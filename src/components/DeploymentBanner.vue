<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-vue-next'
import { ElMessageBox } from 'element-plus'
import { http } from '@/api/http'
import { applyDeploymentStatus, deploymentState } from '@/stores/deployment'

const banner = ref<HTMLElement>()
const visible = computed(() => deploymentState.maintenance || deploymentState.disconnected || deploymentState.recovered)
const title = computed(() => deploymentState.maintenance
  ? '系统正在更新，已暂停新增、保存和下发'
  : deploymentState.disconnected ? '服务连接暂时中断，已暂停提交操作' : '更新已结束，服务已恢复')
const description = computed(() => deploymentState.disconnected
  ? '正在自动检查服务状态，请勿关闭页面。当前编辑内容仍保留在页面中。'
  : deploymentState.maintenance
    ? '可继续查看已加载的内容。请勿关闭页面，等待更新结束后再提交。'
    : '请先保存或复制尚未提交的内容，再手动刷新获取最新版本。')
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
let stopped = false
let observer: ResizeObserver | undefined

async function poll() {
  controller = new AbortController()
  const timeout = setTimeout(() => controller?.abort(), 8000)
  try {
    const status = await http.getWithSignal<{ maintenance: boolean; revision: string }>('/api/deployment-status', controller.signal)
    if (typeof status?.maintenance !== 'boolean' || typeof status?.revision !== 'string') {
      throw new Error('Invalid deployment status')
    }
    if (!stopped) applyDeploymentStatus(status)
  } catch {
    if (!stopped) deploymentState.disconnected = true
  } finally {
    clearTimeout(timeout)
    if (!stopped) timer = setTimeout(poll, 5000)
  }
}

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  if (!visible.value) return
  event.preventDefault()
  event.returnValue = ''
}

async function refresh() {
  try {
    await ElMessageBox.confirm('刷新会清除当前页面尚未提交的编辑内容。请确认已保存或复制后再继续。', '确认刷新页面', {
      confirmButtonText: '已保存，刷新页面', cancelButtonText: '继续编辑', type: 'warning',
    })
    window.removeEventListener('beforeunload', warnBeforeLeaving)
    window.location.reload()
  } catch { /* Keep the current page and edits. */ }
}

onMounted(() => {
  observer = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--deployment-banner-height', `${banner.value?.offsetHeight || 0}px`)
  })
  if (banner.value) observer.observe(banner.value)
  window.addEventListener('beforeunload', warnBeforeLeaving)
  void poll()
})

onBeforeUnmount(() => {
  stopped = true
  clearTimeout(timer)
  controller?.abort()
  observer?.disconnect()
  document.documentElement.style.removeProperty('--deployment-banner-height')
  window.removeEventListener('beforeunload', warnBeforeLeaving)
})
</script>

<template>
  <section ref="banner" v-show="visible" class="deployment-banner" :class="{ 'is-recovered': !deploymentState.maintenance && !deploymentState.disconnected }" role="status" aria-live="polite">
    <AlertTriangle v-if="deploymentState.maintenance || deploymentState.disconnected" :size="22" class="deployment-icon" />
    <CheckCircle2 v-else :size="22" class="deployment-icon" />
    <div class="deployment-copy"><strong>{{ title }}</strong><p>{{ description }}</p></div>
    <el-button v-if="!deploymentState.maintenance && !deploymentState.disconnected" @click="refresh"><RefreshCw :size="16" />手动刷新</el-button>
  </section>
</template>

<style>
.deployment-banner { position: fixed; inset: 0 0 auto; z-index: 2000; display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: #fff4d6; color: #704600; border-bottom: 1px solid #d9ad4b; }
.deployment-banner.is-recovered { background: #ecf8ef; color: #205e36; border-color: #83bd96; }
.deployment-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 14px; line-height: 22px; }
.deployment-copy p { margin: 2px 0 0; }
.deployment-icon { flex-shrink: 0; }
.deployment-banner .el-button { flex-shrink: 0; gap: 6px; }
body { padding-top: var(--deployment-banner-height, 0px); }
.app-shell > aside { top: var(--deployment-banner-height, 0px); }
.app-shell header { top: var(--deployment-banner-height, 0px); }
.el-overlay { top: var(--deployment-banner-height, 0px); }
@media (max-width: 600px) { .deployment-banner { flex-wrap: wrap; padding: 10px 12px; } .deployment-copy { flex-basis: calc(100% - 36px); } .deployment-banner .el-button { margin-left: 34px; } }
</style>
