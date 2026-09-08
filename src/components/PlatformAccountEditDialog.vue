<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { RefreshCw, Save } from 'lucide-vue-next'
import { computed, onMounted } from 'vue'

import RemoteSelect from '@/components/RemoteSelect.vue'
import { usePlatformAccountEdit } from '@/composables/usePlatformAccountEdit'
import { accountAgeTypeOptions, accountCountryOptions, businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ accountId: string; platform: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const auth = useAuthStore()
const { detail, form, loading, submitting, changed, error, canSave, load, save } = usePlatformAccountEdit(
  props.accountId, props.platform, () => auth.can('accounts.edit'),
)
const disabled = computed(() => loading.value || submitting.value || !auth.can('accounts.edit'))
const tagConfig = {
  endpoint: '/api/account-tags', labelKey: 'name', valueKey: 'id',
  detailPath: (id: string) => `/api/account-tags/${encodeURIComponent(id)}`,
  searchParam: 'keyword', pageSize: 50, multiple: true,
}
function close() {
  if (submitting.value) return
  if (changed.value) emit('changed')
  emit('close')
}
async function submit() {
  if (!await save()) return
  ElMessage.success('平台账号资料已保存')
  close()
}
onMounted(load)
</script>

<template>
  <el-dialog :model-value="true" :title="`编辑 ${businessPlatformLabel(platform)} 平台账号`"
    width="min(92vw, 560px)" append-to-body destroy-on-close
    :close-on-click-modal="false" :close-on-press-escape="!submitting" :show-close="!submitting" @close="close">
    <div v-loading="loading" class="platform-edit-body">
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb-4" />
      <el-form v-if="detail" label-position="top" :disabled="disabled" @submit.prevent="submit">
        <div class="platform-edit-grid">
          <el-form-item label="昵称"><el-input v-model="form.display_name" maxlength="200" /></el-form-item>
          <el-form-item label="公开用户名"><el-input v-model="form.username" maxlength="160" /></el-form-item>
          <el-form-item label="主页链接" class="platform-edit-wide"><el-input v-model="form.profile_url" /></el-form-item>
          <el-form-item label="国家">
            <el-select v-model="form.country" filterable clearable aria-label="国家">
              <el-option v-for="option in accountCountryOptions" :key="String(option.value)" :label="option.label" :value="option.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="账号类型">
            <el-select v-model="form.account_age_type" aria-label="账号类型">
              <el-option v-for="option in accountAgeTypeOptions" :key="String(option.value)" :label="option.label" :value="option.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="账号标签" class="platform-edit-wide">
            <RemoteSelect :model-value="form.tag_ids" :config="tagConfig" :disabled="disabled"
              placeholder="请选择账号标签" @update:model-value="form.tag_ids = Array.isArray($event) ? $event : []" />
          </el-form-item>
        </div>
      </el-form>
    </div>
    <template #footer>
      <div class="platform-edit-footer">
        <el-button v-if="!detail && error" :icon="RefreshCw" :disabled="loading" @click="load">重新加载</el-button>
        <el-button :disabled="submitting" @click="close">取消</el-button>
        <el-button type="primary" :icon="Save" :loading="submitting" :disabled="!canSave" @click="submit">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.platform-edit-body { min-height: 100px; }
.platform-edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.platform-edit-wide { grid-column: 1 / -1; }
.platform-edit-footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.platform-edit-footer :deep(.el-button + .el-button) { margin-left: 0; }
@media (max-width: 480px) { .platform-edit-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
