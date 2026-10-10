import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Response } from 'express'
import { fail } from './api-response'
import { BusinessException } from './business.exception'

/**
 * 全局异常过滤器（方案 §31：统一响应/异常）。
 * 将 BusinessException / HttpException / 未知异常统一封装为 ApiResponse。
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>()

    // 业务异常：保留业务错误码
    if (exception instanceof BusinessException) {
      const status = (exception as HttpException).getStatus()
      res
        .status(status)
        .json(fail(exception.message, status, { bizCode: exception.bizCode }))
      return
    }

    // HTTP 异常（含 class-validator 校验错误）
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const msg =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] })?.message ?? exception.message)
      res
        .status(status)
        .json(fail(Array.isArray(msg) ? msg.join('; ') : String(msg), status))
      return
    }

    // 兜底：未知异常按 500 返回（生产应记录堆栈并告警，§24）
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fail('内部错误', HttpStatus.INTERNAL_SERVER_ERROR))
  }
}
