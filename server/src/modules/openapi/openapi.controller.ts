import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { OpenApiGuard } from './openapi.guard'
import { OpenApiClient } from './openapi-client.decorator'
import { OpenApiService } from './openapi.service'
import {
  ApiClient,
  CreateApiClientDto,
  CreateWebhookDto,
  GlVoucherEntry,
  OAuthTokenResponse,
  OpenApiClientContext,
  OpenBill,
  OpenOrder,
  OpenQuote,
  OpenApiSummary,
  TokenRequestDto,
  WebhookSubscription,
} from './openapi.types'

/**
 * 开放平台控制器（任务 5.2，方案 §28 开放 API 与生态集成）。
 *
 * 分为三类入口：
 *  1. 令牌端点 `/openapi/oauth/token`：OAuth2 client_credentials 换取 Bearer 令牌（无需鉴权）。
 *  2. 受保护资源（@UseGuards(OpenApiGuard)）：订单/报价/账单/ERP 凭证/Webhook，按作用域隔离。
 *  3. 平台侧客户端管理（`/openapi/clients`，复用 JWT 用户鉴权）。
 *
 * 返回类型交由 ok<T>() 推断为 ApiResponse<T>（与全仓统一响应 §31）。
 */
@Controller('openapi')
export class OpenApiController {
  /** 开放令牌有效期（秒），演示态 1 小时。 */
  private readonly tokenTtl = 3600

  constructor(
    private readonly openApi: OpenApiService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ===== 令牌端点（OAuth2 client_credentials）=====

  /** 客户端凭 client_id/client_secret 换取 Bearer 令牌。 */
  @Post('oauth/token')
  @HttpCode(200)
  issueToken(@Body() dto: TokenRequestDto): OAuthTokenResponse {
    if (dto.grant_type !== 'client_credentials') {
      throw new UnauthorizedException('UNSUPPORTED_GRANT_TYPE')
    }
    const client = this.openApi.getClientByCredentials(dto.client_id, dto.client_secret)
    if (!client) throw new UnauthorizedException('INVALID_CLIENT')
    this.openApi.checkRateLimit(client.clientId, client.rateLimitPerMin)

    const secret = this.config.get<string>('jwtSecret', { infer: true }) ?? 'change-me-in-prod'
    const accessToken = this.jwt.sign(
      { sub: client.clientId, tenantId: client.tenantId, scopes: client.scopes, aud: 'openapi' },
      { secret, expiresIn: this.tokenTtl },
    )
    return { access_token: accessToken, token_type: 'Bearer', expires_in: this.tokenTtl }
  }

  // ===== 受保护资源（开放令牌鉴权 + 作用域校验）=====

  /** 当前令牌对应的客户端画像（脱敏，不含密钥）。 */
  @Get('me')
  @UseGuards(OpenApiGuard)
  me(@OpenApiClient() client: OpenApiClientContext) {
    return ok<  Omit<ApiClient, 'clientSecret'> | null>(
      this.openApi.getClientProfile(client.tenantId, client.clientId),
    )
  }

  /** 开放平台总览（前端四卡，平台运营可见）。 */
  @Get('summary')
  summary(@TenantId() tenantId: string) {
    return ok<OpenApiSummary>(this.openApi.summary(tenantId))
  }

  /** 开放订单列表（作用域 orders）。 */
  @Get('orders')
  @UseGuards(OpenApiGuard)
  listOrders(@OpenApiClient() client: OpenApiClientContext) {
    this.openApi.assertScope(client, 'orders')
    this.openApi.checkRateLimit(client.clientId, 120)
    return ok<OpenOrder[]>(this.openApi.listOpenOrders(client.tenantId))
  }

  /** 开放报价试算（作用域 quotes，查价）。 */
  @Post('quotes')
  @UseGuards(OpenApiGuard)
  @HttpCode(200)
  quotes(@OpenApiClient() client: OpenApiClientContext, @Body() body: { weightKg?: number; destCountry?: string }) {
    this.openApi.assertScope(client, 'quotes')
    this.openApi.checkRateLimit(client.clientId, 120)
    const weight = Number(body?.weightKg ?? 1)
    const dest = body?.destCountry ?? 'US'
    return ok<OpenQuote[]>(this.openApi.estimateQuote(client.tenantId, weight, dest))
  }

  /** 开放账单列表（作用域 bills，查账单）。 */
  @Get('bills')
  @UseGuards(OpenApiGuard)
  bills(@OpenApiClient() client: OpenApiClientContext) {
    this.openApi.assertScope(client, 'bills')
    this.openApi.checkRateLimit(client.clientId, 120)
    return ok<OpenBill[]>(this.openApi.listOpenBills(client.tenantId))
  }

  /** ERP 财务凭证（作用域 erp，自动生成应收应付，§28）。 */
  @Get('erp/gl')
  @UseGuards(OpenApiGuard)
  gl(@OpenApiClient() client: OpenApiClientContext) {
    this.openApi.assertScope(client, 'erp')
    this.openApi.checkRateLimit(client.clientId, 120)
    return ok<GlVoucherEntry[]>(this.openApi.buildGlVouchers(client.tenantId))
  }

  /** Webhook 订阅列表（受开放令牌保护）。 */
  @Get('webhooks')
  @UseGuards(OpenApiGuard)
  listWebhooks(@OpenApiClient() client: OpenApiClientContext) {
    return ok<WebhookSubscription[]>(this.openApi.listWebhooks(client.tenantId))
  }

  /** 新建 Webhook 订阅（受开放令牌保护）。 */
  @Post('webhooks')
  @UseGuards(OpenApiGuard)
  createWebhook(@OpenApiClient() client: OpenApiClientContext, @Body() dto: CreateWebhookDto) {
    this.openApi.checkRateLimit(client.clientId, 120)
    return ok<WebhookSubscription>(this.openApi.createWebhook(client.tenantId, dto))
  }

  // ===== 平台侧客户端管理（super 运营，复用 JWT 用户鉴权）=====

  /** 客户端列表（平台运营可见本租户全部客户端）。 */
  @Get('clients')
  listClients(@TenantId() tenantId: string) {
    return ok<ApiClient[]>(this.openApi.listClients(tenantId))
  }

  /** 创建开放客户端（分配 clientId/secret 与作用域）。 */
  @Post('clients')
  createClient(@TenantId() tenantId: string, @Body() dto: CreateApiClientDto) {
    return ok<ApiClient>(this.openApi.createClient(tenantId, dto))
  }

  /** 删除开放客户端。 */
  @Delete('clients/:id')
  deleteClient(@TenantId() tenantId: string, @Param('id') id: string) {
    return ok<{ deleted: boolean }>(this.openApi.deleteClient(tenantId, id))
  }

  /** 轮换客户端密钥（旧密钥立即失效）。 */
  @Post('clients/:id/rotate')
  rotateSecret(@TenantId() tenantId: string, @Param('id') id: string) {
    return ok<ApiClient>(this.openApi.rotateSecret(tenantId, id))
  }
}
