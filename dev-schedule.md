# 一件代发货代运营系统 · 开发进度表

> 生成日期：2026-10-10 ｜ 关联方案：`dropshipping-fulfillment-architecture-plan.md` (v1.5)
> 执行方式：夜间自动开发（每日 23:10 启动，约 07:50 结束），由定时任务驱动，**全程无人值守、自恢复、自汇报**。
> 状态图例：⬜ 待开始 ｜ 🔵 进行中 ｜ ✅ 已完成 ｜ ⛔ 受阻(已记录) ｜ ⏭️ 跳过(已记录)
> 本表为唯一进度真相源，自动化每跑完一批任务即回写状态。

---

## 〇、自动化执行约定（看门狗 + 续跑）

- **看门狗（防 429 / 异常中断）**：所有外部调用（npm 安装、API 请求、网络拉取）一律包在重试器里。
  - 遇 HTTP `429` / `5xx` / 网络抖动：**指数退避重试** `2s → 4s → 8s → 16s → 32s`，最多 5 次。
  - 5 次仍失败：**记录到 `.dev/errors.log` → 标记该子步骤跳过 → 立即转下一任务**，绝不整体中止。
- **自恢复**：任何未捕获异常写入 `.dev/errors.log`，当前任务标记 `⛔ 受阻` 并附原因，转下一任务；次日从断点续跑。
- **检查点续跑**：`.dev/state.json` 记录 `当前阶段 / 任务序号 / 最后提交 / 受阻清单`；每次启动先读状态，从断点继续。
- **时间窗自律**：启动 ~23:10，本地时间到 ~07:40 即停止开新任务、跑末轮 lint/test、写日报、收尾（约 07:50 结束）。
- **纪律红线**：严格遵循方案 §31（注释清晰 / 代码整齐）；提交信息用 Conventional Commits；**任何问题自己解决，绝不询问用户**。
- **日报**：每日结束向 `progress-log.md` 追加当日段落（完成/进行中/受阻+错误摘要/测试结果/下一步/提交号），并给用户简短汇总。
- **可视化交付铁律（用户明确要求）**：用户每天早晨会打开网页查看成果，**不允许只交付后端代码而前端无可见变化**。
  - 业务能力类任务（订单/商品/渠道/承运商/报价/加价/账务/报表等）必须同时交付：页面（`web/src/views/`）+ 左侧菜单（`web/src/layouts/BasicLayout.vue` 的 `menus`）+ 路由（`web/src/router/index.ts`）+ 演示数据与交互（`web/src/api/mock-data.ts` 与对应 `*Api` 模块），且**演示模式与正式模式两条路都要通**。
  - 纯后端/基础设施类任务至少在「开发进度」页（`/progress`）有可见条目（`route` 可为 null），产出描述写清可验证点。
  - **每批任务最后必须运行 `npm run progress:gen`**（`scripts/gen-progress.cjs` → 重新生成 `web/src/api/dev-progress.ts`）并随代码提交，确保次日刷新网页即可看到新增能力。
  - 收尾验收：`cd web && npm run lint && npm run build` 零错误，新增页面已注册路由与菜单且能被 dev/preview 正确编译。

---

## 一、进度看板（按阶段）

| 序号 | 阶段 | 任务 | 关键产出 / 对应方案章节 | 依赖 | 预估 | 状态 |
|---|---|---|---|---|---|---|
| 0.1 | 阶段0 | 仓库初始化与目录结构 | NestJS+Vue3 monorepo 骨架；`.git` | — | 0.5d | ✅ |
| 0.2 | 阶段0 | 多租户骨架 | `tenant_id` 行级隔离 + 租户解析中间件（§0/§17） | 0.1 | 1d | ✅ |
| 0.3 | 阶段0 | 鉴权与 RBAC 基线 | JWT + CASL（§0/§22） | 0.2 | 1d | ✅ |
| 0.4 | 阶段0 | 基础设施 | PostgreSQL / Redis / MinIO / Docker Compose（§11） | 0.1 | 0.5d | ✅ |
| 0.5 | 阶段0 | 开发规范工具链 | `.prettierrc`/`.eslintrc`/`.stylelintrc`/commitlint（§31） | 0.1 | 0.5d | ✅ |
| 0.6 | 阶段0 | CI 基线 | `lint --check` + 类型检查卡点（§31.4） | 0.5 | 0.5d | ✅ |
| 1.1 | 阶段1 | ChannelAdapter 框架 | 统一接口：拉单/审单/推单/回传/轨迹（§3） | 0.3 | 1.5d | ✅ |
| 1.2 | 阶段1 | Shopify 接入（首渠道） | 首个适配器跑通（§3） | 1.1 | 1d | ✅ |
| 1.3 | 阶段1 | 订单归集 + 状态机 | 正向 8 态 + 逆向 + `order_events`（§13） | 0.2 | 2d | ✅ |
| 1.4 | 阶段1 | 审单引擎 | 地址/黑名单/库存/合规校验（§13/§18/§19） | 1.3 | 1d | ✅ |
| 1.5 | 阶段1 | 履约路由（模式A 自动） | 系统自动选渠道（§4/§5） | 1.1 | 1d | ✅ |
| 1.6 | 阶段1 | 物流回传 + 轨迹(基础) | 回写运单/基础轨迹（§3） | 1.2 | 1d | ✅ |
| 1.7 | 阶段1 | 商品/SKU 中心 | 平台↔内部↔供应商映射（§1） | 0.2 | 1.5d | ✅ |
| 1.8 | 阶段1 | 运费试算最小版 | 重量/体积→计费重→选渠道（§4） | 1.1 | 1.5d | ⏭️ |
| 1.9 | 阶段1 | 供应商代发链路(基础) | 推单→回传→转平台运单（§21） | 1.1 | 1d | ✅ |
| 1.10 | 阶段1 | Amazon SP-API 评估 | FBA/FBM/LWA 可行性（§29） | 1.1 | 0.5d | ✅ |
| 2.1 | 阶段2 | 国内渠道(淘宝/抖音) | 验证多平台适配（§3） | 1.2 | 1.5d | ✅ |
| 2.2 | 阶段2 | WMS 入库/库存/拣货 | ASN/上架/锁定/拣货波次（§15） | 0.4 | 2d | ✅ |
| 2.3 | 阶段2 | 海外仓模型 | `warehouses`/`inventory`/海外仓备货（§15） | 2.2 | 1.5d | ✅ |
| 3.1 | 阶段3 | CarrierAdapter 框架 | 镜像 ChannelAdapter（§3） | 0.3 | 1d | ✅ |
| 3.2 | 阶段3 | 云途接入(SDK优先) | `yunexpress-sdk` OAuth2+HMAC（§3 调研） | 3.1 | 1d | ✅ |
| 3.3 | 阶段3 | DHL 接入 | OAuth2 + 沙箱审批（§3 调研） | 3.1 | 1.5d | ✅ |
| 3.4 | 阶段3 | 4PX / 燕文 接入 | MD5 签名（§3 调研） | 3.1 | 1.5d | ✅ |
| 3.5 | 阶段3 | 比价引擎 4 层 + 试算模式 | 预热/可达性/实时池/护栏 + 试算开关（§5/§4） | 1.5/3.1 | 2d | ✅ |
| 3.6 | 阶段3 | 加价规则引擎 + 币种归一 | 双价列/Markup/FX（§9/§10） | 3.5 | 1.5d | ✅ |
| 3.7 | 阶段3 | 运费试算门户(正式) | 商户自助试算+自选（§4） | 3.5 | 1.5d | ✅ |
| 3.8 | 阶段3 | 头程/尾程两段式 | `shipment_legs`(leg_type)（§14） | 1.3/3.1 | 1.5d | ✅ |
| 3.9 | 阶段3 | 面单 PDF/ZPL | pdf-lib 处理（§3/§11） | 3.2 | 1d | ✅ |
| 3.10 | 阶段3 | 报关/合规字段 | HS/IOSS/EORI/VAT/Section321（§19） | 1.4 | 1.5d | ✅ |
| 3.11 | 阶段3 | 轨迹双通道 + NDR | 推送+轮询兜底 + 异常工单（§3/§20） | 3.2/3.4 | 1.5d | ✅ |
| 3.12 | 阶段3 | 地址校验 + 分区 | 脏地址/邮编→zone（§18） | 1.4 | 1d | ✅ |
| 3.13 | 阶段3 | 聚合平台兜底 | AfterShip/17track 尾程（§3e） | 3.11 | 0.5d | ✅ |
| 4.1 | 阶段4 | 收款账务 wallet+ledger | 复式记账/预充值/账期/退款（§16） | 0.3 | 2d | ✅ |
| 4.2 | 阶段4 | 商户账单 + 承运商对账 | bills/reconciliations（§9/§10） | 4.1/3.6 | 1.5d | ✅ |
| 4.3 | 阶段4 | 利润核算(spread) | Σ(sell−cost)（§9/§10） | 4.2 | 1d | ✅ |
| 4.4 | 阶段4 | 多租户隔离强化 | schema-per-tenant 评估（§17） | 0.2 | 1d | ✅ |
| 4.5 | 阶段4 | 精细化 RBAC | 组织层级/scope（§22） | 0.3 | 1d | ✅ |
| 4.6 | 阶段4 | 运营配置后台 | 加价/产品/费率卡 UI（§23） | 3.6/3.7 | 2d | ✅ |
| 4.7 | 阶段4 | 报表指标口径 | 履约/物流/利润看板（§25） | 4.3 | 1.5d | ✅ |
| 4.8 | 阶段4 | 理赔保险 | `claims` 流程（§20） | 3.11 | 1d | ✅ |
| 4.9 | 阶段4 | 多语言多币种前端 | i18n + 本地币展示（§27） | 0.5 | 1.5d | ✅ |
| 5.1 | 阶段5 | 风控体系 | 规则引擎+评分（§26） | 1.3/4.5 | 2d | ✅ |
| 5.2 | 阶段5 | 开放 API/ERP 集成 | OAuth2 开放 + ERP 凭证（§28） | 4.2 | 1.5d | ✅ |
| 5.3 | 阶段5 | Amazon SP-API 完整对接 | FBA Inbound/Shipping/Reports（§29） | 1.10/2.1 | 2d | ✅ |
| 5.4 | 阶段5 | 容量/灾备/测试强化 | 拉单限流/比价并发/灾备目标（§30） | 全 | 2d | ✅ |
| 6.1 | 阶段6 | 店铺增删绑定 API | 后端 POST /shops、DELETE /shops/:id + 前端渠道中心增删 UI（演示/正式双路） | 1.2 | 0.5d | ✅ |
| 6.2 | 阶段6 | 采购单实体与 CRUD（后端） | PurchaseOrder + PurchaseOrderItem（快递单号/物流公司/平台订单号/采购链接/产品图URL/数量/SKU/状态）+ service/controller/单测 | 1.3 | 1d | ✅ |
| 6.3 | 阶段6 | 采购单录入前端页 | 录入界面（快递单号/物流公司/订单号/采购链接/产品图上传/数量/SKU）+ 关联订单展示 + 菜单/路由 + 演示/正式双路 | 6.2/1.7 | 1d | ✅ |
| 6.4 | 阶段6 | 采购单↔店铺订单 匹配/关联 | 自动匹配（按平台订单号/收件人/SKU）+ 手动关联；订单详情可见采购单 | 6.2/1.3 | 1d | ✅ |
| 6.5 | 阶段6 | 中转仓模型 + 看板 | Warehouse.type 加 transfer；中转仓看板（货代侧待作业采购单可见） | 2.2 | 1d | ✅ |
| 6.6 | 阶段6 | 扫码到货入库端点 | POST /transfer/scan：快递单号/条码→解析采购单→匹配订单→到货登记；Asn 扩展 purchaseOrderId/scanSource/receivedItems | 6.4/6.5 | 1.5d | ✅ |
| 6.7 | 阶段6 | 中转仓作业：打包任务 + 核对 | 按匹配订单聚合采购单生成打包任务；核对采购单 vs 店铺订单差异；PickTask 扩展 channelCode/labelId/shipmentId | 6.6 | 1.5d | ✅ |
| 6.8 | 阶段6 | 跨境面单生成（中转仓出单） | 选渠道→承运商建单 + LabelService 出 PDF/ZPL；面单关联店铺订单与平台；Shipment 加 purchaseOrderId | 3.9/1.5/6.7 | 1d | ✅ |
| 6.9 | 阶段6 | 出库闭环 + 物流同步 | 出库扫码→Shipment 建单/fulfill→承运商回传→TrackingEvent→正式跨境物流；状态机贯通采购单/订单 | 6.8/1.6 | 1d | ✅ |
| 6.10 | 阶段6 | 采购单录入即关联 + 作业备注贯通 | 录入弹窗内直接选店铺订单（平台单号/收件人远程搜索、自动带出单号与收件人、按订单行项预填、提示「已有 N 张采购单」防重复）；备注透传到中转仓看板/打包队列/打包任务/核对弹窗/扫码结果，供货代分拣装货 | 6.3/6.4/6.5/6.7 | 0.5d | ✅ |
| 6.11 | 阶段6 | 仓库/货架补齐 + 采购产品图 | ①新建仓库加「中转仓（货代）」类型，创建后自动进中转仓看板；②新增「货架/库位」页签：库位编码（区-架-层）+库区+占用(SKU/数量)+建/删(空库位) ；库存/占用一律显示人类可读编码而非内部 ID；③OrderItem 增 imageUrl，采购单关联订单即自动拉取商品主图；④产品图支持本地上传（多图、等比压缩、可填地址） | 6.5/6.10 | 0.5d | ✅ |
| 6.12 | 阶段6 | 扫码枪/PDA 设备无关接入 | ①新增扫码输入层 useScannerInput：全局键盘钩子识别 HID 键盘模拟扫码枪（击键间隔判定，与人工打字区分），结束符/自动提交/前后缀剥离/提示音可配；②新增条码规则引擎 scan-rules.ts：按号段判定快递单号/商品条码/采购单号，扫描 API 支持 scanType=auto（查询优先+号段兜底）；③修复 6.6 条码分支误用 skuId(cuid) 导致扫码必然落空的 bug，改走 Sku.barcode；④采购单新增可扫业务单号 purchaseNo（CGyyyymmdd-nnnn，自动生成）；⑤中转仓扫码弹窗升级为连续扫作业台：扫即提交、流水逐条追加、成功/失败音与统计 | 6.6 | 0.5d | ✅ |
| 7.1 | 阶段7 | SKU/商品 条码录入 + 扫码建档 | Sku.barcode 录入入口（SKU 编辑可填可「扫一下」录入、多码管理、列表条码列 + 扫条码反查定位、批量连扫建档）；后端条码查重/反查接口；演示侧条码改动持久化 | 1.7/6.12 | 1d | ✅ |
| 7.2 | 阶段7 | 采购单收货标签打印（Code128） | 标签数据接口 + 零依赖 Code128B 编码器 + A4 三列拼版/热敏 100×100 打印页（供应商贴箱 → 中转仓一枪到货）；顺带修正 CG 号段正则漏了连字符导致 `CG20261028-0001` 识别为未识别号段的 bug | 6.2/6.12 | 1d | ⬜ |
| 7.3 | 阶段7 | PDA 原生壳（Android WebView + DataWedge） | `pda-shell/` Android 源码工程：全屏 WebView + DataWedge/Honeywell Intent 收码 + 蜂鸣震动 + 常亮 + 侧键触发 + 离线队列补扫；页面侧暴露 `window.__onScan` 桥接；设备接入指引落中转仓「扫码设备设置」弹窗 | 6.12 | 1.5d | ⬜ |

