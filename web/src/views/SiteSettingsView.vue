<template>
  <div class="site-settings">
    <PageHeader
      title="站点设置"
      subtitle="站点名称 / 品牌标识 / TDK 与 SEO / 统计代码 · 保存后立即生效于后台界面与前台页面"
      icon="flag"
      accent="teal"
    >
      <template #actions>
        <el-button type="primary" :loading="saving" @click="save">
          <AppIcon name="check" :size="15" class="btn-ico" />保存设置
        </el-button>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />重新载入
        </el-button>
        <el-button link type="info" @click="resetDemo">重置演示数据</el-button>
      </template>
    </PageHeader>

    <div v-if="!form" v-loading="loading" class="loading-box" />

    <template v-else>
      <!-- 保存状态条：提示上次保存时间与「站点名称已联动侧栏」 -->
      <div class="status-bar">
        <AppIcon name="sparkle" :size="14" />
        <span
          >当前生效站点名称 <b>{{ appliedName }}</b></span
        >
        <span class="sb-sep">·</span>
        <span class="muted">上次更新 {{ fmt(form.updatedAt) }}</span>
        <span v-if="dirty" class="tag-soft tag-amber sb-dirty">有未保存改动</span>
      </div>

      <el-tabs v-model="tab" class="ss-tabs">
        <!-- ============ 基础信息 ============ -->
        <el-tab-pane label="基础信息" name="base">
          <el-row :gutter="16">
            <el-col :span="16">
              <el-card>
                <template #header><span class="section-title">站点身份</span></template>
                <el-form label-position="top">
                  <el-row :gutter="12">
                    <el-col :span="12">
                      <el-form-item label="站点名称（必填）">
                        <el-input
                          v-model="form.siteName"
                          maxlength="30"
                          show-word-limit
                          placeholder="例如：代发·货代运营中台"
                        />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="站点副标题 / Slogan">
                        <el-input v-model="form.siteSlogan" maxlength="40" show-word-limit />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row :gutter="12">
                    <el-col :span="12">
                      <el-form-item label="站点域名">
                        <el-input v-model="form.domain" placeholder="https://example.com" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="备案号">
                        <el-input v-model="form.icpNo" placeholder="粤ICP备xxxxxxxx号" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row :gutter="16">
                    <el-col :span="12">
                      <el-form-item label="站点 LOGO">
                        <ImageUploadField v-model="form.logoUrl" kind="logo" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="Favicon（浏览器标签图标）">
                        <ImageUploadField v-model="form.faviconUrl" kind="favicon" />
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-form-item label="版权信息">
                    <el-input v-model="form.copyright" />
                  </el-form-item>
                </el-form>
              </el-card>

              <el-card class="mt-card">
                <template #header><span class="section-title">联系方式与国际化</span></template>
                <el-form label-position="top">
                  <el-row :gutter="12">
                    <el-col :span="8">
                      <el-form-item label="客服邮箱">
                        <el-input v-model="form.contactEmail" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="客服电话">
                        <el-input v-model="form.contactPhone" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="服务时间">
                        <el-input v-model="form.serviceTime" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-row :gutter="12">
                    <el-col :span="12">
                      <el-form-item label="默认语言">
                        <el-select v-model="form.lang" class="w-full">
                          <el-option
                            v-for="l in LANG_OPTIONS"
                            :key="l.value"
                            :label="l.label"
                            :value="l.value"
                          />
                        </el-select>
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="时区">
                        <el-select v-model="form.timezone" class="w-full">
                          <el-option
                            v-for="t in TZ_OPTIONS"
                            :key="t"
                            :label="t"
                            :value="t"
                          />
                        </el-select>
                      </el-form-item>
                    </el-col>
                  </el-row>
                </el-form>
              </el-card>
            </el-col>

            <!-- 品牌实时预览：确认站点名称与 Logo 的实际观感 -->
            <el-col :span="8">
              <el-card class="brand-card">
                <template #header><span class="section-title">品牌预览</span></template>
                <div class="brand-box">
                  <span class="brand-logo">
                    <img v-if="form.logoUrl" :src="form.logoUrl" alt="logo" />
                    <AppIcon v-else name="package" :size="20" />
                  </span>
                  <div class="brand-text">
                    <strong>{{ form.siteName || '未命名站点' }}</strong>
                    <small>{{ form.siteSlogan || '—' }}</small>
                  </div>
                </div>
                <div class="brand-meta">
                  <div class="bm-row"><span>域名</span><b>{{ form.domain || '—' }}</b></div>
                  <div class="bm-row"><span>备案</span><b>{{ form.icpNo || '—' }}</b></div>
                  <div class="bm-row"><span>客服</span><b>{{ form.contactEmail || '—' }}</b></div>
                </div>
                <p class="text-hint">
                  保存后：站点名称同步侧栏文字与标签页标题，LOGO 同步侧栏图标，Favicon
                  同步浏览器标签图标。上传即压缩为规范尺寸（LOGO 512×512 / Favicon 64×64 方图）。
                </p>
              </el-card>
            </el-col>
          </el-row>
        </el-tab-pane>

        <!-- ============ SEO / TDK ============ -->
        <el-tab-pane label="SEO / TDK" name="seo">
          <el-card>
            <template #header>
              <div class="card-head">
                <span class="section-title">首页 TDK</span>
                <span class="count-pill">标题建议 ≤ 60 字 · 描述建议 ≤ 160 字</span>
              </div>
            </template>

            <el-form label-position="top">
              <el-row :gutter="12">
                <el-col :span="8">
                  <el-form-item label="标题拼接分隔符">
                    <el-select v-model="form.titleSeparator" class="w-full">
                      <el-option
                        v-for="s in SEPARATORS"
                        :key="s.value"
                        :label="s.label"
                        :value="s.value"
                      />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="16">
                  <el-form-item label="是否追加站点名">
                    <el-radio-group v-model="form.titleSuffix">
                      <el-radio-button
                        v-for="(label, key) in TITLE_SUFFIX_LABELS"
                        :key="key"
                        :value="key"
                        >{{ label }}</el-radio-button
                      >
                    </el-radio-group>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item>
                <template #label>
                  <span class="len-label"
                    >首页 Title
                    <span class="len" :class="lenClass(homeTitleLen, 60)">{{ homeTitleLen }}</span>
                  </span>
                </template>
                <el-input v-model="form.homeTitle" maxlength="120" />
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="len-label"
                    >首页 Description
                    <span class="len" :class="lenClass(homeDescLen, 160)">{{ homeDescLen }}</span>
                  </span>
                </template>
                <el-input v-model="form.homeDesc" type="textarea" :rows="3" maxlength="300" />
              </el-form-item>

              <el-form-item label="首页 Keywords（英文逗号分隔）">
                <el-input v-model="form.homeKeywords" />
              </el-form-item>
              <div v-if="keywordTags.length" class="kw-row">
                <span v-for="k in keywordTags" :key="k" class="tag-soft tag-brand">{{ k }}</span>
              </div>
            </el-form>
          </el-card>

          <!-- 页面 TDK 规则表：不同页面各用一套模板 -->
          <el-card class="mt-card">
            <template #header>
              <div class="card-head">
                <span class="section-title">页面 TDK 规则</span>
                <div class="card-actions">
                  <span class="count-pill">共 {{ form.tdkRules.length }} 条 · 生效 {{ enabledTdkCount }} 条</span>
                  <el-button type="primary" size="small" @click="openCreate">
                    <AppIcon name="plus" :size="14" class="btn-ico" />新增规则
                  </el-button>
                </div>
              </div>
            </template>

            <el-table :data="form.tdkRules" size="small">
              <el-table-column label="页面" width="96">
                <template #default="{ row }">
                  <span class="tag-soft" :class="pageClass(row.page)">{{
                    pageLabels[row.page]
                  }}</span>
                </template>
              </el-table-column>
              <el-table-column label="匹配路径" width="132">
                <template #default="{ row }"><span class="mono">{{ row.path }}</span></template>
              </el-table-column>
              <el-table-column label="Title 模板" min-width="200">
                <template #default="{ row }"><span class="strong">{{ row.titleTpl }}</span></template>
              </el-table-column>
              <el-table-column label="Description 模板" min-width="240">
                <template #default="{ row }"><span class="muted">{{ row.descTpl }}</span></template>
              </el-table-column>
              <el-table-column label="Keywords" min-width="150">
                <template #default="{ row }"><span class="muted">{{ row.keywords }}</span></template>
              </el-table-column>
              <el-table-column label="启用" width="72" align="center">
                <template #default="{ row }">
                  <el-switch v-model="row.enabled" @change="onToggleTdk(row)" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="72" align="center">
                <template #default="{ row }">
                  <el-button link type="primary" class="act-btn" @click="openEdit(row)">
                    <AppIcon name="edit" :size="15" />
                  </el-button>
                  <el-button link type="danger" class="act-btn" @click="confirmRemove(row)">
                    <AppIcon name="trash" :size="15" />
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <p class="text-hint fx-hint">
              模板变量：
              <code v-for="v in TDK_VARS" :key="v.var" class="var-code">{{ v.var }}</code>
              将在前台渲染时替换为实际内容（{site} 站点名 / {name} 标题 / {category} 类目）。
            </p>
          </el-card>
        </el-tab-pane>

        <!-- ============ 统计与代码 ============ -->
        <el-tab-pane label="统计与代码" name="code">
          <el-card>
            <template #header><span class="section-title">第三方代码注入</span></template>
            <el-form label-position="top">
              <el-form-item label="头部代码（注入 &lt;head&gt;，如统计脚本、广告像素）">
                <el-input
                  v-model="form.headCode"
                  type="textarea"
                  :rows="4"
                  class="mono-area"
                  placeholder="<script src=&quot;...&quot;></script>"
                />
              </el-form-item>
              <el-form-item label="底部代码（注入 &lt;body&gt; 末尾，如客服插件）">
                <el-input v-model="form.bodyCode" type="textarea" :rows="4" class="mono-area" />
              </el-form-item>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-form-item label="站长验证 meta（content 值）">
                    <el-input v-model="form.verifyMeta" placeholder="baidu / google 验证串" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="Sitemap">
                    <el-switch v-model="form.sitemapEnabled" active-text="自动生成" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="robots.txt">
                <el-input v-model="form.robots" type="textarea" :rows="5" class="mono-area" />
              </el-form-item>
            </el-form>
          </el-card>
        </el-tab-pane>

        <!-- ============ 效果预览 ============ -->
        <el-tab-pane label="效果预览" name="preview">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-card>
                <template #header><span class="section-title">浏览器标签页</span></template>
                <div class="browser">
                  <div class="browser-bar">
                    <span class="dot-r" /><span class="dot-y" /><span class="dot-g" />
                    <span class="tab">
                      <img v-if="form.faviconUrl" :src="form.faviconUrl" class="tab-fav" alt="favicon" />
                      <AppIcon v-else name="globe" :size="12" />
                      {{ browserTitle }}
                    </span>
                  </div>
                  <div class="browser-body">
                    <span class="brand-logo sm">
                      <img v-if="form.logoUrl" :src="form.logoUrl" alt="logo" />
                      <AppIcon v-else name="package" :size="16" />
                    </span>
                    <strong>{{ form.siteName }}</strong>
                  </div>
                </div>
              </el-card>
            </el-col>

            <el-col :span="12">
              <el-card>
                <template #header><span class="section-title">搜索结果片段</span></template>
                <div class="serp">
                  <div class="serp-url">{{ form.domain || 'https://example.com' }}/</div>
                  <div class="serp-title">{{ browserTitle }}</div>
                  <div class="serp-desc">{{ previewHomeDesc }}</div>
                </div>
                <div class="serp">
                  <div class="serp-url">{{ form.domain || 'https://example.com' }}/product/1001</div>
                  <div class="serp-title">{{ previewProductTitle }}</div>
                  <div class="serp-desc">{{ previewProductDesc }}</div>
                </div>
                <p class="text-hint">以上为按当前模板与示例数据（耳机 / 消费电子）渲染的效果。</p>
              </el-card>
            </el-col>
          </el-row>
        </el-tab-pane>
      </el-tabs>
    </template>

    <!-- 新增 / 编辑 TDK 规则 -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.editing ? '编辑 TDK 规则' : '新增 TDK 规则'"
      width="600px"
    >
      <el-form label-position="top">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="页面类型">
              <el-select v-model="dialog.form.page" class="w-full">
                <el-option
                  v-for="(label, key) in TDK_PAGE_LABELS"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="匹配路径">
              <el-input v-model="dialog.form.path" placeholder="/product/{id}" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Title 模板">
          <el-input v-model="dialog.form.titleTpl" placeholder="{name} - {site}" />
        </el-form-item>
        <el-form-item label="Description 模板">
          <el-input
            v-model="dialog.form.descTpl"
            type="textarea"
            :rows="2"
            placeholder="{name}：{category}类目，支持一件代发。"
          />
        </el-form-item>
        <el-form-item label="Keywords">
          <el-input v-model="dialog.form.keywords" placeholder="{name},{category},一件代发" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="dialog.form.note" placeholder="例如：高 SEO 价值入口页" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="dialog.form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRule">
          {{ dialog.editing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  settingsApi,
  TDK_PAGE_LABELS,
  TITLE_SUFFIX_LABELS,
  TDK_VARS,
  type SiteSettings,
  type TdkRule,
  type TdkRuleInput,
} from '@/api/settings'
import { useSiteStore } from '@/stores/site'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import ImageUploadField from '@/components/ImageUploadField.vue'

// 站点设置页（系统设置）：站点身份 / 首页 TDK / 页面 TDK 规则 / 第三方代码 / 效果预览。
// 表单类配置本地编辑后由「保存设置」整体提交；TDK 规则表走独立接口即时落库（与加价规则页一致）。
// 保存成功后同步到 useSiteStore，侧栏 LOGO 与浏览器标签页标题立即跟着变，做到「改了看得见」。
const siteStore = useSiteStore()
const form = ref<SiteSettings | null>(null)
const loading = ref(false)
const saving = ref(false)
const tab = ref('base')
/** 服务端已生效的原始快照，用于判断是否有未保存改动。 */
const baseline = ref<SiteSettings | null>(null)

const LANG_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
]
const TZ_OPTIONS = ['Asia/Shanghai', 'UTC', 'America/Los_Angeles', 'Europe/London']
const SEPARATORS = [
  { value: ' - ', label: '短横线（- ）' },
  { value: ' | ', label: '竖线（|）' },
  { value: ' _ ', label: '下划线（_）' },
  { value: ' – ', label: '连接号（–）' },
]

