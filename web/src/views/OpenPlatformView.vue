<template>
  <div class="open">
    <PageHeader
      title="开放平台"
      subtitle="§28 开放 API 与生态集成：OAuth2 客户端凭证、限流、Webhook 订阅，供商户 ERP/自建系统调用"
      icon="api"
      accent="brand"
    />

    <!-- 概览指标 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-client"><AppIcon name="api" :size="20" /></div>
          <div class="stat-label">API 客户端</div>
          <div class="stat-value">{{ summary.clientCount }}</div>
          <div class="stat-sub">OAuth2 应用</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-wh"><AppIcon name="radar" :size="20" /></div>
          <div class="stat-label">Webhook 订阅</div>
          <div class="stat-value">{{ summary.webhookCount }}</div>
          <div class="stat-sub">事件回调</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-rate"><AppIcon name="trend" :size="20" /></div>
          <div class="stat-label">限流总配额</div>
          <div class="stat-value">{{ summary.rateLimitTotal }}<span class="unit">/min</span></div>
          <div class="stat-sub">各客户端之和</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-ep"><AppIcon name="shield" :size="20" /></div>
          <div class="stat-label">开放接口</div>
          <div class="stat-value">{{ summary.endpointCount }}</div>
          <div class="stat-sub">下单/查价/账单/凭证</div>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="tab" class="op-tabs">
      <!-- API 客户端 -->
      <el-tab-pane :label="`API 客户端 (${summary.clientCount})`" name="clients">
        <el-card class="list-card" shadow="never">
          <div class="toolbar">
            <div class="tip">OAuth2 client_credentials 应用：商户 ERP 凭 client_id/secret 换令牌后调用开放接口。</div>
            <el-button type="primary" @click="openNewClient"><AppIcon name="plus" :size="15" /> 新建客户端</el-button>
          </div>
          <el-table :data="clients" class="op-table" empty-text="暂无客户端" row-key="id">
            <el-table-column label="名称" prop="name" min-width="150" />
            <el-table-column label="Client ID" prop="clientId" min-width="160">
              <template #default="{ row }"><span class="mono">{{ row.clientId }}</span></template>
            </el-table-column>
            <el-table-column label="作用域" min-width="240">
              <template #default="{ row }">
                <el-tag v-for="s in row.scopes" :key="s" :type="scopeTag(s)" size="small" effect="light" class="scope-tag">{{ scopeLabel(s) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="限流" width="100">
              <template #default="{ row }"><span class="rate">{{ row.rateLimitPerMin }}/min</span></template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small" effect="dark">{{ row.status === 'enabled' ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="rotateSecret(row)">轮换密钥</el-button>
                <el-button type="danger" link size="small" @click="removeClient(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- Webhook 订阅 -->
      <el-tab-pane :label="`Webhook 订阅 (${summary.webhookCount})`" name="webhooks">
        <el-card class="list-card" shadow="never">
          <div class="toolbar">
            <div class="tip">订阅平台事件（如 order.shipped），平台异步回调你的接收地址（§28 事件驱动）。</div>
            <el-button type="primary" @click="openNewWebhook"><AppIcon name="plus" :size="15" /> 新建订阅</el-button>
          </div>
          <el-table :data="webhooks" class="op-table" empty-text="暂无订阅" row-key="id">
            <el-table-column label="事件" prop="event" min-width="160" />
            <el-table-column label="回调地址" prop="url" min-width="300">
              <template #default="{ row }"><span class="mono">{{ row.url }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small" effect="dark">{{ row.status === 'active' ? '生效' : '暂停' }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 接口文档 -->
      <el-tab-pane label="接口文档" name="docs">
        <el-card class="list-card" shadow="never">
          <div class="tip doc-tip">开放接口均要求 <code>Authorization: Bearer &lt;token&gt;</code>；下表为商户可调用的资源与所需作用域。</div>
          <el-table :data="endpoints" class="op-table" row-key="path">
            <el-table-column label="Method" width="90">
              <template #default="{ row }"><el-tag :type="row.method === 'GET' ? 'success' : 'warning'" size="small" effect="dark">{{ row.method }}</el-tag></template>
            </el-table-column>
            <el-table-column label="路径" prop="path" min-width="240">
              <template #default="{ row }"><span class="mono">{{ row.path }}</span></template>
            </el-table-column>
            <el-table-column label="作用域" width="130">
              <template #default="{ row }"><el-tag :type="scopeTag(row.scope)" size="small" effect="light">{{ scopeLabel(row.scope) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="说明" prop="description" min-width="280" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 调用示例 -->
      <el-tab-pane label="调用示例" name="sample">
        <el-card class="list-card" shadow="never">
          <div class="tip doc-tip">第一步：用客户端凭证换取令牌；第二步：携带令牌调用开放资源。</div>
          <pre class="code">POST /openapi/oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "cli_demo_full",
  "client_secret": "secret_demo_full_2026"
}
→ { "access_token": "&lt;token&gt;", "token_type": "Bearer", "expires_in": 3600 }

GET /openapi/orders
Authorization: Bearer &lt;token&gt;</pre>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建客户端 -->
    <el-dialog v-model="clientVisible" title="新建 API 客户端" width="480px" @closed="resetClient">
      <el-form :model="clientForm" label-width="88px">
        <el-form-item label="名称" required>
          <el-input v-model="clientForm.name" placeholder="如 ERP 全量集成" />
        </el-form-item>
        <el-form-item label="作用域" required>
          <el-select v-model="clientForm.scopes" multiple placeholder="可多选" class="full">
            <el-option v-for="s in SCOPE_LIST" :key="s" :label="scopeLabel(s)" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="限流/分钟">
          <el-input-number v-model="clientForm.rateLimitPerMin" :min="1" :max="1000" :step="10" controls-position="right" class="full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="clientVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmClient">提交</el-button>
      </template>
    </el-dialog>

    <!-- 新建 Webhook -->
    <el-dialog v-model="whVisible" title="新建 Webhook 订阅" width="480px" @closed="resetWebhook">
      <el-form :model="whForm" label-width="88px">
        <el-form-item label="事件" required>
          <el-input v-model="whForm.event" placeholder="如 order.shipped" />
        </el-form-item>
        <el-form-item label="回调地址" required>
          <el-input v-model="whForm.url" placeholder="https://your-erp/hooks/..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="whVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmWebhook">提交</el-button>
      </template>
    </el-dialog>

    <!-- 新客户端密钥结果 -->
    <el-dialog v-model="secretVisible" title="客户端已创建" width="460px">
      <el-alert type="warning" :closable="false" title="请立即保存 client_secret，关闭后不可再查看">
        <span class="mono secret">{{ createdSecret }}</span>
      </el-alert>
      <template #footer>
        <el-button @click="secretVisible = false">我已保存</el-button>
        <el-button type="primary" @click="copySecret">复制密钥</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  openApiApi,
  type ApiClient,
  type WebhookSubscription,
  type OpenApiSummary,
  type OpenScope,
  type CreateApiClientDto,
  OPEN_SCOPE_LABELS,
  OPEN_SCOPE_TAG,
  OPEN_ENDPOINTS,
} from '@/api/openapi'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 开放平台页（任务 5.2，方案 §28）：OAuth2 客户端 + Webhook + 接口文档；演示/正式双路通。

