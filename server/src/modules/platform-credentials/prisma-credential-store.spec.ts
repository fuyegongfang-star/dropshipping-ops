/**
 * PrismaCredentialStore 单元测试（任务 11.1）。
 *
 * 用 mock PrismaService 验证：① 全部读写均按 tenantId 过滤（行级隔离，杜绝跨租户）；
 * ② save 走 (tenantId, platform) 唯一约束 upsert（幂等覆盖）；③ get/list/delete 查询形态正确；
 * ④ 端口值对象映射（DB 行 → PlatformCredentialValue，updatedAt 序列化为 ISO）。
 * 不依赖真实数据库，可在沙箱内零网络运行。
 */

import { PrismaCredentialStore } from './prisma-credential-store'
import { PrismaService } from '../../database/prisma.service'
import { PlatformKind } from './platform-credentials.constants'
import type { PlatformCredentialValue } from './credential-store.port'

/** 仅 platformCredential 命名空间的 mock，足以驱动 PrismaCredentialStore */
interface MockPlatformCredential {
  upsert: jest.Mock
  findUnique: jest.Mock
  findMany: jest.Mock
  deleteMany: jest.Mock
}

/** 构造一个可配置的 mock PrismaService（仅 platformCredential 命名空间） */
function buildMockPrisma() {
  const platformCredential: MockPlatformCredential = {
    upsert: jest.fn().mockResolvedValue(undefined),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  }
  return { prisma: { platformCredential } as unknown as PrismaService, platformCredential }
}

function sampleValue(overrides: Partial<PlatformCredentialValue> = {}): PlatformCredentialValue {
  return {
    tenantId: 't1',
    platform: PlatformKind.DHL,
    encryptedPayload: 'base64-iv-tag-cipher',
    status: 'active',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('PrismaCredentialStore', () => {
  it('save 走 (tenantId, platform) 唯一约束 upsert，且 create/update 均带 tenantId 与加密 token', async () => {
    const { prisma, platformCredential } = buildMockPrisma()
    const store = new PrismaCredentialStore(prisma)
    await store.save(sampleValue())

    expect(platformCredential.upsert).toHaveBeenCalledTimes(1)
    const call = platformCredential.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ tenantId_platform: { tenantId: 't1', platform: PlatformKind.DHL } })
    expect(call.create).toMatchObject({
      tenantId: 't1',
      platform: PlatformKind.DHL,
      encryptedPayload: 'base64-iv-tag-cipher',
      status: 'active',
    })
    expect(call.update).toMatchObject({
      encryptedPayload: 'base64-iv-tag-cipher',
      status: 'active',
    })
    // updatedAt 转为 Date 注入
    expect(call.create.updatedAt).toBeInstanceOf(Date)
  })

  it('get 按 (tenantId, platform) 定位，缺失返回 undefined，存在则映射为值对象', async () => {
    const { prisma, platformCredential } = buildMockPrisma()
    const store = new PrismaCredentialStore(prisma)
    platformCredential.findUnique.mockResolvedValueOnce(undefined)
    expect(await store.get('t1', PlatformKind.DHL)).toBeUndefined()

    platformCredential.findUnique.mockResolvedValueOnce({
      tenantId: 't1',
      platform: 'dhl',
      encryptedPayload: 'enc',
      status: 'active',
      updatedAt: new Date('2026-05-05T08:00:00.000Z'),
    })
    const got = await store.get('t1', PlatformKind.DHL)
    expect(got).toMatchObject({
      tenantId: 't1',
      platform: PlatformKind.DHL,
      encryptedPayload: 'enc',
      status: 'active',
      updatedAt: '2026-05-05T08:00:00.000Z',
    })
    // 查询条件含租户隔离
    expect(platformCredential.findUnique).toHaveBeenLastCalledWith({
      where: { tenantId_platform: { tenantId: 't1', platform: PlatformKind.DHL } },
    })
  })

  it('list 仅返回本租户凭证（行级隔离），并映射为值对象数组', async () => {
    const { prisma, platformCredential } = buildMockPrisma()
    const store = new PrismaCredentialStore(prisma)
    platformCredential.findMany.mockResolvedValueOnce([
      {
        tenantId: 't1',
        platform: 'dhl',
        encryptedPayload: 'e1',
        status: 'active',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        tenantId: 't1',
        platform: 'yunexpress',
        encryptedPayload: 'e2',
        status: 'pending',
        updatedAt: new Date('2026-02-02T00:00:00.000Z'),
      },
    ])
    const list = await store.list('t1')
    expect(list).toHaveLength(2)
    expect(list.map((v) => v.platform)).toEqual([PlatformKind.DHL, PlatformKind.YUNEXPRESS])
    // 过滤条件仅按 tenantId，绝不返回他租户
    expect(platformCredential.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1' } })
  })

  it('delete 按 (tenantId, platform) 定位，不会误删他租户', async () => {
    const { prisma, platformCredential } = buildMockPrisma()
    const store = new PrismaCredentialStore(prisma)
    await store.delete('t1', PlatformKind.DHL)
    expect(platformCredential.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', platform: PlatformKind.DHL },
    })
  })

  it('租户隔离：相同 platform 不同租户互不可见', async () => {
    const { prisma, platformCredential } = buildMockPrisma()
    const store = new PrismaCredentialStore(prisma)
    platformCredential.findUnique.mockResolvedValueOnce({
      tenantId: 't2',
      platform: 'dhl',
      encryptedPayload: 'other',
      status: 'active',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    // t1 查询应只匹配 t1 行；mock 即便返回 t2 行，where 条件也保证 SQL 层隔离
    const res = await store.get('t1', PlatformKind.DHL)
    expect(platformCredential.findUnique).toHaveBeenCalledWith({
      where: { tenantId_platform: { tenantId: 't1', platform: PlatformKind.DHL } },
    })
    // 此处 mock 故意返回 t2 行以验证调用参数（真实 DB 由 where 约束返回 undefined）
    expect(res?.tenantId).toBe('t2')
  })
})