// 表格 slot 的 row 为 any，故将页面标签字典放宽索引类型为 string 以避免 TS7053。
const pageLabels: Record<string, string> = TDK_PAGE_LABELS

const appliedName = computed(() => siteStore.siteName)
const dirty = computed(() => {
  const a = baseline.value
  const b = form.value
  if (!a || !b) return false
  return JSON.stringify(patchOf(a)) !== JSON.stringify(patchOf(b))
})

const homeTitleLen = computed(() => form.value?.homeTitle?.length ?? 0)
const homeDescLen = computed(() => form.value?.homeDesc?.length ?? 0)
const keywordTags = computed(() =>
  (form.value?.homeKeywords ?? '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean),
)
const enabledTdkCount = computed(() => form.value?.tdkRules.filter((r) => r.enabled).length ?? 0)

// ===== 模板渲染（预览用）=====
/** 用示例数据渲染 TDK 模板，便于预览真实搜索结果观感。 */
function renderTpl(tpl: string): string {
  const site = form.value?.siteName ?? ''
  return tpl
    .replace(/\{site\}/g, site)
    .replace(/\{name\}/g, '无线蓝牙耳机 Pro')
    .replace(/\{category\}/g, '消费电子')
}

/**
 * 按「分隔符 + 是否追加站点名」规则拼出最终标题。
 * 模板里已含站点名（如 {name} - {site}）时不再重复追加，避免出现「站点名 - 站点名」，
 * 这对 SEO 是硬伤（搜索结果里重复品牌词会被判定为堆砌）。
 */
function joinTitle(base: string, isHome: boolean): string {
  const f = form.value
  if (!f) return base
  const need = f.titleSuffix === 'always' || (f.titleSuffix === 'home' && isHome)
  if (!need || !f.siteName || base.includes(f.siteName)) return base
  return base + f.titleSeparator + f.siteName
}

const browserTitle = computed(() => joinTitle(renderTpl(form.value?.homeTitle ?? ''), true))
const previewHomeDesc = computed(() => renderTpl(form.value?.homeDesc ?? ''))

/** 取商品详情页规则做示例预览；无规则时回落到首页配置。 */
const productRule = computed(
  () => form.value?.tdkRules.find((r) => r.page === 'product' && r.enabled) ?? null,
)
const previewProductTitle = computed(() =>
  productRule.value
    ? joinTitle(renderTpl(productRule.value.titleTpl), false)
    : joinTitle(renderTpl(form.value?.homeTitle ?? ''), false),
)
const previewProductDesc = computed(() =>
  productRule.value
    ? renderTpl(productRule.value.descTpl)
    : renderTpl(form.value?.homeDesc ?? ''),
)

function pageClass(page: string): string {
  const map: Record<string, string> = {
    home: 'tag-brand',
    product: 'tag-teal',
    category: 'tag-violet',
    quote: 'tag-orange',
    article: 'tag-amber',
    custom: 'tag-gray',
  }
  return map[page] ?? 'tag-gray'
}

function lenClass(len: number, limit: number): string {
  if (len === 0) return 'len-zero'
  return len > limit ? 'len-over' : 'len-ok'
}

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** 组装提交入参：TDK 规则走独立接口，故不随主表单提交。 */
function patchOf(s: SiteSettings): Partial<SiteSettings> {
  return {
    siteName: s.siteName,
    siteSlogan: s.siteSlogan,
    logoUrl: s.logoUrl,
    faviconUrl: s.faviconUrl,
    domain: s.domain,
    icpNo: s.icpNo,
    copyright: s.copyright,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    serviceTime: s.serviceTime,
    lang: s.lang,
    timezone: s.timezone,
    titleSeparator: s.titleSeparator,
    titleSuffix: s.titleSuffix,
    homeTitle: s.homeTitle,
    homeDesc: s.homeDesc,
    homeKeywords: s.homeKeywords,
    headCode: s.headCode,
    bodyCode: s.bodyCode,
    verifyMeta: s.verifyMeta,
    robots: s.robots,
    sitemapEnabled: s.sitemapEnabled,
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const s = await settingsApi.site()
    form.value = s
    baseline.value = { ...s, tdkRules: s.tdkRules.map((r) => ({ ...r })) }
    siteStore.apply(s)
  } catch (e) {
    ElMessage.error('加载站点设置失败：' + errMsg(e))
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  const f = form.value
  if (!f) return
  if (!f.siteName.trim()) {
    ElMessage.warning('站点名称不能为空')
    tab.value = 'base'
    return
  }
  saving.value = true
  try {
    const saved = await settingsApi.updateSite(patchOf(f))
    // 保留本地 TDK 规则表（服务端已按独立接口落库），再刷新基线，避免误判未保存。
    form.value = { ...saved, tdkRules: f.tdkRules }
    baseline.value = { ...saved, tdkRules: f.tdkRules.map((r) => ({ ...r })) }
    siteStore.apply(form.value)
    ElMessage.success('站点设置已保存，侧栏与标签页标题已同步')
  } catch (e) {
    ElMessage.error('保存失败：' + errMsg(e))
  } finally {
    saving.value = false
  }
}

// ===== TDK 规则：独立接口即时落库 =====
const dialog = reactive({
  visible: false,
  editing: false,
  editingId: '',
  form: blankRule(),
})

function blankRule(): TdkRuleInput {
  return {
    page: 'custom',
    path: '/',
    titleTpl: '',
    descTpl: '',
    keywords: '',
    enabled: true,
    note: '',
  }
}

function openCreate(): void {
  dialog.editing = false
  dialog.editingId = ''
  dialog.form = blankRule()
  dialog.visible = true
}

function openEdit(row: TdkRule): void {
  dialog.editing = true
  dialog.editingId = row.id
  dialog.form = { ...row }
  dialog.visible = true
}

async function submitRule(): Promise<void> {
  const f = dialog.form
  if (!f.titleTpl?.trim()) {
    ElMessage.warning('Title 模板不能为空')
    return
  }
  saving.value = true
  try {
    if (dialog.editing) {
      await settingsApi.updateTdkRule(dialog.editingId, {
        page: f.page,
        path: f.path,
        titleTpl: f.titleTpl,
        descTpl: f.descTpl,
        keywords: f.keywords,
        enabled: f.enabled,
        note: f.note,
      })
      ElMessage.success('TDK 规则已保存')
    } else {
      await settingsApi.createTdkRule({
        page: f.page,
        path: f.path,
        titleTpl: f.titleTpl,
        descTpl: f.descTpl,
        keywords: f.keywords,
        enabled: f.enabled,
        note: f.note,
      })
      ElMessage.success('TDK 规则已新增')
    }
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error('保存失败：' + errMsg(e))
  } finally {
    saving.value = false
  }
}

async function onToggleTdk(row: TdkRule): Promise<void> {
  try {
    await settingsApi.updateTdkRule(row.id, { enabled: row.enabled })
    ElMessage.info(`「${pageLabels[row.page]}」TDK 已${row.enabled ? '启用' : '停用'}`)
  } catch (e) {
    ElMessage.error('更新失败：' + errMsg(e))
    row.enabled = !row.enabled
  }
}

async function confirmRemove(row: TdkRule): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除「${pageLabels[row.page]}」的 TDK 规则？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await settingsApi.removeTdkRule(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error('删除失败：' + errMsg(e))
  }
}

// ===== 演示数据重置 =====
async function resetDemo(): Promise<void> {
  try {
    await ElMessageBox.confirm('将清除本地演示中的站点设置改动，恢复初始数据？', '重置演示数据', {
      type: 'warning',
      confirmButtonText: '重置',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    const s = await settingsApi.resetSite()
    form.value = s
    baseline.value = { ...s, tdkRules: s.tdkRules.map((r) => ({ ...r })) }
    siteStore.apply(s)
    ElMessage.success('已重置为初始站点设置')
  } catch (e) {
    ElMessage.error('重置失败：' + errMsg(e))
  }
}

onMounted(load)
</script>

<style scoped>
.btn-ico {
  margin-right: 5px;
}
.loading-box {
  height: 200px;
}
.mt-card {
  margin-top: 16px;
}
.section-title {
  font-weight: 600;
  color: var(--ink-800);
}
.muted {
  color: var(--ink-500);
}
.strong {
  font-weight: 600;
  color: var(--ink-800);
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12.5px;
  color: var(--ink-600);
}
.act-btn {
  padding: 2px 4px;
}

/* 生效状态条 */
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  border-radius: var(--r-md);
  background: #fff;
  border: 1px solid var(--line);
  font-size: 12.5px;
  color: var(--ink-600);
}
.status-bar b {
  color: var(--brand-600);
}
.sb-sep {
  color: var(--ink-300);
}
.sb-dirty {
  margin-left: auto;
}

/* 保存区按钮行（Tab 卡片内的表头操作） */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.card-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.count-pill {
  font-size: 12px;
  font-weight: 600;
  color: #0e7490;
  background: #ecfeff;
  padding: 4px 10px;
  border-radius: var(--r-pill);
}

/* 品牌预览 */
.brand-card {
  height: 100%;
}
.brand-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0 14px;
  border-bottom: 1px dashed var(--line);
}
.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  overflow: hidden;
  flex: none;
}
.brand-logo.sm {
  width: 30px;
  height: 30px;
  border-radius: 9px;
}
.brand-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.brand-text strong {
  font-size: 15px;
  color: var(--ink-900);
}
.brand-text small {
  font-size: 12px;
  color: var(--ink-400);
}
.brand-meta {
  padding: 12px 0;
}
.bm-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
  padding: 5px 0;
}
.bm-row span {
  color: var(--ink-400);
  flex: none;
}
.bm-row b {
  color: var(--ink-700);
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}

