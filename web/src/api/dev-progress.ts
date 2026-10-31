/**
 * 开发进度数据 —— **本文件由 scripts/gen-progress.cjs 自动生成，请勿手工修改。**
 *
 * 生成命令：`npm run progress:gen`（读取 dev-schedule.md 的任务表）
 * 生成时间：2026-10-31T16:10:19.250Z
 * 源码提交：c5bd464
 *
 * 作用：让「演示模式」与「正式模式」都能在网页上直接看到开发进度与最近交付的能力，
 * 夜间自动开发每完成一批任务后重新生成并提交，次日刷新页面即可看到新内容。
 */

export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'skipped'

export interface DevTask {
  /** 任务号，如 '3.7' */
  id: string
  /** 所属阶段，如 '阶段3' */
  phase: string
  /** 任务名称 */
  name: string
  /** 关键产出 / 方案章节 */
  deliverable: string
  /** 依赖任务号 */
  deps: string
  /** 预估工期 */
  estimate: string
  /** 状态 */
  status: TaskStatus
  /** 对应前端页面路由（null 表示暂无界面，为纯后端能力） */
  route: string | null
}

export interface DevStats {
  total: number
  done: number
  doing: number
  todo: number
  blocked: number
  skipped: number
  /** 完成率（百分比，保留 1 位小数） */
  percent: number
}

/** 数据生成时间（ISO 字符串） */
export const DEV_PROGRESS_GENERATED_AT = "2026-10-31T16:10:20.265Z"

/** 数据对应的源码提交号（短 SHA） */
export const DEV_PROGRESS_COMMIT = "c5bd464"

