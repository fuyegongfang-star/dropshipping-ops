/**
 * 平台凭证模块（任务 NEXT-1，方案 §2.2/§17.2）。
 *
 * 仅注册本模块自洽的 Provider：凭证服务、适配器工厂、以及内存版凭证存储端口。
 * 真实持久化（Prisma）实现为 TODO：届时替换 CREDENTIAL_STORE 绑定即可，上层无需改动。
 * 当前为纯新增模块，不改动任何既有模块/测试，保证既有 363 单测不受影响。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-29 夜间批次
 */

import { Module } from '@nestjs/common'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import {
  CREDENTIAL_STORE,
  InMemoryCredentialStore,
} from './credential-store.port'
import { PlatformCredentialService } from './platform-credential.service'
import { PlatformAdapterFactory } from './platform-adapter.factory'
import { PlatformCredentialsController } from './platform-credentials.controller'

@Module({
  providers: [
    SecretEncryptionService,
    { provide: CREDENTIAL_STORE, useClass: InMemoryCredentialStore },
    PlatformCredentialService,
    PlatformAdapterFactory,
  ],
  controllers: [PlatformCredentialsController],
  exports: [PlatformCredentialService, PlatformAdapterFactory],
})
export class PlatformCredentialsModule {}
