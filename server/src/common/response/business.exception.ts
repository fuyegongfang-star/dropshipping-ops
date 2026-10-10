import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * 业务异常（方案 §31：统一异常）。
 * 携带业务错误码 bizCode，由全局过滤器转为统一响应结构。
 * 用法：throw new BusinessException('ORDER_NOT_FOUND', '订单不存在', HttpStatus.NOT_FOUND)
 */
export class BusinessException extends HttpException {
  public readonly bizCode: string

  constructor(
    bizCode: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, status)
    this.bizCode = bizCode
  }
}