/* 字数提示 */
.len-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.len {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: var(--r-pill);
}
.len-ok {
  color: #0e7490;
  background: #ecfeff;
}
.len-over {
  color: #b91c1c;
  background: #fee2e2;
}
.len-zero {
  color: var(--ink-400);
  background: var(--line-soft);
}
.kw-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: -6px 0 10px;
}
.fx-hint {
  margin: 12px 0 0;
}
.var-code {
  display: inline-block;
  margin: 0 4px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--line-soft);
  color: var(--brand-700);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}
.mono-area :deep(.el-textarea__inner) {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12.5px;
}

/* 浏览器标签页预览 */
.browser {
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  overflow: hidden;
}
.browser-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  background: var(--line-soft);
  border-bottom: 1px solid var(--line);
}
.dot-r,
.dot-y,
.dot-g {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}
.dot-r {
  background: #f87171;
}
.dot-y {
  background: #fbbf24;
}
.dot-g {
  background: #34d399;
}
.browser-bar .tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 10px;
  max-width: 260px;
  padding: 3px 12px;
  border-radius: 7px 7px 0 0;
  background: #fff;
  font-size: 12px;
  color: var(--ink-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-fav {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  object-fit: cover;
  flex: none;
}
.browser-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 22px 16px;
  font-size: 14px;
  color: var(--ink-800);
}

/* 搜索结果片段（SERP） */
.serp {
  padding: 12px 0;
  border-bottom: 1px dashed var(--line);
}
.serp:last-of-type {
  border-bottom: none;
}
.serp-url {
  font-size: 12px;
  color: #0f766e;
}
.serp-title {
  font-size: 16px;
  color: #1a0dab;
  line-height: 1.4;
  margin: 2px 0 3px;
}
.serp-desc {
  font-size: 13px;
  color: var(--ink-600);
  line-height: 1.6;
}
</style>
