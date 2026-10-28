<template>
  <div class="wms">
    <PageHeader
      title="仓储管理"
      subtitle="§15 海外仓与一件代发：国内/海外仓库 → 入库预报(ASN) → 收货上架 → 库存调整 → 拣货波次"
      icon="warehouse"
      accent="brand"
    >
      <template #actions>
        <el-button type="primary" @click="openWh"><AppIcon name="plus" :size="15" /> 新建仓库</el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="tab" class="wms-tabs">
      <!-- 仓库 -->
      <el-tab-pane label="仓库" name="wh">
        <el-row :gutter="16" class="stat-row">
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-brand"><AppIcon name="warehouse" :size="20" /></div><div class="stat-label">仓库总数</div><div class="stat-value">{{ warehouses.length }}</div><div class="stat-sub">国内 + 海外 + 中转</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-info"><AppIcon name="package" :size="20" /></div><div class="stat-label">在库 SKU 种类</div><div class="stat-value">{{ skuKinds }}</div><div class="stat-sub">去重 SKU 数</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-done"><AppIcon name="check" :size="20" /></div><div class="stat-label">库存总量</div><div class="stat-value">{{ totalQty }}</div><div class="stat-sub">全部仓库数量合计</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-warn"><AppIcon name="pin" :size="20" /></div><div class="stat-label">海外仓 / 中转仓</div><div class="stat-value">{{ overseasCount }} / {{ transferCount }}</div><div class="stat-sub">备货主力 / 货代作业</div></el-card></el-col>
        </el-row>
        <el-card v-loading="lwh" class="list-card" shadow="never">
          <el-table :data="warehouses" empty-text="暂无仓库" row-key="id">
            <el-table-column label="仓库 ID" prop="id" min-width="150"><template #default="{ row }"><span class="mono">{{ row.id }}</span></template></el-table-column>
            <el-table-column label="仓库名称" prop="name" min-width="200" />
            <el-table-column label="类型" width="110"><template #default="{ row }"><el-tag :type="warehouseTypeType(row.type)" size="small" effect="light">{{ warehouseTypeLabel(row.type) }}</el-tag></template></el-table-column>
            <el-table-column label="区域/国家" min-width="120"><template #default="{ row }">{{ row.region || '—' }}</template></el-table-column>
            <el-table-column label="建档时间" min-width="170"><template #default="{ row }">{{ fmtTime(row.createdAt) }}</template></el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 入库 ASN -->
      <el-tab-pane label="入库(ASN)" name="asn">
        <el-row :gutter="16" class="stat-row">
          <el-col v-for="s in ASN_STATES" :key="s" :span="8"><el-card class="stat-card" shadow="hover"><div class="stat-ico" :class="asnIco(s)"><AppIcon name="inbox" :size="20" /></div><div class="stat-label">{{ asnLabel(s) }}</div><div class="stat-value">{{ asnCount(s) }}</div><div class="stat-sub">状态：{{ s }}</div></el-card></el-col>
        </el-row>
        <el-card v-loading="lasn" class="list-card" shadow="never">
          <div class="toolbar">
            <el-button type="primary" @click="openAsn"><AppIcon name="plus" :size="15" /> 新建入库预报</el-button>
            <el-button text @click="refreshAsns"><AppIcon name="refresh" :size="15" /> 刷新</el-button>
          </div>
          <el-table :data="asns" empty-text="暂无入库单" row-key="id">
            <el-table-column label="ASN 单号" prop="id" min-width="150"><template #default="{ row }"><span class="mono">{{ row.id }}</span></template></el-table-column>
            <el-table-column label="目标仓库" min-width="200"><template #default="{ row }">{{ whName(row.warehouseId) }}</template></el-table-column>
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="asnType(row.status)" size="small" effect="light">{{ asnLabel(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="创建时间" min-width="170"><template #default="{ row }">{{ fmtTime(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" min-width="200" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === 'pending'" type="warning" link :loading="actingId === row.id" @click="receive(row)">收货</el-button>
                <el-button v-if="row.status === 'received'" type="primary" link :loading="actingId === row.id" @click="openPutaway(row)">上架</el-button>
                <el-tag v-if="row.status === 'closed'" type="success" size="small" effect="plain">已关闭</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 库存 -->
      <el-tab-pane label="库存" name="inv">
        <el-row :gutter="16" class="stat-row">
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-brand"><AppIcon name="package" :size="20" /></div><div class="stat-label">SKU 种类</div><div class="stat-value">{{ inventory.length }}</div><div class="stat-sub">库存记录数</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-done"><AppIcon name="check" :size="20" /></div><div class="stat-label">可用库存总量</div><div class="stat-value">{{ totalQty }}</div><div class="stat-sub">qty 合计</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-warn"><AppIcon name="lock" :size="20" /></div><div class="stat-label">锁定总量</div><div class="stat-value">{{ totalLocked }}</div><div class="stat-sub">lockedQty 合计</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-info"><AppIcon name="warehouse" :size="20" /></div><div class="stat-label">覆盖仓库</div><div class="stat-value">{{ invWhCount }}</div><div class="stat-sub">有库存的仓库数</div></el-card></el-col>
        </el-row>
        <el-card v-loading="linv" class="list-card" shadow="never">
          <div class="toolbar">
            <el-button type="primary" @click="openAdjust(null)"><AppIcon name="swap" :size="15" /> 库存调整</el-button>
            <el-button text @click="refreshInventory"><AppIcon name="refresh" :size="15" /> 刷新</el-button>
          </div>
          <el-table :data="inventory" empty-text="暂无库存" row-key="id">
            <el-table-column label="库存 ID" prop="id" min-width="140"><template #default="{ row }"><span class="mono">{{ row.id }}</span></template></el-table-column>
            <el-table-column label="仓库" min-width="200"><template #default="{ row }">{{ whName(row.warehouseId) }}</template></el-table-column>
            <el-table-column label="SKU" prop="skuId" min-width="140"><template #default="{ row }"><span class="mono">{{ row.skuId }}</span></template></el-table-column>
            <el-table-column label="库位" min-width="130"><template #default="{ row }"><span class="mono strong-cell">{{ row.binCode || '—' }}</span></template></el-table-column>
            <el-table-column label="可用数量" prop="qty" min-width="110" />
            <el-table-column label="锁定" prop="lockedQty" min-width="90" />
            <el-table-column label="操作" min-width="110" fixed="right"><template #default="{ row }"><el-button type="primary" link @click="openAdjust(row)">调整</el-button></template></el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 拣货 -->
      <el-tab-pane label="拣货" name="pick">
        <el-row :gutter="16" class="stat-row">
          <el-col v-for="s in PICK_STATES" :key="s" :span="8"><el-card class="stat-card" shadow="hover"><div class="stat-ico" :class="pickIco(s)"><AppIcon name="truck" :size="20" /></div><div class="stat-label">{{ pickLabel(s) }}</div><div class="stat-value">{{ pickCount(s) }}</div><div class="stat-sub">状态：{{ s }}</div></el-card></el-col>
        </el-row>
        <el-card v-loading="lpick" class="list-card" shadow="never">
          <div class="toolbar">
            <el-button type="primary" @click="openWave"><AppIcon name="plus" :size="15" /> 创建拣货波次</el-button>
            <el-button text @click="refreshPicks"><AppIcon name="refresh" :size="15" /> 刷新</el-button>
          </div>
          <el-table :data="picks" empty-text="暂无拣货任务" row-key="id">
            <el-table-column label="任务 ID" prop="id" min-width="150"><template #default="{ row }"><span class="mono">{{ row.id }}</span></template></el-table-column>
            <el-table-column label="仓库" min-width="200"><template #default="{ row }">{{ whName(row.warehouseId) }}</template></el-table-column>
            <el-table-column label="关联订单" min-width="140"><template #default="{ row }"><span class="mono">{{ row.orderId || '—' }}</span></template></el-table-column>
            <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="pickType(row.status)" size="small" effect="light">{{ pickLabel(row.status) }}</el-tag></template></el-table-column>
            <el-table-column label="创建时间" min-width="170"><template #default="{ row }">{{ fmtTime(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" min-width="110" fixed="right"><template #default="{ row }"><el-button v-if="row.status !== 'done'" type="success" link :loading="actingId === row.id" @click="complete(row)">完成</el-button><el-tag v-else type="success" size="small" effect="plain">已终态</el-tag></template></el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 货架 / 库位管理 -->
      <el-tab-pane label="货架/库位" name="bin">
        <el-row :gutter="16" class="stat-row">
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-info"><AppIcon name="pin" :size="20" /></div><div class="stat-label">库位总数</div><div class="stat-value">{{ bins.length }}</div><div class="stat-sub">全部仓库货架位</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-done"><AppIcon name="check" :size="20" /></div><div class="stat-label">已占用库位</div><div class="stat-value">{{ binUsedCount }}</div><div class="stat-sub">有库存的库位</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-warn"><AppIcon name="package" :size="20" /></div><div class="stat-label">库位在库总量</div><div class="stat-value">{{ binTotalQty }}</div><div class="stat-sub">占用件数合计</div></el-card></el-col>
          <el-col :span="6"><el-card class="stat-card" shadow="hover"><div class="stat-ico ico-brand"><AppIcon name="warehouse" :size="20" /></div><div class="stat-label">覆盖仓库</div><div class="stat-value">{{ binWhCount }}</div><div class="stat-sub">已建档库位的仓库</div></el-card></el-col>
        </el-row>
        <el-card v-loading="lbin" class="list-card" shadow="never">
          <div class="toolbar">
            <el-button type="primary" @click="openBin"><AppIcon name="plus" :size="15" /> 新建库位</el-button>
            <el-select v-model="binWhFilter" placeholder="全部仓库" clearable style="width: 240px">
              <el-option v-for="w in warehouses" :key="w.id" :label="`${w.name}（${WAREHOUSE_TYPE_LABELS[w.type]}）`" :value="w.id" />
            </el-select>
            <el-button text @click="refreshBins"><AppIcon name="refresh" :size="15" /> 刷新</el-button>
          </div>
          <el-table :data="filteredBins" empty-text="暂无库位，点击「新建库位」建档" row-key="id">
            <el-table-column label="库位编码" min-width="150">
              <template #default="{ row }"><span class="mono strong-cell">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column label="库区" min-width="140">
              <template #default="{ row }">{{ row.zone || '—' }}</template>
            </el-table-column>
            <el-table-column label="所属仓库" min-width="220">
              <template #default="{ row }">{{ row.warehouseName }}</template>
            </el-table-column>
            <el-table-column label="占用 SKU" prop="skuKinds" min-width="110" />
            <el-table-column label="在库数量" prop="totalQty" min-width="110" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.totalQty > 0 ? 'warning' : 'success'" size="small" effect="light">
                  {{ row.totalQty > 0 ? '已占用' : '空闲' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="建档时间" min-width="170">
              <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" min-width="110" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="danger"
                  link
                  :disabled="row.totalQty > 0"
                  :loading="actingId === row.id"
                  @click="removeBin(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建仓库 -->
    <el-dialog v-model="whVisible" title="新建仓库" width="440px">
      <el-form label-width="92px">
        <el-form-item label="仓库名称" required><el-input v-model="whForm.name" placeholder="如：深圳前海国内仓 / US-West 海外仓" /></el-form-item>
        <el-form-item label="仓库类型" required>
          <el-radio-group v-model="whForm.type">
            <el-radio value="domestic">国内仓</el-radio>
            <el-radio value="overseas">海外仓</el-radio>
            <el-radio value="transfer">中转仓（货代）</el-radio>
          </el-radio-group>
          <div class="hint">
            {{
              whForm.type === 'transfer'
                ? '中转仓供货代收货 / 打包 / 贴跨境面单使用，创建后会自动出现在「中转仓作业看板」'
                : whForm.type === 'overseas'
                  ? '海外仓用于跨境备货（先囤货再卖）'
                  : '国内仓用于收货集货、国内段作业'
            }}
          </div>
        </el-form-item>
        <el-form-item
          v-if="whForm.type !== 'domestic'"
          :label="whForm.type === 'overseas' ? '国家/区域' : '城市/口岸'"
          :required="whForm.type === 'overseas'"
        >
          <el-input
            v-model="whForm.region"
            :placeholder="whForm.type === 'overseas' ? '如：US / DE / JP' : '如：深圳 / 义乌（可选）'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="whVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmWh">提交</el-button>
      </template>
    </el-dialog>

    <!-- 新建 ASN -->
    <el-dialog v-model="asnVisible" title="新建入库预报(ASN)" width="440px">
      <el-form label-width="92px">
        <el-form-item label="目标仓库" required>
          <el-select v-model="asnForm.warehouseId" placeholder="请选择仓库" class="full">
            <el-option v-for="w in warehouses" :key="w.id" :label="`${w.name}（${WAREHOUSE_TYPE_LABELS[w.type]}）`" :value="w.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="asnVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="warehouses.length === 0" @click="confirmAsn">创建预报</el-button>
      </template>
    </el-dialog>

    <!-- 上架 -->
    <el-dialog v-model="putVisible" title="上架（实物入位 + 增加库存）" width="460px">
      <el-form label-width="92px">
        <el-form-item label="SKU" required><el-input v-model="putForm.skuId" placeholder="内部 SKU，如 SKU-A100" /></el-form-item>
        <el-form-item label="上架数量" required><el-input-number v-model="putForm.qty" :min="1" :step="1" controls-position="right" /></el-form-item>
        <el-form-item label="库位编码" required><el-input v-model="putForm.binCode" placeholder="如 A-01（不存在自动建库位）" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="putVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmPutaway">确认上架</el-button>
      </template>
    </el-dialog>

    <!-- 库存调整 -->
    <el-dialog v-model="adjVisible" title="库存调整（入库 / 出库 / 盘点）" width="460px">
      <el-form label-width="92px">
        <el-form-item label="仓库" required>
          <el-select v-model="adjForm.warehouseId" placeholder="请选择仓库" class="full" :disabled="!!adjTarget">
            <el-option v-for="w in warehouses" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="SKU" required><el-input v-model="adjForm.skuId" :disabled="!!adjTarget" placeholder="如 SKU-A100" /></el-form-item>
        <el-form-item label="库位（可选）"><el-input v-model="adjForm.binId" placeholder="留空走该仓该 SKU 默认行" /></el-form-item>
        <el-form-item label="数量变动" required>
          <el-input-number v-model="adjForm.delta" :step="1" controls-position="right" />
          <span class="hint">正=入库，负=出库（出库不得为负）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmAdjust">提交调整</el-button>
      </template>
    </el-dialog>

    <!-- 拣货波次 -->
    <el-dialog v-model="waveVisible" title="创建拣货波次" width="460px">
      <el-form label-width="92px">
        <el-form-item label="仓库" required>
          <el-select v-model="waveForm.warehouseId" placeholder="请选择仓库" class="full">
            <el-option v-for="w in warehouses" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单号" required>
          <el-input v-model="waveForm.orderIds" type="textarea" :rows="3" placeholder="每行一个订单号，如 ORD-2001" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="waveVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="warehouses.length === 0" @click="confirmWave">生成任务</el-button>
      </template>
    </el-dialog>

    <!-- 新建库位（货架编号） -->
    <el-dialog v-model="binVisible" title="新建库位（货架编号）" width="460px">
      <el-form label-width="92px">
        <el-form-item label="所属仓库" required>
          <el-select v-model="binForm.warehouseId" placeholder="请选择仓库" class="full">
            <el-option v-for="w in warehouses" :key="w.id" :label="`${w.name}（${WAREHOUSE_TYPE_LABELS[w.type]}）`" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="库位编码" required>
          <el-input v-model="binForm.code" placeholder="如 A-01-01（区-架-层）" />
        </el-form-item>
        <el-form-item label="库区">
          <el-input v-model="binForm.zone" placeholder="如 A 区 / 拣货区（可选）" />
        </el-form-item>
      </el-form>
      <div class="hint">
        编码建议遵循「区-架-层-位」（如 A-01-02），同一仓库内编码不可重复；库位上有库存时不允许删除。
      </div>
      <template #footer>
        <el-button @click="binVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmBin">创建库位</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  wmsApi,
  type WarehouseDto,
  type AsnDto,
  type InventoryDto,
  type PickTaskDto,
  type BinDto,
  type WarehouseType,
  type AsnStatus,
  type PickStatus,
  WAREHOUSE_TYPE_LABELS,
  WAREHOUSE_TYPE_TYPE,
  ASN_STATUS_LABELS,
  ASN_STATUS_TYPE,
  PICK_STATUS_LABELS,
  PICK_STATUS_TYPE,
} from '@/api/wms'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 仓储管理页（任务 2.2 入库/库存/拣货 + 2.3 海外仓模型，方案 §15）：仓库 / ASN / 库存 / 拣货四视图；演示/正式双路通。

const ASN_STATES: AsnStatus[] = ['pending', 'received', 'closed']
const PICK_STATES: PickStatus[] = ['pending', 'done']

const tab = ref('wh')
const warehouses = ref<WarehouseDto[]>([])
const asns = ref<AsnDto[]>([])
const inventory = ref<InventoryDto[]>([])
const picks = ref<PickTaskDto[]>([])
const bins = ref<BinDto[]>([])
const lwh = ref(false)
const lasn = ref(false)
const linv = ref(false)
const lpick = ref(false)
const lbin = ref(false)
const saving = ref(false)
const actingId = ref('')

/** 货架管理：按仓库过滤库位（'' = 全部仓库） */
const binWhFilter = ref('')
const filteredBins = computed(() =>
  binWhFilter.value ? bins.value.filter((b) => b.warehouseId === binWhFilter.value) : bins.value,
)
const transferCount = computed(() => warehouses.value.filter((w) => w.type === 'transfer').length)
const binUsedCount = computed(() => bins.value.filter((b) => b.totalQty > 0).length)
const binTotalQty = computed(() => bins.value.reduce((s, b) => s + b.totalQty, 0))
const binWhCount = computed(() => new Set(bins.value.map((b) => b.warehouseId)).size)

const skuKinds = computed(() => new Set(inventory.value.map((i) => i.skuId)).size)
const totalQty = computed(() => inventory.value.reduce((s, i) => s + i.qty, 0))
const totalLocked = computed(() => inventory.value.reduce((s, i) => s + i.lockedQty, 0))
const overseasCount = computed(() => warehouses.value.filter((w) => w.type === 'overseas').length)
const invWhCount = computed(() => new Set(inventory.value.map((i) => i.warehouseId)).size)

function asnCount(s: AsnStatus): number {
  return asns.value.filter((a) => a.status === s).length
}
function pickCount(s: PickStatus): number {
  return picks.value.filter((p) => p.status === s).length
}
function whName(id: string): string {
  return warehouses.value.find((w) => w.id === id)?.name ?? id
}
function warehouseTypeType(t: WarehouseType): string {
  return WAREHOUSE_TYPE_TYPE[t]
}
function warehouseTypeLabel(t: WarehouseType): string {
  return WAREHOUSE_TYPE_LABELS[t]
}
function asnLabel(s: AsnStatus): string {
  return ASN_STATUS_LABELS[s]
}
function asnType(s: AsnStatus): string {
  return ASN_STATUS_TYPE[s]
}
function pickLabel(s: PickStatus): string {
  return PICK_STATUS_LABELS[s]
}
function pickType(s: PickStatus): string {
  return PICK_STATUS_TYPE[s]
}
function asnIco(_s: AsnStatus): string {
  return 'ico-brand'
}
function pickIco(_s: PickStatus): string {
  return 'ico-info'
}
function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN', { hour12: false })
}

// —— 仓库 ——
const whVisible = ref(false)
const whForm = reactive({ name: '', type: 'domestic' as WarehouseType, region: '' })
function openWh() {
  whForm.name = ''
  whForm.type = 'domestic'
  whForm.region = ''
  whVisible.value = true
}
async function confirmWh() {
  if (!whForm.name.trim()) return ElMessage.warning('请输入仓库名称')
  if (whForm.type === 'overseas' && !whForm.region.trim()) return ElMessage.warning('海外仓必须填写国家/区域')
  saving.value = true
  try {
    await wmsApi.createWarehouse({ name: whForm.name.trim(), type: whForm.type, region: whForm.region.trim() || undefined })
    ElMessage.success('仓库已创建')
    whVisible.value = false
    await refreshWarehouses()
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败')
  } finally {
    saving.value = false
  }
}

// —— 库位 / 货架管理 ——
const binVisible = ref(false)
const binForm = reactive({ warehouseId: '', code: '', zone: '' })
async function refreshBins(): Promise<void> {
  lbin.value = true
  try {
    bins.value = await wmsApi.listBins()
  } catch {
    bins.value = []
  } finally {
    lbin.value = false
  }
}
function openBin(): void {
  if (warehouses.value.length === 0) {
    ElMessage.warning('请先创建仓库，再为其建立库位')
    return
  }
  binForm.warehouseId = binWhFilter.value || warehouses.value[0].id
  binForm.code = ''
  binForm.zone = ''
  binVisible.value = true
}
async function confirmBin(): Promise<void> {
  if (!binForm.warehouseId) {
    ElMessage.warning('请选择所属仓库')
    return
  }
  if (!binForm.code.trim()) {
    ElMessage.warning('请输入库位编码（如 A-01-01）')
    return
  }
  saving.value = true
  try {
    await wmsApi.createBin({
      warehouseId: binForm.warehouseId,
      code: binForm.code.trim(),
      zone: binForm.zone.trim() || undefined,
    })
    ElMessage.success('库位已创建')
    binVisible.value = false
    await refreshBins()
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败')
  } finally {
    saving.value = false
  }
}
async function removeBin(row: BinDto): Promise<void> {
  if (row.totalQty > 0) {
    ElMessage.warning(`库位 ${row.code} 仍有 ${row.totalQty} 件库存，请先移库 / 清零`)
    return
  }
  actingId.value = row.id
  try {
    await wmsApi.deleteBin(row.id)
    ElMessage.success(`库位 ${row.code} 已删除`)
    await refreshBins()
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败')
  } finally {
    actingId.value = ''
  }
}

// —— ASN ——
const asnVisible = ref(false)
const asnForm = reactive({ warehouseId: '' })
function openAsn() {
  asnForm.warehouseId = warehouses.value[0]?.id ?? ''
  asnVisible.value = true
}
async function confirmAsn() {
  if (!asnForm.warehouseId) return ElMessage.warning('请选择仓库')
  saving.value = true
  try {
    await wmsApi.createAsn(asnForm.warehouseId)
    ElMessage.success('入库预报已创建（pending）')
    asnVisible.value = false
    await refreshAsns()
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败')
  } finally {
    saving.value = false
  }
}
async function receive(row: AsnDto) {
  actingId.value = row.id
  try {
    await wmsApi.receiveAsn(row.id)
    ElMessage.success('已收货（received）')
    await refreshAsns()
  } catch (e) {
    ElMessage.error((e as Error).message || '收货失败')
  } finally {
    actingId.value = ''
  }
}
const putVisible = ref(false)
const putForm = reactive({ id: '', skuId: '', qty: 1, binCode: '' })
function openPutaway(row: AsnDto) {
  putForm.id = row.id
  putForm.skuId = ''
  putForm.qty = 1
  putForm.binCode = ''
  putVisible.value = true
}
async function confirmPutaway() {
  if (!putForm.skuId.trim() || putForm.qty < 1 || !putForm.binCode.trim()) return ElMessage.warning('请填写 SKU / 数量≥1 / 库位')
  saving.value = true
  try {
    await wmsApi.putaway(putForm.id, { skuId: putForm.skuId.trim(), qty: putForm.qty, binCode: putForm.binCode.trim() })
    ElMessage.success('上架完成，ASN 已关闭，库存已增加')
    putVisible.value = false
    await Promise.all([refreshAsns(), refreshInventory()])
  } catch (e) {
    ElMessage.error((e as Error).message || '上架失败')
  } finally {
    saving.value = false
  }
}

// —— 库存调整 ——
const adjVisible = ref(false)
const adjTarget = ref<InventoryDto | null>(null)
const adjForm = reactive({ warehouseId: '', skuId: '', binId: '', delta: 0 })
function openAdjust(row: InventoryDto | null) {
  adjTarget.value = row
  adjForm.warehouseId = row?.warehouseId ?? warehouses.value[0]?.id ?? ''
  adjForm.skuId = row?.skuId ?? ''
  adjForm.binId = row?.binId ?? ''
  adjForm.delta = 0
  adjVisible.value = true
}
async function confirmAdjust() {
  if (!adjForm.warehouseId || !adjForm.skuId.trim()) return ElMessage.warning('请填写仓库与 SKU')
  if (adjForm.delta === 0) return ElMessage.warning('数量变动不能为 0')
  saving.value = true
  try {
    await wmsApi.adjustInventory({
      warehouseId: adjForm.warehouseId,
      skuId: adjForm.skuId.trim(),
      delta: adjForm.delta,
      binId: adjForm.binId.trim() || undefined,
    })
    ElMessage.success('库存已调整')
    adjVisible.value = false
    await refreshInventory()
  } catch (e) {
    ElMessage.error((e as Error).message || '调整失败')
  } finally {
    saving.value = false
  }
}

// —— 拣货波次 ——
const waveVisible = ref(false)
const waveForm = reactive({ warehouseId: '', orderIds: '' })
function openWave() {
  waveForm.warehouseId = warehouses.value[0]?.id ?? ''
  waveForm.orderIds = ''
  waveVisible.value = true
}
async function confirmWave() {
  if (!waveForm.warehouseId) return ElMessage.warning('请选择仓库')
  const ids = waveForm.orderIds.split('\n').map((s) => s.trim()).filter(Boolean)
  if (!ids.length) return ElMessage.warning('请至少填写一个订单号')
  saving.value = true
  try {
    const tasks = await wmsApi.createWave(waveForm.warehouseId, ids)
    ElMessage.success(`已生成 ${tasks.length} 个拣货任务`)
    waveVisible.value = false
    await refreshPicks()
  } catch (e) {
    ElMessage.error((e as Error).message || '生成失败')
  } finally {
    saving.value = false
  }
}
async function complete(row: PickTaskDto) {
  actingId.value = row.id
  try {
    await wmsApi.completePick(row.id)
    ElMessage.success('拣货任务已完成（done）')
    await refreshPicks()
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败')
  } finally {
    actingId.value = ''
  }
}

// —— 刷新 ——
async function refreshWarehouses() {
  lwh.value = true
  try {
    warehouses.value = await wmsApi.listWarehouses()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载仓库失败')
  } finally {
    lwh.value = false
  }
}
async function refreshAsns() {
  lasn.value = true
  try {
    asns.value = await wmsApi.listAsns()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载入库单失败')
  } finally {
    lasn.value = false
  }
}
async function refreshInventory() {
  linv.value = true
  try {
    inventory.value = await wmsApi.listInventory()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载库存失败')
  } finally {
    linv.value = false
  }
}
async function refreshPicks() {
  lpick.value = true
  try {
    picks.value = await wmsApi.listPicks()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载拣货任务失败')
  } finally {
    lpick.value = false
  }
}

onMounted(() => {
  refreshWarehouses()
  refreshAsns()
  refreshInventory()
  refreshPicks()
  refreshBins()
})
</script>

<style scoped>
.wms {
  padding: 4px;
}
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: 16px;
}
.stat-ico {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.ico-brand {
  background: rgba(79, 110, 247, 0.12);
  color: var(--brand-500, #4f6ef7);
}
.ico-info {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}
.ico-done {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}
.ico-warn {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.stat-label {
  font-size: 13px;
  color: var(--text-muted, #8a94a6);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin: 2px 0;
}
.stat-sub {
  font-size: 12px;
  color: var(--text-muted, #aab2c0);
}
.list-card {
  border-radius: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.full {
  width: 100%;
}
.hint {
  font-size: 12px;
  color: var(--text-muted, #aab2c0);
  margin-left: 8px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
/* 货架编号 / 库位编码：需要一眼扫到，故加粗提色 */
.strong-cell {
  font-weight: 600;
  color: var(--ink-800, #1f2937);
}
.hint {
  margin-top: 4px;
  line-height: 1.6;
}
</style>
