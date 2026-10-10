import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma 单例服务（方案 §11）。
 * 全仓通过此服务访问数据库；连接在服务初始化时建立。
 * 注意：@prisma/client 需先执行 `npm run prisma:generate` 生成。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }
}
