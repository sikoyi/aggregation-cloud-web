<script setup lang="ts">
import { Copy, RefreshCw, Timer, X } from 'lucide-vue-next'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted } from 'vue'

import type { TotpSource } from '@/api/accountTotp'
import { useAccountTotp } from '@/composables/useAccountTotp'

const props = defineProps<{ source: TotpSource; accountId: string; revision?: unknown; disabled?: boolean }>()
const { visible, loading, error, code, seconds, setVisible, setSuspended, refresh, copy } = useAccountTotp(
  () => ({ source: props.source, id: props.accountId, revision: props.revision }),
)
const displayCode = computed(() => code.value ? `${code.value.slice(0, 3)} ${code.value.slice(3)}` : '--- ---')
function open(value: boolean) { setVisible(value && !props.disabled) }
function visibilityChanged() { setSuspended(document.hidden) }
async function copyCode() {
  try {
    if (await copy()) ElMessage.success('验证码已复制')
    else ElMessage.warning('验证码已过期，请等待刷新后复制')
  } catch { ElMessage.error('复制失败，请手动复制验证码') }
}
onMounted(() => document.addEventListener('visibilitychange', visibilityChanged))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibilityChanged))
</script>

<template>
  <el-popover :visible="visible" trigger="click" placement="bottom" :width="260" @update:visible="open">
    <template #reference>
      <span @click.stop>
        <el-tooltip :content="disabled ? '尚未设置 2FA 密钥' : '查看验证码'" placement="top">
          <el-button class="totp-trigger" text circle :icon="Timer" aria-label="查看 2FA 验证码" :disabled="disabled" />
        </el-tooltip>
      </span>
    </template>
    <section class="totp-viewer" aria-label="2FA 验证码">
      <header>
        <strong>2FA 验证码</strong>
        <el-button text circle :icon="X" aria-label="关闭验证码" @click="setVisible(false)" />
      </header>
      <div v-if="error" class="totp-viewer__error" role="alert">
        <span>{{ error }}</span>
        <el-button :icon="RefreshCw" @click="refresh">重新获取</el-button>
      </div>
      <template v-else>
        <div class="totp-viewer__code" :aria-busy="loading">
          <span>{{ displayCode }}</span>
          <el-tooltip content="复制验证码" placement="top">
            <el-button text circle :icon="Copy" aria-label="复制验证码" :disabled="loading || !code" @click="copyCode" />
          </el-tooltip>
        </div>
        <p :class="{ 'totp-viewer__expiring': seconds <= 5 && !loading }">
          {{ loading ? '正在获取验证码' : seconds <= 5 ? `即将过期，剩余 ${seconds} 秒` : `${seconds} 秒后刷新` }}
        </p>
      </template>
    </section>
  </el-popover>
</template>

<style scoped>
.totp-trigger { width: 24px; height: 24px; padding: 4px; }
.totp-viewer { min-height: 132px; }
.totp-viewer header { display: flex; align-items: center; justify-content: space-between; }
.totp-viewer__code { display: flex; align-items: center; justify-content: center; gap: 12px; height: 64px; }
.totp-viewer__code span { font-family: ui-monospace, monospace; font-size: 28px; font-variant-numeric: tabular-nums; user-select: all; }
.totp-viewer p { margin: 0; color: var(--el-text-color-secondary); text-align: center; font-size: 12px; }
.totp-viewer p.totp-viewer__expiring { color: var(--el-color-warning); }
.totp-viewer__error { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-top: 12px; color: var(--el-color-danger); overflow-wrap: anywhere; }
</style>
