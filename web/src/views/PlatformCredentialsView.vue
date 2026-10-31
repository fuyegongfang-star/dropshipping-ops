<template>
  <div class="pc">
    <PageHeader
      title="平台凭证管理"
      subtitle="§17.2 凭证工厂化接入：淘宝 TOP / 抖音开放平台 / 云途 / DHL / 4PX / 燕文 的密钥统一录入、加密落库、按平台桥接适配器"
      icon="key"
      accent="brand"
    />

    <el-alert
      class="tip"
      type="info"
      :closable="false"
      show-icon
      title="凭证安全说明"
      description="明文仅在「保存」瞬间经后端 AES-256-GCM 加密落库，列表/接口绝不返回明文；点击「查看明文」需二次确认，明文仅驻留内存、关闭即焚。"
    />

    <el-row :gutter="16" class="grid">
      <el-col v-for="item in list" :key="item.platform" :xs="24" :sm="12" :md="8" :lg="8" :xl="6">
        <el-card class="plat-card" shadow="hover" :body-style="{ padding: '18px 18px 16px' }">
          <div class="plat-head">
            <span class="plat-ico" :class="item.carrierSide ? 'car' : 'chn'">{{ item.carrierSide ? '承运' : '渠道' }}</span>
            <div class="plat-title">
              <div class="plat-name">{{ item.label }}</div>
              <el-tag size="small" effect="plain" type="info" class="auth-tag">{{ authLabel(item.authType) }}</el-tag>
            </div>
            <el-tag :type="item.status === 'configured' ? 'success' : 'info'" size="small" effect="dark" class="status-tag">
              {{ item.status === 'configured' ? '已配置' : '未配置' }}
            </el-tag>
          </div>

          <div class="caps">
            <el-tag v-for="c in item.capabilities" :key="c" size="small" effect="light" class="cap">{{ capLabel(c) }}</el-tag>
          </div>

          <div class="meta">
            <span v-if="item.status === 'configured'">更新时间：{{ fmt(item.updatedAt) }}</span>
            <span v-else class="empty">尚未录入凭证</span>
          </div>

          <div class="actions">
            <el-button
              v-if="item.status === 'configured'"
              type="primary"
              size="small"
              @click="openEdit(item)"
            ><AppIcon name="edit" :size="14" /> 编辑</el-button>
            <el-button
              v-else
              type="primary"
              size="small"
              @click="openEdit(item)"
            ><AppIcon name="plus" :size="14" /> 配置</el-button>
            <el-button
              v-if="item.status === 'configured'"
              size="small"
              @click="viewSecret(item)"
            ><AppIcon name="key" :size="14" /> 查看明文</el-button>
            <el-button
              v-if="item.status === 'configured'"
              type="danger"
              size="small"
              link
              @click="remove(item)"
            ><AppIcon name="trash" :size="14" /> 删除</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 新增 / 编辑凭证 -->
    <el-dialog
      v-model="editVisible"
      :title="(editForm.platformLabel || '') + ' · 凭证配置'"
      width="520px"
      @closed="resetEdit"
    >
      <el-alert
        v-if="currentDef"
        class="dlg-tip"
        type="warning"
        :closable="false"
        :title="'鉴权方式：' + authLabel(currentDef.authType)"
        :description="currentDef.authHint"
      />
      <el-form label-width="110px" class="dlg-form">
        <el-divider content-position="left">必填字段</el-divider>
        <el-form-item v-for="f in requiredFields" :key="f.key" :label="f.label">
          <el-input
            v-model="editForm.fields[f.key]"
            :placeholder="f.placeholder || ('请输入' + f.label)"
            :type="f.secret ? 'password' : 'text'"
            :show-password="!!f.secret"
          />
        </el-form-item>
        <template v-if="optionalFields.length">
          <el-divider content-position="left">可选字段</el-divider>
          <el-form-item v-for="f in optionalFields" :key="f.key" :label="f.label">
            <el-input
              v-model="editForm.fields[f.key]"
              :placeholder="f.placeholder || ('请输入' + f.label)"
              :type="f.secret ? 'password' : 'text'"
              :show-password="!!f.secret"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmSave">保存并加密落库</el-button>
      </template>
    </el-dialog>

    <!-- 查看明文 -->
    <el-dialog v-model="viewVisible" :title="(viewPlatformLabel || '') + ' · 明文凭证'" width="520px" @closed="resetView">
      <el-alert
        type="warning"
        :closable="false"
        title="明文仅驻留内存，关闭对话框即清除，请勿截图外传"
      />
      <el-descriptions :column="1" border class="view-desc">
        <el-descriptions-item v-for="(v, k) in viewFields" :key="k" :label="fieldLabel(k)">
          <span class="mono secret">{{ v }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="viewVisible = false">我已阅知</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  platformCredentialsApi,
  getPlatformDef,
  AUTH_TYPE_LABELS,
  CAPABILITY_LABELS,
  type CredentialListItem,
  type CredentialDetail,
  type PlatformDefinition,
} from '@/api/platform-credentials'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 平台凭证管理页（任务 8.2，方案 §17.2）：网格卡片 + 动态表单 + 查看/删除；演示/正式双路通。
// 说明：统一凭证工厂当前无独立的「轮转」接口（轮转语义映射到 OAuth token 刷新，待真实联调 TODO），
// 故此处以「重新编辑即覆盖」替代轮转按钮，避免引入无后端支撑的伪操作。