/** 全部任务（按 dev-schedule.md 顺序） */
export const DEV_TASKS: DevTask[] = [
  {
    "id": "0.1",
    "phase": "阶段0",
    "name": "仓库初始化与目录结构",
    "deliverable": "NestJS+Vue3 monorepo 骨架；`.git`",
    "deps": "—",
    "estimate": "0.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "0.2",
    "phase": "阶段0",
    "name": "多租户骨架",
    "deliverable": "`tenant_id` 行级隔离 + 租户解析中间件（§0/§17）",
    "deps": "0.1",
    "estimate": "1d",
    "status": "done",
    "route": "/tenants"
  },
  {
    "id": "0.3",
    "phase": "阶段0",
    "name": "鉴权与 RBAC 基线",
    "deliverable": "JWT + CASL（§0/§22）",
    "deps": "0.2",
    "estimate": "1d",
    "status": "done",
    "route": null
  },
  {
    "id": "0.4",
    "phase": "阶段0",
    "name": "基础设施",
    "deliverable": "PostgreSQL / Redis / MinIO / Docker Compose（§11）",
    "deps": "0.1",
    "estimate": "0.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "0.5",
    "phase": "阶段0",
    "name": "开发规范工具链",
    "deliverable": "`.prettierrc`/`.eslintrc`/`.stylelintrc`/commitlint（§31）",
    "deps": "0.1",
    "estimate": "0.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "0.6",
    "phase": "阶段0",
    "name": "CI 基线",
    "deliverable": "`lint --check` + 类型检查卡点（§31.4）",
    "deps": "0.5",
    "estimate": "0.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "1.1",
    "phase": "阶段1",
    "name": "ChannelAdapter 框架",
    "deliverable": "统一接口：拉单/审单/推单/回传/轨迹（§3）",
    "deps": "0.3",
    "estimate": "1.5d",
    "status": "done",
    "route": "/orders"
  },
  {
    "id": "1.2",
    "phase": "阶段1",
    "name": "Shopify 接入（首渠道）",
    "deliverable": "首个适配器跑通（§3）",
    "deps": "1.1",
    "estimate": "1d",
    "status": "done",
    "route": "/channels"
  },
  {
    "id": "1.3",
    "phase": "阶段1",
    "name": "订单归集 + 状态机",
    "deliverable": "正向 8 态 + 逆向 + `order_events`（§13）",
    "deps": "0.2",
    "estimate": "2d",
    "status": "done",
    "route": "/orders"
  },
  {
    "id": "1.4",
    "phase": "阶段1",
    "name": "审单引擎",
    "deliverable": "地址/黑名单/库存/合规校验（§13/§18/§19）",
    "deps": "1.3",
    "estimate": "1d",
    "status": "done",
    "route": "/orders"
  },
  {
    "id": "1.5",
    "phase": "阶段1",
    "name": "履约路由（模式A 自动）",
    "deliverable": "系统自动选渠道（§4/§5）",
    "deps": "1.1",
    "estimate": "1d",
    "status": "done",
    "route": "/fulfillment"
  },
  {
    "id": "1.6",
    "phase": "阶段1",
    "name": "物流回传 + 轨迹(基础)",
    "deliverable": "回写运单/基础轨迹（§3）",
    "deps": "1.2",
    "estimate": "1d",
    "status": "done",
    "route": "/shipment-tracking"
  },
  {
    "id": "1.7",
    "phase": "阶段1",
    "name": "商品/SKU 中心",
    "deliverable": "平台↔内部↔供应商映射（§1）",
    "deps": "0.2",
    "estimate": "1.5d",
    "status": "done",
    "route": "/catalog"
  },
  {
    "id": "1.8",
    "phase": "阶段1",
    "name": "运费试算最小版",
    "deliverable": "重量/体积→计费重→选渠道（§4）",
    "deps": "1.1",
    "estimate": "1.5d",
    "status": "done",
    "route": "/quotes"
  },
  {
    "id": "1.9",
    "phase": "阶段1",
    "name": "供应商代发链路(基础)",
    "deliverable": "推单→回传→转平台运单（§21）",
    "deps": "1.1",
    "estimate": "1d",
    "status": "done",
    "route": "/suppliers-dropship"
  },
  {
    "id": "1.10",
    "phase": "阶段1",
    "name": "Amazon SP-API 评估",
    "deliverable": "FBA/FBM/LWA 可行性（§29）",
    "deps": "1.1",
    "estimate": "0.5d",
    "status": "done",
    "route": "/channels"
  },
  {
    "id": "2.1",
    "phase": "阶段2",
    "name": "国内渠道(淘宝/抖音)",
    "deliverable": "验证多平台适配（§3）",
    "deps": "1.2",
    "estimate": "1.5d",
    "status": "done",
    "route": "/channels"
  },
  {
    "id": "2.2",
    "phase": "阶段2",
    "name": "WMS 入库/库存/拣货",
    "deliverable": "ASN/上架/锁定/拣货波次（§15）",
    "deps": "0.4",
    "estimate": "2d",
    "status": "done",
    "route": "/warehouse"
  },
  {
    "id": "2.3",
    "phase": "阶段2",
    "name": "海外仓模型",
    "deliverable": "`warehouses`/`inventory`/海外仓备货（§15）",
    "deps": "2.2",
    "estimate": "1.5d",
    "status": "done",
    "route": "/warehouse"
  },
  {
    "id": "3.1",
    "phase": "阶段3",
    "name": "CarrierAdapter 框架",
    "deliverable": "镜像 ChannelAdapter（§3）",
    "deps": "0.3",
    "estimate": "1d",
    "status": "done",
    "route": null
  },
  {
    "id": "3.2",
    "phase": "阶段3",
    "name": "云途接入(SDK优先)",
    "deliverable": "`yunexpress-sdk` OAuth2+HMAC（§3 调研）",
    "deps": "3.1",
    "estimate": "1d",
    "status": "done",
    "route": "/carriers"
  },
  {
    "id": "3.3",
    "phase": "阶段3",
    "name": "DHL 接入",
    "deliverable": "OAuth2 + 沙箱审批（§3 调研）",
    "deps": "3.1",
    "estimate": "1.5d",
    "status": "done",
    "route": "/carriers"
  },
  {
    "id": "3.4",
    "phase": "阶段3",
    "name": "4PX / 燕文 接入",
    "deliverable": "MD5 签名（§3 调研）",
    "deps": "3.1",
    "estimate": "1.5d",
    "status": "done",
    "route": "/carriers"
  },
  {
    "id": "3.5",
    "phase": "阶段3",
    "name": "比价引擎 4 层 + 试算模式",
    "deliverable": "预热/可达性/实时池/护栏 + 试算开关（§5/§4）",
    "deps": "1.5/3.1",
    "estimate": "2d",
    "status": "done",
    "route": "/quotes"
  },
  {
    "id": "3.6",
    "phase": "阶段3",
    "name": "加价规则引擎 + 币种归一",
    "deliverable": "双价列/Markup/FX（§9/§10）",
    "deps": "3.5",
    "estimate": "1.5d",
    "status": "done",
    "route": "/pricing"
  },
  {
    "id": "3.7",
    "phase": "阶段3",
    "name": "运费试算门户(正式)",
    "deliverable": "商户自助试算+自选（§4）",
    "deps": "3.5",
    "estimate": "1.5d",
    "status": "done",
    "route": "/quotes"
  },
  {
    "id": "3.8",
    "phase": "阶段3",
    "name": "头程/尾程两段式",
    "deliverable": "`shipment_legs`(leg_type)（§14）",
    "deps": "1.3/3.1",
    "estimate": "1.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "3.9",
    "phase": "阶段3",
    "name": "面单 PDF/ZPL",
    "deliverable": "pdf-lib 处理（§3/§11）",
    "deps": "3.2",
    "estimate": "1d",
    "status": "done",
    "route": null
  },
  {
    "id": "3.10",
    "phase": "阶段3",
    "name": "报关/合规字段",
    "deliverable": "HS/IOSS/EORI/VAT/Section321（§19）",
    "deps": "1.4",
    "estimate": "1.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "3.11",
    "phase": "阶段3",
    "name": "轨迹双通道 + NDR",
    "deliverable": "推送+轮询兜底 + 异常工单（§3/§20）",
    "deps": "3.2/3.4",
    "estimate": "1.5d",
    "status": "done",
    "route": "/orders"
  },
  {
    "id": "3.12",
    "phase": "阶段3",
    "name": "地址校验 + 分区",
    "deliverable": "脏地址/邮编→zone（§18）",
    "deps": "1.4",
    "estimate": "1d",
    "status": "done",
    "route": "/address"
  },
  {
    "id": "3.13",
    "phase": "阶段3",
    "name": "聚合平台兜底",
    "deliverable": "AfterShip/17track 尾程（§3e）",
    "deps": "3.11",
    "estimate": "0.5d",
    "status": "done",
    "route": "/aggregator"
  },
  {
    "id": "4.1",
    "phase": "阶段4",
    "name": "收款账务 wallet+ledger",
    "deliverable": "复式记账/预充值/账期/退款（§16）",
    "deps": "0.3",
    "estimate": "2d",
    "status": "done",
    "route": "/wallet"
  },
  {
    "id": "4.2",
    "phase": "阶段4",
    "name": "商户账单 + 承运商对账",
    "deliverable": "bills/reconciliations（§9/§10）",
    "deps": "4.1/3.6",
    "estimate": "1.5d",
    "status": "done",
    "route": "/billing"
  },
  {
    "id": "4.3",
    "phase": "阶段4",
    "name": "利润核算(spread)",
    "deliverable": "Σ(sell−cost)（§9/§10）",
    "deps": "4.2",
    "estimate": "1d",
    "status": "done",
    "route": "/profit"
  },
  {
    "id": "4.4",
    "phase": "阶段4",
    "name": "多租户隔离强化",
    "deliverable": "schema-per-tenant 评估（§17）",
    "deps": "0.2",
    "estimate": "1d",
    "status": "done",
    "route": "/security"
  },
  {
    "id": "4.5",
    "phase": "阶段4",
    "name": "精细化 RBAC",
    "deliverable": "组织层级/scope（§22）",
    "deps": "0.3",
    "estimate": "1d",
    "status": "done",
    "route": "/rbac"
  },
  {
    "id": "4.6",
    "phase": "阶段4",
    "name": "运营配置后台",
    "deliverable": "加价/产品/费率卡 UI（§23）",
    "deps": "3.6/3.7",
    "estimate": "2d",
    "status": "done",
    "route": "/pricing"
  },
  {
    "id": "4.7",
    "phase": "阶段4",
    "name": "报表指标口径",
    "deliverable": "履约/物流/利润看板（§25）",
    "deps": "4.3",
    "estimate": "1.5d",
    "status": "done",
    "route": "/reports"
  },
  {
    "id": "4.8",
    "phase": "阶段4",
    "name": "理赔保险",
    "deliverable": "`claims` 流程（§20）",
    "deps": "3.11",
    "estimate": "1d",
    "status": "done",
    "route": "/claims"
  },
  {
    "id": "4.9",
    "phase": "阶段4",
    "name": "多语言多币种前端",
    "deliverable": "i18n + 本地币展示（§27）",
    "deps": "0.5",
    "estimate": "1.5d",
    "status": "done",
    "route": "/localization"
  },
  {
    "id": "5.1",
    "phase": "阶段5",
    "name": "风控体系",
    "deliverable": "规则引擎+评分（§26）",
    "deps": "1.3/4.5",
    "estimate": "2d",
    "status": "done",
    "route": "/risk"
  },
  {
    "id": "5.2",
    "phase": "阶段5",
    "name": "开放 API/ERP 集成",
    "deliverable": "OAuth2 开放 + ERP 凭证（§28）",
    "deps": "4.2",
    "estimate": "1.5d",
    "status": "done",
    "route": "/open-platform"
  },
  {
    "id": "5.3",
    "phase": "阶段5",
    "name": "Amazon SP-API 完整对接",
    "deliverable": "FBA Inbound/Shipping/Reports（§29）",
    "deps": "1.10/2.1",
    "estimate": "2d",
    "status": "done",
    "route": "/amazon"
  },
  {
    "id": "5.4",
    "phase": "阶段5",
    "name": "容量/灾备/测试强化",
    "deliverable": "拉单限流/比价并发/灾备目标（§30）",
    "deps": "全",
    "estimate": "2d",
    "status": "done",
    "route": "/system/capacity"
  },
  {
    "id": "6.1",
    "phase": "阶段6",
    "name": "店铺增删绑定 API",
    "deliverable": "后端 POST /shops、DELETE /shops/:id + 前端渠道中心增删 UI（演示/正式双路）",
    "deps": "1.2",
    "estimate": "0.5d",
    "status": "done",
    "route": "/channels"
  },
  {
    "id": "6.2",
    "phase": "阶段6",
    "name": "采购单实体与 CRUD（后端）",
    "deliverable": "PurchaseOrder + PurchaseOrderItem（快递单号/物流公司/平台订单号/采购链接/产品图URL/数量/SKU/状态）+ service/controller/单测",
    "deps": "1.3",
    "estimate": "1d",
    "status": "done",
    "route": "/purchase-orders"
  },
  {
    "id": "6.3",
    "phase": "阶段6",
    "name": "采购单录入前端页",
    "deliverable": "录入界面（快递单号/物流公司/订单号/采购链接/产品图上传/数量/SKU）+ 关联订单展示 + 菜单/路由 + 演示/正式双路",
    "deps": "6.2/1.7",
    "estimate": "1d",
    "status": "done",
    "route": "/purchase-orders"
  },
  {
    "id": "6.4",
    "phase": "阶段6",
    "name": "采购单↔店铺订单 匹配/关联",
    "deliverable": "自动匹配（按平台订单号/收件人/SKU）+ 手动关联；订单详情可见采购单",
    "deps": "6.2/1.3",
    "estimate": "1d",
    "status": "done",
    "route": "/catalog"
  },
  {
    "id": "6.5",
    "phase": "阶段6",
    "name": "中转仓模型 + 看板",
    "deliverable": "Warehouse.type 加 transfer；中转仓看板（货代侧待作业采购单可见）",
    "deps": "2.2",
    "estimate": "1d",
    "status": "done",
    "route": "/transfer"
  },
  {
    "id": "6.6",
    "phase": "阶段6",
    "name": "扫码到货入库端点",
    "deliverable": "POST /transfer/scan：快递单号/条码→解析采购单→匹配订单→到货登记；Asn 扩展 purchaseOrderId/scanSource/receivedItems",
    "deps": "6.4/6.5",
    "estimate": "1.5d",
    "status": "done",
    "route": "/transfer"
  },
  {
    "id": "6.7",
    "phase": "阶段6",
    "name": "中转仓作业：打包任务 + 核对",
    "deliverable": "按匹配订单聚合采购单生成打包任务；核对采购单 vs 店铺订单差异；PickTask 扩展 channelCode/labelId/shipmentId",
    "deps": "6.6",
    "estimate": "1.5d",
    "status": "done",
    "route": "/transfer"
  },
  {
    "id": "6.8",
    "phase": "阶段6",
    "name": "跨境面单生成（中转仓出单）",
    "deliverable": "选渠道→承运商建单 + LabelService 出 PDF/ZPL；面单关联店铺订单与平台；Shipment 加 purchaseOrderId",
    "deps": "3.9/1.5/6.7",
    "estimate": "1d",
    "status": "done",
    "route": "/transfer"
  },
  {
    "id": "6.9",
    "phase": "阶段6",
    "name": "出库闭环 + 物流同步",
    "deliverable": "出库扫码→Shipment 建单/fulfill→承运商回传→TrackingEvent→正式跨境物流；状态机贯通采购单/订单",
    "deps": "6.8/1.6",
    "estimate": "1d",
    "status": "done",
    "route": "/transfer"
  },
  {
    "id": "6.10",
    "phase": "阶段6",
    "name": "采购单录入即关联 + 作业备注贯通",
    "deliverable": "录入弹窗内直接选店铺订单（平台单号/收件人远程搜索、自动带出单号与收件人、按订单行项预填、提示「已有 N 张采购单」防重复）；备注透传到中转仓看板/打包队列/打包任务/核对弹窗/扫码结果，供货代分拣装货",
    "deps": "6.3/6.4/6.5/6.7",
    "estimate": "0.5d",
    "status": "done",
    "route": "/channels"
  },
  {
    "id": "6.11",
    "phase": "阶段6",
    "name": "仓库/货架补齐 + 采购产品图",
    "deliverable": "①新建仓库加「中转仓（货代）」类型，创建后自动进中转仓看板；②新增「货架/库位」页签：库位编码（区-架-层）+库区+占用(SKU/数量)+建/删(空库位) ；库存/占用一律显示人类可读编码而非内部 ID；③OrderItem 增 imageUrl，采购单关联订单即自动拉取商品主图；④产品图支持本地上传（多图、等比压缩、可填地址）",
    "deps": "6.5/6.10",
    "estimate": "0.5d",
    "status": "done",
    "route": "/catalog"
  },
  {
    "id": "6.12",
    "phase": "阶段6",
    "name": "扫码枪/PDA 设备无关接入",
    "deliverable": "①新增扫码输入层 useScannerInput：全局键盘钩子识别 HID 键盘模拟扫码枪（击键间隔判定，与人工打字区分），结束符/自动提交/前后缀剥离/提示音可配；②新增条码规则引擎 scan-rules.ts：按号段判定快递单号/商品条码/采购单号，扫描 API 支持 scanType=auto（查询优先+号段兜底）；③修复 6.6 条码分支误用 skuId(cuid) 导致扫码必然落空的 bug，改走 Sku.barcode；④采购单新增可扫业务单号 purchaseNo（CGyyyymmdd-nnnn，自动生成）；⑤中转仓扫码弹窗升级为连续扫作业台：扫即提交、流水逐条追加、成功/失败音与统计",
    "deps": "6.6",
    "estimate": "0.5d",
    "status": "done",
    "route": "/catalog"
  },
  {
    "id": "7.1",
    "phase": "阶段7",
    "name": "SKU/商品 条码录入 + 扫码建档",
    "deliverable": "Sku.barcode 录入入口（SKU 编辑可填可「扫一下」录入、多码管理、列表条码列 + 扫条码反查定位、批量连扫建档）；后端条码查重/反查接口；演示侧条码改动持久化",
    "deps": "1.7/6.12",
    "estimate": "1d",
    "status": "done",
    "route": "/catalog"
  },
  {
    "id": "7.2",
    "phase": "阶段7",
    "name": "采购单收货标签打印（Code128）",
    "deliverable": "标签数据接口 + 零依赖 Code128B 编码器 + A4 三列拼版/热敏 100×100 打印页（供应商贴箱 → 中转仓一枪到货）；顺带修正 CG 号段正则漏了连字符导致 `CG20261028-0001` 识别为未识别号段的 bug",
    "deps": "6.2/6.12",
    "estimate": "1d",
    "status": "done",
    "route": "/purchase-orders"
  },
  {
    "id": "7.3",
    "phase": "阶段7",
    "name": "PDA 原生壳（Android WebView + DataWedge）",
    "deliverable": "`pda-shell/` Android 源码工程：全屏 WebView + DataWedge/Honeywell Intent 收码 + 蜂鸣震动 + 常亮 + 侧键触发 + 离线队列补扫；页面侧暴露 `window.__onScan` 桥接；设备接入指引落中转仓「扫码设备设置」弹窗",
    "deps": "6.12",
    "estimate": "1.5d",
    "status": "done",
    "route": "/transfer"
  },
  {
    "id": "8.1",
    "phase": "阶段8",
    "name": "平台凭证工厂化接入（基础）",
    "deliverable": "统一凭证契约（淘宝TOP/抖音开放平台/云途/DHL/4PX/燕文）+ 加密落库(§17.2 AES-256-GCM，不存明文) + 端口/适配器存储（内存实现，Prisma 持久化 TODO）+ 平台→适配器工厂（真实 API 联调 TODO）；新增 `platform-credentials` 模块，9 单测全绿，纯后端基础（UI 待 8.2）",
    "deps": "2.1/3.2",
    "estimate": "1d",
    "status": "done",
    "route": null
  },
  {
    "id": "8.2",
    "phase": "阶段8",
    "name": "平台凭证管理 UI + 真实联调桥接",
    "deliverable": "前端 PlatformCredentialsView（/platform-credentials，super 专属）：凭证列表（平台/状态/更新时间）+ 新增/编辑对话框（按平台动态字段：淘宝 appKey/appSecret/session；抖音 appKey/appSecret/accessToken；云途 customerCode/apiKey/apiSecret；DHL clientId/clientSecret/DHL-API-Key；4PX 客户号/密钥；燕文 商户号/密钥）+ 查看/轮转/删除（解密展示需二次确认，明文仅驻留内存）+ 演示/正式双路（platform-credentials.ts + mock-data 同口径内存实现）；router + menuNodes（系统设置 钥匙图标）+ AppIcon key 图标 + locales 注册；进度生成器 EXPLICIT_ROUTES 补 8.2→/platform-credentials。后端 8.1 已就绪（platform-credentials 模块 + 加密落库），本任务纯前端接入；并把承运商/渠道注册表里「真实 API 联调 TODO」桥接到凭证工厂（暂不强制联网，联调留 TODO 标注）。验收：web vue-tsc✅/eslint✅/vite build✅；server 若有改动 tsc✅/eslint✅/jest✅。",
    "deps": "8.1",
    "estimate": "1d",
    "status": "done",
    "route": "/platform-credentials"
  },
  {
    "id": "9.1",
    "phase": "阶段9",
    "name": "全局 JWT 鉴权守卫（review A1）",
    "deliverable": "全局挂载 `APP_GUARD=GlobalAuthGuard`（`app.module.ts` 注入）；新增 `Public()` 装饰器 + `GlobalAuthGuard`（继承 passport `jwt`，遇 `@Public()` 直接放行）；`auth/login`、`health`、`openapi/oauth/token` 及 OpenApiGuard 资源路由标公开；业务级 RBAC 仍由控制器 `@UseGuards(PermissionsGuard)` 负责。",
    "deps": "8.1",
    "estimate": "0.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "9.2",
    "phase": "阶段9",
    "name": "租户上下文改由 JWT 派生（review A2）",
    "deliverable": "`tenant.middleware.ts` 改为「携带合法 JWT 时以令牌 tenantId 为准、忽略客户端自报 `x-tenant-id`；仅无 Bearer 令牌时回退到 `x-tenant-id`/子域名（可信网关场景）」，消除伪造请求头冒充租户的越权。",
    "deps": "9.1",
    "estimate": "0.5d",
    "status": "done",
    "route": "/tenants"
  },
  {
    "id": "9.3",
    "phase": "阶段9",
    "name": "生产密钥 fail-fast（review A3/A5）",
    "deliverable": "`configuration.ts` 启动拦截：production 缺失 `JWT_SECRET` 或 `APP_MASTER_KEY`（或 `JWT_SECRET` 仍为占位值 `change-me-in-prod`）直接拒绝启动；dev/test 仅告警。消除默认密钥可伪造令牌 / 开发密钥静默加密凭证的隐患。",
    "deps": "9.2",
    "estimate": "0.5d",
    "status": "done",
    "route": null
  },
  {
    "id": "9.4",
    "phase": "阶段9",
    "name": "租户隔离缺省拒绝（review A4）",
    "deliverable": "引入租户作用域 Prisma 扩展 `TenantPrismaService`（基于 `PrismaService.$extends`）：对租户作用域模型（Order/PurchaseOrder/Asn/PackTask/ShippingLabel/Shipment/TrackingEvent/Warehouse/Bin/Inventory/Sku/SkuBarcode/Supplier/CarrierAccount/Billing*/Ledger*/Quote/Webhook 等）的查询自动注入 `tenantId` 到 `where`，缺失则开发态告警、生产态拒绝；提供「模型→租户字段」白名单。优先迁移高危读路径（orders/purchase-orders/transfer/wms/carriers/billing/finance）到作用域客户端并补全跨租户隔离测试（越权访问断言拒绝）。验收：jest 隔离测试全绿、不破坏既有 372 测试；tsc/eslint 绿；提交前 checkpoint。⚠️ 高风险：逐接口回归，禁止一次性硬改全局查询。",
    "deps": "9.3",
    "estimate": "1.5d",
    "status": "done",
    "route": "/tenants"
  },
  {
    "id": "9.5",
    "phase": "阶段9",
    "name": "开放平台客户端管理加守卫（review A6）",
    "deliverable": "`openapi` 模块客户端管理端点（clients 增删/rotate）当前仅 `@TenantId()`，补 `OpenApiGuard` 或 `JwtAuthGuard+super` 守卫；源码写死种子密钥（`secret_demo_full_2026` 等）改为首次启动随机生成并持久化（或明确标注为演示种子且仅 dev 注入）；`getClientByCredentials` 的 `!==` 改为 `crypto.timingSafeEqual` 恒定时间比较。验收：tsc/eslint/jest 绿；守卫单测覆盖。",
    "deps": "9.1",
    "estimate": "1d",
    "status": "done",
    "route": null
  },
  {
    "id": "9.6",
    "phase": "阶段9",
    "name": "承运成本占位 0 改 null（review C1）",
    "deliverable": "承运适配器 `createShipment` 的 `carrierCost:0` 占位改为 `null`（真实回传前成本未知）；利润/账单计算（BillingService/LedgerService/MarkupEngine 回显）对 `null` 成本做排除或标注「成本待回传」，避免系统性高估利润。验收：相关单测覆盖 null 分支；tsc/eslint/jest 绿。",
    "deps": "8.1",
    "estimate": "0.5d",
    "status": "todo",
    "route": null
  },
  {
    "id": "9.7",
    "phase": "阶段9",
    "name": "演示/正式构建收敛（review B3）",
    "deliverable": "`web` 生产构建（`vite build` + CI）硬性要求 `VITE_USE_MOCK=false`，缺省或 true 时构建失败并提示；README 明确「生产部署必须 NODE_ENV=production 且 VITE_USE_MOCK=false」；`server` 若残留 `USE_MOCK` 分支统一移除或文档化。验收：生产构建脚本可执行且不带 mock。",
    "deps": "7.1",
    "estimate": "0.5d",
    "status": "todo",
    "route": null
  },
  {
    "id": "9.8",
    "phase": "阶段9",
    "name": "Web 登录页与令牌获取（上线前置）",
    "deliverable": "非 mock 生产部署下全局守卫已要求 JWT，但 web 当前无登录页拿 token（既有缺口）。新增 `LoginView`（/login）：租户选择/输入 + 邮箱 + 密码 → POST /api/auth/login → 存 token 到 Pinia user store + localStorage → 重定向首页；`http.ts` 正式模式自动注入 `Authorization: Bearer`；路由加 `/login` 公开 + 未登录自动跳登录；演示模式（VITE_USE_MOCK）保持直返 mock、不弹登录。验收：web vue-tsc/eslint/vite build 绿；登录→拿 token→带鉴权请求链路在正式模式可走通（端到端需本机 PG，见 env_critical）。",
    "deps": "9.1",
    "estimate": "1d",
    "status": "todo",
    "route": "/tenants"
  }
]

/** 统计汇总 */
export const DEV_STATS: DevStats = {
  "total": 70,
  "done": 67,
  "doing": 0,
  "todo": 3,
  "blocked": 0,
  "skipped": 0,
  "percent": 95.7
}

/** 阶段列表（去重，按出现顺序） */
export const DEV_PHASES = ["阶段0","阶段1","阶段2","阶段3","阶段4","阶段5","阶段6","阶段7","阶段8","阶段9"]

/** 最近交付的任务号（已完成中序号最大的若干个），用于「最近更新」高亮 */
export const DEV_RECENT_IDS = ["9.2","9.3","9.4","9.5"]
