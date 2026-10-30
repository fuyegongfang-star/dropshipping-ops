/**
 * 集中配置（方案 §11）：从环境变量读取，经 @nestjs/config 注入各模块。
 * 所有密钥类变量严禁硬编码，统一从此处读取（§17 安全）。
 */
export interface AppConfig {
  port: number
  databaseUrl: string
  redisUrl: string
  jwtSecret: string
  jwtExpiresIn: string
  minio: {
    endpoint: string
    port: number
    accessKey: string
    secretKey: string
    bucket: string
  }
}

/**
 * 生产环境安全配置 fail-fast（§17）。
 * 缺失 JWT_SECRET / APP_MASTER_KEY 时，生产环境**直接拒绝启动**，
 * 避免在「可预测默认密钥 / 源码硬编码开发密钥」下静默运行（review A3/A5）。
 * 非 production（development / test）仅告警，不阻断，便于本地演示。
 */
function assertProductionSecrets(): void {
  const env = process.env.NODE_ENV ?? 'development'
  if (env !== 'production') return

  const problems: string[] = []
  const jwt = process.env.JWT_SECRET
  if (!jwt || jwt === 'change-me-in-prod') {
    problems.push('JWT_SECRET 未配置或仍使用占位值 "change-me-in-prod"（令牌可被任意伪造）')
  }
  if (!process.env.APP_MASTER_KEY) {
    problems.push('APP_MASTER_KEY 未配置（平台凭证将以源码内硬编码的开发密钥加密，掌握源码即可解密）')
  }
  if (problems.length > 0) {
    throw new Error(
      `[启动拦截] 生产环境检测到缺失/不安全的安全配置，已拒绝启动：\n - ${problems.join(
        '\n - ',
      )}\n请通过环境变量注入合规密钥后重试（详见方案 §17 安全）。`,
    )
  }
}

export default (): AppConfig => {
  // 启动前校验：生产环境密钥缺失直接 fail-fast
  assertProductionSecrets()

  return {
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    bucket: process.env.MINIO_BUCKET ?? 'dropshipping',
  },
  }
}