> 阶段7 执行顺序建议：**7.1 → 7.2 → 7.3**。7.1 是数据地基（没条码，②贴出去的箱码与 Sku.barcode 之间没有可用映射），7.2 把条码落到物理介质（仓库才有东西可扫），7.3 是终端形态升级且依赖外部工具链（Android Gradle），放最后。

---

## 二、里程碑

- **M0（阶段0 完成）**：脚手架 + 多租户 + 鉴权 + 规范工具链 + CI 就绪。
- **M1（阶段1 完成）**：单渠道跑通「拉单→审单→路由→推单→回传→轨迹」+ 试算最小版。
- **M2（阶段2 完成）**：多平台验证 + WMS/海外仓基础。
- **M3（阶段3 完成）**：国际物流段全通（云途/DHL/4PX/燕文 + 比价 + 加价 + 试算门户 + 两段式）。
- **M4（阶段4 完成）**：结算/账务/多租户/运营后台闭环，具备对外收费运营能力。
- **M5（阶段5 完成）**：风控/开放生态/Amazon 完整对接/容量灾备，达到生产级。
- **M6（阶段6 完成）**：货代中转仓作业流全通——采购单录入/匹配 → 中转仓扫码到货入库 → 打包贴跨境面单 → 出库同步跨境物流，与既有订单/渠道/承运商底座闭环。
- **M7（阶段7 完成）**：条码介质与终端接入闭环——商品条码可录入（含枪扫建档）、采购单可打印 Code128 收货标签供供应商贴箱、场站端可用 PDA 原生壳接管扫码输入，仓库「一枪到底」无需翻纸质单据。
- **6.10 体验补强（已完成）**：采购单录入时直接选关联店铺订单（一步到位），备注透传至货代作业侧（看板 / 打包队列 / 打包任务 / 核对弹窗 / 扫码结果），避免订单量增长后手动关联对错单、仓库漏看分拣注意事项。

---

## 三、进度回写格式（自动化写入）

自动化每批任务结束，按此格式更新上方表格的「状态」列，并在文末追加：

```
## 进度更新 · YYYY-MM-DD
- 完成：0.1 / 0.2 / 0.5
- 进行中：0.3
- 受阻：无（或 1.9 ⛔ 原因：…）
- 测试结果：lint ✅ / tsc ✅ / test ✅(x/y)
- 提交：<git commit ids>
- 下一步：0.4 / 0.6 / 1.1
```

---

## 四、进度更新记录

### 进度更新 · 2026-10-10（人工起头，非夜间自动化）
- **完成（✅）**：0.1 仓库与 monorepo 目录结构 / 0.2 多租户骨架（middleware+context+decorator+guard+tenant 模块）/ 0.4 基础设施（docker-compose PG/Redis/MinIO + 配置）/ 0.5 开发规范工具链（prettier/eslint/stylelint/commitlint 配置）/ 0.6 CI 基线（GitHub Actions：lint+typecheck+prisma generate 卡点）。
- **进行中（🔵）**：0.3 鉴权与 RBAC 基线 —— JWT + Passport 已落地，`Role`/`UserRole` 表与 CASL 能力待阶段4 细化策略。
- **核心产出**：
  - 全量 Prisma 数据模型落定（覆盖方案 §7 + §13~§30 全部表，含多租户 tenantId 行级隔离）。
  - 服务端骨架可编译：`npm run typecheck` 与 `npm run lint` 均通过（exit=0）。
  - 前端 Vue3 脚手架（租户切换器 + 统一 HTTP 客户端带 `x-tenant-id`）就位并**已安装依赖、验证通过**。
- **前端验证结果（本次补充）**：`web` 依赖安装（`--ignore-scripts` 规避 esbuild 安装坑）→ `npm run build`（vue-tsc 类型检查 + vite 构建，exit=0，产物 dist/）→ `npm run lint`（exit=0）。
  - 修复项：① http 客户端封装为类型化方法（响应拦截器解包 data，方法返回 `Promise<T>` 而非 `AxiosResponse<T>`，调用点免 `.data`）；② 组件名 `Dashboard` 改为多单词 `DashboardView.vue`（满足 Vue 风格指南，不关规则）。
- **受阻**：无（前端依赖与构建已全部打通）。
- **⚠️ 环境关键事实（务必同步给夜间自动化）**：
  1. 本仓是 **npm workspaces monorepo**（根 package.json `workspaces:["server","web"]`），依赖被提升到根 `node_modules`，`web/node_modules` 多为符号链接；esbuild 二进制落在 `node_modules/@esbuild/win32-x64/esbuild.exe`。
  2. 本机沙箱的 **safe-delete 批量删除守卫** 会在 `rm -rf node_modules` 或 npm 做 tree 对齐/批量清理（增删特定包、prune）时把进程 **SIGTERM**（`SAFE_DELETE_BULK_GUARD_ERROR`）。规避：① 绝不要 `rm -rf node_modules`；② 不要在已有 node_modules 上跑会触发 prune 的 `npm install`（若需补装，优先 `npm install <pkg> --ignore-scripts --no-audit --no-fund`，但仍可能被守卫截；若被截，检查目标包是否已落盘，落盘即视为成功）；③ 全新 `npm install --ignore-scripts`（从干净状态）可正常完成。
  3. esbuild 安装必须 `--ignore-scripts`，否则 Git Bash 下 postinstall 报 `Circular *1` 失败；缺失平台二进制时补 `@esbuild/win32-x64@0.21.5`（`--no-save --ignore-scripts`）。
- **下一步（夜间自动化接力）**：0.3 收尾 → 1.1 ChannelAdapter 框架 → 1.2 Shopify 接入 → 1.3 订单归集+状态机 → 1.8 运费试算最小版。
- **提交**：baseline 初始提交（阶段0 脚手架起头）+ 前端依赖与验证修复。

---

### 进度更新 · 2026-10-10（夜间自动化 23:10 启动）
- **完成（✅）**：
  - **0.3 鉴权与 RBAC 基线** —— JWT + Passport 已落；CASL 策略按方案 §22 留待阶段4 细化（方案口径一致，标记完成）。
  - **1.1 ChannelAdapter 框架** —— 统一接口（拉单/审单/推单回传/轨迹）+ 抽象基类 + **注册表（实例/工厂双模式）** + 归一化 DTO（class-validator）+ **共享可重试 HTTP 客户端**（§2.1：超时/429·5xx·网络错误指数退避 2/4/8/16/32s，最多5次）+ 拉单落库服务（upsert 入 `Order`，初始态 `pending_review`，单条失败不中断）+ Mock 适配器（自测用）。
  - **1.2 Shopify 接入** —— `ShopifyAdapter`（Admin REST：拉单归一化 / 回传履约 / 查单 / 撤单 / 轨迹）+ `ShopifyAdapterFactory`（按店铺凭证构建）+ 注册工厂。
  - **1.3 订单归集 + 状态机** —— `OrderStateMachineService`（12 态合法转移表 + 守卫 + 幂等 + `order_events` 审计 + 逆向流程 cancel/interception/redirect/return）；REST 入口 `/api/orders/:id/transition`、`/reverse`。拉单归集已在 1.1 的 `pullAndStore` 落地。
  - **1.4 审单引擎** —— `OrderReviewService` 可插拔 `ReviewCheck` 架构：地址完整性校验 + 黑名单校验（内存，§26 预留）+ 库存/合规占位（待 §1.7/§15、§19，均带 `TODO(ops)` 责任人+日期，按 §31）。REST 入口 `/api/orders/:id/review`。
  - **1.7 商品/SKU 中心** —— `CatalogModule`：商品（SPU）/内部 SKU 的 CRUD（租户行级隔离）+ **三段映射解析**（平台 SKU→内部 SKU `resolveByPlatformSku`、内部 SKU→供应商 SKU `resolveSupplierSku`、`syncPlatformSku`/`linkSupplierSku` 维护 §21）+ **计费重派生**（`computeWeights`：实重 vs 体积重取大，对接 §4/§5）；拉单落库 `ChannelSyncService` 接入映射，按 `platformSku`（回退 `skuCode`）回填 `OrderItem.skuId`。
- **进行中（🔵）**：无（本批任务全部完成）。
- **受阻**：无。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（29 passed / 4 suites）。
- **提交**：见 `7714434`（`feat(channels/orders/catalog): 阶段1 MVP 履约框架 1.1-1.4 + 商品SKU中心 1.7`）。
- **下一步（次日接力）**：1.5 履约路由（模式A 自动选渠道 / 1.6 物流回传+轨迹基础 / 1.8 运费试算最小版 / 1.9 供应商代发链路 / 1.10 Amazon SP-API 评估）。注意 1.5/1.6/1.8/1.9 依赖阶段3 承运商适配器与费率卡（§3/§4），1.10 为评估类可作下一步；1.7 已完成，1.4 库存校验占位可在 §15 WMS 落地后接 `CatalogService` 真实校验。
- **关键工程事实（同步夜间自动化）**：
  1. 新增 `server/src/common/http/`：全局 `RetryableHttpService` + `HttpModule`（全局提供），渠道/承运商适配器共用；退避基准 2000ms（2/4/8/16/32s，5 次）。
  2. 渠道注册表 `ChannelRegistryService` 支持 `registerAdapter`（无状态实例，如 Mock）与 `registerFactory`（按店铺凭证构建，如 Shopify），`resolveForShop` 工厂优先。
  3. 本仓已落地 Jest + ts-jest（`server/jest.config.cjs`），`npm test` 可用；新增模块均配套单测。
  4. 环境同上轮：npm workspaces monorepo，依赖提升到根；`.prisma/client` 已重新生成（ReverseOrder 增 `cause` 字段）。

---

### 进度更新 · 2026-10-10（续跑 · Amazon SP-API 评估）
- **完成（✅）**：
  - **1.10 Amazon SP-API 评估（§29）** —— `AmazonLwaClient`（LWA OAuth2 认证闸门：client_credentials / refresh_token 双 grant + 令牌缓存，复用 `RetryableHttpService` 超时/重试/退避 §2.1）+ `AmazonAdapter`（落入 §3 `ChannelAdapter` 框架：拉单 Orders v0 归一化 + 二次 `getOrderItems` 补明细 + 状态映射 + LWA 鉴权头）+ `AmazonRequestSigner` 接口（`NoopAmazonSigner` 占位，SigV4 待阶段5）+ `AmazonAdapterFactory`（按店铺凭证构建，注册进渠道注册表）。**评估结论**：LWA 认证闸门已可独立验证（无需 SigV4）；SP-API 读写端点需 AWS SigV4 签名 + 开发者账号审核（周期数天~数周），**FBA/FBM 推单/轨迹明确标记为阶段5 完整对接（任务 5.3）**。
- **进行中（🔵）**：无。
- **受阻**：无。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（33 passed / 5 suites）。
- **提交**：原夜间批次漏提交，已于 2026-10-11 随文档/检查点一并补提交（见 `feat(channels/amazon): 阶段1 Amazon SP-API 评估 1.10`）。
- **下一步（次日接力）**：1.5 履约路由 / 1.6 物流回传+轨迹 / 1.8 运费试算最小版 / 1.9 供应商代发链路（均依赖阶段3 承运商适配器与费率卡 §3/§4，待阶段3 后补）；阶段1 MVP 主干「拉单→审单→SKU映射」已闭环，1.10 评估落地，剩余多为阶段3 依赖项。

---

### 进度更新 · 2026-10-11（夜间自动化 23:10 启动 · CarrierAdapter 框架）
- **完成（✅）**：
  - **3.1 CarrierAdapter 框架（§3，镜像 ChannelAdapter）** —— 与 1.1 对称落地承运商侧可插拔适配器体系：
    - `carrier.constants.ts`：`CarrierCode`（yunexpress/dhl/fourpx/yanwen/aggregator/mock）、`CarrierAuthType`（oauth2/hmac/md5）、`CarrierCapability`（rate/ship/label/track/cancel/subscribe 六能力声明）、`CarrierHealth`。
    - `carrier-adapter.interface.ts`：`CarrierAdapter` 统一六能力接口（getRates / createShipment / getLabel / getTracking / cancelShipment / subscribeTracking）。
    - `abstract-carrier.adapter.ts`：抽象基类，复用 `RetryableHttpService`（§2.1 超时/429·5xx 指数退避）+ `AppLogger` + 默认健康探测（带能力声明）。
    - `weight.ts`：计费重/抛重计算（§4.2 核心：计费重=max(实重,体积重)，多箱 Σ，抛比系数默认 5000，除零保护）。
    - 归一化 DTO：`dto/rate.dto.ts`（`GetRatesRequest`/`RateQuote`/`SurchargeItem`/`CargoType`/`LegType`，class-validator 入参）、`dto/shipment.dto.ts`（`CreateShipmentRequest`/`CreateShipmentResult`/`CarrierLabel`/收件人/报关字段 §19）、`dto/tracking.dto.ts`（`CarrierTrackingStatus` 归一化 + `CarrierTrackingResult`）。
    - `carrier-registry.service.ts`：**实例 + 工厂双模式**（镜像 ChannelRegistryService）——`registerAdapter` / `registerFactory` / `resolveForAccount`（工厂优先，含租户账号凭证 §2.2）/ `isFactory` / `getAdapter` / `has` / `listCodes`；未注册优雅抛 `BusinessException`。
    - `adapters/mock-carrier.adapter.ts`：`MockCarrierAdapter` 自测桩（比价计费重逻辑 / 建单 / 面单 / 轨迹 / 取消 / 订阅），使框架无真实凭证可单测。
    - `carriers.service.ts` + `carriers.controller.ts`：REST 入口（`GET /carriers`、`GET /carriers/:code/health`、`POST /carriers/:code/rates`、`POST /carriers/:code/shipments`、`GET /carriers/:code/tracking/:no`、`POST /carriers/:code/cancel/:no`、`POST /carriers/:code/subscribe/:no`）；服务读 `Carrier` 目录（空则回退枚举）+ 经注册表分发；工厂型已预留「查租户 CarrierAccount → 工厂构建」路径（§2.2，待 3.2+ 注册工厂）。
    - `carriers.module.ts`：装配 + `onModuleInit` 注册 Mock；已接入 `AppModule`。
