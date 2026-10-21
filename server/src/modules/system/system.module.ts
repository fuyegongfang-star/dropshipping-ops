import { Module } from '@nestjs/common'
import { SystemController } from './system.controller'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import { PrismaModule } from '../../database/prisma.module'
import { ChannelsModule } from '../channels/channels.module'

/**
 * 系统模块（任务 4.4 / 5.4）：承载安全态势与容量灾备诊断等平台级只读接口。
 * SecretEncryptionService 平台共享，PrismaService 经全局 PrismaModule 注入。
 * 容量诊断（§30）需读取 ChannelsModule 的拉单限流守卫实时统计，故导入 ChannelsModule。
 */
@Module({
  imports: [PrismaModule, ChannelsModule],
  controllers: [SystemController],
  providers: [SecretEncryptionService],
  exports: [SecretEncryptionService],
})
export class SystemModule {}
