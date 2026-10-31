/**
 * 平台凭证管理控制器单元测试（任务 8.2）。
 * 覆盖：列表脱敏/全平台展示、查看解密、写入加密落库、删除、未知平台拒绝。
 * 不依赖数据库，使用真实 SecretEncryptionService + 内存存储端口。
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
import { PlatformCredentialsController } from './platform-credentials.controller'
import { PlatformKind } from './platform-credentials.constants'
import { SaveCredentialDto } from './dtos/save-credential.dto'

describe('PlatformCredentialsController', () => {
  let controller: PlatformCredentialsController
  let service: PlatformCredentialService
  const TENANT = 't_ctrl'

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformCredentialsController],
      providers: [
        SecretEncryptionService,
        { provide: CREDENTIAL_STORE, useClass: InMemoryCredentialStore },
        PlatformCredentialService,
        PlatformAdapterFactory,
      ],
    }).compile()
    controller = moduleRef.get(PlatformCredentialsController)
    service = moduleRef.get(PlatformCredentialService)
  })

  it('list 返回全部平台且未配置项 status=empty', async () => {
    service.setCredential(TENANT, PlatformKind.DHL, { apiKey: 'k', apiSecret: 's' })
    const res = await controller.list(TENANT)
    const items = res.data as unknown as { platform: string; status: string }[]
    expect(items.length).toBeGreaterThanOrEqual(6)
    const dhl = items.find((i) => i.platform === PlatformKind.DHL)
    expect(dhl?.status).toBe('configured')
    const taobao = items.find((i) => i.platform === PlatformKind.TAOBAO)
    expect(taobao?.status).toBe('empty')
  })

  it('get 解密返回明文凭证', async () => {
    service.setCredential(TENANT, PlatformKind.DOUYIN, { appKey: 'a', appSecret: 'b' })
    const res = await controller.get(TENANT, PlatformKind.DOUYIN)
    expect((res.data as { fields: Record<string, string> }).fields).toEqual({
      appKey: 'a',
      appSecret: 'b',
    })
  })

  it('get 缺失凭证抛 PLATFORM_CREDENTIAL_MISSING', async () => {
    let err: BusinessException | undefined
    try {
      await controller.get(TENANT, PlatformKind.TAOBAO)
    } catch (e) {
      err = e as BusinessException
    }
    expect(err?.bizCode).toBe('PLATFORM_CREDENTIAL_MISSING')
  })

  it('save 加密落库并返回绑定描述符', async () => {
    const dto = new SaveCredentialDto()
    dto.platform = PlatformKind.DHL
    dto.fields = { apiKey: 'k', apiSecret: 's' }
    const res = await controller.save(TENANT, dto)
    const data = res.data as { status: string; binding: { status: string } }
    expect(data.status).toBe('configured')
    expect(data.binding.status).toBe('scaffold-todo')
    expect(service.hasCredential(TENANT, PlatformKind.DHL)).toBe(true)
  })

  it('remove 后凭证不可读', async () => {
    service.setCredential(TENANT, PlatformKind.DHL, { apiKey: 'k', apiSecret: 's' })
    await controller.remove(TENANT, PlatformKind.DHL)
    expect(service.hasCredential(TENANT, PlatformKind.DHL)).toBe(false)
  })

  it('未知平台拒绝（list/get/save/remove 均校验 platform）', async () => {
    const bad = 'nope' as PlatformKind
    await expect(controller.get(TENANT, bad)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    })
    const dto = new SaveCredentialDto()
    dto.platform = bad
    dto.fields = {}
    await expect(controller.save(TENANT, dto)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    })
  })
})
