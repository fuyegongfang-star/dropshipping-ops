<template>
  <div class="address">
    <PageHeader
      title="地址校验与分区"
      subtitle="收件地址标准化、质量评分与脏地址检测；邮编→分区驱动远程附加费与承运商可达性（§18）"
      icon="pin"
      accent="orange"
    >
      <template #actions>
        <span class="pill"><AppIcon name="pin" :size="13" />§18 地址校验标准化</span>
      </template>
    </PageHeader>

    <el-row :gutter="16">
      <!-- 左：地址录入 -->
      <el-col :span="10">
        <el-card class="form-card">
          <template #header><span class="section-title">收件地址</span></template>

          <el-form label-position="top">
            <el-form-item label="目的国">
              <el-select v-model="form.country" class="w-full" filterable placeholder="选择目的国（ISO2）">
                <el-option v-for="c in countries" :key="c.code" :label="`${c.code} · ${c.name}`" :value="c.code" />
              </el-select>
            </el-form-item>
            <el-row :gutter="8">
              <el-col :span="12">
                <el-form-item label="收件人">
                  <el-input v-model="form.name" placeholder="如 John Doe" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="电话">
                  <el-input v-model="form.phone" placeholder="如 +1 415 555 0100" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="8">
              <el-col :span="12">
                <el-form-item label="州 / 省">
                  <el-input v-model="form.state" placeholder="如 CA" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="城市">
                  <el-input v-model="form.city" placeholder="如 Cupertino" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="地址行 1（街道门牌）">
              <el-input v-model="form.addressLine1" placeholder="如 1 Apple Park Way" />
            </el-form-item>
            <el-form-item label="地址行 2（单元 / 公司，可选）">
              <el-input v-model="form.addressLine2" placeholder="可选" />
            </el-form-item>
            <el-form-item label="邮政编码">
              <el-input v-model="form.postalCode" placeholder="如 95014（美国 5 位）" />
            </el-form-item>
            <el-form-item label="评估承运商（缺省评估全部）">
              <el-select v-model="form.carriers" class="w-full" multiple collapse-tags placeholder="留空 = 评估全部承运商">
                <el-option v-for="c in carriers" :key="c.code" :label="c.name" :value="c.code" />
              </el-select>
            </el-form-item>

            <div class="actions">
              <el-button type="primary" :loading="loading" @click="onValidate">
                <AppIcon name="check" :size="15" /> 校验地址
              </el-button>
              <el-button @click="fillSample(true)"><AppIcon name="check" :size="15" /> 填充示例（合规）</el-button>
              <el-button @click="fillSample(false)"><AppIcon name="warning" :size="15" /> 填充示例（脏地址）</el-button>
            </div>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右：校验结果 -->
      <el-col :span="14">
        <el-empty v-if="!result" description="填写地址后点击「校验地址」查看标准化、质量分与分区结论" />

        <template v-else>
          <!-- 质量分 + 标准化 -->
          <el-card class="res-card">
            <template #header>
              <span class="section-title">
                校验结果
                <el-tag :type="result.valid ? 'success' : 'danger'" size="small" class="ml">
                  {{ result.valid ? '可下单' : '需修正' }}
                </el-tag>
              </span>
            </template>

            <div class="score-row">
              <div class="score-box" :class="scoreClass">
                <div class="score-num">{{ result.qualityScore }}</div>
                <div class="score-label">地址质量分</div>
              </div>
              <div class="norm">
                <div class="norm-title">标准化地址</div>
                <div class="norm-line"><b>{{ result.normalized.name || '—' }}</b></div>
                <div class="norm-line">{{ [result.normalized.addressLine1, result.normalized.addressLine2].filter(Boolean).join(', ') || '—' }}</div>
                <div class="norm-line">{{ [result.normalized.city, result.normalized.state].filter(Boolean).join(', ') }} {{ result.normalized.postalCode }}</div>
                <div class="norm-line muted">{{ result.normalized.country }} · {{ result.normalized.phone || '电话缺失' }}</div>
              </div>
            </div>

            <!-- 分区结论 -->
            <div class="zone-row">
              <span class="kv"><i>分区</i><b>{{ result.zone.zoneCode }}</b></span>
              <span class="kv"><i>区域</i><b>{{ result.zone.region }}</b></span>
              <el-tag :type="result.zone.isRemote ? 'warning' : 'info'" size="small">
                {{ result.zone.isRemote ? '偏远地区（加收远程费 §4.4）' : '非偏远' }}
              </el-tag>
              <el-tag :type="result.zone.reachable ? 'success' : 'danger'" size="small">
                {{ result.zone.reachable ? '可达' : '不可达' }}
              </el-tag>
            </div>
          </el-card>

          <!-- 问题清单 -->
          <el-card v-if="result.issues.length" class="res-card">
            <template #header><span class="section-title">问题清单（分级）</span></template>
            <div v-for="(it, i) in result.issues" :key="i" class="issue" :class="`lv-${it.level}`">
              <AppIcon :name="it.level === 'error' ? 'warning' : it.level === 'warning' ? 'info' : 'check'" :size="15" />
              <span>{{ it.message }}</span>
              <el-tag v-if="it.field" size="small" effect="plain" class="field-tag">{{ it.field }}</el-tag>
            </div>
          </el-card>

          <!-- 承运商可行性 -->
          <el-card class="res-card">
            <template #header><span class="section-title">各承运商可行性（分区 / 远程 / 可达）</span></template>
            <el-table :data="result.feasibility" size="small" border>
              <el-table-column prop="carrierName" label="承运商" min-width="110" />
              <el-table-column prop="zoneCode" label="分区" width="92" align="center">
                <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.zoneCode }}</el-tag></template>
              </el-table-column>
              <el-table-column label="远程" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.isRemote ? 'warning' : 'info'" size="small">{{ row.isRemote ? '偏远' : '正常' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="可达" width="80" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.reachable ? 'success' : 'danger'" size="small">{{ row.reachable ? '可达' : '不可达' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="note" label="建议" min-width="200" show-overflow-tooltip />
            </el-table>
          </el-card>
        </template>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { carriersApi, type AddressValidateRequest, type AddressValidationResult } from '@/api/carriers'

const countries = [
  { code: 'US', name: '美国' },
  { code: 'DE', name: '德国' },
  { code: 'GB', name: '英国' },
  { code: 'FR', name: '法国' },
  { code: 'CA', name: '加拿大' },
  { code: 'AU', name: '澳大利亚' },
  { code: 'JP', name: '日本' },
]

const carriers = ref<{ code: string; name: string }[]>([])
const loading = ref(false)
const result = ref<AddressValidationResult | null>(null)

const form = reactive<AddressValidateRequest>({
  country: 'US',
  name: '',
  phone: '',
  state: '',
  city: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  carriers: [],
})

const scoreClass = computed(() => {
  const s = result.value?.qualityScore ?? 0
  if (s >= 85) return 'good'
  if (s >= 60) return 'mid'
  return 'low'
})

function fillSample(good: boolean): void {
  if (good) {
    Object.assign(form, {
      country: 'US',
      name: 'John Doe',
      phone: '+1 415 555 0100',
      state: 'CA',
      city: 'Cupertino',
      addressLine1: '1 Apple Park Way',
      addressLine2: '',
      postalCode: '95014',
      carriers: [],
    })
  } else {
    Object.assign(form, {
      country: 'US',
      name: '',
      phone: 'abc',
      state: '',
      city: '',
      addressLine1: '',
      addressLine2: '',
      postalCode: 'ABCDE',
      carriers: [],
    })
  }
}

async function onValidate(): Promise<void> {
  loading.value = true
  try {
    result.value = await carriersApi.validateAddress({ ...form })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    carriers.value = await carriersApi.list()
  } catch {
    carriers.value = []
  }
})
</script>

<style scoped>
.w-full {
  width: 100%;
}
.section-title {
  font-weight: 600;
  color: var(--ink-800);
}
.ml {
  margin-left: 8px;
}
.form-card,
.res-card {
  margin-bottom: 16px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 11px;
  border-radius: var(--r-pill);
  background: var(--orange-soft, #fff1e6);
  color: #d97706;
  font-size: 12px;
  font-weight: 600;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.score-row {
  display: flex;
  gap: 18px;
  align-items: center;
}
.score-box {
  width: 96px;
  height: 96px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex: none;
  box-shadow: var(--sh-2);
}
.score-box.good {
  background: linear-gradient(135deg, #34d399, #159e54);
}
.score-box.mid {
  background: linear-gradient(135deg, #fbbf24, #d97706);
}
.score-box.low {
  background: linear-gradient(135deg, #fb7185, #e11d48);
}
.score-num {
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
}
.score-label {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.92;
}
.norm {
  flex: 1;
  min-width: 0;
}
.norm-title {
  font-size: 12px;
  color: var(--ink-500);
  margin-bottom: 4px;
}
.norm-line {
  font-size: 14px;
  color: var(--ink-800);
  line-height: 1.7;
}
.norm-line.muted {
  color: var(--ink-500);
  font-size: 13px;
}
.zone-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--line);
}
.kv {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--ink-700);
}
.kv i {
  font-style: normal;
  color: var(--ink-500);
  font-size: 13px;
}
.issue {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  margin-bottom: 8px;
  font-size: 13.5px;
}
.issue.lv-error {
  background: #fef2f2;
  color: #b91c1c;
}
.issue.lv-warning {
  background: #fff7ed;
  color: #c2410c;
}
.issue.lv-info {
  background: #eff6ff;
  color: #1d4ed8;
}
.field-tag {
  margin-left: auto;
}
</style>
