/**
 * 平台凭证模块（任务 8.1 / 11.1，方案 §2.2/§17.2）。
 *
 * 注册本模块自洽的 Provider：凭证服务、适配器工厂、桥接服务，以及**落库 PostgreSQL
 * 的凭证存储端口 PrismaCredentialStore**（2026-11-03 夜间批次由内存版下沉至此）。
 * InMemoryCredentialStore 仍保留，供单测以 CREDENTIAL_STORE 覆盖绑定使用，上层服务零改动。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-29 夜间批次，2026-11-03 凭证持久化
 */

import { Module } from '@nestjs/common'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import {
  CREDENTIAL_STORE,
  InMemoryCredentialStore,
} from './credential-store.port'
import { PrismaCredentialStore } from './prisma-credential-store'
import { PlatformCredentialService } from './platform-credential.service'
import { PlatformAdapterFactory } from './platform-adapter.factory'
import { PlatformIntegrationBridgeService } from './integration-bridge.service'
import { PlatformCredentialsController } from './platform-credentials.controller'
// 桥接需要读取承运商/渠道注册表，故引入两模块（与 AppModule 同构，无循环依赖）。
import { CarriersModule } from '../carriers/carriers.module'
import { ChannelsModule } from '../channels/channels.module'

@Module({
  imports: [CarriersModule, ChannelsModule],
  providers: [
    SecretEncryptionService,
    // 生产存储：Prisma 落库 + 租户隔离（替换原进程级内存实现）。
    { provide: CREDENTIAL_STORE, useClass: PrismaCredentialStore },
    PlatformCredentialService,
    PlatformAdapterFactory,
    PlatformIntegrationBridgeService,
  ],
  controllers: [PlatformCredentialsController],
  exports: [PlatformCredentialService, PlatformAdapterFactory, PlatformIntegrationBridgeService],
})
export class PlatformCredentialsModule {
  /**
   * InMemoryCredentialStore 仍导出，便于单测模块以
   * `{ provide: CREDENTIAL_STORE, useClass: InMemoryCredentialStore }` 覆盖绑定。
   */
  static readonly MemoryStore = InMemoryCredentialStore
}
