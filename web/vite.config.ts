import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite 配置（方案 §11）：Vue3 + TS，/api 代理到后端 3000（开发态规避跨域）。
export default defineConfig(({ mode }) => {
  // 加载所有 .env.* / .env 文件，解析 VITE_USE_MOCK 的真实取值（含 .env 默认值）。
  // 注意：Vite 在 config 阶段尚未注入 import.meta.env，需主动 loadEnv。
  const env = loadEnv(mode, process.cwd(), '')
  const useMock = env.VITE_USE_MOCK

  // 生产构建硬性约束（review B3）：禁止把演示模式（mock 假数据）构建上生产。
  // 缺省（未设置）或 true 一律拒绝，避免「假数据整站上线」的事故。
  if (mode === 'production' && useMock !== 'false') {
    throw new Error(
      '[构建拦截] 生产构建必须 VITE_USE_MOCK=false（当前取值为 ' +
        String(useMock ?? '未设置') +
        '）。' +
        '演示模式仅用于本地预览，不得用于生产部署。' +
        '请使用 `npm run build:prod`（自动 VITE_USE_MOCK=false）或显式设置 VITE_USE_MOCK=false 后重试。',
    )
  }

  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
  }
})
