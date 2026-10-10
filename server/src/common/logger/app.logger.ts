import { Logger, LoggerService } from '@nestjs/common'

/**
 * 统一日志封装（方案 §31：统一日志）。
 * 提供带上下文的结构化日志，后续可无缝接入 Loki/ELK（§24 可观测性）。
 */
export class AppLogger implements LoggerService {
  private readonly logger = new Logger()

  log(message: string, context?: string): void {
    this.logger.log(message, context)
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, trace, context)
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, context)
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, context)
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, context)
  }
}
