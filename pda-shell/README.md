# DSO 中转仓 PDA 原生壳（任务 7.3）

工业 PDA（Zebra / Honeywell / 霍尼韦尔 / 得利捷）全屏 WebView 壳，承载中转仓「扫码到货作业台」（`/transfer`）。
扫描头直出的扫码值经 `window.__onScan(value)` 注入网页，无需键盘输出模式，仓库「一枪到底」。

> ⚠️ **本工程为源码工程，本机无 Android SDK，未编译 APK。** 构建需在装有 Android Studio 的机器执行 `./gradlew assembleRelease`。

## 能力

- 全屏 WebView 加载中转仓作业台（站点地址可在设置页持久化，默认 `https://ops.example.com/transfer`）；
- 兼容三类扫描广播：`Zebra DataWedge` / `Honeywell` / 通用 `android.intent.action.SCAN` 兜底；
- 扫描成功 `ToneGenerator` 蜂鸣 + `Vibrator` 震动反馈；
- 加载失败重试 + 离线提示；
- `minSdk 26`，依赖控制在 AndroidX WebKit 级别（`core-ktx` / `appcompat` / `webkit` / `constraintlayout`）。

## DataWedge Profile 配置（以 Zebra 为例）

1. 打开 **DataWedge** → 新建 Profile（如 `DSO_Transfer`）；
2. 关联本应用包名 `com.dso.pda`；
3. **关闭 Keystroke output**（关键：否则扫码值会模拟键盘输入，与网页输入层冲突）；
4. **开启 Intent output**：
   - Intent action = `com.dso.pda.scan`（与 `ScanReceiver.DATAWEDGE_ACTION`、网页「PDA / 数据终端接入」区块展示的动作名一致）；
   - Intent delivery = `Broadcast intent`；
5. 扫描后由 `ScanReceiver` 解析 `com.symbol.datawedge.data_string` 并调用网页 `window.__onScan(value)`。

> Honeywell 设备：广播 action 为 `com.honeywell.decode.intent.action.DECODE_DATA`，取 extra `data`；其余品牌用通用 `android.intent.action.SCAN` 兜底。

## 网页侧桥接

`TransferView` 在挂载时暴露 `window.__onScan = (value) => handleScanValue(value)`（卸载时清理）。
中转仓「扫码设备设置」弹窗已含「PDA / 数据终端接入」区块：显示桥接状态（已连接 / 未检测到原生壳）、
一键复制 DataWedge 动作名、离线队列提示（网页模式显示「本模式不支持离线队列，请用键盘输出模式或安装 PDA 壳」）。

## 构建与签名

```bash
# 首次构建需联网拉取 Gradle 与依赖
./gradlew assembleRelease
# 产物：app/build/outputs/apk/release/app-release.apk
```

签名：在 `app/` 下放 `release-key.jks` 并在 `app/build.gradle` 的 `signingConfigs` 配置后重打包；
或直接使用 Android Studio 的 Generate Signed Bundle / APK 向导。

## 目录结构

```
pda-shell/
├── build.gradle                      # 根工程（Android Gradle Plugin + Kotlin）
├── settings.gradle
├── gradle.properties
└── app/
    ├── build.gradle
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/dso/pda/
        │   ├── MainActivity.kt        # 全屏 WebView + 蜂鸣/震动 + JS 桥
        │   └── ScanReceiver.kt        # 三类扫描广播兼容
        ├── res/layout/activity_main.xml
        └── res/values/strings.xml
```
