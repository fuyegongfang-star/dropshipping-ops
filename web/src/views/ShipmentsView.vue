<template>
  <div class="shipments">
    <PageHeader
      title="两段式运单编排"
      subtitle="头程（国内→海外仓）+ 尾程（海外仓→买家）拆分建单，逐段运单号与成本独立可见"
      icon="truck"
      accent="brand"
    >
      <template #actions>
        <span class="leg-pill"><AppIcon name="layers" :size="13" />§14 头程/尾程模型</span>
      </template>
    </PageHeader>

    <el-row :gutter="16">
      <!-- 左：编排表单 -->
      <el-col :span="9">
        <el-card class="form-card">
          <template #header><span class="section-title">运单参数</span></template>

          <el-form label-position="top">
            <el-form-item label="头程承运商（国内 → 海外仓）">
              <el-select v-model="form.firstCarrierCode" class="w-full" placeholder="选择头程承运商">
                <el-option v-for="c in carriers" :key="c.code" :label="`${c.name}`" :value="c.code" />
              </el-select>
            </el-form-item>

            <el-form-item label="尾程承运商（海外仓 → 买家）">
              <el-select
                v-model="form.lastCarrierCode"
                class="w-full"
                clearable
                placeholder="留空 = 头程承运商一票到底"
              >
                <el-option v-for="c in carriers" :key="c.code" :label="`${c.name}`" :value="c.code" />
              </el-select>
            </el-form-item>

            <el-form-item label="转运节点 / 海外仓代码">
              <el-input v-model="form.transitHub" placeholder="如 OVERSEAS-US-WEST" />
            </el-form-item>

            <el-row :gutter="8">
              <el-col :span="12">
                <el-form-item label="始发地">
                  <el-input v-model="form.origin" placeholder="如 CN-SZ" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目的国">
                  <el-select v-model="form.destCountry" class="w-full">
                    <el-option v-for="c in countries" :key="c.code" :label="c.name" :value="c.code" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="重量 (kg)">
              <el-input-number v-model="form.weightKg" class="w-full" :min="0.1" :max="500" :step="0.5" />
            </el-form-item>

            <el-form-item label="尺寸 长 × 宽 × 高 (cm)">
              <el-row :gutter="8" class="dims">
                <el-col :span="8"><el-input-number v-model="form.lengthCm" class="w-full" :min="1" :max="200" /></el-col>
                <el-col :span="8"><el-input-number v-model="form.widthCm" class="w-full" :min="1" :max="200" /></el-col>
                <el-col :span="8"><el-input-number v-model="form.heightCm" class="w-full" :min="1" :max="200" /></el-col>
              </el-row>
            </el-form-item>

            <el-form-item label="收件人（尾程投递）">
              <el-input v-model="form.recipientName" placeholder="收件人姓名" />
            </el-form-item>

            <el-button type="primary" class="w-full run-btn" :loading="loading" @click="run">
              <AppIcon name="bolt" :size="15" class="btn-ico" />编排运单
            </el-button>
          </el-form>

          <p class="text-hint form-hint">
            计费重取「实重」与「体积重(长×宽×高/5000)」较大者；两段各自独立建单，
            尾程目的国与收件人沿用上方参数。
          </p>
        </el-card>
      </el-col>

      <!-- 右：编排结果 + 路由图 -->
      <el-col :span="15">
        <el-card v-loading="loading" class="result-card">
          <template #header>
            <div class="card-head">
              <span class="section-title">运单链路</span>
              <span v-if="result" class="count-pill">总成本 ${{ result.totalCarrierCost.toFixed(2) }}</span>
            </div>
          </template>

          <template v-if="result">
            <!-- 路由图：国内仓 → 海外仓 → 买家，逐段承运商标注 -->
            <div class="route">
              <div class="node">
                <span class="node-ico"><AppIcon name="package" :size="16" /></span>
                <span class="node-label">国内仓</span>
                <span class="node-sub">{{ form.origin }}</span>
              </div>
              <div class="seg" v-for="(leg, i) in result.legs" :key="i">
                <span class="seg-line" :class="`seg-${leg.legType}`" />
                <span class="seg-tag" :class="`tag-${leg.legType}`">
                  {{ LEG_LABELS[leg.legType] }} · {{ leg.carrierName }}
                </span>
                <div class="node">
                  <span class="node-ico hub"><AppIcon name="warehouse" :size="16" /></span>
                  <span class="node-label">{{ i === 0 ? leg.transitHub : '买家' }}</span>
                  <span class="node-sub">
                    {{ i === 0 ? '海外仓' : form.destCountry }} · {{ leg.waybillNo }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 逐段明细 -->
            <div
              v-for="(leg, i) in result.legs"
              :key="i"
              class="leg"
            >
              <div class="leg-head">
                <span class="leg-badge" :class="`tag-${leg.legType}`">{{ LEG_LABELS[leg.legType] }}</span>
                <span class="leg-carrier">{{ leg.carrierName }}</span>
                <span class="leg-days"><AppIcon name="clock" :size="13" />{{ leg.estimatedLeadDays }} 天</span>
                <el-button size="small" type="primary" plain class="leg-print" :loading="labelLoading" @click="openLabel(leg)">
                  <AppIcon name="print" :size="13" class="btn-ico" />打印面单
                </el-button>
              </div>
              <div class="leg-grid">
                <div><span class="lbl">运单号</span><span class="val">{{ leg.waybillNo }}</span></div>
                <div><span class="lbl">轨迹号</span><span class="val">{{ leg.trackingNo || '—' }}</span></div>
                <div><span class="lbl">本段成本</span><span class="val cost">${{ leg.carrierCost.toFixed(2) }}</span></div>
                <div><span class="lbl">转运节点</span><span class="val">{{ leg.transitHub || '—' }}</span></div>
              </div>
            </div>

            <p class="text-hint result-hint">
              两段运单各自独立，尾程优先走聚合平台兜底（§3e/§20）。总成本 = 各段成本之和，
              加价后客户售价见「运费试算」页。
            </p>
          </template>

          <div v-else class="app-empty">
            <span class="app-empty-ico"><AppIcon name="truck" :size="26" /></span>
            <span class="app-empty-text">选择头程/尾程承运商并点击「编排运单」，查看拆分后的两段运单</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 面单预览对话框（§3/§11 PDF + ZPL 双格式） -->
    <el-dialog v-model="labelVisible" title="面单预览" width="460px" append-to-body>
      <div v-if="labelData" class="label-prev">
        <div class="label-pdf">
          <iframe :src="pdfSrc" class="label-frame" title="面单 PDF" />
        </div>
        <div class="label-meta">
          <span>运单号：<b>{{ labelData.waybillNo }}</b></span>
          <a :href="pdfDownload" :download="labelData.fileName" class="label-dl">下载 PDF</a>
        </div>
        <div class="label-zpl">
          <div class="zpl-head">
            <span>ZPL II（热敏）</span>
            <el-button size="small" text type="primary" @click="copyZpl">复制</el-button>
          </div>
          <pre class="zpl-code">{{ labelData.zpl }}</pre>
        </div>
      </div>
      <div v-else class="app-empty"><span class="app-empty-text">生成中…</span></div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { carriersApi, LEG_LABELS, type ComposeLegsResult, type LegType, type ShipmentLeg, type LabelResult } from '@/api/carriers'
import type { Carrier } from '@/api/carriers'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 两段式运单编排页（任务 3.8，方案 §14 头程/尾程两段式物流模型）。
const countries = [
  { code: 'US', name: '美国 US' },
  { code: 'GB', name: '英国 GB' },
  { code: 'DE', name: '德国 DE' },
  { code: 'FR', name: '法国 FR' },
  { code: 'JP', name: '日本 JP' },
  { code: 'AU', name: '澳大利亚 AU' },
]

const carriers = ref<Carrier[]>([])
const loading = ref(false)
const result = ref<ComposeLegsResult | null>(null)

// 面单预览（§3/§11）
const labelVisible = ref(false)
const labelLoading = ref(false)
const labelData = ref<LabelResult | null>(null)
const pdfSrc = computed(() =>
  labelData.value ? `data:application/pdf;base64,${labelData.value.pdfBase64}` : '',
)
const pdfDownload = computed(() => pdfSrc.value)

async function openLabel(leg: ShipmentLeg): Promise<void> {
  labelLoading.value = true
  labelVisible.value = true
  labelData.value = null
  try {
    labelData.value = await carriersApi.createLabel({
      carrierCode: leg.carrierCode,
      carrierName: leg.carrierName,
      waybillNo: leg.waybillNo,
      trackingNo: leg.trackingNo,
      origin: form.origin,
      destCountry: form.destCountry,
      transitHub: leg.transitHub,
      legType: leg.legType,
      recipient: { name: form.recipientName, country: form.destCountry, city: '—', address1: '—' },
    })
  } catch (e) {
    ElMessage.error('面单生成失败：' + (e as Error).message)
  } finally {
    labelLoading.value = false
  }
}

async function copyZpl(): Promise<void> {
  if (!labelData.value) return
  try {
    await navigator.clipboard.writeText(labelData.value.zpl)
    ElMessage.success('ZPL 已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择')
  }
}

const form = reactive({
  firstCarrierCode: 'yunexpress',
  lastCarrierCode: 'yanwen',
  transitHub: 'OVERSEAS-US-WEST',
  origin: 'CN-SZ',
  destCountry: 'US',
  weightKg: 1.2,
  lengthCm: 20,
  widthCm: 15,
  heightCm: 10,
  recipientName: 'John Doe',
})

onMounted(async () => {
  try {
    carriers.value = (await carriersApi.list()) ?? []
  } catch {
    carriers.value = []
  }
})

async function run(): Promise<void> {
  if (!form.firstCarrierCode) {
    ElMessage.warning('请选择头程承运商')
    return
  }
  loading.value = true
  try {
    result.value = await carriersApi.composeLegs({
      firstCarrierCode: form.firstCarrierCode,
      lastCarrierCode: form.lastCarrierCode || undefined,
      transitHub: form.transitHub || undefined,
      shipment: {
        origin: form.origin,
        destCountry: form.destCountry,
        parcels: [
          { weightKg: form.weightKg, lengthCm: form.lengthCm, widthCm: form.widthCm, heightCm: form.heightCm },
        ],
        recipient: { name: form.recipientName, country: form.destCountry, city: '—', address1: '—' },
      },
    })
    const n = result.value.legs.length
    ElMessage.success(`已编排 ${n} 段运单，总成本 $${result.value.totalCarrierCost.toFixed(2)}`)
  } catch (e) {
    ElMessage.error('编排失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.w-full { width: 100%; }
.btn-ico { margin-right: 5px; }
.leg-pill {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: var(--r-pill); background: var(--surface); border: 1px solid var(--line);
  color: var(--ink-600); font-size: 13px; font-weight: 500;
}
.form-card :deep(.el-card__body) { padding: 18px 20px; }
.dims { width: 100%; }
.dims :deep(.el-input-number) { width: 100%; }
.run-btn { margin-top: 4px; }
.form-hint { margin: 14px 0 0; }
.card-head { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.card-head .section-title { margin: 0; }
.count-pill {
  font-size: 12px; font-weight: 600; color: var(--brand-700);
  background: var(--brand-soft); padding: 4px 10px; border-radius: var(--r-pill);
}

/* 路由图 */
.route { display: flex; align-items: stretch; flex-wrap: wrap; gap: 0; margin-bottom: 22px; }
.node {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; padding: 12px 14px; min-width: 110px;
  border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface);
}
.node-ico {
  width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  background: var(--brand-soft); color: var(--brand-600);
}
.node-ico.hub { background: #fff4e5; color: #d97706; }
.node-label { font-size: 13px; font-weight: 700; color: var(--ink-900); }
.node-sub { font-size: 11.5px; color: var(--ink-500); text-align: center; max-width: 130px; word-break: break-all; }
.seg { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 130px; padding: 0 6px; }
.seg-line { width: 100%; height: 3px; border-radius: 3px; background: var(--line); margin-bottom: 8px; }
.seg-line.seg-first { background: linear-gradient(90deg, var(--brand-400), var(--brand-600)); }
.seg-line.seg-last { background: linear-gradient(90deg, #fbbf24, #d97706); }
.seg-tag { font-size: 11.5px; font-weight: 600; padding: 3px 8px; border-radius: var(--r-pill); white-space: nowrap; }
.tag-first { background: var(--brand-soft); color: var(--brand-700); }
.tag-last { background: #fff4e5; color: #b45309; }
.tag-direct { background: #ecfdf5; color: #047857; }

/* 逐段明细 */
.leg {
  border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px;
  margin-bottom: 12px; background: var(--surface);
}
.leg-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.leg-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: var(--r-pill); }
.leg-carrier { font-size: 14px; font-weight: 700; color: var(--ink-900); }
.leg-days { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ink-500); }
.leg-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.leg-grid .lbl { display: block; font-size: 11px; color: var(--ink-400); margin-bottom: 2px; }
.leg-grid .val { font-size: 13px; font-weight: 600; color: var(--ink-800); word-break: break-all; }
.leg-grid .val.cost { color: var(--brand-600); }
.result-hint { margin: 6px 0 0; }
.leg-print { margin-left: 12px; }
.btn-ico { margin-right: 4px; }

/* 面单预览对话框 */
.label-prev { display: flex; flex-direction: column; gap: 12px; }
.label-pdf { border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; background: #fff; }
.label-frame { width: 100%; height: 220px; border: 0; }
.label-meta { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--ink-700); }
.label-dl { color: var(--brand-600); font-weight: 600; text-decoration: none; }
.label-zpl { border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.zpl-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg); font-size: 12px; color: var(--ink-600); border-bottom: 1px solid var(--line); }
.zpl-code { margin: 0; padding: 10px 12px; font-size: 11.5px; line-height: 1.6; color: var(--ink-700); white-space: pre-wrap; word-break: break-all; max-height: 160px; overflow: auto; }
</style>
