import { UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { OpenApiController } from './openapi.controller'
import { OpenApiGuard } from './openapi.guard'
import { OpenApiService } from './openapi.service'
import { RolesGuard } from '../../common/auth/rbac/roles.guard'
import type { OpenApiClientContext } from './openapi.types'

/** 固定密钥：控制器签发与守卫验签使用同一 secret（与 ConfigService 提供的一致）。 */
const TEST_SECRET = 'test-openapi-secret'

describe('OpenApiController（§28 开放 API 端点）', () => {
  let controller: OpenApiController
  let jwt: JwtService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_SECRET, signOptions: { expiresIn: '1h' } })],
      controllers: [OpenApiController],
      providers: [
        OpenApiService,
        OpenApiGuard,
        RolesGuard,
        { provide: ConfigService, useValue: { get: () => TEST_SECRET } },
      ],
    }).compile()
    controller = module.get(OpenApiController)
    jwt = module.get(JwtService)
  })

  const ctx = (scopes: string[]): OpenApiClientContext => ({
    clientId: 'cli_demo_full',
    tenantId: 't_demo',
    scopes: scopes as OpenApiClientContext['scopes'],
  })

  it('令牌端点：正确凭据返回 Bearer 令牌，且可验签（aud=openapi）', () => {
    // 运行时创建客户端（密钥随机生成，不再依赖源码硬编码种子密钥）
    const created = controller.createClient('t_demo', {
      name: '令牌测试',
      scopes: ['orders', 'quotes', 'tracking', 'bills', 'erp'],
    })
    const client = created.data
    const res = controller.issueToken({
      grant_type: 'client_credentials',
      client_id: client.clientId,
      client_secret: client.clientSecret,
    })
    expect(res.token_type).toBe('Bearer')
    expect(res.expires_in).toBe(3600)
    const payload = jwt.verify(res.access_token)
    expect((payload as { aud: string }).aud).toBe('openapi')
    expect((payload as { sub: string }).sub).toBe(client.clientId)
  })

  it('令牌端点：错误凭据 / 不支持的授权类型 → 401', () => {
    expect(() =>
      controller.issueToken({ grant_type: 'client_credentials', client_id: 'cli_demo_full', client_secret: 'bad' }),
    ).toThrow(UnauthorizedException)
    expect(() =>
      controller.issueToken({ grant_type: 'password' as never, client_id: 'x', client_secret: 'y' }),
    ).toThrow(UnauthorizedException)
  })

  it('/me：返回脱敏客户端画像（不含密钥）', () => {
    const profile = controller.me(ctx(['orders']))
    expect(profile).not.toBeNull()
    expect((profile as { clientSecret?: string }).clientSecret).toBeUndefined()
  })

  it('开放订单：含 orders 作用域 → 返回数据；缺作用域 → 401', () => {
    expect(controller.listOrders(ctx(['orders'])).data.length).toBeGreaterThan(0)
    expect(() => controller.listOrders(ctx(['quotes']))).toThrow(UnauthorizedException)
  })

  it('开放报价：含 quotes 作用域 → 返回报价；缺作用域 → 401', () => {
    const q = controller.quotes(ctx(['quotes']), { weightKg: 2, destCountry: 'US' })
    expect(q.data.length).toBe(3)
    expect(() => controller.quotes(ctx(['orders']), { weightKg: 1 })).toThrow(UnauthorizedException)
  })

  it('ERP 凭证 / 账单 / Webhook：按作用域放行', () => {
    expect(controller.gl(ctx(['erp'])).data.length).toBe(6)
    expect(() => controller.gl(ctx(['orders']))).toThrow(UnauthorizedException)
    expect(controller.bills(ctx(['bills'])).data.length).toBe(3)
    expect(controller.listWebhooks(ctx(['orders'])).data.length).toBe(0)
    const wh = controller.createWebhook(ctx(['orders']), { event: 'order.shipped', url: 'https://x' })
    expect(wh.data.status).toBe('active')
  })

  it('开放守卫：缺令牌/无效令牌/错 aud → 401；有效 → 注入上下文', () => {
    const guard = new OpenApiGuard(jwt)
    const mkCtx = (header: string) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: header } }) }) } as never)
    expect(() => guard.canActivate(mkCtx(''))).toThrow(UnauthorizedException)
    expect(() => guard.canActivate(mkCtx('Bearer not-a-jwt'))).toThrow(UnauthorizedException)
    const wrongAud = jwt.sign({ sub: 'c', tenantId: 't_demo', scopes: [], aud: 'web' }, { secret: TEST_SECRET })
    expect(() => guard.canActivate(mkCtx('Bearer ' + wrongAud))).toThrow(UnauthorizedException)
    const good = jwt.sign({ sub: 'c', tenantId: 't_demo', scopes: ['orders'], aud: 'openapi' }, { secret: TEST_SECRET })
    const req: { headers: { authorization: string }; openApiClient?: unknown } = { headers: { authorization: 'Bearer ' + good } }
    const goodCtx = { switchToHttp: () => ({ getRequest: () => req }) } as never
    expect(guard.canActivate(goodCtx)).toBe(true)
    expect(req.openApiClient).toMatchObject({ clientId: 'c', tenantId: 't_demo' })
  })
})
