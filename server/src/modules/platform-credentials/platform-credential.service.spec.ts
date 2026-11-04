/**
 * 平台凭证服务单元测试（任务 8.1 / 11.1）。
 *
 * 覆盖：加密落库不存明文、读取解密还原、缺失凭证抛错、必填校验、列表/删除、工厂描述符与客户端配置补全网关。
 * 使用真实 SecretEncryptionService + 内存存储端口，不依赖数据库。
 * 注：凭证存储端口统一异步（11.1 下沉 Prisma），本测试相应 await。
 */

import { Test } from '@nestjs/testing'
import { HttpStatus } from '@nestjs/common'
import { BusinessException } from '../../common/response/business.exception'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import {
  CREDENTIAL_STORE,
  InMemoryCredentialStore,
} from './credential-store.port'
import { PlatformCredentialService } from './platform-credential.service'
import { PlatformAdapterFactory } from './platform-adapter.factory'
import {
  PlatformKind,
  PLATFORM_META,
} from './platform-credentials.constants'

describe('PlatformCredentialService', () => {
  let service: PlatformCredentialService
  let factory: PlatformAdapterFactory
  let store: InMemoryCredentialStore

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecretEncryptionService,
        { provide: CREDENTIAL_STORE, useClass: InMemoryCredentialStore },
        PlatformCredentialService,
        PlatformAdapterFactory,
      ],
    }).compile()
    service = moduleRef.get(PlatformCredentialService)
    factory = moduleRef.get(PlatformAdapterFactory)
    store = moduleRef.get(CREDENTIAL_STORE)
  })

  it('写入后读取可还原结构化凭证', async () => {
    const cred = { appKey: 'ak', appSecret: 'sk' }
    await service.setCredential('t1', PlatformKind.TAOBAO, cred)
    expect(await service.getCredential('t1', PlatformKind.TAOBAO)).toEqual(cred)
    expect(await service.hasCredential('t1', PlatformKind.TAOBAO)).toBe(true)
  })

  it('明文绝不入库（存储中仅为加密 token）', async () => {
    const cred = { appKey: 'ak', appSecret: 'sk' }
    await service.setCredential('t1', PlatformKind.TAOBAO, cred)
    const raw = await store.get('t1', PlatformKind.TAOBAO)
    expect(raw).toBeDefined()
    // 结构化明文（含字段名）绝不出现在密文中；避免对短子串(base64 偶发命中)做脆弱断言
    expect(raw!.encryptedPayload).not.toContain(JSON.stringify(cred))
    expect(raw!.encryptedPayload).not.toContain('appSecret')
    expect(raw!.encryptedPayload).not.toContain('appKey')
  })

  it('缺失凭证抛 PLATFORM_CREDENTIAL_MISSING', async () => {
    let err: BusinessException | undefined
    try {
      await service.getCredential('ghost', PlatformKind.DOUYIN)
    } catch (e) {
      err = e as BusinessException
    }
    expect(err).toBeInstanceOf(BusinessException)
    expect(err!.bizCode).toBe('PLATFORM_CREDENTIAL_MISSING')
    expect(err!.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('必填字段缺失抛 PLATFORM_CREDENTIAL_INCOMPLETE', async () => {
    let err: BusinessException | undefined
    try {
      await service.setCredential('t1', PlatformKind.YUNEXPRESS, { appId: 'a' } as never)
    } catch (e) {
      err = e as BusinessException
    }
    expect(err).toBeInstanceOf(BusinessException)
    expect(err!.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('listPlatforms 仅返回已配置平台', async () => {
    await service.setCredential('t1', PlatformKind.DOUYIN, { appKey: 'a', appSecret: 'b' })
    await service.setCredential('t1', PlatformKind.DHL, { apiKey: 'k', apiSecret: 's' })
    expect((await service.listPlatforms('t1')).sort()).toEqual(
      [PlatformKind.DHL, PlatformKind.DOUYIN].sort(),
    )
    expect(await service.listPlatforms('other')).toEqual([])
  })

  it('removeCredential 后不可读', async () => {
    await service.setCredential('t1', PlatformKind.TAOBAO, { appKey: 'a', appSecret: 'b' })
    await service.removeCredential('t1', PlatformKind.TAOBAO)
    expect(await service.hasCredential('t1', PlatformKind.TAOBAO)).toBe(false)
  })

  it('工厂：describe 返回平台元信息与默认网关', () => {
    const meta = factory.describe(PlatformKind.YUNEXPRESS)
    expect(meta.authType).toBe(PLATFORM_META[PlatformKind.YUNEXPRESS].authType)
    expect(meta.defaultGateway).toContain('yunexpress')
  })

  it('工厂：createClientConfig 补全默认网关', () => {
    const cfg = factory.createClientConfig(PlatformKind.DHL, { apiKey: 'k', apiSecret: 's' })
    expect(cfg.gateway).toContain('dhl.com')
  })

  it('工厂：resolveAdapter 产出 scaffold-todo 描述符', async () => {
    const desc = await factory.resolveAdapter(PlatformKind.DOUYIN, 't1')
    expect(desc.status).toBe('scaffold-todo')
    expect(desc.capabilities).toContain('pull')
  })
})
