<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { IS_MOCK } from '@/api/http'
import { login } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = reactive({ tenantId: 't_demo', email: 'admin@demo.com', password: 'demo123456' })
const loading = ref(false)

const isMock = computed(() => IS_MOCK)

/** 演示模式：无需登录，直接进入系统（store 已是 demo 用户）。 */
function enterDemo(): void {
  router.replace((route.query.redirect as string) || '/')
}

async function onSubmit(): Promise<void> {
  loading.value = true
  try {
    const { token } = await login(form.email, form.password, form.tenantId)
    userStore.login({
      token,
      user: { email: form.email, tenantId: form.tenantId, roles: ['super'] },
    })
    ElMessage.success('登录成功')
    router.replace((route.query.redirect as string) || '/')
  } catch (e) {
    ElMessage.error((e as Error).message || '登录失败，请检查账号或密码')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-bg" />
    <el-card class="login-card" shadow="always">
      <div class="brand">
        <div class="brand-logo"><AppIcon name="box" :size="26" /></div>
        <div>
          <div class="brand-name">一件代发 · 货代运营 SaaS</div>
          <div class="brand-sub">Dropshipping &amp; Freight Forwarding</div>
        </div>
      </div>

      <el-alert
        v-if="isMock"
        class="demo-tip"
        type="info"
        :closable="false"
        show-icon
        title="当前为演示模式"
        description="演示模式无需真实账号，点击下方「直接进入演示」即可浏览全部功能；接入真实后端时请使用 VITE_USE_MOCK=false 部署。"
      />

      <el-form :model="form" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="租户 ID">
          <el-input v-model="form.tenantId" placeholder="如 t_demo" :disabled="loading">
            <template #prefix><AppIcon name="building" :size="15" /></template>
          </el-input>
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" type="email" placeholder="登录邮箱" :disabled="loading">
            <template #prefix><AppIcon name="user" :size="15" /></template>
          </el-input>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="登录密码" :disabled="loading" @keyup.enter="onSubmit">
            <template #prefix><AppIcon name="key" :size="15" /></template>
          </el-input>
        </el-form-item>

        <el-button
          v-if="!isMock"
          type="primary"
          class="submit-btn"
          size="large"
          :loading="loading"
          @click="onSubmit"
        >
          登录
        </el-button>
        <el-button v-else type="primary" class="submit-btn" size="large" @click="enterDemo">
          直接进入演示
        </el-button>
      </el-form>

      <div class="foot">© 2026 一件代发 · 货代运营平台 · 安全加固 9.8</div>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1200px 600px at 15% 0%, rgba(79, 110, 247, 0.12), transparent 60%),
    radial-gradient(900px 500px at 100% 100%, rgba(18, 181, 165, 0.1), transparent 55%),
    var(--bg);
}
.login-card {
  position: relative;
  width: 400px;
  max-width: calc(100vw - 32px);
  border-radius: var(--r-xl);
  border: none;
  box-shadow: var(--sh-3);
  padding: 8px 4px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.brand-logo {
  width: 46px;
  height: 46px;
  border-radius: var(--r-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  box-shadow: var(--sh-brand);
}
.brand-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink-900);
}
.brand-sub {
  font-size: 12px;
  color: var(--ink-500);
  letter-spacing: 0.3px;
}
.demo-tip {
  margin: 14px 0 6px;
  border-radius: var(--r-sm);
}
.submit-btn {
  width: 100%;
  margin-top: 6px;
  border-radius: var(--r-sm);
  font-weight: 600;
}
.foot {
  margin-top: 16px;
  text-align: center;
  font-size: 11px;
  color: var(--ink-400);
}
</style>
