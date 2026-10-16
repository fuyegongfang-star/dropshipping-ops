<template>
  <div class="security">
    <PageHeader
      title="安全加固"
      subtitle="§17 多租户隔离 / 密钥加密 / 越权防护（SaaS 上线硬门槛）"
      icon="shield"
      accent="brand"
    />

    <!-- 核心态势卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-tenant"><AppIcon name="tenants" :size="20" /></div>
          <div class="stat-label">租户隔离模型</div>
          <div class="stat-value">{{ status?.tenantScopedModelCount ?? '—' }}</div>
          <div class="stat-sub">全部业务表带 tenant_id 行级隔离</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-key"><AppIcon name="shield" :size="20" /></div>
          <div class="stat-label">凭据加密</div>
          <div class="stat-value status-ok">AES-256-GCM</div>
          <div class="stat-sub">加密存储 · 运行时解密 · 不落明文库</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-guard"><AppIcon name="radar" :size="20" /></div>
          <div class="stat-label">越权防护（IDOR）</div>
          <div class="stat-value status-ok">已拦截</div>
          <div class="stat-sub">上下文租户冲突即拒绝（§17.4）</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：§17 合规清单 -->
      <el-col :span="14">
        <el-card class="sec-card" shadow="never">
          <template #header><span class="section-title">§17 加固清单</span></template>
          <el-table :data="checklist" class="sec-table" empty-text="暂无">
            <el-table-column label="条款" prop="clause" width="90" />
            <el-table-column label="能力" prop="name" min-width="120" />
            <el-table-column label="落地情况" prop="status" width="120">
              <template #default="{ row }">
                <span :class="['pill', row.done ? 'pill-ok' : 'pill-pending']">
                  {{ row.done ? '已落地' : '规划中' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="说明" prop="note" min-width="160" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-col>

      <!-- 右：评估结论 + 隔离模型 -->
      <el-col :span="10">
        <el-card class="sec-card" shadow="never">
          <template #header><span class="section-title">隔离方案评估结论</span></template>
          <p class="eval">
            经评估，本仓采用 <b>共享库 + tenant_id 行级隔离</b>（而非 schema-per-tenant）：
            高并发多租户下独立 schema 的运维/迁移/跨租户聚合成本过高。
            服务层显式注入 tenant_id 为主机制，Prisma 中间件做 <b>IDOR 纵深防御</b>（冲突即拦截），
            平台级聚合在无租户上下文时完全透明。
          </p>
        </el-card>

        <el-card class="sec-card model-card" shadow="never">
          <template #header><span class="section-title">租户隔离模型（{{ status?.tenantScopedModels.length ?? 0 }}）</span></template>
          <div class="model-cloud">
            <span v-for="m in status?.tenantScopedModels ?? []" :key="m" class="model-tag">{{ m }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { systemApi, type SecurityStatus } from '@/api/system'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 安全加固页（任务 4.4，方案 §17）：只读展示隔离/加密/越权防护态势与合规清单。
const status = ref<SecurityStatus | null>(null)

const checklist = [
  { clause: '§17.1', name: '租户隔离', done: true, note: 'tenant_id 行级隔离 + 中间件强制（禁客户端覆盖）' },
  { clause: '§17.2', name: '密钥管理', done: true, note: 'AES-256-GCM 加密承运商凭据，主密钥由环境变量注入' },
  { clause: '§17.3', name: 'PII 合规', done: false, note: '买家 PII 脱敏/加密 + 数据主体权利接口（规划中）' },
  { clause: '§17.4', name: '越权防护', done: true, note: 'context-bound tenantId 冲突拦截，防 IDOR' },
  { clause: '§17.5', name: '传输与审计', done: true, note: 'TLS 全链路 + 操作审计日志（WAF/限流见 §26）' },
]

onMounted(async () => {
  try {
    status.value = await systemApi.getSecurity()
  } catch (e) {
    console.warn('[Security] 加载失败', (e as Error).message)
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
.ico-key {
  background: linear-gradient(135deg, var(--teal-500), #0e9488);
  box-shadow: 0 6px 18px rgba(18, 181, 165, 0.32);
}
.ico-guard {
  background: linear-gradient(135deg, var(--violet-500), #5b3fe0);
  box-shadow: 0 6px 18px rgba(124, 92, 252, 0.32);
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
.status-ok {
  color: var(--green-500);
}
.stat-sub {
  font-size: 12px;
  color: var(--ink-400);
}
.sec-card {
  border-radius: var(--r-lg);
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.pill {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
}
.pill-ok {
  color: var(--green-500);
  background: rgba(16, 185, 129, 0.12);
}
.pill-pending {
  color: var(--amber-500);
  background: rgba(247, 144, 9, 0.12);
}
.eval {
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-600);
  margin: 0;
}
.model-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.model-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-700);
  background: rgba(79, 110, 247, 0.1);
  border-radius: 8px;
  padding: 3px 9px;
}
</style>