const SCOPE_LIST: OpenScope[] = ['orders', 'quotes', 'tracking', 'bills', 'erp']

function scopeLabel(s: OpenScope): string {
  return OPEN_SCOPE_LABELS[s]
}
function scopeTag(s: OpenScope): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  return OPEN_SCOPE_TAG[s]
}

const endpoints = OPEN_ENDPOINTS

const tab = ref<'clients' | 'webhooks' | 'docs' | 'sample'>('clients')
const summary = reactive<OpenApiSummary>({ clientCount: 0, webhookCount: 0, rateLimitTotal: 0, endpointCount: 0 })
const clients = ref<ApiClient[]>([])
const webhooks = ref<WebhookSubscription[]>([])
const saving = ref(false)
const createdSecret = ref('')

async function refreshSummary(): Promise<void> {
  try {
    Object.assign(summary, await openApiApi.summary())
  } catch (e) {
    ElMessage.error('开放平台总览加载失败：' + (e as Error).message)
  }
}
async function refreshClients(): Promise<void> {
  try {
    clients.value = await openApiApi.listClients()
  } catch (e) {
    ElMessage.error('客户端加载失败：' + (e as Error).message)
  }
}
async function refreshWebhooks(): Promise<void> {
  try {
    webhooks.value = await openApiApi.listWebhooks()
  } catch (e) {
    ElMessage.error('Webhook 加载失败：' + (e as Error).message)
  }
}

async function rotateSecret(row: ApiClient): Promise<void> {
  try {
    const updated = await openApiApi.rotateSecret(row.id)
    Object.assign(row, updated)
    await refreshSummary()
    ElMessage.success('密钥已轮换，旧密钥立即失效')
  } catch (e) {
    ElMessage.error('轮换失败：' + (e as Error).message)
  }
}
async function removeClient(row: ApiClient): Promise<void> {
  try {
    await openApiApi.deleteClient(row.id)
    clients.value = clients.value.filter((c) => c.id !== row.id)
    await refreshSummary()
    ElMessage.success('客户端已删除')
  } catch (e) {
    ElMessage.error('删除失败：' + (e as Error).message)
  }
}

