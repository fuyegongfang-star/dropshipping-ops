<template>
  <div class="tenants">
    <PageHeader
      title="租户管理"
      subtitle="多租户行级隔离 · 切换租户即刻获得隔离视图"
      icon="tenants"
      accent="brand"
    >
      <template #actions>
        <el-button type="primary" @click="dialog = true">
          <AppIcon name="plus" :size="15" class="btn-ico" />新建租户
        </el-button>
      </template>
    </PageHeader>

    <el-card>
      <template #header>
        <div class="card-head">
          <span class="section-title">租户列表</span>
          <span class="count-pill">共 {{ tenants.length }} 个</span>
        </div>
      </template>

      <el-table v-loading="loading" :data="tenants">
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">
            <span class="cell-tenant">
              <span class="t-badge"><AppIcon name="building" :size="15" /></span>
              <span class="t-name">{{ row.name }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="租户标识" width="170">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <span class="tag-soft" :class="statusClass(row.status)">{{ row.status || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button
              size="small"
              :type="current === row.code ? 'success' : 'primary'"
              @click="pick(row.code)"
            >
              <AppIcon :name="current === row.code ? 'check' : 'swap'" :size="14" class="btn-ico" />
              {{ current === row.code ? '已选中' : '切换查看' }}
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <div class="app-empty">
            <span class="app-empty-ico"><AppIcon name="building" :size="26" /></span>
            <span class="app-empty-text">暂无租户</span>
          </div>
        </template>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" title="新建租户" width="400">
      <el-form label-width="84">
        <el-form-item label="名称">
          <el-input v-model="name" placeholder="如：深圳某某供应链" />
        </el-form-item>
        <el-form-item label="标识">
          <el-input v-model="code" placeholder="如 demo2（英文/数字）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="create">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { tenantsApi, type Tenant } from '@/api/tenants'
import { useTenantStore } from '@/stores/tenant'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

const tenantStore = useTenantStore()
const tenants = ref<Tenant[]>([])
const loading = ref(false)
const current = ref(tenantStore.currentTenantCode)
const dialog = ref(false)
const name = ref('')
const code = ref('')

function statusClass(status: string): string {
  if ((status || '').toLowerCase() === 'active') return 'tag-green'
  if ((status || '').toLowerCase() === 'disabled') return 'tag-red'
  return 'tag-gray'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    tenants.value = await tenantsApi.list()
    current.value = tenantStore.currentTenantCode
  } catch (e) {
    ElMessage.error('加载租户失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

function pick(c: string): void {
  tenantStore.setTenant(c)
  current.value = c
  ElMessage.success('已切换租户，数据将按该租户隔离展示')
}

async function create(): Promise<void> {
  if (!name.value || !code.value) {
    ElMessage.warning('请填写名称与标识')
    return
  }
  try {
    await tenantsApi.create(name.value, code.value)
    ElMessage.success('租户已创建')
    dialog.value = false
    name.value = ''
    code.value = ''
    await load()
  } catch (e) {
    ElMessage.error('创建失败：' + (e as Error).message)
  }
}

onMounted(load)
</script>

<style scoped>
.btn-ico {
  margin-right: 5px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.card-head .section-title {
  margin: 0;
}
.count-pill {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-700);
  background: var(--brand-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}
.cell-tenant {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}
.t-badge {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--brand-soft);
  color: var(--brand-600);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.t-name {
  font-weight: 500;
  color: var(--ink-800);
}
.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--ink-600);
}
</style>
