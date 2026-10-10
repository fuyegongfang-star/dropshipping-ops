import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './common/response/response.filter'

/**
 * 应用入口（方案 §11）。
 * 关键装配：全局前缀 /api、CORS、DTO 校验管道、全局异常过滤器（统一响应结构）。
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api') // 所有接口以 /api 开头，便于网关路由
  app.enableCors() // 跨域：前端独立部署时需要；生产按白名单收紧（§17）
  // 校验管道：自动校验并转换 DTO，whitelist 剔除多余字段，防越权注入
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }),
  )
  // 全局异常过滤器：所有异常统一封装为 ApiResponse 结构（§31 统一响应）
  app.useGlobalFilters(new GlobalExceptionFilter())

  const port = parseInt(process.env.PORT ?? '3000', 10)
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`[dropshipping-ops] server listening on :${port} (api prefix: /api)`)
}

void bootstrap()