// 新建客户端
const clientVisible = ref(false)
const clientForm = reactive<{ name: string; scopes: OpenScope[]; rateLimitPerMin: number }>({ name: '', scopes: [], rateLimitPerMin: 60 })
function openNewClient(): void {
  clientVisible.value = true
}
function resetClient(): void {
  clientForm.name = ''
  clientForm.scopes = []
  clientForm.rateLimitPerMin = 60
}
const secretVisible = ref(false)
async function confirmClient(): Promise<void> {
  if (!clientForm.name.trim()) {
    ElMessage.warning('请填写名称')
    return
  }
  if (!clientForm.scopes.length) {
    ElMessage.warning('至少选择一个作用域')
    return
  }
  saving.value = true
  try {
    const created = await openApiApi.createClient({
      name: clientForm.name.trim(),
      scopes: clientForm.scopes,
      rateLimitPerMin: clientForm.rateLimitPerMin,
    } as CreateApiClientDto)
    clients.value.unshift(created)
    createdSecret.value = created.clientSecret ?? ''
    await refreshSummary()
    clientVisible.value = false
    secretVisible.value = true
  } catch (e) {
    ElMessage.error('创建失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}
function copySecret(): void {
  navigator.clipboard?.writeText(createdSecret.value).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.warning('复制失败，请手动选择'),
  )
}

// 新建 Webhook
const whVisible = ref(false)
const whForm = reactive<{ event: string; url: string }>({ event: '', url: '' })
function openNewWebhook(): void {
  whVisible.value = true
}
function resetWebhook(): void {
  whForm.event = ''
  whForm.url = ''
}
async function confirmWebhook(): Promise<void> {
  if (!whForm.event.trim()) {
    ElMessage.warning('请填写事件')
    return
  }
  if (!whForm.url.trim()) {
    ElMessage.warning('请填写回调地址')
    return
  }
  saving.value = true
  try {
    const created = await openApiApi.createWebhook({ event: whForm.event.trim(), url: whForm.url.trim() })
    webhooks.value.unshift(created)
    await refreshSummary()
    ElMessage.success('订阅已创建')
    whVisible.value = false
  } catch (e) {
    ElMessage.error('创建失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await refreshSummary()
  await Promise.all([refreshClients(), refreshWebhooks()])
})
</script>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: var(--r-lg);
  position: relative;
  overflow: hidden;
}
.stat-card :deep(.el-card__body) {
  padding: 18px 20px;
}
.stat-ico {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 12px;
}
.ico-client {
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  box-shadow: var(--sh-brand);
}
.ico-wh {
  background: linear-gradient(135deg, var(--violet-500), #6d3bd4);
  box-shadow: 0 6px 18px rgba(109, 59, 212, 0.3);
}
.ico-rate {
  background: linear-gradient(135deg, var(--green-600, #10a96b), #0b8a57);
  box-shadow: 0 6px 18px rgba(16, 169, 107, 0.3);
}
.ico-ep {
  background: linear-gradient(135deg, var(--amber-500), #e07b07);
  box-shadow: 0 6px 18px rgba(247, 144, 9, 0.3);
}
.stat-label {
  font-size: 13px;
  color: var(--ink-500);
  font-weight: 500;
}
.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--ink-900);
  letter-spacing: -0.5px;
  margin: 4px 0 2px;
}
.unit {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-400);
  margin-left: 2px;
}
.stat-sub {
  font-size: 12px;
  color: var(--ink-400);
}
.op-tabs {
  margin-top: 4px;
}
.list-card {
  border-radius: var(--r-lg);
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 12px;
}
.tip {
  font-size: 12px;
  color: var(--ink-500);
  flex: 1;
}
.doc-tip {
  margin-bottom: 14px;
}
.op-table :deep(.el-tag) {
  font-weight: 600;
}
.scope-tag {
  margin: 2px 4px 2px 0;
}
.mono {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-variant-numeric: tabular-nums;
}
.rate {
  font-weight: 700;
  color: var(--ink-800);
}
.code {
  background: var(--ink-900, #1f2430);
  color: #e6edf3;
  border-radius: 10px;
  padding: 16px 18px;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}
.secret {
  font-weight: 700;
  word-break: break-all;
}
.full {
  width: 100%;
}
</style>
