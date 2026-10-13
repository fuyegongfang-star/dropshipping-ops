import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { settingsApi, type SiteSettings } from '@/api/settings'

/**
 * 站点设置状态（系统设置 → 站点设置）。
 *
 * 作用：站点名称 / 副标题在「站点设置」页保存后，立即反映到后台侧栏 LOGO
 * 与浏览器标签页标题（见 BasicLayout.vue），让配置改动「看得见」，而非只写进库里。
 * 演示模式与正式模式共用同一条链路：正式模式由后端 GET /settings/site 提供数据。
 */
export const useSiteStore = defineStore('site', () => {
  const settings = ref<SiteSettings | null>(null)

  /** 站点名称：未加载完成时回落到默认品牌名，避免界面闪空。 */
  const siteName = computed(() => settings.value?.siteName?.trim() || '代发·货代')

  /** 站点副标题（Slogan）。 */
  const siteSlogan = computed(() => settings.value?.siteSlogan?.trim() || '运营中台')

  /** 站点 LOGO 地址（上传或外链），空表示使用默认内置图标。 */
  const logoUrl = computed(() => settings.value?.logoUrl?.trim() || '')

  /** 浏览器标签图标（favicon）地址，空表示使用默认。 */
  const faviconUrl = computed(() => settings.value?.faviconUrl?.trim() || '')

  /** 加载站点设置；失败时静默保持默认（设置页自身会提示错误）。 */
  async function load(): Promise<void> {
    try {
      settings.value = await settingsApi.site()
    } catch {
      settings.value = null
    }
  }

  /** 本地应用一份已保存的设置（保存成功后无需再次请求即可刷新界面）。 */
  function apply(next: SiteSettings): void {
    settings.value = next
  }

  return { settings, siteName, siteSlogan, logoUrl, faviconUrl, load, apply }
})
