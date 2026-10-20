#!/usr/bin/env node
/**
 * 开发进度生成器（零依赖，Node 标准库）。
 *
 * 用途：解析 `dev-schedule.md` 的任务表，生成前端可消费的静态进度数据
 * `web/src/api/dev-progress.ts`，从而保证：
 *   1. 「演示模式」与「正式模式」下前端都能直接读到同一份进度（无需后端接口）；
 *   2. 夜间自动开发每完成一批任务后运行本脚本，**次日用户刷新网页即可看到新增能力**。
 *
 * 用法：`npm run progress:gen`（项目根目录）
 *
 * 设计约束：仅读取 markdown + 写一个 .ts 文件，不访问网络、不修改其他文件，
 * 因此可安全地在看门狗重试器内重复执行（幂等）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCHEDULE = path.join(ROOT, 'dev-schedule.md');
const OUT = path.join(ROOT, 'web', 'src', 'api', 'dev-progress.ts');

/** 状态图例 → 前端枚举值 */
const STATUS_MAP = {
  '⬜': 'todo',
  '🔵': 'doing',
  '✅': 'done',
  '⛔': 'blocked',
  '⏭️': 'skipped',
};

/** 任务号 → 前端页面路由（已完成能力对应「去查看」入口）。 */
const EXPLICIT_ROUTES = {
  '1.2': '/channels',
  '1.3': '/orders',
  '1.4': '/orders',
  '1.7': '/catalog',
  '3.6': '/pricing',
  '3.7': '/quotes',
  '3.12': '/address',
  '3.13': '/aggregator',
  '4.1': '/wallet',
  '4.2': '/billing',
  '4.3': '/profit',
  '4.4': '/security',
  '4.5': '/rbac',
  '4.6': '/pricing',
  '4.7': '/reports',
  '4.8': '/claims',
  '4.9': '/localization',
  '5.1': '/risk',
};

/** 关键词 → 路由（兜底推断，命中即用）。 */
const KEYWORD_ROUTES = [
  [['加价', '币种', '汇率', '定价规则'], '/pricing'],
  [['比价', '试算', '报价', '运费'], '/quotes'],
  [['承运商', '云途', 'DHL', '4PX', '燕文', '物流'], '/carriers'],
  [['商品', 'SKU', 'sku', '货品'], '/catalog'],
  [['渠道', '店铺', 'Shopify', 'Amazon', '平台接入'], '/channels'],
  [['订单', '审单', '状态机', '履约', '轨迹'], '/orders'],
  [['租户', '多租户'], '/tenants'],
  [['报表', '看板', '指标', '运营报表'], '/reports'],
  [['理赔', '保险', '索赔', '异常件'], '/claims'],
  [['语言', '多语言', '币种', '本地币', 'i18n', '本地化'], '/localization'],
  [['风控', '风险', '黑名单', '欺诈', '刷单', '评分', '规则引擎'], '/risk'],
];

function inferRoute(id, name, deliverable) {
  if (EXPLICIT_ROUTES[id]) return EXPLICIT_ROUTES[id];
  const text = `${name} ${deliverable}`;
  for (const [keywords, route] of KEYWORD_ROUTES) {
    if (keywords.some((k) => text.includes(k))) return route;
  }
  return null;
}

