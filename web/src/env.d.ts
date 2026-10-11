/// <reference types="vite/client" />

/**
 * 前端环境变量类型声明（方案 §11）。
 * VITE_USE_MOCK：=true 时走纯前端演示模式（见 src/api/http.ts 与 src/api/mock-data.ts），
 * 无需后端 / 数据库即可渲染全部业务页面，便于本地直接预览成果。
 */
interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