const list = ref<CredentialListItem[]>([])
const saving = ref(false)
const loading = ref(false)

const authLabel = (t: string) => (AUTH_TYPE_LABELS as Record<string, string>)[t] ?? t
const capLabel = (c: string) => (CAPABILITY_LABELS as Record<string, string>)[c] ?? c

function fmt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

// ===== 编辑 / 新增 =====
const editVisible = ref(false)
const currentDef = ref<PlatformDefinition | null>(null)
const editForm = reactive<{ platform: string; platformLabel: string; fields: Record<string, string> }>({
  platform: '',
  platformLabel: '',
  fields: {},
})
const requiredFields = computed(() => currentDef.value?.required ?? [])
const optionalFields = computed(() => currentDef.value?.optional ?? [])

function openEdit(item: CredentialListItem): void {
  const def = getPlatformDef(item.platform)
  if (!def) {
    ElMessage.error('未知平台定义：' + item.platform)
    return
  }
  currentDef.value = def
  editForm.platform = def.code
  editForm.platformLabel = def.label
  // 编辑时预填已存明文（演示态由 mock 返回；正式态需先点「查看明文」后再编辑，此处留空由用户重填敏感字段）
  editForm.fields = {}
  editVisible.value = true
}
function resetEdit(): void {
  currentDef.value = null
  editForm.platform = ''
  editForm.platformLabel = ''
  editForm.fields = {}
}

async function confirmSave(): Promise<void> {
  const def = currentDef.value
  if (!def) return
  // 必填校验（与后端 PLATFORM_META.requiredFields 对齐）
  const missing = def.required.filter((f) => !editForm.fields[f.key]?.trim())
  if (missing.length) {
    ElMessage.warning('请填写必填字段：' + missing.map((f) => f.label).join('、'))
    return
  }
  // 可选字段去除空串，避免落库无意义占位
  const payload: Record<string, string> = {}
  for (const f of [...def.required, ...def.optional]) {
    const v = editForm.fields[f.key]
    if (v !== undefined && v !== null && String(v).trim() !== '') payload[f.key] = String(v).trim()
  }
  saving.value = true
  try {
    const res = await platformCredentialsApi.save(def.code, payload)
    const data = res as unknown as { binding?: { note?: string } }
    if (data?.binding?.note) {
      ElMessage.success('凭证已加密保存 · ' + data.binding.note)
    } else {
      ElMessage.success('凭证已加密保存')
    }
    editVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error('保存失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

// ===== 查看明文（二次确认，明文仅驻留内存）=====
const viewVisible = ref(false)
const viewPlatformLabel = ref('')
const viewFields = ref<Record<string, string>>({})
function fieldLabel(key: string): string {
  const def = currentDef.value
  const f = def?.required.find((x) => x.key === key) ?? def?.optional.find((x) => x.key === key)
  return f?.label ?? key
}
async function viewSecret(item: CredentialListItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `即将展示「${item.label}」的明文凭证。明文仅用于核对，请勿截图或外传；确定继续？`,
      '查看明文确认',
      { type: 'warning', confirmButtonText: '查看明文', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    const detail = (await platformCredentialsApi.get(item.platform)) as unknown as CredentialDetail
    viewPlatformLabel.value = item.label
    currentDef.value = getPlatformDef(item.platform) ?? null
    viewFields.value = detail.fields
    viewVisible.value = true
  } catch (e) {
    ElMessage.error('获取明文失败：' + (e as Error).message)
  }
}
function resetView(): void {
  viewPlatformLabel.value = ''
  viewFields.value = {}
}

// ===== 删除 =====
async function remove(item: CredentialListItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除「${item.label}」的凭证吗？删除后该平台将无法通过凭证工厂桥接适配器。`,
      '删除凭证',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await platformCredentialsApi.remove(item.platform)
    ElMessage.success('凭证已删除')
    await refresh()
  } catch (e) {
    ElMessage.error('删除失败：' + (e as Error).message)
  }
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    list.value = (await platformCredentialsApi.list()) as unknown as CredentialListItem[]
  } catch (e) {
    ElMessage.error('凭证列表加载失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
</script>

<style scoped>
.tip {
  margin-bottom: 16px;
  border-radius: var(--r-lg);
}
.grid {
  margin-top: 4px;
}
.plat-card {
  border-radius: var(--r-lg);
  margin-bottom: 16px;
  border: 1px solid var(--line);
}
.plat-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.plat-ico {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex: none;
}
.plat-ico.car {
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
}
.plat-ico.chn {
  background: linear-gradient(135deg, var(--violet-500, #7c5cf0), #5b3fd0);
}
.plat-title {
  flex: 1;
  min-width: 0;
}
.plat-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.auth-tag {
  margin-top: 3px;
  font-weight: 600;
}
.status-tag {
  flex: none;
  font-weight: 600;
}
.caps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.cap {
  font-weight: 600;
}
.meta {
  font-size: 12px;
  color: var(--ink-500);
  min-height: 18px;
  margin-bottom: 14px;
}
.meta .empty {
  color: var(--ink-400);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.actions .el-button {
  margin-left: 0;
}
.dlg-tip {
  margin-bottom: 14px;
  border-radius: var(--r-md, 10px);
}
.dlg-form {
  margin-top: 4px;
}
.view-desc {
  margin-top: 14px;
}
.mono {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.secret {
  font-weight: 700;
  word-break: break-all;
}
</style>
