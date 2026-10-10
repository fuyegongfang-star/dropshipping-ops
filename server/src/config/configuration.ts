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

export default (): AppConfig => ({
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
})
