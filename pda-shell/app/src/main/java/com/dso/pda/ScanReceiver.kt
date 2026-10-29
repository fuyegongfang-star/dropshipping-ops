package com.dso.pda

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle

/**
 * 扫描广播接收器（任务 7.3）：兼容三类工业 PDA 扫描输出。
 *
 * - Zebra DataWedge：action 可配（默认 [DATAWEDGE_ACTION]），取 extra "com.symbol.datawedge.data_string"；
 * - Honeywell：action "com.honeywell.decode.intent.action.DECODE_DATA"，取 extra "data"；
 * - 通用：action "android.intent.action.SCAN"，依次尝试 "SCAN_RESULT" / "scanResult"。
 *
 * 解析到非空扫码值即回调 [onScan]，由 MainActivity 注入网页 window.__onScan。
 */
class ScanReceiver(private val onScan: (String) -> Unit) : BroadcastReceiver() {

    companion object {
        /** 与网页端「PDA / 数据终端接入」区块展示的 DataWedge 动作名保持一致 */
        const val DATAWEDGE_ACTION = "com.dso.pda.scan"
        private const val HONEYWELL_ACTION = "com.honeywell.decode.intent.action.DECODE_DATA"
        private const val GENERIC_ACTION = "android.intent.action.SCAN"
    }

    private val filter = IntentFilter().apply {
        addAction(DATAWEDGE_ACTION)
        addAction(HONEYWELL_ACTION)
        addAction(GENERIC_ACTION)
    }

    fun register(ctx: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(this, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            ctx.registerReceiver(this, filter)
        }
    }

    fun unregister(ctx: Context) {
        runCatching { ctx.unregisterReceiver(this) }
    }

    override fun onReceive(ctx: Context?, intent: Intent?) {
        val value = extract(intent) ?: return
        if (value.isNotBlank()) onScan(value)
    }

    private fun extract(intent: Intent?): String? {
        if (intent == null) return null
        return when (intent.action) {
            DATAWEDGE_ACTION -> intent.getStringExtra("com.symbol.datawedge.data_string")
            HONEYWELL_ACTION -> intent.getStringExtra("data")
            GENERIC_ACTION -> intent.getStringExtra("SCAN_RESULT") ?: intent.getStringExtra("scanResult")
            else -> {
                // 兜底：遍历 extras 取首个非空字符串
                val b: Bundle? = intent.extras
                b?.keySet()?.firstNotNullOfOrNull { k -> b.getString(k)?.takeIf { it.isNotBlank() } }
            }
        }
    }
}
