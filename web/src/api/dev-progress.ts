/**
 * 开发进度数据 —— **本文件由 scripts/gen-progress.cjs 自动生成，请勿手工修改。**
 *
 * 生成命令：`npm run progress:gen`（读取 dev-schedule.md 的任务表）
 * 生成时间：2026-10-13T03:02:01.054Z
 * 源码提交：0d1c9af
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
export const DEV_PROGRESS_GENERATED_AT = "2026-10-13T03:02:01.305Z"

/** 数据对应的源码提交号（短 SHA） */
export const DEV_PROGRESS_COMMIT = "0d1c9af"

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
    "status": "todo",
    "route": "/channels"
  },
  {
    "id": "1.6",
    "phase": "阶段1",
    "name": "物流回传 + 轨迹(基础)",
    "deliverable": "回写运单/基础轨迹（§3）",
    "deps": "1.2",
    "estimate": "1d",
    "status": "todo",
    "route": "/carriers"
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
    "status": "todo",
    "route": "/quotes"
  },
  {
    "id": "1.9",
    "phase": "阶段1",
    "name": "供应商代发链路(基础)",
    "deliverable": "推单→回传→转平台运单（§21）",
    "deps": "1.1",
    "estimate": "1d",
    "status": "todo",
    "route": null
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
    "status": "todo",
    "route": "/channels"
  },
  {
    "id": "2.2",
    "phase": "阶段2",
    "name": "WMS 入库/库存/拣货",
    "deliverable": "ASN/上架/锁定/拣货波次（§15）",
    "deps": "0.4",
    "estimate": "2d",
    "status": "todo",
    "route": null
  },
  {
    "id": "2.3",
    "phase": "阶段2",
    "name": "海外仓模型",
    "deliverable": "`warehouses`/`inventory`/海外仓备货（§15）",
    "deps": "2.2",
    "estimate": "1.5d",
    "status": "todo",
    "route": null
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
    "status": "todo",
    "route": null
  },
  {
    "id": "3.9",
    "phase": "阶段3",
    "name": "面单 PDF/ZPL",
    "deliverable": "pdf-lib 处理（§3/§11）",
    "deps": "3.2",
    "estimate": "1d",
    "status": "todo",
    "route": null
  },
  {
    "id": "3.10",
    "phase": "阶段3",
    "name": "报关/合规字段",
    "deliverable": "HS/IOSS/EORI/VAT/Section321（§19）",
    "deps": "1.4",
    "estimate": "1.5d",
    "status": "todo",
    "route": null
  },
  {
    "id": "3.11",
    "phase": "阶段3",
    "name": "轨迹双通道 + NDR",
    "deliverable": "推送+轮询兜底 + 异常工单（§3/§20）",
    "deps": "3.2/3.4",
    "estimate": "1.5d",
    "status": "todo",
    "route": "/orders"
  },
  {
    "id": "3.12",
    "phase": "阶段3",
    "name": "地址校验 + 分区",
    "deliverable": "脏地址/邮编→zone（§18）",
    "deps": "1.4",
    "estimate": "1d",
    "status": "todo",
    "route": null
  },
  {
    "id": "3.13",
    "phase": "阶段3",
    "name": "聚合平台兜底",
    "deliverable": "AfterShip/17track 尾程（§3e）",
    "deps": "3.11",
    "estimate": "0.5d",
    "status": "todo",
    "route": null
  },
  {
    "id": "4.1",
    "phase": "阶段4",
    "name": "收款账务 wallet+ledger",
    "deliverable": "复式记账/预充值/账期/退款（§16）",
    "deps": "0.3",
    "estimate": "2d",
    "status": "todo",
    "route": null
  },
  {
    "id": "4.2",
    "phase": "阶段4",
    "name": "商户账单 + 承运商对账",
    "deliverable": "bills/reconciliations（§9/§10）",
    "deps": "4.1/3.6",
    "estimate": "1.5d",
    "status": "todo",
    "route": "/carriers"
  },
  {
    "id": "4.3",
    "phase": "阶段4",
    "name": "利润核算(spread)",
    "deliverable": "Σ(sell−cost)（§9/§10）",
    "deps": "4.2",
    "estimate": "1d",
    "status": "todo",
    "route": null
  },
  {
    "id": "4.4",
    "phase": "阶段4",
    "name": "多租户隔离强化",
    "deliverable": "schema-per-tenant 评估（§17）",
    "deps": "0.2",
    "estimate": "1d",
    "status": "todo",
    "route": "/tenants"
  },
  {
    "id": "4.5",
    "phase": "阶段4",
    "name": "精细化 RBAC",
    "deliverable": "组织层级/scope（§22）",
    "deps": "0.3",
    "estimate": "1d",
    "status": "todo",
    "route": null
  },
  {
    "id": "4.6",
    "phase": "阶段4",
    "name": "运营配置后台",
    "deliverable": "加价/产品/费率卡 UI（§23）",
    "deps": "3.6/3.7",
    "estimate": "2d",
    "status": "todo",
    "route": "/pricing"
  },
  {
    "id": "4.7",
    "phase": "阶段4",
    "name": "报表指标口径",
    "deliverable": "履约/物流/利润看板（§25）",
    "deps": "4.3",
    "estimate": "1.5d",
    "status": "todo",
    "route": "/carriers"
  },
  {
    "id": "4.8",
    "phase": "阶段4",
    "name": "理赔保险",
    "deliverable": "`claims` 流程（§20）",
    "deps": "3.11",
    "estimate": "1d",
    "status": "todo",
    "route": null
  },
  {
    "id": "4.9",
    "phase": "阶段4",
    "name": "多语言多币种前端",
    "deliverable": "i18n + 本地币展示（§27）",
    "deps": "0.5",
    "estimate": "1.5d",
    "status": "todo",
    "route": "/pricing"
  },
  {
    "id": "5.1",
    "phase": "阶段5",
    "name": "风控体系",
    "deliverable": "规则引擎+评分（§26）",
    "deps": "1.3/4.5",
    "estimate": "2d",
    "status": "todo",
    "route": null
  },
  {
    "id": "5.2",
    "phase": "阶段5",
    "name": "开放 API/ERP 集成",
    "deliverable": "OAuth2 开放 + ERP 凭证（§28）",
    "deps": "4.2",
    "estimate": "1.5d",
    "status": "todo",
    "route": null
  },
  {
    "id": "5.3",
    "phase": "阶段5",
    "name": "Amazon SP-API 完整对接",
    "deliverable": "FBA Inbound/Shipping/Reports（§29）",
    "deps": "1.10/2.1",
    "estimate": "2d",
    "status": "todo",
    "route": "/channels"
  },
  {
    "id": "5.4",
    "phase": "阶段5",
    "name": "容量/灾备/测试强化",
    "deliverable": "读写分离/备份/压测（§30）",
    "deps": "全",
    "estimate": "2d",
    "status": "todo",
    "route": null
  }
]

/** 统计汇总 */
export const DEV_STATS: DevStats = {
  "total": 45,
  "done": 19,
  "doing": 0,
  "todo": 26,
  "blocked": 0,
  "skipped": 0,
  "percent": 42.2
}

/** 阶段列表（去重，按出现顺序） */
export const DEV_PHASES = ["阶段0","阶段1","阶段2","阶段3","阶段4","阶段5"]

/** 最近交付的任务号（已完成中序号最大的若干个），用于「最近更新」高亮 */
export const DEV_RECENT_IDS = ["3.4","3.5","3.6","3.7"]
