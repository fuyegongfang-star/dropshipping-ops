<template>
  <div class="tenants">
    <el-card>
      <template #header>
        <div class="head">
          <span>租户管理（多租户行级隔离）</span>
          <el-button type="primary" @click="dialog = true">新建租户</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="tenants" stripe>
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="code" label="租户标识" width="160" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              size="small"
              :type="current === row.code ? 'success' : 'primary'"
              @click="pick(row.code)"
            >
              {{ current === row.code ? '已选中' : '切换查看' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" title="新建租户" width="380">
      <el-form label-width="80">
        <el-form-item label="名称"><el-input v-model="name" /></el-form-item>
        <el-form-item label="标识"><el-input v-model="code" placeholder="如 demo2" /></el-form-item>
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

const tenantStore = useTenantStore()
const tenants = ref<Tenant[]>([])
const loading = ref(false)
const current = ref(tenantStore.currentTenantCode)
const dialog = ref(false)
const name = ref('')
const code = ref('')

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
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