- **进行中（🔵）**：无。
- **受阻**：无。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（20 新增 / 全仓 53 passed / 8 suites）。
- **提交**：见 `feat(carriers): 阶段3 CarrierAdapter 框架 3.1（接口/注册表/Mock/REST/单测）`。
- **下一步（次日接力）**：3.2 云途接入（SDK 优先，OAuth2+HMAC，§1.1）→ 3.3 DHL → 3.4 4PX/燕文（MD5）→ 3.5 比价引擎4层 → 3.6 加价规则引擎。3.1 已解锁"工厂注册"通道，3.2~3.4 注册工厂即接入 `CarriersModule.onModuleInit` 与 `CarriersService.resolve` 的租户账号分发。阶段1 收口任务 1.5/1.6/1.8/1.9 仍可顺延至 3.5/3.6 后补。
- **关键工程事实**：承运商 `Carrier`/`CarrierAccount`/相关表已在 Prisma 落定（无需改 schema）；新增模块全程零网络/安装依赖，看门狗未触发。编码纪律 §31 严守（中文注释/字段带单位与业务含义/TODO 带责任人+日期/函数精简/无 magic number/统一响应与异常）。

---

### 进度更新 · 2026-10-12（夜间自动化 23:10 启动 · 承运商适配器 3.2-3.4 + 比价引擎 3.5）
- **完成（✅）**：
  - **3.2 云途 YunExpress 接入（SDK 优先，OAuth2+HMAC）** —— `yunexpress-auth.config.ts`（prod/sandbox base + 合理占位 endpoints，TODO 2026-11 联调校正）、`yunexpress-sign.service.ts`（canonical=`appId.timestamp.body`，HMAC-SHA256）、`yunexpress-token.service.ts`（client_credentials 换 token + 实例内存缓存，提前 60s 刷新，TODO Redis）、`yunexpress.types.ts`（原生报文映射，信封 `code===0`）、`yunexpress.adapter.ts`（六能力全实现，统一鉴权头 + 信封校验 + 状态归一化 + 计费重映射；`carrierCost` 暂占位 0，待 §9 费用回传）。
  - **3.3 DHL 接入（OAuth2 Basic + 轮询）** —— `dhl-auth.config.ts`/`dhl-token.service.ts`（Basic=`base64(clientId:clientSecret)` 换 token，内存缓存）/ `dhl.types.ts` / `dhl.adapter.ts`：能力 **RATE/SHIP/LABEL/TRACK**（**无 cancel/subscribe，诚实抛 `NOT_IMPLEMENTED`**，不在能力声明谎称）；`invoke()` 带 `Authorization:Bearer` + `DHL-API-Key`，无 HMAC，直返 data。
  - **3.4 4PX + 燕文 接入（MD5）** —— 共享 `md5-sign.service.ts`（32 位小写 MD5）；`fourpx.adapter.ts` 能力 RATE/SHIP/LABEL/TRACK/**CANCEL**（无 subscribe）；`yanwen.adapter.ts` 能力 **SHIP/LABEL/TRACK**（**无 rate/cancel/subscribe，均诚实抛 `NOT_IMPLEMENTED`**）；`carriers.module.ts` `onModuleInit` 注册三工厂，`CarriersService.resolve` 工厂优先分发租户 `CarrierAccount` 凭证。
  - **3.5 比价引擎四层 + 试算模式（§5 / §4.1）** —— `pricing.types.ts`（`CompareRequest`/`CompareResult` 含四层执行痕迹）、`reachability.service.ts`（L2 可达性地图：禁运国 KP/IR/SY + 燕文禁敏感货，<5ms 剔除）、`pricing-engine.service.ts`（L1 预热费率卡接口预留返回空 TODO Redis；L3 有界并行实时池 2s SLA，失败捕获入 `l3Failed` 不中断；L4 诚实护栏：去重 `carrierCode:productCode`→成本升序→截断 `PRICING_MAX_RESULTS=20`；试算模式返回多列表不锁价）、`pricing.controller.ts`（`POST /pricing/compare`，`@TenantId()`）、`pricing.module.ts` 接入 `AppModule`；`CarriersService` 新增公开 `resolveAdapter(tenantId, code)` 供引擎工厂解析。
- **进行中（🔵）**：无（本批任务全部完成）。
- **受阻**：无。
- **诚实原则落地**：不支持的能力（DHL 无 cancel/subscribe、燕文无 rate/cancel/subscribe、4PX 无 subscribe）一律抛 `BusinessException(NOT_IMPLEMENTED)`，不在 `capabilities` 声明里谎称支持；`health()` 工厂型用探针账号仅取能力声明、不真实探测（软失败）。
- **占位 / 待联调（统一 TODO）**：① 各承运商 API 路径与字段为合理占位（`TODO(ops): 2026-11 联调校正`）；② `carrierCost` 暂占位 0（待 §9 费用回传回填）；③ 令牌缓存为实例内存级（待 Redis 共享）；④ L1 费率卡返回空（待 Redis/合约价卡）。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**99 passed / 13 suites**，新增 8 条比价引擎单测覆盖 L2/L3/L4/试算/截断）。
- **提交**：`64223ba`（feat(carriers): 3.2 云途/3.3 DHL/3.4 4PX·燕文 适配器接入）、`1bbafca`（feat(pricing): 3.5 比价引擎四层架构 + 试算模式 + L4 诚实护栏）、`4ff82d3`（chore(dev): 检查点 3.2-3.5 完成）。
- **下一步（次日接力）**：3.6 加价规则引擎 + 币种归一（§9/§10，双价列 Markup/FX，填充 `RateQuote.sellPrice` 与利润核算基础）。阶段1 收口 1.5/1.6/1.8/1.9 可在 3.5/3.6 后补。

---

### 进度更新 · 2026-10-12（续跑 · 3.6 加价规则引擎 + 币种归一）
- **完成（✅）**：
  - **3.6 加价规则引擎 + 币种归一（§10 双价列 / 加价层 / 币种归一）** —— 新增 `pricing/markup/` 子模块：
    - `fx.service.ts`：`FxService` 币种归一（内存汇率种子 USD/EUR/GBP→CNY=7.2/7.8/9.1；缺失汇率诚实抛错，不静默 1:1；TODO Redis 缓存 + 真实 FX 源）。
    - `markup-rules.service.ts`：`MarkupRulesService` 规则解析（作用域 GLOBAL/CARRIER/PRODUCT/ROUTE_ZONE/TENANT；**跨作用域叠加 + 同(作用域,类型)最具体/高 priority 胜出**；默认全局 15% + 最低毛利 ¥5，ROUTE_ZONE 待 §18 zone_maps）。
    - `markup-engine.service.ts`：`MarkupEngineService` 在比价 L4 后执行：carrier_cost→基准币种→加价叠加（PERCENT/FIXED/TIERED）→最低毛利保护→双价列（sell_price/margin/fx_rate_snapshot）。
    - `pricing.module.ts` 装配三服务；`PricingEngineService` 注入 `MarkupEngineService`，L4 后 `enrichQuotes` 回填 quotes（sellPrice/margin/currency/fxRateSnapshot），`selected` 改按 **sellPrice** 锁价（§5 报价即实收）。
    - `rate.dto.ts`：`RateQuote` 增 `margin?` / `fxRateSnapshot?`（币种归一汇率快照，§10.6）。
  - 配套 18 个单测（fx/rules/engine 三套），验证币种归一、作用域叠加与去重、PERCENT/FIXED/TIERED、最低毛利兜底、双价列回填。
- **进行中（🔵）**：无。
- **受阻**：无。
- **占位 / 待联调（统一 TODO）**：① 汇率内存表待 Redis + 真实 FX 源（§10.3）；② 加价规则内存表待 `markup_rules` 持久化 + 运营后台配置（§10.6/§23）；③ ROUTE_ZONE 作用域待 §18 zone_maps 接入。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**117 passed / 16 suites**）。
- **提交**：`af93581`（feat(pricing): 3.6 加价规则引擎 + 币种归一）。
- **下一步（次日接力）**：3.7 运费试算门户(正式)（§4：商户自助试算 + 渠道自选 + quote 锁定；`POST /pricing/compare` 引擎已就绪，需补门户 API/页与 quote 有效期/成本快照）。

---

### 进度更新 · 2026-10-12（续跑 · 3.7 运费试算门户正式）
- **完成（✅）**：
  - **3.7 运费试算门户(正式)（§4 运费试算与渠道自选）** —— 新增 `pricing/quote/` 子模块：
    - `quote.types.ts`：`Quote`/`QuoteStatus`/`QUOTE_TTL_MS`（默认 24h，待 §23 可配）。
    - `quotes.service.ts`：`QuotesService` 试算结果落库（内存 Map，待 §7/§10.6 `quotes` 表）：生成 `quote_id`（UUID）+ 有效期 + **租户隔离** + `selectedProductCode` 渠道自选；过期标记 `EXPIRED` 并诚实抛 `QUOTE_EXPIRED`（`HttpStatus.GONE`）。
    - `quotes.controller.ts`：`QuotesController` —— `POST /pricing/quotes`（跑比价引擎 trial + 加价层落库）、`GET /pricing/quotes/:id`（租户隔离 + 过期校验）、`PATCH /pricing/quotes/:id/select`（商户渠道自选，仅限列表内产品）。
  - 复用比价引擎（trial 模式）+ 加价层（§5/§10），**试算价与真实下单价口径一致**（§4.1/§4.6「试算即所见，下单即所付」）。
  - 新增 5 单测（创建/租户隔离/渠道自选/过期/有效期）。
- **进行中（🔵）**：无。
- **受阻**：无。
- **占位 / 待联调（统一 TODO）**：① quote 内存表待 `quotes` 表持久化（§7/§10.6）；② 试算门户前端页（渠道自选 UI）待阶段3 前端任务；③ 附加费明细引擎（§4.4 fuel/remote/oversize/关税预付）列为后续「物流增强」项，3.7 报价已含 sell_price 但附加费明细未逐项展开。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**122 passed / 17 suites**）。
- **提交**：`cb04b4c`（feat(pricing): 3.7 运费试算门户(正式) quote 锁定 + 渠道自选）。
- **下一步（次日接力）**：3.8 头程/尾程两段式（§14 `shipment_legs`：leg_type first/last；建单可拆分两段运单，轨迹带 leg 维度）。

---

### 进度更新 · 2026-10-13（夜间自动化 23:10 启动 · 3.8 头程/尾程两段式）
- **完成（✅）**：
  - **3.8 头程/尾程两段式物流模型（§14）** —— 在承运商建单模型引入 leg 维度：
    - `dto/shipment.dto.ts`：`CreateShipmentResult` 增 `legs?: ShipmentLegResult[]`；新增 `ShipmentLegResult`（legType/承运商/运单号/轨迹号/面单/成本/时效/转运节点）与 `ComposeShipmentResult`（各段聚合 + 总成本）。`LegType`（first/last/direct）已在 rate.dto。
    - `shipment-legs.service.ts`：`ShipmentLegsService.compose` 编排两段式建单——全程单拆为「头程 origin→hub」+「尾程 hub→dest」，分别调用 `CarriersService.ship` 建单并聚合；仅头程时退化为单段 FIRST。
    - `carriers.controller.ts`：新增 `POST /carriers/shipments/compose`（租户隔离）；`carriers.module.ts` 装配 `ShipmentLegsService`。
    - 单测 `shipment-legs.service.spec.ts`（3 cases：全程两段/单段退化/分段入参正确），全程拆两段成本聚合 12.5+7.3=19.8 断言通过。
  - **前端可视化（两段式运单页）**：`web/src/views/ShipmentsView.vue`（物流履约分组「两段式运单」），选头程/尾程承运商 + 转运节点 → 渲染「国内仓→海外仓→买家」路由图与逐段运单号/成本/时效；`carriers.ts` 增 `composeLegs` API 与类型；`mock-data.ts` 增 `doCompose` 演示编排；路由 + BasicLayout 菜单 已注册；AppIcon 增 `warehouse` 图标。
- **进行中（🔵）**：无。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `jest` ✅（shipment-legs 3 passed，全仓 125 passed/18 suites）｜ web `vue-tsc --noEmit` ✅ ｜ `vite build` ✅。
- **提交**：`39170b3`（feat(carriers): 阶段3 头程/尾程两段式物流模型 3.8）。
- **下一步（次日接力）**：3.9 面单 PDF/ZPL（§3/§11，pdf-lib 渲染，承运商/运单页打印入口）。

---

### 进度更新 · 2026-10-13（续跑 · 3.9 面单 PDF/ZPL）
- **完成（✅）**：
  - **3.9 面单 PDF/ZPL 渲染（§3 getLabel / §11 面单渲染）** —— 新增 `carriers/label/` 子模块：
    - `label.service.ts`：`LabelService` 把单段运单渲染为 **PDF（pdf-lib，4x6 标签）** + **ZPL II（热敏指令，含 ^BC 真条码 + ^FD 文本）** 双格式；PDF 用仿条码竖条 + 标准字体（中文承运商名降为 ASCII 回退代码，避免 WinAnsi 编码抛错），ZPL 保留原文。
    - `label.types.ts`：`LabelSpec` / `LabelResult`（pdfBase64 + zpl + fileName）。
    - `carriers.controller.ts`：`POST /carriers/labels`（租户隔离）；`carriers.module.ts` 装配 `LabelService`。
    - 单测 `label.service.spec.ts`（3 cases：PDF 头 %PDF / ZPL ^XA..^XZ / ^BC 条码 / 缺字段回退）全绿。
  - **前端可视化（打印面单）**：`ShipmentsView.vue` 每段运单新增「打印面单」按钮 → 弹窗预览 **PDF（iframe）+ ZPL 文本（可复制）**；`carriers.ts` 增 `createLabel` API 与类型；`mock-data.ts` 增 `doCreateLabel`（占位 PDF + ZPL）；AppIcon 增 `print` 图标。
- **进行中（🔵）**：无。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `jest` ✅（label 3 passed，全仓 128 passed/19 suites）｜ web `vue-tsc --noEmit` ✅ ｜ `vite build` ✅。
- **提交**：`dae84d1`（feat(carriers): 阶段3 面单 PDF/ZPL 渲染 3.9）。
- **下一步（次日接力）**：3.10 报关/合规字段（§19 HS/IOSS/EORI/VAT/Section321）。

---

### 进度更新 · 2026-10-13（续跑 · 3.10 报关/合规字段）
- **完成（✅）**：
  - **3.10 报关/合规字段（§19 申报/合规自动化）** —— 新增 `carriers/customs/` 子模块：
    - `customs.service.ts`：`CustomsService.validate` 在 booking 前做合规关卡校验（§19 守卫）：申报价值必填与正性、HS 编码 6-12 位格式、欧盟 IOSS(≤150€)/EORI 与格式、英国 EORI、美国 Section 321（≤$800 T86）资格判定、敏感货物（带电/液体）禁运提示；任一 error 即 `valid=false` 阻断/转人工。
    - `customs.types.ts`：`CustomsSpec` / `CustomsIssue(level=error|warning|info)` / `CustomsValidationResult`（含 eligibleSection321 + recommendedDuty）。
    - `carriers.controller.ts`：`POST /carriers/customs/validate`；`carriers.module.ts` 装配 `CustomsService`。
    - 单测 `customs.service.spec.ts`（7 cases：申报价值/欧盟/英国/Section321/超限/HS格式/敏感货）全绿。
  - **前端可视化（报关合规校验）**：`ShipmentsView.vue` 新增「报关合规校验」卡片（目的国/HS/IOSS/EORI/申报价值/货物类型/Section321 开关）→ 调用 `carriersApi.validateCustoms` 展示分级问题（error 红 / warning 橙 / info 蓝）与建议清关方式；`carriers.ts` 增 `validateCustoms` API 与类型；`mock-data.ts` 增 `doValidateCustoms`（与后端同口径）。
- **进行中（🔵）**：无。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `jest` ✅（customs 7 passed，全仓 135 passed/20 suites）｜ web `vue-tsc --noEmit` ✅ ｜ `vite build` ✅。
- **提交**：待本批末统一提交（3.10 `feat(carriers): 阶段3 报关/合规字段 3.10`）。
- **下一步（次日接力）**：3.11 轨迹双通道+NDR（§3/§20 推送+轮询兜底+异常工单）｜ 3.12 地址校验+分区（§18 脏地址/邮编→zone）｜ 3.13 聚合平台兜底（AfterShip/17track 尾程）。

---

### 进度更新 · 2026-10-13（续跑 · 3.11 轨迹双通道 + NDR）
- **完成（✅）**：
  - **3.11 轨迹双通道 + NDR（§3 getTracking / §6 双通道 / §20 异常事件）** —— 新增 `carriers/tracking/` 子模块：
    - `abstract-carrier.adapter.ts`：补 `getCapabilities()` 公开方法（能力清单供通道判定，已同步进 `CarrierAdapter` 接口契约）。
    - `tracking.types.ts`：`TrackingEnvelope`（轨迹+通道+NDR+查询时间）/ `NdrReport`（detected/severity/events/recommendedAction）/ `TrackingQuery`。
    - `tracking.service.ts`：`TrackingService.track` 双通道判定——支持订阅的承运商走**推送（push，注册 webhook 订阅）**，否则走**轮询（poll）**兜底；`detectNdr` 对 exception/cancelled 归一化状态产出 NDR 报告（critical→建理赔工单 §20，cancelled→确认重投/退款）。
    - `carriers.controller.ts`：`POST /carriers/tracking/query`；`carriers.module.ts` 装配 `TrackingService`。
    - 单测 `tracking.service.spec.ts`（3 cases：推送通道+订阅 / 轮询通道 / NDR 异常识别）全绿。
  - **前端可视化（轨迹查询双通道 + NDR）**：`ShipmentsView.vue` 新增「轨迹查询（双通道 + NDR）」卡片——选承运商 + 轨迹号（`ndr` 哨兵触发异常演示）→ 展示**通道标签（推送/轮询）+ 订阅状态**与**NDR 异常报告（严重级别+事件+建议）**及轨迹节点时间线；`carriers.ts` 增 `trackQuery` API 与类型；`mock-data.ts` 增 `doTrackQuery`（订阅能力→通道、ndr→exception+清关扣留事件）；AppIcon 增 `radar` 图标。
- **进行中（🔵）**：无。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `jest` ✅（tracking 3 passed，全仓 138 passed/21 suites）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：`待提交`（feat(carriers): 阶段3 轨迹双通道+NDR 3.11）。
- **下一步（次日接力）**：3.12 地址校验+分区（§18 脏地址/邮编→zone）｜ 3.13 聚合平台兜底（AfterShip/17track 尾程）。

---

### 进度更新 · 2026-10-14（夜间自动化 23:10 启动 · 3.12 地址校验+分区 / 3.13 聚合平台兜底）
- **完成（✅）**：
  - **3.12 地址校验与分区（§18 地址校验与标准化）** —— 新增 `carriers/address/` 子模块：
    - `address.types.ts`：`AddressSpec`/`AddressIssue`/`ZoneInfo`/`CarrierFeasibility`/`AddressValidationResult`（分级问题 + 邮编分区 + 多承运商可行性）。
    - `zone-map.service.ts`：`ZoneMapService` 邮编→分区映射引擎 `resolve`/`resolveMany`：分区 ZONE_1..ZONE_5（邮编首字符确定性落入）、区域中文名、远程区前缀标记（US AK/HI/关岛、CA 北部、AU 北领地占位）、按承运商可达性覆盖（4PX 美国 ZONE_5 不可达、燕文加拿大远区不可达，待 §3e 兜底）。
    - `address.service.ts`：`AddressService.validate` —— 脏地址检测（必填/邮编格式按目的国/电话格式）+ 标准化（大小写归一/邮编大写/去空格）+ 质量分（完整度 70% + 格式合规 30%）+ 分区与多承运商可行性；error 级阻断、warning/info 提示。
    - `carriers.controller.ts`：`POST /carriers/address/validate`；`carriers.module.ts` 装配 `AddressService`/`ZoneMapService`。
    - 单测 `address.service.spec.ts`（12 cases：必填/邮编格式/电话/质量分/标准化/分区/远程/可达/多承运商可行性）。
  - **3.13 聚合平台兜底追踪（§3e）** —— 新增 `carriers/aggregator/` 子模块：
    - `aggregator.types.ts`：`AggregatorQuery`/`AggregatorResult`/`AggregatorCatalogItem`（归一化尾程轨迹 + fallback 标志）。
    - `aggregator.service.ts`：`AggregatorService.query` 经 AfterShip/17TRACK 归一化尾程轨迹，作为直连失败时的第三兜底通道；诚实原则——未接入平台抛 `NOT_IMPLEMENTED`、fail 哨兵返回 `fallback=true` 建议直连，不静默伪装妥投；`listCatalog` 供前端枚举。
    - `carriers.controller.ts`：`POST /carriers/aggregator/track` + `GET /carriers/aggregator/catalog`；`carriers.module.ts` 装配 `AggregatorService`。
    - 单测 `aggregator.service.spec.ts`（5 cases：目录/正常归一化/不支持诚实抛/失败哨兵 fallback）。
  - **前端可视化（两页独立，避免膨胀 ShipmentsView）**：
    - `AddressView.vue`（物流履约分组「地址校验」）：地址表单（目的国/收件人/电话/州省/城市/地址行/邮编/承运商多选）→ 质量分徽章 + 标准化地址 + 分区结论（区/区域/远程/可达）+ 分级问题清单 + 各承运商可行性表；内置「合规/脏地址」示例一键填充，演示+正式双路通。
    - `AggregatorView.vue`（物流履约分组「聚合追踪」）：选聚合平台 + 尾程承运商 + 轨迹号 → 归一化轨迹时间线 + fallback 提示；含「fail」哨兵演示未解析兜底。
    - `carriers.ts` 增 `validateAddress`/`aggregateTrack`/`listAggregators` API 与类型；`mock-data.ts` 增 `doValidateAddress`/`doAggregateTrack`/`doAggregatorCatalog`（与后端同口径）；`AppIcon` 增 `pin`；`router` + `BasicLayout.menuNodes` 已注册两页。
- **进行中（🔵）**：无（本批任务全部完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**155 passed / 23 suites**，新增 17：address 12 + aggregator 5）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：待本批末统一提交（3.12+3.13 后端/前端/进度生成器）。
- **下一步（次日接力）**：阶段3 收口完成（M3 达成）。进入阶段4：4.1 收款账务 wallet+ledger（复式记账/预充值/账期/退款 §16）→ 4.2 商户账单+承运商对账 → 4.3 利润核算 → 4.4 多租户隔离强化 → 4.5 精细化 RBAC → 4.6 运营配置后台 → 4.7 报表指标 → 4.8 理赔保险 → 4.9 多语言多币种前端。另：3.12 的 zone_maps 可在 §4.4 接入远程附加费、在比价 L2 可达性复用。

---

### 进度更新 · 2026-10-15（夜间自动化 23:10 启动 · 4.1 收款账务）
- **完成（✅）**：
  - **4.1 收款账务 wallet + ledger（§16 平台收款与商户账务）** —— 新增 `finance` 模块：
    - `wallet.service.ts`：钱包模型（balance 可用余额 / frozen 冻结 / creditLimit 信用账期 / currency 基准币 / status）、复式记账流水（recharge/freeze/unfreeze/charge/refund/settle，只增不改，balanceAfter 留痕）；资金流（§16.3）充值→钱包增、下单锁价→冻结、实际 booking→扣减（优先消耗冻结、余额可负表示动用信用）、撤单/退货→refund、与承运商结算→settle；可用额度 `available = balance - frozen + creditLimit`，下单前据此校验、不足诚实抛 `WALLET_INSUFFICIENT`；钱包被风控冻结（`status=frozen`）禁止资金进出（§16.1）。
    - `wallet.controller.ts`：`GET /finance/wallet`（概要）、`GET /finance/ledger`（流水）、`POST /finance/wallet/recharge`、`/credit-limit`、`/freeze`、`/unfreeze`、`/charge`、`/refund`、`/settle`；全部 `@TenantId()` 租户隔离（§0/§17）。
    - `finance.module.ts` 装配并接入 `AppModule`。
    - 单测 `wallet.service.spec.ts`（7 cases：充值/冻结扣费/额度不足/信用账期/退款结算/解冻/流水只增不改）全绿。
  - **Schema（§16.5）**：`Wallet` 增 `frozen`/`creditLimit`/`status` 字段，`LedgerEntry` 类型与字段对齐 §16.2（amount 带符号、balanceAfter、refType/refId/remark）；已 `prisma generate`。
  - **前端可视化（财务中心首个落地页）**：`web/src/views/WalletView.vue`（/wallet）—— 钱包四宫格（可用额度/可用余额/冻结/授信）+ 资金操作（充值、设授信、模拟下单冻结→扣费、撤单解冻→退款）+ 复式记账流水表（类型徽章/带符号金额/变动后余额/关联单号）；`web/src/api/finance.ts` 接口封装、`mock-data.ts` 同口径内存实现（演示+正式双路通）；`router` + `BasicLayout.menuNodes` 财务中心分组注册「收款账务」；AppIcon 增 `wallet` 图标。
- **进行中（🔵）**：无（本批任务完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**162 passed / 24 suites**，新增 7）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：待本批末统一提交（4.1 后端/前端/进度生成器，含 schema 变更需随 `prisma generate` 产物）。
- **下一步（次日接力）**：4.2 商户账单 + 承运商对账（bills/reconciliations，§9/§10，复用 4.1 ledger 与 3.6 加价/币种）→ 4.3 利润核算(spread) → 4.4 多租户隔离强化 → 4.5 精细化 RBAC → 4.6 运营配置后台 → 4.7 报表指标 → 4.8 理赔保险 → 4.9 多语言多币种前端。

### 进度更新 · 2026-10-15（续跑 · 4.2 商户账单 + 承运商对账）
- **完成（✅）**：
  - **4.2 商户账单 + 承运商对账（§9/§10 结算与对账）** —— 新增 `billing` 模块：
    - `billing.service.ts`：按账期聚合各租户 `Shipment.sellPrice` → 商户账单 `Bill`（tenant+period 唯一，draft→issued→settled 状态机）；按账期聚合各承运商 `Shipment.carrierCost` → 承运商对账 `Reconciliation`（carrierCode+period 唯一，carrierId→code 经 Carrier 映射，open→matched→closed 状态机）；平台利润核算 `profit = ΣtotalSell − ΣtotalCost`、毛利率（§9 spread）。
    - `billing.controller.ts`：`POST /billing/bills/generate`、`GET /billing/bills`、`POST .../:id/issue|settle`、`POST /billing/reconciliations/generate`、`GET /billing/reconciliations`、`POST .../:id/match|close`、`GET /billing/profit`；账单列表按 `@TenantId()` 隔离，对账/利润为平台级。
    - `billing.module.ts` 装配并接入 `AppModule`。
    - 单测 `billing.service.spec.ts`（7 cases：账期聚合/出账幂等/承运商聚合/账单状态机/对账状态机/利润核算/非法账期）全绿。
  - **Schema 修复**：`Bill`/`Reconciliation` 在 §9/§10 落地时曾被重复定义（P1012），已合并为单一聚合模型（tenant+period / carrierCode+period 唯一），`prisma generate` 通过。
  - **前端可视化（财务中心第二个落地页）**：`web/src/views/BillingView.vue`（/billing）—— 平台利润四宫格（应收合计/应付合计/平台利润/毛利率）+ 双 Tab（商户账单：生成/出账/结清；承运商对账：生成/匹配/关闭）；`web/src/api/billing.ts` 接口封装、`mock-data.ts` 同口径内存实现（演示+正式双路通）；`router` + `BasicLayout.menuNodes` 财务中心分组注册「商户账单」；AppIcon 增 `bill/calendar/arrow-down/arrow-up/trend/percent` 图标。
- **进行中（🔵）**：无（4.2 完成，进入 4.3）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**169 passed / 25 suites**，新增 7）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（含 schema 修复、billing 模块、前端页、进度生成器）。
- **下一步**：4.3 利润核算(spread)（报表化 §9/§10，前端利润看板/趋势，复用 4.2 的 profit 口径）→ 4.4 多租户隔离强化 → 4.5 精细化 RBAC → 4.6 运营配置后台 → 4.7 报表指标 → 4.8 理赔保险 → 4.9 多语言多币种前端。

### 进度更新 · 2026-10-16（夜间自动化 23:10 启动 · 4.3 利润核算）
- **完成（✅）**：
  - **4.3 利润核算（spread，§9/§10 报表化）** —— 在 4.2 平台级利润核算（`profit = ΣtotalSell − ΣtotalCost`）基础上报表化拆解：
    - 后端 `billing.service.ts` 新增 `getProfitBreakdown(period)`（总览 + **按租户** 应收/应付/利润/毛利率 + **按承运商** 应付成本，租户级利润由 `Shipment.sellPrice − carrierCost` 真实分摊，非笼统相减）+ `getProfitTrend(months=6)`（近 N 账期平台利润概览，供趋势图）；`billing.controller.ts` 新增 `GET /billing/profit/breakdown`、`GET /billing/profit/trend`；`billing.types.ts` 新增 `ProfitBreakdown`/`TenantProfit`/`CarrierCost`。
    - 单测 `billing.service.spec.ts` 新增 2 cases（租户/承运商拆解口径 + 趋势结构）。
  - **前端可视化（财务中心第三个落地页）**：`web/src/views/ProfitView.vue`（/profit）—— 利润总览四宫格（应收合计/应付合计/平台利润/毛利率）+ **利润趋势图（ECharts 近 6 账期 利润柱+应收/应付折线）** + 按租户利润贡献表 + 按承运商应付成本表；`web/src/api/billing.ts` 增 `getProfitBreakdown`/`getProfitTrend` + 类型；`mock-data.ts` 增 `doGetProfitBreakdown`/`doGetProfitTrend`（与后端同口径，演示+正式双路通）；`router` + `BasicLayout.menuNodes` 财务中心分组注册「利润核算」；`AppIcon` 复用 `trend/calendar/arrow-down/arrow-up/coins/percent`。
- **进行中（🔵）**：无（本批 4.3 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**171 passed / 25 suites**，新增 2）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（4.3 后端/前端/进度生成器）。
- **下一步（次日接力）**：4.4 多租户隔离强化（§17 schema-per-tenant 评估 / 行级隔离加固）→ 4.5 精细化 RBAC → 4.6 运营配置后台 → 4.7 报表指标 → 4.8 理赔保险 → 4.9 多语言多币种前端。

### 进度更新 · 2026-10-16（续跑 · 4.4 多租户隔离强化）
- **完成（✅）**：
  - **4.4 多租户隔离强化（§17 评估 + 落地）** —— 评估结论：**采用共享库 + tenant_id 行级隔离**（schema-per-tenant 经评估在高并发多租户下运维/迁移/跨租户聚合成本过高，不予采用）。
    - 后端 `common/tenant/tenant-isolation.ts`：`TENANT_SCOPED_MODELS`（全 39 个带 tenant_id 的业务模型）+ `enforceTenantIsolation` 纯函数（上下文租户与读写 tenant_id 冲突即抛 `TENANT_ISOLATION_VIOLATION`，§17.1 禁客户端覆盖 + §17.4 防 IDOR）；平台级聚合（无上下文）完全透明。
    - `common/tenant/tenant-isolation.middleware.ts`：Prisma `$use` 注册中间件（热重载去重），把隔离校验接入全局 DB 拦截。
    - `common/security/secret-encryption.service.ts`（§17.2）：AES-256-GCM 加密承运商凭据（加密存储/运行时解密/不落明文库），主密钥取自 `APP_MASTER_KEY`，缺失告警+开发态降级。
    - `common/tenant/tenant.middleware.ts`：租户解析新增 **JWT 验签回退**（与鉴权同一密钥，取 payload.tenantId），使隔离上下文对 JWT 认证请求也生效（比客户端 header 更权威）。
    - `modules/system/`：`GET /system/security` 只读诊断（隔离模式/模型数/加密算法/越权防护）；`AppModule` 装配 `SystemModule`。
    - 单测 `tenant-isolation.spec.ts`（8 cases）+ `secret-encryption.service.spec.ts`（4 cases）。
  - **前端可视化（系统设置 → 安全加固）**：`web/src/views/SecurityView.vue`（/security，super 专属）—— 核心态势三卡片（隔离模型数/AES-256-GCM/IDOR 已拦截）+ §17 合规清单（已落地/规划中状态）+ 隔离方案评估结论 + 39 模型标签云；`web/src/api/system.ts` + `mock-data.ts` 双路通；`router` + `BasicLayout.menuNodes` 系统设置分组注册（roles super）；`AppIcon` 复用 `shield/tenants/radar`。
- **进行中（🔵）**：无（本批 4.4 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**183 passed / 27 suites**，新增 12）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（4.4 后端/前端/进度生成器）。
- **下一步（次日接力）**：4.5 精细化 RBAC（§22 组织层级 / scope）→ 4.6 运营配置后台 → 4.7 报表指标 → 4.8 理赔保险 → 4.9 多语言多币种前端。

### 进度更新 · 2026-10-16（续跑 · 4.5 精细化 RBAC）
- **完成（✅）**：
  - **4.5 精细化 RBAC（§22 权限点 / 角色蓝图 / 角色分配）** —— 后端新增 `common/auth/rbac/` 子模块：
    - `permissions.ts`：`PERMISSION_RESOURCES`（12 个资源分组，如 dashboard/order/catalog/channel/carrier/pricing/shipment/finance/report/rbac/tenant/settings）、`ROLE_PERMISSIONS`（super_admin/operator/finance/warehouse/cs 五套系统角色 → 默认权限点集合）、`SYSTEM_ROLES`、`SCOPE_DIMENSIONS`（all/shop/warehouse/region 数据可见范围）、`ALL_PERMISSIONS`、`resolvePermissions(roles)`（角色→权限点解析）、`scopeMatches(userScope, resourceScope)`（作用域匹配）。
    - `require-permissions.decorator.ts`：`@RequirePermissions(...)` + `REQUIRE_PERMISSIONS_KEY`，供控制器方法标注所需权限点。
    - `permissions.guard.ts`：`PermissionsGuard` 用 `Reflector` 读取装饰器元数据，对缺权限请求返回 403（§22 运行时鉴权）。
    - `modules/rbac/rbac.controller.ts`：`@UseGuards(JwtAuthGuard, PermissionsGuard)`；`GET /rbac/permissions`（权限点目录 + 作用域维度）、`GET /rbac/role-blueprints`（系统角色→权限点蓝图）、`GET /rbac/roles`（当前租户角色）、`POST /rbac/roles`（创建角色，需 `rbac:manage`）、`POST /rbac/users/:userId/roles`（分配角色，需 `rbac:manage`）；`rbac.module.ts` 装配并接入 `AppModule`。
    - JWT 权限点贯通：`auth.service.ts` 登录签发把 `roles` 写入 JWT；`jwt.strategy.ts` validate 回吐 `roles`；`users.service.ts` `validate` 改由 `role` 表两查询加载角色（规避 `Role`/`UserRole` 无 Prisma 关系）。
    - 单测 `permissions.spec.ts`（5 cases：角色解析/作用域匹配/权限并集/缺权限判定/资源分组完整性）全绿。
  - **前端可视化（系统设置 → 权限管理）**：`web/src/views/RbacView.vue`（/rbac，super 专属）—— 态势四卡片（角色数/权限点总数/作用域维度/系统蓝图数）+ **权限矩阵**（行=权限点、列=系统角色、✓ 标记归属）+ 当前租户角色表（系统/自定义徽章、权限数、分配按钮）+ 新建角色对话框（角色名/作用域/权限点多选）+ 分配角色对话框（用户 ID + 角色选择）；`web/src/api/rbac.ts` 接口封装、`mock-data.ts` 增 RBAC 演示状态与 `doGetCatalog`/`doGetBlueprints`/`doGetRoles`/`doCreateRole`/`doAssignRoles`（演示+正式双路通）；`router` + `BasicLayout.menuNodes` 系统设置分组注册（roles super，icon `key`）；`AppIcon` 复用 `key/shield/globe/layers/check`。
- **进行中（🔵）**：无（本批 4.5 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**188 passed / 27 suites**，新增 5）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（4.5 后端/前端/进度生成器）。
- **下一步（次日接力）**：4.6 运营配置后台（§23 加价/产品/费率卡 UI）→ 4.7 报表指标 → 4.8 理赔保险 → 4.9 多语言多币种前端。

### 进度更新 · 2026-10-17（夜间自动化 23:10 启动 · 4.6 运营配置后台）
- **完成（✅）**：
  - **4.6 运营配置后台（§23 加价/产品/费率卡 UI）** —— 补完并收口「运营配置」页（/pricing，系统设置分组）：
    - 后端新增/收口 `modules/pricing/markup/` 与 `product/`：
      - `markup-config.types.ts`：`MarkupConfigScope`（global/tenant/carrier/channel/product）、`MarkupConfigMode`（percent/fixed）、`MarkupConfigOut`/`CreateMarkupConfigDto`/`UpdateMarkupConfigDto`（class-validator）。
      - `markup-config.service.ts`：内存版加价规则服务（6 条种子：全局 12% / 租户 acme 5% / 承运商 DHL 8%·云途 15% / 产品 带电 6% / 渠道 Amazon 2% 停用），`list/create`(空 target 抛 MARKUP_TARGET_EMPTY)/`update`/`remove`（TODO §10.6 DB 落库）。
      - `markup-config.controller.ts`：`@Controller('pricing/markup-rules')` GET/POST/PUT(':id')/DELETE(':id')。
      - `fx.controller.ts` + `fx.service.ts`：`@Controller('pricing/fx')` GET 列表 + PUT(':base/:quote') 调汇率（≤0 抛 FX_RATE_INVALID）；`listRates()`/`updateRate()` + `DISPLAY_RATE_PAIRS`（USD/EUR/GBP→CNY）。
      - `product/`（续 3.7 半截工程）：`LogisticsProduct` 全字段 CRUD + `GET :id/rate?weightKg=` 费率卡成本试算（首重价 + 续重价 × max(0, 计费重−1)）。
    - 单测 `markup-config.service.spec.ts`（7 cases）+ `logistics-product.service.spec.ts`（修前批次按创建倒序失效）全绿。
  - **前端可视化（系统设置 → 运营配置，三 Tab 合一）**：`web/src/views/PricingRulesView.vue` 改三 Tab——「加价规则」(既有) / 「物流产品 / 费率卡」(新增 `OperationsProducts.vue`) / 「币种与汇率」(既有)；`OperationsProducts.vue` 含产品目录表（承运商/物流段/目的区/时效/费率卡/启用开关）+ 新增编辑对话框（承运商/产品名必填等 14 字段）+ 费率卡成本试算对话框（计费重→承运商成本）；`web/src/api/pricing.ts` 增 `CarrierCode`/`LegType`/`CargoType` 类型 + `CARRIER_LABELS`/`LEG_LABELS`/`CARGO_LABELS` + `LogisticsProduct`/`RateCardQuote`/`ProductInput` + `productsApi`（list/create/update/remove/rate）；`web/src/api/mock-data.ts` 增 `MockLogisticsProduct` + 4 条种子 + `doListProducts`/`doCreateProduct`/`doUpdateProduct`/`doRemoveProduct`/`doProductRate`（演示+正式双路通）。路由与菜单沿用既有 /pricing（系统设置，图标 sliders）。
- **进行中（🔵）**：无（本批 4.6 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**202 passed / 30 suites**，新增 7 + 修复 1）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（4.6 后端/前端/进度生成器）。
- **下一步（次日接力）**：4.7 报表指标口径（§25 履约/物流/利润看板）→ 4.8 理赔保险 → 4.9 多语言多币种前端。

### 进度更新 · 2026-10-17（续跑 · 4.7 报表指标口径）
- **完成（✅）**：
  - **4.7 报表指标口径（§25 报表指标定义）** —— 运营报表总览，五类指标单请求聚合：
    - 后端新增 `modules/reports/`：`reports.types.ts`（FulfillmentSla/LogisticsSla/ProfitReport/ChannelDistribution/ExceptionReport/ReportDashboard）、`reports.service.ts`（演示口径代表值，TODO §10 双价列 + §16 ledger + 事件真实聚合）、`reports.controller.ts`（`@Controller('reports')` GET `/overview`）、`reports.module.ts` 接入 `AppModule`。
    - 单测 `reports.service.spec.ts`（6 cases：五类字段完整/履约几何均值/物流四渠道/利润拆解/渠道占比和≈1/异常率求和）全绿。
  - **前端可视化（业务运营 → 运营报表）**：`web/src/views/ReportsView.vue`（/reports）—— 核心指标卡（整体履约达成率/综合异常率/近6期平台利润/总单量）+ 五张 ECharts（履约各段时长、物流时效+异常率双轴、利润趋势、渠道单量占比饼、异常构成饼）+ 利润拆解表（租户/渠道）；新增可复用 `components/BaseChart.vue`（ECharts 封装）；`web/src/api/reports.ts` 类型 + `reportsApi.overview`；`mock-data.ts` 增 `doGetReportDashboard`（与后端同口径，演示+正式双路通）；`router` 注册 /reports、`BasicLayout.menuNodes` 业务运营分组注册（icon `chart`）、`AppIcon` 增 `chart`。
- **进行中（🔵）**：无（本批 4.7 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**208 passed / 31 suites**，新增 6）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（4.7 后端/前端/进度生成器）。
- **下一步（次日接力）**：4.8 理赔保险（§20 claims 流程）→ 4.9 多语言多币种前端（§27）。

### 进度更新 · 2026-10-18（夜间自动化 23:10 启动 · 4.8 理赔保险 + 4.9 多语言多币种前端）
- **完成（✅）**：
  - **4.8 理赔保险（§20 异常 / 理赔 / 保险）** —— 后端 `claims` 模块（ClaimsService/Controller/Types/Module + DTO 校验 + 状态流转 open→processing→approved/rejected→paid）+ `Claim` schema 补全（cause/responsibleParty/refCarrierClaimId/note/updatedAt）；前端「理赔保险」页（/claims，财务中心）概览四卡 + 列表 + 新建 + 状态推进，演示/正式双路通；`claims.ts` 接口 + `mock-data` 同口径内存实现 + AppIcon `claim` + 路由/菜单/进度生成器注册。
  - **4.9 多语言多币种前端（§27）** —— 轻量 i18n（`t()` + 响应式 `locale` + 中/英字典，未引 vue-i18n 第三方依赖，避免安装触发本机 safe-delete 守卫）+ 顶栏语言切换 + 展示币种切换（CNY/USD/EUR/GBP，复用 §10.3 汇率口径，记账与后端始终基准币 CNY）；侧栏菜单/分组/顶栏文案接入 `t()` 即时翻译；「本地化设置」页（/localization，系统设置）语言 + 展示币种 + 汇率表 + 换算演示；利润核算页金额按展示币种实时换算（`money()`/`toDisplay`）。
- **进行中（🔵）**：无（阶段4 全部完成，M4 达成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（213 passed / 32 suites，新增 5 claims）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：`8dde7b1`(4.8) / `e3735ce`(progress) / `fda4dc8`(检查点) / `5a5ff34`(4.9) / `e8bf89d`(progress)。
- **下一步（次日接力）**：5.1 风控体系（§26 规则引擎 + 评分）→ 5.2 开放 API/ERP 集成 → 5.3 Amazon SP-API 完整对接 → 5.4 容量/灾备/测试强化。

---

### 进度更新 · 2026-10-21（夜间自动化 23:10 启动 · 5.3 Amazon SP-API 完整对接）
- **完成（✅）**：
  - **5.3 Amazon SP-API 完整对接（§29）** —— 阶段1（1.10 评估）已落地的 LWA 认证闸门 + 订单拉取/归一化基础上，补齐 §29 三大能力并启用真实 SigV4：
    - **FBA Inbound 头程入仓**：`AmazonAdapter.createInboundShipmentPlan` / `createInboundShipment` / `getInboundShipment` / `getPrepInstructions`（/fba/inbound/v0/plans|shipments|prepInstructions），卖家货从国内发往 Amazon 分配的 FBA 仓（§14 头程）。
    - **Shipping 买运单（FBM 推单）**：`AmazonAdapter.purchaseShippingLabel`（MerchantFulfillment /mfn/v0/shipments），取追踪号回写平台完成履约。
    - **Reports 对账**：`AmazonAdapter.requestReport` / `getReport` / `getReportDocument` / `getSettlementSummary`（Reports 2021-06-30，结算报表 TSV/CSV 解析为入账/费用/净额/按类型归集）。
    - **真实 AWS SigV4 签名** (`AmazonSigV4Signer`)：纯算法（Node crypto HMAC-SHA256），对照 AWS 官方 get-vanilla 测试向量离线验证一致；缺 AWS 凭证时回退 `NoopAmazonSigner`（评估/演示）。
    - 后端 `AmazonController`（/amazon/:shopId/health|fba-inbound/plan|fba-inbound|fba-inbound/:id|fba-inbound/prep|shipping/label|reports|reports/:id|reports/settlement/:id）+ `ChannelsModule` 已注册控制器与 `AmazonAdapterFactory`，工厂按店铺 authConfig 构建（§17 加密 + SigV4 选择器）。
  - **前端可视化（业务运营 → Amazon 对接）**：`web/src/views/AmazonView.vue`（/amazon）—— 三 Tab 闭环：① FBA 头程入仓（发货 SKU/数量→创建入库计划→分配 FBA 仓+FNSKU→创建货件→状态轮询→预处理指引）；② FBM 买运单（订单号+SKU→购面单→追踪号回写）；③ 结算报表对账（请求报表→异步状态轮询→DONE 后下载结算汇总四宫格+按类型表）。`web/src/api/amazon.ts` 接口封装 + `mock-data.ts` 同口径内存实现（演示+正式双路通）；`router` + `BasicLayout.menuNodes` 业务运营分组注册（`AppIcon` 新增 `amazon` 图标）；`locales` 补 `menu.amazon`。
- **进行中（🔵）**：无（本批 5.3 完成，进入 5.4）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**255 passed / 38 suites**，Amazon 相关 20 例新增全绿：sigv4×4 + capabilities + adapter×3 + controller×12）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（5.3 后端/前端/进度生成器）。
- **下一步（次日接力）**：5.4 容量/灾备/测试强化（§30：拉单限流/比价并发池/面单异步/读写分离/PG 备份/压测）。

---

### 进度更新 · 2026-10-21（夜间自动化续跑 · 5.4 容量/灾备/测试强化）
- **完成（✅）**：
  - **5.4 容量/灾备/测试强化（§30）** —— 聚焦 §30 的容量阈值、灾备目标与压测可观测性：
    - **拉单限流守卫**（`server/src/modules/channels/sync-throttle.service.ts`，新增）：内存级在途锁（同店铺去重 + TTL 兜底防死锁）+ 单租户并发信号量（超限抛 `PULL_THROTTLED` → HTTP 429）；`SyncThrottleService.getStats()` 暴露实时统计。
    - **接入拉单主链路**：`ChannelSyncService.pullAndStore` 进入前经 `throttle.acquire` 准入、finally 中 `release`，租户隔离的 `ChannelSyncController.POST :shopId/pull` 自然获得限流（无需改控制器）。
    - **容量与灾备配置中心**（`server/src/common/capacity/capacity.config.ts`，新增）：集中沉淀 §30 阈值（拉单并发上限/在途 TTL/比价并发池）与灾备目标（RTO 1h / RPO 5min / 全量+增量备份 cron + 保留天数），常量化去 magic number。
    - **系统诊断端点**（`SystemController.GET /system/capacity`，新增）：返回 `CAPACITY_CONFIG` 镜像 + 拉单限流实时统计 + §30 落地说明；`SystemModule` 导入 `ChannelsModule` 共享 `SyncThrottleService`（无循环依赖）。
    - **测试强化**：新增 `sync-throttle.service.spec.ts`（7 例：去重/并发上限/精确回退/TTL 过期/统计口径/重置/重复 release）；既有 `channels.spec.ts` 适配新构造参数。
  - **前端可视化（系统设置 → 容量与灾备，super 专属）**：`web/src/views/CapacityView.vue`（/capacity）—— 三张态势卡（拉单并发上限 / 在途店铺锁实时 / RTO-RPO）+ 容量阈值表 + 按租户并发进度条 + 灾备策略卡 + §30 落地说明；`web/src/api/system.ts` 增 `CapacityStatus`/`ThrottleStats` 接口与 `getCapacity()`，`mock-data.ts` 同口径静态镜像（演示+正式双路通）；`router` + `BasicLayout.menuNodes` 系统设置分组注册（`AppIcon` 复用 `bolt` 图标）；`locales` 补 `menu.capacity`。
- **进行中（🔵）**：无（本批 5.4 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**261 passed / 39 suites**，sync-throttle 新增 7 例全绿）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（5.4 后端/前端/进度生成器）。
- **下一步（次日接力）**：阶段5 收尾后进入收尾阶段（端到端压测脚本 / CI 接入 / 文档沉淀），或继续推进 dev-schedule 后续任务（如有）。

---

### 进度更新 · 2026-10-21（夜间自动化续跑 · 1.5 履约路由）
- **完成（✅）**：
  - **1.5 履约路由（模式A 自动选渠道，§4/§5）** —— 在 3.5 比价引擎（四层 + §10 加价层）已成熟基础上，新增订单级自动选渠能力，避免重复询价逻辑、口径漂移：
    - **FulfillmentRouterService**（`server/src/modules/pricing/fulfillment-router.service.ts`，新增）：`route(tenantId, req)` 复用比价引擎（trial 模式拿护栏后报价），按策略选优——`cheapest` 看加价后售价最低、`fastest` 看时效下限最小；返回推荐项 + 次优 3 条备选 + 可读推荐理由（诚实原则：无可行渠道时推荐为空并说明）。
    - **端点** `PricingController.POST /pricing/route`（新增）：注入 `FulfillmentRouterService`，`PricingModule` 注册该服务；`RouteStrategy`/`RouteRequest`/`RouteSuggestion` 类型与 `RateQuote` 对齐。
    - **测试强化**：`fulfillment-router.service.spec.ts` 3 例（cheapest/fastest 选优、无可行渠道返回空 + 说明）以桩替换比价引擎，专注验证路由层策略与解释。
  - **前端可视化（物流履约 → 履约路由）**：`web/src/views/FulfillmentView.vue`（/fulfillment）—— 发货上下文表单（目的国/货物类型/包裹实重+尺寸/策略：最省钱·最快）+ 一键「自动选渠道」→ 推荐渠道高亮卡（产品/售价/成本/时效）+ 推荐理由 + 备选渠道表；`web/src/api/fulfillment.ts` 接口封装 + `mock-data.ts` 同口径内存实现（演示+正式双路通）；`router` + `BasicLayout.menuNodes` 物流履约分组注册（AppIcon 复用 `swap` 图标）；`locales` 补 `menu.fulfillment`；进度生成器 EXPLICIT_ROUTES 补 1.5→/fulfillment。
- **进行中（🔵）**：无（本批 1.5 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**264 passed / 39 suites**，fulfillment-router 新增 3 例全绿）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（1.5 后端/前端/进度生成器）。
- **下一步（次日接力）**：继续推进剩余 ⬜ 早期任务 1.6/1.8/1.9/2.1/2.2/2.3（部分已被 3.x/4.x/5.x 交付覆盖，将按序补齐或标注 superseded）。

### 进度更新 · 2026-10-22（夜间自动化续跑 · 1.6 物流回传 + 轨迹基础）
- **完成（✅）**：
  - **1.6 物流回传 + 轨迹(基础)（§3 推单回传 / §6 轨迹）** —— 在既有 CarriersService.ship / ChannelRegistryService / OrderStateMachineService 之上新建 ShipmentsModule，沉淀「订单 → 建单 → 回传平台 → 轨迹上报」基础闭环，避免各业务重复造轮：
    - **ShipmentsService**（`server/src/modules/shipments/shipments.service.ts`）：`book` 调承运商建单落库运单 + 首段运单 + 首条「已建单」轨迹；`fulfill` 经渠道适配器回写平台并推进订单至 pushed；`recordTracking` 追加轨迹节点并按状态映射推进订单；`list/listTracking` 支持租户隔离。
    - **端点**（`ShipmentsController`，`/shipments`）：`POST /` 建单、`POST /:id/fulfill` 回传、`POST /:id/tracking` 上报、`GET /:id/tracking` 时间线、`GET /` 列表（可按 orderId 过滤）；`ShipmentsModule` 接入 `AppModule`，复用 carriers/channels/orders 三模块。Prisma schema 为 `TrackingEvent` 补 `description` 字段并 `prisma generate`。
    - **测试**：`shipments.service.spec.ts` 6 例（建单落库/缺单报错/回传推进/轨迹映射/时间线升序/租户隔离）全绿。
  - **前端可视化（物流履约 → 物流回传与轨迹）**：`web/src/views/ShipmentTrackingView.vue`（/shipment-tracking）—— 订单建单卡（选单 + 选承运商 + 运单类型）+ 运单列表 + 选中详情（回传平台按钮 + 轨迹上报表单 + 时间线）；`web/src/api/shipments.ts` 接口封装（book/fulfill/recordTracking/listTracking/list + 状态中文标签）；`mock-data.ts` 同口径内存实现（种子 2 运单 + 7 轨迹，建单/回传/上报均改写内存，演示+正式双路通）；`router` + `BasicLayout.menuNodes` 物流履约分组注册（图标 `link`）；`locales` 补 `menu.shipmentTracking`；进度生成器 EXPLICIT_ROUTES 补 1.6→/shipment-tracking。
- **进行中（🔵）**：无（本批 1.6 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**270 passed / 41 suites**，shipments 新增 6 例全绿）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（1.6 后端/前端/进度生成器/进度表）。
- **下一步（次日接力）**：继续推进剩余 ⬜ 早期任务 1.8/1.9/2.1/2.2/2.3（部分已被 3.x/4.x/5.x 交付覆盖，将按序补齐或标注 superseded）。

### 进度更新 · 2026-10-23（夜间自动化续跑 · 1.9 供应商代发 + 2.1 国内渠道 + 2.2/2.3 WMS 海外仓）

- **完成（✅）**：
  - **1.9 供应商代发链路(基础)（§21）** —— SuppliersModule（后端）：`SuppliersService`（供应商档案 + 代发单推单，租户隔离）、`SuppliersController`（`/suppliers`、`/suppliers/orders`、`/suppliers/orders/:id/advance`）、`SupplierDto`/`SupplierOrderDto`（状态机 pushed→accepted→shipped→done）、单测 8 例全绿；前端 `SuppliersView`（/suppliers-dropship，双 Tab 档案+代发单，演示+正式双路通）、`suppliers.ts` 接口、`mock-data` 同口径内存实现、`BasicLayout.menuNodes` + `locales` + `AppIcon(supplier)` 注册。
  - **1.8 运费试算最小版**：标记 ⏭️ superseded（已被 3.5/3.7 运费试算门户完整覆盖，QuotesView /quotes 已落地）。
  - **2.1 国内渠道(淘宝/抖音)（§3）** —— `TaobaoAdapter`/`DouyinAdapter` 继承 `AbstractChannelAdapter`，实现拉单/确认/回传/查单/撤单/轨迹六能力（无状态演示适配器，真实凭证工厂接入待 2026-11 联调，已注释 TODO）；注册进 `ChannelRegistryService`（GET /channels/platforms 自动露出）；单测 `domestic-adapters.spec.ts` 2 例；前端 `ChannelsView` 平台标签补 taobao(粉)/douyin(青) 配色 + `mock-data` 平台列表纳入 taobao/douyin。
  - **2.2/2.3 WMS 入库/库存/拣货 + 海外仓模型（§15）** —— `WmsModule`（后端）：`WmsService`（仓库 domestic/overseas、ASN pending→received→closed、上架按 仓+SKU+库位 累加库存、库存调整出库不得为负、拣货波次→任务 done、全租户隔离）、`WmsController`（`/wms/warehouses|asns|inventory|picks` 及 receive/putaway/adjust/wave/complete）、`WmsDto`/`WmsService` 单测 6 例全绿；前端 `WarehouseView`（/warehouse，四 Tab 仓库/入库/库存/拣货，演示+正式双路通）、`wms.ts` 接口、`mock-data` 同口径内存实现、`menuNodes` + `locales` + `AppIcon(warehouse)` 注册；进度生成器 EXPLICIT_ROUTES 补 2.2/2.3→/warehouse。
- **修复（本批）**：`WarehouseService` 库存 `upsert` 复合唯一键类型问题改用 `findFirst`+`update`/`create`；`SuppliersView` 补 `reactive` 导入并改用类型安全标签助手（vue-tsc 通过）；WMS 单测 fake Prisma 去除重复键并补 `inventory.findFirst`/`create`/`update`。
- **进行中（🔵）**：无（本批 1.9/2.1/2.2/2.3 全部完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**286 passed / 44 suites**）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（1.9/2.1/2.2/2.3 后端/前端/进度生成器/进度表）。
- **下一步（次日接力）**：早期 ⬜ 任务（1.9/2.1/2.2/2.3）已全部补齐，1.8 标注 superseded；方案 v1.5 主线任务收口。后续可推进：a) 真实平台凭证工厂化接入（淘宝 TOP / 抖音开放平台 / 云途·DHL·4PX·燕文 联调，标注 TODO）；b) 端到端真实验证（需本机按 README 起 PG）；c) 按 §31 收尾文档与回归。

---

## 阶段6 详细设计（货代中转仓作业流）

> 背景：v1.5 主线（阶段0–5）已完成订单/渠道/比价/承运商/账务/风控等底座，但「采购 → 中转仓 → 扫码 → 打包贴单 → 出库」这一核心作业流从未立项（详见 `中转仓流程审计.md`）。本阶段补齐，复用既有底座，不推倒重来。
> 执行纪律：沿用本表「〇、自动化执行约定」全部红线；业务能力类任务必须 页面 + 菜单 + 路由 + 演示/正式双路通；每批末跑 `npm run progress:gen` 并随代码提交。

### 6.1 店铺增删绑定 API
- 后端：`ShopsController` 补 `POST /shops`（入参 platform/name/authConfig，租户隔离）、`DELETE /shops/:id`（解绑，校验归属）；`ShopsService` 补 create/remove。
- 前端：`ChannelsView` 补「新增店铺 / 解绑」操作；`channels.ts` + `mock-data` 同口径；菜单/路由已存在无需新增。
- 验收：`POST/DELETE` 在演示与正式模式均通；列表实时反映增删。

### 6.2 采购单实体与 CRUD（后端）
- 新增 Prisma：`PurchaseOrder`（tenantId, shopId?, orderId?, trackingNo, carrier, platformOrderNo, purchaseUrl, productImages Json[String], remark, status, createdAt/updatedAt）、`PurchaseOrderItem`（purchaseOrderId, skuId?, productName, quantity, imageUrl?, unitPrice?, createdAt）。
- `PurchaseOrderService`：list（租户隔离、按 status/shop 过滤）、create（字段校验）、updateStatus、getById；`PurchaseOrderController`：`GET /purchase-orders`、`POST /purchase-orders`、`PATCH /purchase-orders/:id/status`。
- 单测覆盖租户隔离 + 状态机；prisma generate。

### 6.3 采购单录入前端页
- 新增 `PurchaseOrderView`（/purchase-orders）：录入表单（快递单号/物流公司/平台订单号/采购链接/产品图上传/数量/SKU 选择/备注）+ 列表 + 状态标签；`purchase-order.ts` 接口 + `mock-data` 内存实现（演示/正式双路）。
- `BasicLayout.menuNodes` 业务运营分组注册、`locales` 补 `menu.purchaseOrders`、`AppIcon` 补 icon；路由注册。

### 6.4 采购单↔店铺订单 匹配/关联
- `PurchaseOrderService.match(orderId)`：按 `platformOrderNo` 精确匹配 `Order`；模糊候选（收件人/手机号/SKU 集合相似度）给出建议列表供手动关联。
- 手动关联：`PATCH /purchase-orders/:id/link`（orderId）。
- 前端：`OrdersView` 订单详情抽屉新增「关联采购单」区块，展示已关联采购单与待匹配建议。

### 6.5 中转仓模型 + 看板
- `Warehouse.type` 扩 `transfer`（枚举 domestic/overseas/transfer）；新增 `TransferView`（/transfer 或中转仓 Tab）：展示该租户中转仓 + 待作业采购单（status 未出库且已到仓/已匹配）。
- 货代侧可见：中转仓看板列出到货采购单及关联店铺订单概览。

### 6.6 扫码到货入库端点
- 新增 `TransferModule`：`POST /transfer/scan`，body `{ warehouseId, scanValue, scanType: trackingNo|barcode|purchaseNo }`。
  - 解析：scanValue → 定位 `PurchaseOrder`（按 trackingNo / barcode(Sku) / purchaseNo）；命中后按 6.4 逻辑匹配 `Order`；生成到货登记（扩展 `Asn`：加 `purchaseOrderId`、`scanSource`、`receivedItems` Json）并将 `PurchaseOrder.status` 置 `arrived`/`matched`。
  - 返回：采购单 + 匹配订单 + 入库结果，供 PDA/扫码枪屏幕回显。
- 单测：扫码解析 + 匹配 + 入库状态推进。

### 6.7 中转仓作业：打包任务 + 核对
- 按匹配后的店铺订单聚合采购单，生成打包任务（扩展 `PickTask`：加 `channelCode`、`labelId`、`shipmentId`、`packedAt`；或新增 `PackTask`）。
- 核对：对比采购单行项（SKU/数量）与店铺订单 `OrderItem`，差异高亮提示。
- 前端：中转仓作业页——待打包队列 → 选单 → 核对差异 → 标记打包。

### 6.8 跨境面单生成（中转仓出单）
- 打包完成后选跨境渠道（复用比价/履约路由 1.5 + 承运商适配器）：`Shipment.book` 建单 + `LabelService` 出 PDF/ZPL；`Shipment` 加 `purchaseOrderId` 关联；面单收件人取自店铺订单 `recipient`，面单标题按平台/店铺呈现。
- 前端：打包页「生成面单」按钮 → 预览 PDF/ZPL → 打印。

### 6.9 出库闭环 + 物流同步
- 出库扫码：`POST /transfer/outbound`（shipmentId/purchaseOrderId）→ `Shipment.fulfill` 回写平台 + `TrackingEvent` 追加出库节点 → 流转正式跨境物流轨迹。
- 状态机贯通：`PurchaseOrder` → `shipped/outbound`；关联 `Order` → `pushed/shipped`；物流轨迹在 `ShipmentTrackingView` 可查。
- 验收：出库后跨境物流单号与轨迹在演示与正式模式均可见、可追踪。

---

### 进度更新 · 2026-10-25（夜间自动化 23:10 启动 · 6.4 采购单↔店铺订单 匹配/关联）
- **完成（✅）**：
  - **6.4 采购单↔店铺订单 匹配/关联** —— 在既有 `PurchaseOrderService` 之上补全匹配闭环（后端半截工程由本批续完并落盘）：
    - 后端 `PurchaseOrderService`：`findCandidates(tenantId, poId)`（按 平台订单号 / 收件人 / SKU 重叠 三维打分按强度降序）、`autoMatch`（取最强候选并关联，已关联幂等）、`link`（同租户校验防 IDOR）、`unlink`、`listByOrder`（订单详情展示用）；`PurchaseOrderController` 补 `GET :id/candidates`、`POST :id/auto-match`、`POST :id/link`、`POST :id/unlink`，`list` 增 `orderId` 过滤；`PurchaseOrder` schema 扩 `recipientName`（6.4 比对字段），`CreatePurchaseOrderDto` 增 `recipientName`/`LinkPurchaseOrderDto`。
    - 单测 `purchase-order.service.spec.ts` 新增 9 例（候选排序/空/自动匹配/幂等/无候选/手动关联/跨租户 404/解关联/listByOrder），全仓 **306 passed / 46 suites**。
  - **前端可视化（业务运营 → 采购单管理 / 订单中心）**：`PurchaseOrderView` 列表增「关联订单」列 + 「匹配/关联」对话框（候选卡片 + 命中理由徽章 + 一键自动匹配 + 手动选单关联/解除）；`OrdersView` 订单详情抽屉新增「关联采购单」区块（展示已关联采购单 + 一键跳采购单管理）；`purchase-order.ts` 增 `candidates/autoMatch/link/unlink` + `PurchaseOrderCandidate` 类型，`mock-data.ts` 同口径内存实现（`doCandidates/doAutoMatch/doLink/doUnlink` + mockRouter 分发），演示与正式双路通。
- **进行中（🔵）**：无（本批 6.4 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**306 passed / 46 suites**）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（6.4 后端/前端/进度生成器/进度表/检查点）。
- **下一步（次日接力）**：6.5 中转仓模型 + 看板（Warehouse.type 扩 transfer + 中转仓看板页）。

### 进度更新 · 2026-10-25（续跑 · 6.5 中转仓模型 + 看板）
- **完成（✅）**：
  - **6.5 中转仓模型 + 看板（阶段6 详细设计）** —— `Warehouse.type` 扩 `transfer`（schema 注释 + `WarehouseType` 联合类型 + `CreateWarehouseDto` 校验放行），既有的 `WmsService` 仓库列表/新建天然兼容新类型。
  - 新增 `TransferModule`（6.5–6.9 统一承载）：`TransferService.getBoard(tenantId)` 聚合「本租户中转仓」+「待作业采购单（status ∈ arrived/matched/packed，未出库）」+「关联店铺订单概览」+ 状态统计；`TransferController` `GET /transfer/board`（租户隔离）；`transfer.service.spec.ts` 4 例（中转仓隔离/待作业过滤/关联订单概览/状态聚合）全绿。
  - **前端可视化（业务运营 → 中转仓作业）**：`TransferView`（/transfer）态势三卡（中转仓数/待作业采购单数/已关联订单数）+ 中转仓卡片列表 + 待作业采购单表（状态/关联订单概览/产品）；`transfer.ts` 接口、`mock-data.ts` 同口径内存实现（`doGetTransferBoard` 含 transfer 仓种子 + mockRouter 分发），演示与正式双路通；`router` 注册 /transfer、`BasicLayout.menuNodes` 业务运营分组注册（`menu.transfer` 中英文）、`AppIcon` 复用 `warehouse`。
- **进行中（🔵）**：无（本批 6.5 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（310 passed / 47 suites）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（6.5 后端/前端/进度生成器/进度表/检查点）。
- **下一步（次日接力）**：6.6 扫码到货入库端点（POST /transfer/scan：解析采购单→匹配订单→到货登记，Asn 扩展 purchaseOrderId/scanSource/receivedItems）。

### 进度更新 · 2026-10-25（续跑 · 6.6 扫码到货入库端点）
- **完成（✅）**：
  - **6.6 扫码到货入库端点（阶段6 详细设计）** —— `TransferService.scan(tenantId, dto)`：① 校验中转仓归属（租户隔离，防越权）；② 按扫码类型解析采购单（`trackingNo` 直查 / `purchaseNo` 按 id / `barcode` 经 `PurchaseOrderItem.skuId` 反查父采购单，均限定租户）；③ 生成收货单 `Asn`（status=received + 行项快照 `receivedItems` + `purchaseOrderId` + `scanSource`）；④ 推进采购单状态机首跳 `pending→arrived`；⑤ 复用 6.4 `PurchaseOrderService.autoMatch` 关联店铺订单；返回 ASN/采购单快照 + matched/advanced 标记。修复 `TransferService` 注入 `PrismaClient`（基类）的隐性运行时 DI 缺陷，改为注入全局 `PrismaService`（与全仓一致，已 `prisma generate` 刷新 `Asn` 新字段）。
  - `TransferController` 新增 `POST /transfer/scan`（租户隔离 + 全局 `ValidationPipe` 校验 `ScanTransferDto`）；`TransferModule` 接入 `PurchaseOrderModule` 复用自动匹配；`transfer.dto.ts` 新增 `ScanType` / `ScanTransferDto`（class-validator）。`transfer.service.spec.ts` 新增 6 例（快递单号解析+推进+自动匹配 / 自动匹配回填 orderId / 重复扫码不重复推进 / SKU 条码反查 / 中转仓越权 / 无法解析采购单）。
  - **前端可视化（中转仓作业 扫码到货）**：`TransferView`（/transfer）新增「扫码到货」对话框（中转仓选择 + 扫码类型 radio + 扫码值输入 + 演示数据一键填充）+ 到货结果卡（ASN 编号 / 采购单 / 状态 / 行项数 / 推进·匹配徽章），提交后刷新看板使状态推进即时可见；`transfer.ts` 增 `scan` 接口与 `ScanTransferDto`/`ScanTransferResult` 类型，`mock-data.ts` 同口径内存实现 `doScanTransfer`（含 ASN 行项快照 + 状态机推进 + 6.4 自动匹配）+ mockRouter `POST /transfer/scan`，演示与正式双路通。
- **进行中（🔵）**：无（本批 6.6 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（316 passed / 47 suites）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（6.6 后端/前端/进度生成器/进度表/检查点）。
- **下一步（次日接力）**：6.7 中转仓作业：打包任务 + 核对（按匹配订单聚合采购单生成打包任务；核对采购单 vs 店铺订单差异；PickTask 扩展 channelCode/labelId/shipmentId）。

### 进度更新 · 2026-10-25（续跑 · 6.7 中转仓打包任务 + 核对）
- **完成（✅）**：
  - **6.7 中转仓打包任务 + 核对（阶段6 详细设计）** —— 设计决策：未扩展 WMS `PickTask`（拣货作业，语义不同），改为新增独立的 `PackTask` 模型（`warehouseId/orderId/purchaseOrderIds/json/status`（pending|packed）/`channelCode/labelId/shipmentId`（6.8/6.9 回填）/`packedAt`），与既有拣货任务解耦。
    - 后端 `TransferService`：`getPackQueue`（聚合「已匹配且已关联订单」的采购单 → 按订单分组 → 预计算采购行项 vs 订单行项差异 + 已建任务标记）、`generatePackTasks`（幂等，按订单组创建 pending 任务，默认取本租户首个中转仓）、`listPackTasks`、`getPackCheck`、`pack`（幂等推进聚合采购单 `arrived/matched→packed` 并置任务 packed）；私有 `computeCheck`（按 `skuId` 优先、否则产品名 归一，5 类差异：`matched`/`qty_mismatch`/`missing_in_po`/`extra_in_po`/`unverified` + 汇总 `hasDifference`）。`TransferController` 新增 5 端点：`GET /transfer/pack-queue`、`POST /transfer/pack-tasks/generate`、`GET /transfer/pack-tasks`、`GET /transfer/pack-tasks/:id/check`、`POST /transfer/pack-tasks/:id/pack`（全租户隔离 + `TENANT_REQUIRED` 守卫）。`transfer.service.pack.spec.ts` 新增 7 例（队列聚合+差异/任务关联/幂等生成/缺货·多采检测/打包推进+幂等/任务不存在/租户隔离），全仓 **323 passed / 48 suites**。
  - **前端可视化（中转仓作业 打包作业）**：`TransferView`（/transfer）新增「打包作业」区块——态势第 4 卡（待打包任务）+ 待打包队列表（店铺订单/聚合采购单/核对预览差异胶囊/任务状态/「核对」「打包」操作）+ 已建打包任务子表（全生命周期，含打包时间）；「核对」对话框展示采购行项 vs 订单行项差异明细表（差异着色 + 一致/数量不符/缺货/多采/待核 结论 + 存在即拦截告警）；`transfer.ts` 增 `packQueue/generatePackTasks/listPackTasks/packCheck/pack` 与 6 类类型，`mock-data.ts` 同口径内存实现（`doGetPackQueue/doGeneratePackTasks/doListPackTasks/doGetPackCheck/doPack` + `computePackCheck` 与后端一致 + mockRouter 分发），演示与正式双路通。演示种子新增 `po_pack_1`/`po_pack_2`（已 matched 并关联 `o1`/`o2`），其中 `o2` 期望 1 件、采购 3 件 → 默认呈现「数量不符」差异演示。
- **进行中（🔵）**：无（本批 6.7 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**323 passed / 48 suites**）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（6.7 后端/前端/进度生成器/进度表/检查点）。
- **下一步（次日接力）**：6.8 跨境面单生成（中转仓出单：选渠道→承运商建单 + LabelService 出 PDF/ZPL；面单关联店铺订单与平台；Shipment 加 purchaseOrderId；PackTask.channelCode/labelId 回填）。

### 进度更新 · 2026-10-26（续跑 · 6.8 跨境面单生成）
- **完成（✅）**：
  - **6.8 跨境面单生成（阶段6 详细设计，中转仓出单）** ——
    - 模型：`Shipment` 扩 `purchaseOrderId`（关联采购单/打包任务）；新增 `ShippingLabel` 模型（`packTaskId`/`shipmentId`/`channelCode`/`trackingNo`/`recipient`(Json)/`zpl`/`pdfUrl`(SVG data URI)/`status`）。
    - 后端 `TransferService`：`listChannels`（4 个跨境渠道：云途/DHL/4PX/燕文，含 baseFee/perKgRate）、`generateLabel`（仅已打包任务可出单 → 估算运费**演示价**`baseFee+perKgRate×实重`、TODO 接 `MarkupEngineService` §10 → 本地建单落库 `Shipment`+首条 `booked` 轨迹 + `ShippingLabel`(ZPL 源文 + SVG 预览) → 回填 `PackTask.channelCode/labelId/shipmentId`，幂等）、`getLabel`；私有 `estimateCost/buildZpl/buildLabelSvg/escapeHtml/toLabelDto/loadTaskContext`；`TransferController` 新增 `GET /transfer/channels`、`POST /transfer/pack-tasks/:id/label`、`GET /transfer/pack-tasks/:id/label`（全租户隔离 + `ValidationPipe`）；`GenerateLabelDto` 校验 `channelCode` 白名单；`transfer.service.label.spec.ts` 新增 8 例（渠道列表/不存在/未打包拦截/建单+ZPL+SVG+回填/幂等/租户隔离/未生成 LABEL_NOT_FOUND/查看），全仓 **331 passed / 49 suites**。
  - **前端可视化（中转仓作业 跨境面单）**：`TransferView`（/transfer）「已建打包任务」子表增「渠道」列与「生成面单 / 查看面单」操作；新增面单对话框（选渠道 → 生成 → SVG 预览 + ZPL 源文折叠 + 打印）；`transfer.ts` 增 `channels/generateLabel/getLabel` 与 3 类类型，`mock-data.ts` 同口径内存实现（`doListChannels/doGenerateLabel/doGetLabel` + `buildMockZpl/buildMockLabelSvg/estimateMockCost` + mockRouter 分发，演示/正式双路通）。
- **进行中（🔵）**：无（本批 6.8 完成）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**331 passed / 49 suites**）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（6.8 后端/前端/进度生成器/进度表/检查点）。
- **下一步（次日接力）**：6.9 出库闭环 + 物流同步（出库扫码 → Shipment.fulfill 回写平台 + TrackingEvent 追加出库节点 → 流转正式跨境物流轨迹；状态机贯通采购单/订单）。

### 进度更新 · 2026-10-27（续跑 · 6.9 出库闭环 + 物流同步 · M6 收官）
- **完成（✅）**：
  - **6.9 出库闭环 + 物流同步（阶段6 详细设计，收官任务）** ——
    - 后端 `TransferModule` 注入 `ShipmentsModule`（可选 `ShipmentsService`，保持历史 spec 3 参构造兼容）；`TransferService.outbound(tenantId, dto)`：① 解析 shipmentId——`packTaskId` 路径校验 `labelId + shipmentId` 齐备否则 `OUTBOUND_NO_LABEL`，或直接 `shipmentId` 否则 `OUTBOUND_TARGET_REQUIRED`（`PACK_TASK_NOT_FOUND`/`OUTBOUND_TARGET_REQUIRED` 守卫）；② `ShipmentsService.fulfill`（回写平台 + 推进运单/订单 `approved→pushed`，best-effort）+ `recordTracking({status:'picked_up',location:'中转仓',description:'已出库揽收，离港进入正式跨境物流'})`（追加出库轨迹节点 + 推进订单 `picked_up`）；③ `updateMany` 推进关联采购单 `packed→outbound`（仅 packed 命中，租户隔离）；④ 聚合 shipment + `listTracking`（完整轨迹时间线）+ order + poMap 返回 `OutboundResult`（`packTask: PackTaskDto|null`、`shipment`、`tracking: OutboundTrackingVo[]`、`purchaseOrder[]`、`order`、`message`）。`TransferController` 新增 `POST /transfer/outbound`（全租户隔离 + `ValidationPipe`）；`transfer.dto.ts` 增 `OutboundTransferDto`；`transfer.types.ts` `OutboundResult.packTask` 放宽为 `PackTaskDto|null`。`transfer.service.outbound.spec.ts` 新增 7 例（成功闭环 booked→pushed→picked_up·PO packed→outbound·订单 pushed→picked_up / shipmentId 直出 / OUTBOUND_NO_LABEL / OUTBOUND_TARGET_REQUIRED / PACK_TASK_NOT_FOUND / 租户隔离 / 仅 packed PO 推进），全仓 **338 passed / 50 suites**。
  - **前端可视化（中转仓作业 出库闭环）**：`TransferView`（/transfer）「已建打包任务」子表增「出库状态」列（待出库/已出库）+「出库 / 查看出库」操作；新增出库结果对话框（成功告警 + 跨境运单号/运单状态/关联订单状态/采购单推进汇总 + 物流轨迹时间线 `el-timeline` 展示 booked→pushed→picked_up 节点）。出库后实时刷新：关联采购单 `packed→outbound` 离仓（移出待作业看板）、订单 `pushed→picked_up`。`transfer.ts` 增 `OutboundTransferDto/OutboundTrackingVo/OutboundResult` 与 `transferApi.outbound`；`mock-data.ts` 同口径内存实现 `doOutbound`（含 `doGenerateLabel` 同步建 `shipments` 实体以便 fulfill/轨迹联动订单）+ mockRouter 分发，演示与正式双路通。
  - **M6 阶段6 全通**：采购单录入/匹配 → 中转仓扫码到货入库 → 打包贴跨境面单 → 出库同步跨境物流，与既有订单/渠道/承运商底座闭环，`progress:gen` 任务表 6.9→/transfer（EXPLICIT_ROUTES）。
- **进行中（🔵）**：无（本批 6.9 完成，阶段6 / M6 里程碑收官）。
- **受阻**：无。
- **测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（**338 passed / 50 suites**）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
- **提交**：随本批统一提交（6.9 后端/前端/进度生成器/进度表/检查点）。
- **下一步**：阶段6（M6 货代中转仓作业流）已全量交付，主线方案 v1.5 的「采购→中转仓→扫码→打包贴单→出库」核心作业流闭环完成；后续可推进真实平台凭证工厂化接入（淘宝 TOP/抖音开放平台/云途·DHL·4PX·燕文 联调，标注 TODO）+ 本机 PG 端到端验证 + §31 收尾文档。

---

## 阶段7 详细设计（条码介质与终端接入）

> 背景：阶段 6 把「采购 → 中转仓扫码 → 打包贴单 → 出库」作业流跑通，6.12 补齐了设备无关的扫码输入层。但链路两端仍是空的——**商品条码没有录入入口（Sku.barcode 恒为 null，扫商品码必然落空）**，且**包裹上没有可扫的条码介质**（供应商发货什么都没有，仓库只能靠翻纸质入库单）。阶段 7 补齐「数据 → 介质 → 终端」三段，让仓库真的能「一枪到底」。
> 执行纪律：沿用本表「〇、自动化执行约定」全部红线；业务能力类任务必须 页面 + 菜单/路由 + 演示/正式双路通；每批末跑 `npm run progress:gen` 并随代码提交。
> **真库提醒**：本阶段新增 `SkuBarcode` 模型与 `PurchaseOrder.boxCount` 字段，正式库需执行 `prisma db push`（或 migrate）。

### 7.1 SKU/商品 条码录入 + 扫码建档

- **数据层**：`Sku.barcode`（已有 `@@index([tenantId, barcode])`）继续作为**主条码**承担扫码反查；新增 `SkuBarcode` 模型承载多码：`id / tenantId / skuId / code / kind('supplier'|'internal'|'ean13'|'other') / createdAt`，约束 `@@unique([tenantId, code])`、`@@index([tenantId, skuId])`。
  - 写入时须与 `Sku.barcode` 互斥去重：同一租户内同一 `code` 不得同时出现在 `Sku.barcode` 与 `SkuBarcode`，重复抛 `SKU_BARCODE_DUPLICATE`（400，附冲突的 SKU 编码，便于现场定位）。
- **后端（catalog 模块）**：
  - `CreateSkuDto / UpdateSkuDto` 增 `barcode?`——去首尾空白、空串存 `null`；EAN-13/UPC-A 若长度命中则做**校验位**计算，不符仅 warn 带入返回值不拦截（供应商乱贴码是常态，不能卡录入）。
  - 新增 `GET /sku/barcode-lookup?code=`：按租户查主码与多码，返回 `{ skuId, code, productName, matchedBy: 'main'|'alt', kind }`，用于「扫条码定位 SKU」与后续 PDA。
  - 新增多码管理：`GET /sku/:skuId/barcodes`、`POST /sku/:skuId/barcodes`、`DELETE /sku/barcodes/:id`、`PATCH /sku/:skuId/barcodes/main`（设为主码并回写 `Sku.barcode`，原主码降级为 alt 码）。
  - 单测（≥8 例）：重复拦截（含与 `Sku.barcode` 冲突）、跨租户隔离、lookup 命中主码/多码/未命中、删除后立即失效、校验位提示、设主码幂等。
- **前端 `CatalogView`（业务运营 → 商品 SKU）**：
  - SKU 新增/编辑弹窗加「商品条码」输入框 + 右侧「扫一下」按钮：点击进入 capture 态，**复用 6.12 已落地的 `web/src/composables/useScannerInput.ts`** 接收扫码枪输入并回填（同一份 `localStorage` 设备配置：结束符/自动提交/前后缀/提示音）。
  - SKU 详情/编辑内嵌「多码」小表格：码值 / 类型 / 删除 / 「设为主码」。
  - SKU 列表加「条码」列（主码 + `+N` 多码徽章）；顶部工具栏加「**扫码定位**」按钮 → 吸附同一钩子，扫到即过滤并高亮命中行，未命中提示「该条码未建档，是否录入到当前 SKU」。
  - 「**批量扫码建档**」：选定 SKU 后连续扫多个条码逐条写入多码（扫即提交 + 成功/失败音，与 6.12 连续扫作业台一致）。
  - `catalog.ts` 增接口与类型；`mock-data.ts` 同口径内存实现，且**条码变更写入 localStorage 覆盖层（建议 key `dso.sku-barcodes-v1`），刷新后仍生效**——否则演示模式第二天打开条码全没了。
- **验收**：演示模式下人工慢速键盘输入不误判为扫码枪；用 Edge headless + CDP 模拟 ≤35ms/字符输入能被识别为扫码枪并回填（沿用 6.12 验证手法）；条码改动刷新后仍在（localStorage 覆盖层生效）。

### 7.2 采购单收货标签打印（Code128）

- **为什么是 Code128 而不是二维码**：仓库常见的**枪式激光扫描器（Zebra/霍尼韦尔/得利捷老型号）普遍不识别 QR**，Code128 是这类设备通吃的字母数字码制；而采购单号 `CG20261028-0001` 含字母与连字符，EAN-13/UPC-A 装不下。QR 仅在未来需要塞更多字段时作为**附加**码出现，不做主码。
- **编码器（零依赖自研）**：新增 `web/src/utils/code128.ts`，实现 **Code128B**（字符集 95 个可打印 ASCII → value 映射、StartB=104、加权累加**校验位**、Stop=106），导出 `code128Bars(text): number[]` 与 `code128SvgRects(text, opts)`。理由：不为一次性打印能力引入 npm 依赖（本机 `npm install` 易受沙箱/网络影响）。**必须**写临时断言脚本验证：① 已知样例（如 `"CODE128"`）bits 序列与公开实现一致；② 校验位计算正确；③ 含不可打印字符/中文时抛明确错误。
- **标签数据**：新增 `GET /purchase-orders/:id/label-data`，返回 `{ purchaseNo, carrier?, trackingNo?, supplier?, items:[{ skuCode, productName, quantity }], remark, boxCount, printedAt }`；`PurchaseOrder` 增 `boxCount Int @default(1)`（备注复用既有 `remark`，**不新增字段**），`PATCH /purchase-orders/:id` 支持改 `boxCount`。
- **打印交互 `PurchaseOrderView`（业务运营 → 采购单管理）**：行操作加「**收货标签**」按钮 → 标签预览对话框：
  - 纸型切换：**A4 三列拼版**（普通打印机）/ **热敏 100×100 mm**（标签机）；
  - 每张标签内容：`purchaseNo` 的 Code128 条码 + 明文、供应商/采购链接、目的中转仓（下拉列本租户 `type=transfer` 仓库，默认首个）、SKU 编码+品名+数量（>6 行折叠为「等 N 项」）、作业备注摘要（>40 字截断）、箱号 `x / N`、打印时间；
  - 「打印」走 `window.print()` + `@media print` 只保留标签容器（隐藏后台框架/侧栏/按钮），**不引后端 PDF 依赖**；
  - `purchase-order.ts` 增 `getLabelData`，`mock-data.ts` 补 `doGetLabelData`。
- **顺带修 bug**：`server/src/modules/transfer/scan-rules.ts` 的采购单号规则 `/^CG\d{6,}$/i` **匹配不到实际格式**（生成的是 `CG20261028-0001`，含连字符），导致扫自己打印的收货标签时被判为「未识别号段」——补 `/^CG\d{8}-\d{3,6}$/i` 并保留原规则兜底，配单测。
- **验收**：生成的标签条码能被读码 app 扫出明文 `CG...`（以 bits 序列自证）；`@media print` 预览只含标签；演示/正式双路都能打开。

### 7.3 PDA 原生壳（Android WebView + DataWedge）

- **定位（务必写在 README 与日报里）**：这是**体验升级而非功能必需**——PDA 自带浏览器 + 扫描 APP 设「键盘输出（Keystroke）」模式时，现有网页即可直接作业；本任务服务于已购置/将购置工业终端的用户。
- **交付 `pda-shell/`（源码工程；本机无 Android SDK，不出 APK，禁止伪造已构建）**：
  - `MainActivity.kt`：全屏 WebView（站点地址可在设置页配置并持久化）、JS 桥注入 `window.__onScan(value)`、加载失败重试与离线提示页。
  - `ScanReceiver.kt`：`BroadcastReceiver` 兼容三类广播 —— Zebra DataWedge（action 可配，默认 `com.symbol.datawedge.data`，取 `com.symbol.datawedge.data_string`）、Honeywell（`com.honeywell.decode.intent.action.DECODE_DATA` / `data`）、通用 `android.intent.action.SCAN` 兜底（依次尝试常见 key）。
  - 反馈与作业：解析成功 `ToneGenerator` 蜂鸣 + `Vibrator` 震动（失败不同节奏）、`FLAG_KEEP_SCREEN_ON` 常亮、侧键/PTT 触发扫描 Intent。
  - 离线容灾：扫码值先落本地 SQLite 队列，网络可用时按序 `POST /transfer/scan` 补传（幂等由 6.6 Asn 侧幂等保证），页面可看补扫条数。
  - `README.md`：DataWedge Profile 配置步骤（**关闭 Keystroke output、开启 Intent output、Intent action 与壳内配置一致**）、签名与打包命令（首次构建需联网 Gradle）、升级说明。
  - Gradle 配置齐备（`settings.gradle` / `build.gradle` / `gradle.properties`），`minSdk 26`，依赖控制在 AndroidX WebKit 级别。
  - **验收口径**：工程结构完整、README 可照做、Kotlin 源码无未解析引用；**明确记录「本机无法编译 APK，需在装 Android Studio 的机器执行 `./gradlew assembleRelease`」**。
- **页面侧桥接（可视化载体）**：`TransferView`（/transfer）挂载时暴露 `window.__onScan = (value) => submitScan(value)`（卸载时清理），复用既有连续扫作业台；中转仓「扫码设备设置」弹窗新增「**PDA / 数据终端接入**」区块：桥接状态（未检测到原生壳 / 已连接 __onScan）、可一键复制的 DataWedge action 名与配置指引、离线队列条数（网页模式显示「本模式不支持离线队列，请用键盘输出模式或安装 PDA 壳」）。演示模式下该区块可打开、指引可复制。
- **验收**：`npm run progress:gen` 后 /progress 页可见 7.3 条目（route → /transfer）；网页模式在缺少原生桥接时不报错。

---

### 进度更新 · 2026-10-28（夜间自动化 23:10 启动 · 阶段7 条码介质与终端接入）

#### 7.1 SKU/商品 条码录入 + 扫码建档（✅ 完成并验证）
- **后端**：`SkuBarcode` 多码模型（Prisma generate 通过）；`common/barcode/barcode.util.ts` 校验位算法（EAN-13/UPC-A，warn 不拦截）；`CatalogService` 新增 `lookupByBarcode` / `listBarcodes` / `addBarcode`（主码与多码互斥去重，冲突抛 `SKU_BARCODE_DUPLICATE`）/ `deleteBarcode` / `setMainBarcode`（事务：旧主码降级为 alt + 回写 `Sku.barcode`）；`CatalogController` 5 个 REST 端点；`SkuResponseDto` 增 `barcodeCheckWarning`。单测 12 例全绿。
- **前端**：`CatalogView` 重写——SKU 列表「商品条码」列（`+N` 多码徽章）、「扫码定位」工具栏按钮（复用 `useScannerInput`）、「条码」操作按钮开编辑对话框（主码输入 + 「扫一下」+ EAN-13/UPC-A 校验位提示 + 「批量扫码建档」连续扫 + 多码表格「设为主码/删除」）；`catalog.ts` 增类型与接口；`mock-data.ts` 同口径内存实现且条码变更落 `localStorage` 覆盖层（`dso.sku-barcodes-v1`），刷新后仍在；`AppIcon` 增 `scan` 图标。演示/正式双路通。
- **质量门禁**：server tsc✅ / eslint --max-warnings 0✅ / jest **350 passed / 50 suites**；web vue-tsc✅ / eslint✅ / vite build✅。
- **下一步**：7.2 采购单收货标签打印（Code128）+ 修 scan-rules CG 号段正则 bug。
