<template>
  <!-- 仅平台运营方可见：卖家租户不应看到「本次更新 / 开发进度」类内部提醒。 -->
  <div v-if="isSuper" class="whatsnew">
    <el-badge :value="unseen" :hidden="unseen === 0" :offset="[-6, 4]">
      <button class="icon-btn" title="本次更新（最近交付的能力）" @click="open">
        <AppIcon name="bell" :size="18" />
      </button>
    </el-badge>

    <el-drawer v-model="visible" title="本次更新 · 最近交付能力" size="400px">
      <p class="wn-tip">
        每晚自动开发完成后会重新生成本清单；明天刷新页面，这里就会列出新完成的能力。
      </p>

      <div class="wn-list">
        <div v-for="t in recentTasks" :key="t.id" class="wn-item">
          <div class="wn-head">
            <span class="wn-id">{{ t.id }}</span>
            <span class="wn-name">{{ t.name }}</span>
            <span class="wn-new">NEW</span>
          </div>
          <div class="wn-deliv">{{ t.deliverable }}</div>
          <router-link v-if="t.route" class="wn-go" :to="t.route" @click="visible = false">
            去查看 →
          </router-link>
          <span v-else class="wn-none">纯后端能力（接口已就绪，界面待排期）</span>
        </div>
      </div>

      <el-button class="wn-all" type="primary" plain @click="goAll">查看完整开发进度</el-button>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  DEV_TASKS,
  DEV_RECENT_IDS,
  DEV_PROGRESS_COMMIT,
  DEV_PROGRESS_GENERATED_AT,
} from '@/api/dev-progress'
import AppIcon from '@/components/AppIcon.vue'

// 「本次更新」提醒：以生成器产出的提交号（无 git 时用生成时间）作为版本标记，
// 与 localStorage 中已读标记比对，从而在每天新产出后于顶栏显示红点，
// 解决「不知道昨晚自动开发了什么、没法提出调整」的问题。
// 仅平台运营方（super）可见——卖家租户不应看到开发进度类内部信息。
const userStore = useUserStore()
const isSuper = computed(() => userStore.role === 'super')

const KEY = 'dev-whatsnew-seen'
const marker = DEV_PROGRESS_COMMIT || DEV_PROGRESS_GENERATED_AT
const recentTasks = DEV_TASKS.filter((t) => DEV_RECENT_IDS.includes(t.id))

const router = useRouter()
const visible = ref(false)
const seen = ref('')

onMounted(() => {
  try {
    seen.value = localStorage.getItem(KEY) ?? ''
  } catch {
    seen.value = ''
  }
})

const unseen = computed(() => (seen.value === marker ? 0 : recentTasks.length))

/** 打开抽屉即视为已读（红点消除），但列表始终可回看。 */
function open(): void {
  visible.value = true
  try {
    localStorage.setItem(KEY, marker)
  } catch {
    /* 隐私模式下忽略 */
  }
  seen.value = marker
}

function goAll(): void {
  visible.value = false
  router.push('/progress')
}
</script>

<style scoped>
.icon-btn {
  position: relative;
  width: 38px;
  height: 38px;
  border: none;
  background: var(--line-soft);
  color: var(--ink-600);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s var(--ease);
}
.icon-btn:hover {
  background: var(--brand-soft);
  color: var(--brand-600);
}

.wn-tip {
  margin: 0 0 14px;
  font-size: 12.5px;
  color: var(--ink-500);
  line-height: 1.7;
}
.wn-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wn-item {
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: #fbfcff;
  border: 1px solid var(--line);
}
.wn-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wn-id {
  font-weight: 700;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--violet-500));
  padding: 2px 7px;
  border-radius: 6px;
}
.wn-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-800);
}
.wn-new {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ff7a45, #f5222d);
  padding: 1px 5px;
  border-radius: 5px;
}
.wn-deliv {
  margin-top: 6px;
  font-size: 12px;
  color: var(--ink-500);
  line-height: 1.6;
}
.wn-go {
  display: inline-block;
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--brand-600);
  text-decoration: none;
}
.wn-go:hover {
  text-decoration: underline;
}
.wn-none {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--ink-400);
}
.wn-all {
  width: 100%;
  margin-top: 18px;
}
</style>
