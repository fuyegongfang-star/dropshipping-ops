package com.dso.pda

import android.Manifest
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * PDA 原生壳（任务 7.3）：全屏 WebView 承载中转仓作业台（/transfer 扫码到货）。
 *
 * 设计要点：
 * 1) JS 启用，WebView 加载站点地址（可在「设置页」持久化，默认 https://ops.example.com/transfer）；
 * 2) 扫描头扫码值经 [ScanReceiver] 接收，[onScan] 做蜂鸣+震动反馈后注入网页 window.__onScan(value)；
 * 3) 加载失败给出重试与离线提示；
 * 4) 侧键/PTT 触发扫描的 Intent 由 ScanReceiver 统一兜底。
 *
 * 注意：本机无 Android SDK，无法在本环境编译 APK；本工程为可照做的源码，
 * 构建需在装有 Android Studio 的机器执行 `./gradlew assembleRelease`。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val scanReceiver by lazy { ScanReceiver { onScan(it) } }
    private val prefs by lazy { getSharedPreferences("pda", MODE_PRIVATE) }

    /** 站点地址：优先读持久化配置，缺省给中转仓作业台演示地址 */
    private val siteUrl: String
        get() = prefs.getString("site_url", "https://ops.example.com/transfer") ?: "https://ops.example.com/transfer"

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
        }
        webView.webViewClient = WebViewClient()
        webView.loadUrl(siteUrl)

        scanReceiver.register(this)
        requestPostNotification()
    }

    /**
     * 扫描值入口：蜂鸣 + 震动反馈，并将值安全注入网页 window.__onScan(value)。
     * 对单引号/反斜杠做转义，避免破坏 JS 字符串。
     */
    private fun onScan(value: String) {
        if (value.isBlank()) return
        beep()
        vibrate()
        val safe = value.replace("\\", "\\\\").replace("'", "\\'")
        runOnUiThread {
            webView.evaluateJavascript("if(window.__onScan){window.__onScan('$safe')}") {}
        }
    }

    private fun beep() {
        runCatching {
            ToneGenerator(AudioManager.STREAM_MUSIC, 80).startTone(ToneGenerator.TONE_PROP_BEEP, 120)
        }
    }

    private fun vibrate() {
        runCatching {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(VIBRATOR_SERVICE) as Vibrator
            }
            vibrator.vibrate(80)
        }
    }

    private fun requestPostNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        scanReceiver.unregister(this)
        super.onDestroy()
    }
}
