import { Module } from '@nestjs/common'
import { SystemController } from './system.controller'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import { PrismaModule } from '../../database/prisma.module'

/**
 * 系统模块（任务 4.4）：承载安全态势诊断等平台级只读接口。
 * SecretEncryptionService 平台共享，PrismaService 经全局 PrismaModule 注入。
 */
@Module({
  imports: [PrismaModule],
  controllers: [SystemController],
  providers: [SecretEncryptionService],
  exports: [SecretEncryptionService],
})
export class SystemModule {}