/** 读取当前提交短 SHA：先试 git 命令，失败则回退直接读 .git 元数据（沙箱/精简 PATH 下更稳）。 */
function readGitHead() {
  try {
    const out = execSync('git rev-parse --short HEAD', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out;
  } catch {
    /* 回退到文件读取 */
  }
  try {
    const gitDir = path.join(ROOT, '.git');
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (head.startsWith('ref:')) {
      const ref = head.slice(4).trim();
      const sha = fs.readFileSync(path.join(gitDir, ref), 'utf8').trim();
      if (sha) return sha.slice(0, 7);
    }
    if (/^[0-9a-f]{7,40}$/i.test(head)) return head.slice(0, 7);
  } catch {
    /* 非 git 仓库，忽略 */
  }
  return '';
}

/** 解析任务表：`| 3.7 | 阶段3 | 任务名 | 产出 | 依赖 | 预估 | ✅ |` */
function parseTasks(md) {
  const tasks = [];
  const lineRe = /^\|\s*(\d+\.\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|\s*([^|]*?)\s*\|\s*$/;
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (!m) continue;
    const [, id, phase, name, deliverable, deps, estimate, rawStatus] = m;
    // 状态列可能形如「✅」或「✅ 备注」；取首个图例字符。
    let status = 'todo';
    for (const [icon, value] of Object.entries(STATUS_MAP)) {
      if (rawStatus.includes(icon)) {
        status = value;
        break;
      }
    }
    const clean = (s) => s.replace(/\s+/g, ' ').trim();
    tasks.push({
      id: clean(id),
      phase: clean(phase),
      name: clean(name),
      deliverable: clean(deliverable),
      deps: clean(deps),
      estimate: clean(estimate),
      status,
      route: inferRoute(clean(id), clean(name), clean(deliverable)),
    });
  }
  return tasks;
}

/** 版本号比较（3.10 > 3.9），用于「最近交付」排序。 */
function compareId(a, b) {
  const na = a.split('.').map(Number);
  const nb = b.split('.').map(Number);
  return na[0] - nb[0] || na[1] - nb[1];
}

function build(tasks) {
  const done = tasks.filter((t) => t.status === 'done');
  const recentIds = done
    .slice()
    .sort((a, b) => compareId(b.id, a.id))
    .slice(0, 4)
    .map((t) => t.id)
    .sort(compareId);

  const stats = {
    total: tasks.length,
    done: done.length,
    doing: tasks.filter((t) => t.status === 'doing').length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    skipped: tasks.filter((t) => t.status === 'skipped').length,
    percent: tasks.length ? Math.round((done.length / tasks.length) * 1000) / 10 : 0,
  };

  const phases = [...new Set(tasks.map((t) => t.phase))];

  const header = `/**
 * 开发进度数据 —— **本文件由 scripts/gen-progress.cjs 自动生成，请勿手工修改。**
 *
 * 生成命令：\`npm run progress:gen\`（读取 dev-schedule.md 的任务表）
 * 生成时间：${new Date().toISOString()}
 * 源码提交：${readGitHead() || '(未初始化 git)'}
 *
 * 作用：让「演示模式」与「正式模式」都能在网页上直接看到开发进度与最近交付的能力，
 * 夜间自动开发每完成一批任务后重新生成并提交，次日刷新页面即可看到新内容。
 */
`;

  const body = `
export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'skipped'

export interface DevTask {
  /** 任务号，如 '3.7' */
  id: string
  /** 所属阶段，如 '阶段3' */
  phase: string
  /** 任务名称 */
  name: string
  /** 关键产出 / 方案章节 */
  deliverable: string
  /** 依赖任务号 */
  deps: string
  /** 预估工期 */
  estimate: string
  /** 状态 */
  status: TaskStatus
  /** 对应前端页面路由（null 表示暂无界面，为纯后端能力） */
  route: string | null
}

export interface DevStats {
  total: number
  done: number
  doing: number
  todo: number
  blocked: number
  skipped: number
  /** 完成率（百分比，保留 1 位小数） */
  percent: number
}

/** 数据生成时间（ISO 字符串） */
export const DEV_PROGRESS_GENERATED_AT = ${JSON.stringify(new Date().toISOString())}

/** 数据对应的源码提交号（短 SHA） */
export const DEV_PROGRESS_COMMIT = ${JSON.stringify(readGitHead())}

/** 全部任务（按 dev-schedule.md 顺序） */
export const DEV_TASKS: DevTask[] = ${JSON.stringify(tasks, null, 2)}

/** 统计汇总 */
export const DEV_STATS: DevStats = ${JSON.stringify(stats, null, 2)}

/** 阶段列表（去重，按出现顺序） */
export const DEV_PHASES = ${JSON.stringify(phases)}

/** 最近交付的任务号（已完成中序号最大的若干个），用于「最近更新」高亮 */
export const DEV_RECENT_IDS = ${JSON.stringify(recentIds)}
`;

  return header + body;
}

function main() {
  if (!fs.existsSync(SCHEDULE)) {
    console.error('[progress:gen] 找不到 dev-schedule.md：' + SCHEDULE);
    process.exit(1);
  }
  const md = fs.readFileSync(SCHEDULE, 'utf8');
  const tasks = parseTasks(md);
  if (tasks.length === 0) {
    console.error('[progress:gen] 未从 dev-schedule.md 解析到任何任务，请检查表格格式。');
    process.exit(1);
  }
  const out = build(tasks);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out, 'utf8');
  const stats = JSON.parse(out.match(/export const DEV_STATS: DevStats = (\{[\s\S]*?\})/)[1]);
  console.log(
    `[progress:gen] 已生成 ${path.relative(ROOT, OUT)}：` +
      `共 ${stats.total} 任务，完成 ${stats.done}（${stats.percent}%），` +
      `进行中 ${stats.doing}，待开始 ${stats.todo}，受阻 ${stats.blocked}，跳过 ${stats.skipped}`,
  );
}

main();
