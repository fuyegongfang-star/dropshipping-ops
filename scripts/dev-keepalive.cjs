#!/usr/bin/env node
/**
 * dev-keepalive.cjs —— 一件代发 Web 本地服务保活守护
 *
 * 同时拉起 vite dev(5173) 与 vite preview(4173)；任一进程异常退出即在 3s 后自动重启。
 * 端口若已被占用（例如其它实例已在运行）则跳过该服务，避免重复绑定冲突。
 * preview 依赖 web/dist 构建产物：未构建时跳过并每 60s 复查，待 build 后自动接管。
 *
 * 用法：
 *   node scripts/dev-keepalive.cjs        # 前台常驻（Ctrl+C 退出并回收子进程）
 *   npm run serve                         # 同上（在 web 目录下执行）
 * 亦可由 Windows 计划任务（登录时）或 scripts/start-web.bat 调用，实现开机自启。
 */
const { spawn } = require('child_process')
const net = require('net')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..') // dropshipping-ops
const WEB = path.join(ROOT, 'web')
const NODE = process.execPath // 当前 node 绝对路径，避免依赖 PATH（计划任务环境下 PATH 常缺 node）
// vite 可能被 npm workspaces 提升到根 node_modules，故按候选路径解析，优先 web 本地、回退根目录。
const VITE_CANDIDATES = [
  path.join(WEB, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
]
const VITE = VITE_CANDIDATES.find((p) => fs.existsSync(p)) || null
const LOG = path.join(ROOT, '.dev', 'keepalive.log')
fs.mkdirSync(path.dirname(LOG), { recursive: true })

function log(...a) {
  const line = `[${new Date().toISOString()}] ${a.map(String).join(' ')}`
  console.log(line)
  try {
    fs.appendFileSync(LOG, line + '\n')
  } catch (_) {
    /* 日志写入失败不影响保活逻辑 */
  }
}

/**
 * 探测端口是否被占用：vite 默认绑 IPv6 [::1]，故先试 ::1 再试 127.0.0.1，
 * 任一连通即视为占用（规避 curl 127.0.0.1 误报“连不上”的假阴性）。
 */
function portInUse(port) {
  function probe(host) {
    return new Promise((resolve) => {
      const s = net.connect(port, host)
      s.setTimeout(1000)
      s.once('connect', () => {
        s.destroy()
        resolve(true)
      })
      s.once('error', () => {
        s.destroy()
        resolve(false)
      })
      s.once('timeout', () => {
        s.destroy()
        resolve(false)
      })
    })
  }
  return probe('::1').then((a) => (a ? true : probe('127.0.0.1')))
}

const SERVICES = [
  { name: 'dev', title: 'dev(5173)', port: 5173, args: [VITE], needDist: false },
  { name: 'preview', title: 'preview(4173)', port: 4173, args: [VITE, 'preview'], needDist: true },
]

const procs = new Map() // name -> child
const cooldown = new Map() // name -> 下次允许尝试启动的时间戳
let running = true

function startService(svc) {
  log(`▶ 启动 ${svc.title} ...`)
  const child = spawn(NODE, svc.args, {
    cwd: WEB,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    windowsHide: true,
  })
  child.stdout.on('data', (d) => {
    const t = d.toString().trim()
    if (t) log(`[${svc.title}] ${t}`)
  })
  child.stderr.on('data', (d) => {
    const t = d.toString().trim()
    if (t) log(`[${svc.title}/err] ${t}`)
  })
  child.on('exit', (code, signal) => {
    procs.delete(svc.name)
    if (!running) return
    log(`⚠️ ${svc.title} 退出 code=${code} signal=${signal}，3s 后重启`)
    setTimeout(() => {
      if (running) tryStart(svc)
    }, 3000)
  })
  procs.set(svc.name, child)
}

async function tryStart(svc) {
  if (!running) return
  const now = Date.now()
  // 仍在冷却期内：稍后复查（用于 preview 缺 dist 的慢轮询）
  if (cooldown.has(svc.name) && now < cooldown.get(svc.name)) {
    setTimeout(() => {
      if (running) tryStart(svc)
    }, 5000)
    return
  }
  // preview 需要 web/dist；未构建则进入 60s 冷却，避免无 dist 时频繁重启刷日志
  if (svc.needDist && !fs.existsSync(path.join(WEB, 'dist'))) {
    cooldown.set(svc.name, now + 60000)
    log(`⏸ ${svc.title} 需要 web/dist 构建产物，暂未构建，60s 后复查`)
    setTimeout(() => {
      if (running) tryStart(svc)
    }, 61000)
    return
  }
  const inUse = await portInUse(svc.port)
  if (inUse) {
    log(`ℹ️ ${svc.title} 端口 ${svc.port} 已被占用，跳过（由已在运行实例托管）`)
    return
  }
  startService(svc)
}

function shutdown() {
  if (!running) return
  running = false
  log('■ 收到退出信号，正在回收子服务 ...')
  for (const [, child] of procs) {
    try {
      child.kill('SIGTERM')
    } catch (_) {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 1500)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main() {
  log('=== dev-keepalive 启动 ===')
  if (!VITE) {
    log('✖ 未找到 vite，请先安装依赖（根目录或 web 目录执行 npm install）')
    process.exit(1)
  }
  for (const svc of SERVICES) await tryStart(svc)
  log('✓ 守护就位：已启动/接管的服务将由本进程保活；按 Ctrl+C 停止')
}
main()
