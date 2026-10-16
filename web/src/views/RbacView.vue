<template>
  <div class="rbac">
    <PageHeader
      title="权限管理"
      subtitle="§22 精细化 RBAC：权限点目录 / 角色蓝图 / 角色分配（SaaS 多租户权限隔离核心）"
      icon="key"
      accent="brand"
    />

    <!-- 态势卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-role"><AppIcon name="key" :size="20" /></div>
          <div class="stat-label">当前租户角色</div>
          <div class="stat-value">{{ roles.length }}</div>
          <div class="stat-sub">含 {{ systemCount }} 个系统内置角色</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-perm"><AppIcon name="shield" :size="20" /></div>
          <div class="stat-label">权限点总数</div>
          <div class="stat-value">{{ flatPerms.length }}</div>
          <div class="stat-sub">跨 {{ resources.length }} 个资源分组</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-scope"><AppIcon name="globe" :size="20" /></div>
          <div class="stat-label">作用域维度</div>
          <div class="stat-value">{{ scopes.length }}</div>
          <div class="stat-sub">数据可见范围约束</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-blue"><AppIcon name="layers" :size="20" /></div>
          <div class="stat-label">系统角色蓝图</div>
          <div class="stat-value">{{ blueprintNames.length }}</div>
          <div class="stat-sub">可一键复制建角色</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：系统角色蓝图（权限矩阵） -->
      <el-col :span="14">
        <el-card class="rbac-card" shadow="never">
          <template #header>
            <span class="section-title">系统角色蓝图 · 权限矩阵</span>
            <span class="section-tip">行=权限点，列=系统内置角色，✓ 表示该角色拥有此权限</span>
          </template>
          <el-table :data="flatPerms" class="rbac-table" empty-text="暂无权限点" max-height="520">
            <el-table-column label="权限点" min-width="180">
              <template #default="{ row }">
                <div class="perm-cell">
                  <span class="perm-label">{{ row.label }}</span>
                  <span class="perm-code">{{ row.code }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-for="name in blueprintNames"
              :key="name"
              :label="name"
              align="center"
              width="96"
            >
              <template #default="{ row }">
                <AppIcon
                  v-if="hasPerm(name, row.code)"
                  name="check"
                  :size="16"
                  class="perm-on"
                />
                <span v-else class="perm-off">—</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 右：当前租户角色 + 新建 -->
      <el-col :span="10">
        <el-card class="rbac-card" shadow="never">
          <template #header>
            <span class="section-title">当前租户角色</span>
            <el-button type="primary" size="small" @click="openCreate">
              <AppIcon name="key" :size="14" /> 新建角色
            </el-button>
          </template>
          <el-table :data="roles" class="rbac-table" empty-text="暂无角色" max-height="520">
            <el-table-column label="角色" min-width="130">
              <template #default="{ row }">
                <div class="role-cell">
                  <span class="role-name">{{ row.name }}</span>
                  <span :class="['pill', row.system ? 'pill-sys' : 'pill-custom']">
                    {{ row.system ? '系统' : '自定义' }}
                  </span>
                </div>
                <div class="role-scope">作用域：{{ scopeLabel(row.scope) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="权限数" prop="permissions.length" width="80" align="center" />
            <el-table-column label="操作" width="92">
              <template #default="{ row }">
                <el-button
                  v-if="!row.system"
                  size="small"
                  text
                  type="primary"
                  :disabled="busy"
                  @click="openAssign(row)"
                >
                  分配
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 新建角色对话框 -->
    <el-dialog v-model="createVisible" title="新建角色" width="560px" @closed="resetForm">
      <el-form :model="form" label-width="88px">
        <el-form-item label="角色名" required>
          <el-input v-model="form.name" placeholder="如：区域运营" maxlength="40" />
        </el-form-item>
        <el-form-item label="作用域">
          <el-select v-model="form.scope" class="full">
            <el-option
              v-for="s in scopes"
              :key="s.code"
              :label="s.label"
              :value="s.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="权限点">
          <el-checkbox-group v-model="form.permissions" class="perm-group">
            <el-checkbox
              v-for="p in flatPerms"
              :key="p.code"
              :value="p.code"
              class="perm-check"
            >
              {{ p.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 分配角色对话框 -->
    <el-dialog v-model="assignVisible" title="分配角色给用户" width="460px" @closed="resetAssign">
      <el-form label-width="88px">
        <el-form-item label="用户 ID">
          <el-input v-model="assignForm.userId" placeholder="演示态填写任意用户标识" />
        </el-form-item>
        <el-form-item label="分配角色">
          <el-select v-model="assignForm.roleId" class="full">
            <el-option
              v-for="r in roles"
              :key="r.id"
              :label="`${r.name}（${r.system ? '系统' : '自定义'}）`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="submitAssign">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { rbacApi, type PermissionResource, type ScopeDimension, type RoleOut } from '@/api/rbac'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 权限管理页（任务 4.5，方案 §22）：权限矩阵 + 角色清单 + 新建/分配。
const resources = ref<PermissionResource[]>([])
const scopes = ref<ScopeDimension[]>([])
const roles = ref<RoleOut[]>([])
const blueprints = ref<Record<string, string[]>>({})
const busy = ref(false)

// 拉平权限点目录，便于矩阵行渲染与权限选择。
const flatPerms = computed(() =>
  resources.value.flatMap((g) =>
    g.items.map((it) => ({ ...it, group: g.groupLabel })),
  ),
)
const blueprintNames = computed(() => Object.keys(blueprints.value))
const systemCount = computed(() => roles.value.filter((r) => r.system).length)

// 判断某系统角色是否拥有某权限点（矩阵单元格）。
function hasPerm(role: string, code: string): boolean {
  return !!blueprints.value[role]?.includes(code)
}
function scopeLabel(code: string | null): string {
  return scopes.value.find((s) => s.code === code)?.label ?? (code || '—')
}

// ===== 新建角色 =====
const createVisible = ref(false)
const form = ref({ name: '', scope: 'all', permissions: [] as string[] })

function openCreate(): void {
  createVisible.value = true
}
function resetForm(): void {
  form.value = { name: '', scope: 'all', permissions: [] }
}
async function submitCreate(): Promise<void> {
  if (!form.value.name.trim()) {
    ElMessage.warning('角色名不能为空')
    return
  }
  busy.value = true
  try {
    const created = await rbacApi.createRole({
      name: form.value.name.trim(),
      scope: form.value.scope,
      permissions: form.value.permissions,
    })
    roles.value = [created, ...roles.value]
    ElMessage.success(`角色「${created.name}」创建成功`)
    createVisible.value = false
  } catch (e) {
    ElMessage.error(`创建失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

// ===== 分配角色 =====
const assignVisible = ref(false)
const assignForm = ref({ userId: '', roleId: '' })
const assignTarget = ref<RoleOut | null>(null)

function openAssign(row: RoleOut): void {
  assignTarget.value = row
  assignForm.value = { userId: '', roleId: row.id }
  assignVisible.value = true
}
function resetAssign(): void {
  assignForm.value = { userId: '', roleId: '' }
  assignTarget.value = null
}
async function submitAssign(): Promise<void> {
  if (!assignForm.value.userId.trim()) {
    ElMessage.warning('请填写用户 ID')
    return
  }
  busy.value = true
  try {
    const res = await rbacApi.assignRoles(assignForm.value.userId.trim(), [assignForm.value.roleId])
    ElMessage.success(`已为用户分配 ${res.assigned} 个角色`)
    assignVisible.value = false
  } catch (e) {
    ElMessage.error(`分配失败：${(e as Error).message}`)
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    const [catalog, bps, rls] = await Promise.all([
      rbacApi.getCatalog(),
      rbacApi.getBlueprints(),
      rbacApi.getRoles(),
    ])
    resources.value = catalog.resources
    scopes.value = catalog.scopes
    blueprints.value = bps
    roles.value = rls as RoleOut[]
  } catch (e) {
    console.warn('[RBAC] 加载失败', (e as Error).message)
  }
})
</script>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: var(--r-lg);
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
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  box-shadow: var(--sh-brand);
  margin-bottom: 12px;
}
.ico-perm {
  background: linear-gradient(135deg, var(--teal-500), #0e9488);
  box-shadow: 0 6px 18px rgba(18, 181, 165, 0.32);
}
.ico-scope {
  background: linear-gradient(135deg, var(--violet-500), #5b3fe0);
  box-shadow: 0 6px 18px rgba(124, 92, 252, 0.32);
}
.ico-blue {
  background: linear-gradient(135deg, var(--amber-500), #d97706);
  box-shadow: 0 6px 18px rgba(247, 144, 9, 0.32);
}
.stat-label {
  font-size: 13px;
  color: var(--ink-500);
  font-weight: 500;
}
.stat-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--ink-900);
  margin: 4px 0 2px;
}
.stat-sub {
  font-size: 12px;
  color: var(--ink-400);
}
.rbac-card {
  border-radius: var(--r-lg);
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.section-tip {
  font-size: 12px;
  color: var(--ink-400);
  margin-left: 10px;
}
.rbac-card :deep(.el-card__header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.perm-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.perm-label {
  font-size: 13px;
  color: var(--ink-800);
  font-weight: 500;
}
.perm-code {
  font-size: 11px;
  color: var(--ink-400);
  font-family: var(--mono);
}
.perm-on {
  color: var(--green-500);
}
.perm-off {
  color: var(--ink-300);
}
.role-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.role-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-900);
}
.role-scope {
  font-size: 11px;
  color: var(--ink-400);
  margin-top: 2px;
}
.pill {
  font-weight: 600;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
}
.pill-sys {
  color: var(--brand-700);
  background: rgba(79, 110, 247, 0.12);
}
.pill-custom {
  color: var(--teal-600);
  background: rgba(18, 181, 165, 0.12);
}
.perm-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  max-height: 260px;
  overflow-y: auto;
}
.perm-check {
  margin-right: 0;
}
.full {
  width: 100%;
}
</style>
