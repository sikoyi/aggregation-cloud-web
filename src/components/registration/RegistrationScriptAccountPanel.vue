<script setup lang="ts">
import { KeyRound, RefreshCw, Save, ShieldCheck } from 'lucide-vue-next'
import { ElNotification, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  registrationApi,
  type RegistrationScriptAccount,
  type RegistrationStatus,
} from '@/api/registration'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const saving = ref(false)
const current = ref<RegistrationScriptAccount | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  username: '',
  password: '',
  status: 'enabled' as RegistrationStatus,
})
const isCreated = computed(() => !!current.value)
const rules: FormRules = {
  username: [{ required: true, message: '请输入脚本登录账号', trigger: 'blur' }],
  password: [{
    validator: (_rule, value, callback) => {
      if (!isCreated.value && String(value || '').length < 8) {
        callback(new Error('首次创建必须填写至少 8 位密码'))
      } else if (value && String(value).length < 8) {
        callback(new Error('密码不能少于 8 位'))
      } else {
        callback()
      }
    },
    trigger: 'blur',
  }],
}

async function loadAccount() {
  loading.value = true
  try {
    current.value = await registrationApi.getScriptAccount()
    form.username = current.value?.username || ''
    form.password = ''
    form.status = current.value?.status || 'enabled'
  } finally {
    loading.value = false
  }
}

async function submit() {
  await formRef.value?.validate()
  saving.value = true
  try {
    current.value = await registrationApi.saveScriptAccount({
      username: form.username.trim(),
      password: form.password || undefined,
      status: form.status,
    })
    form.password = ''
    ElNotification.success({ title: '保存成功', message: '脚本登录账号已更新' })
  } finally {
    saving.value = false
  }
}

defineExpose({ loadAccount })
onMounted(loadAccount)
</script>

<template>
  <div v-loading="loading" class="registration-panel">
    <div class="panel-toolbar">
      <div>
        <h2>脚本访问账号</h2>
        <p>脚本通过账号密码换取 JWT；可以同时保持多个有效登录会话。</p>
      </div>
      <el-tooltip content="刷新" placement="bottom">
        <el-button circle :icon="RefreshCw" @click="loadAccount" />
      </el-tooltip>
    </div>

    <div class="account-layout">
      <div class="account-summary">
        <div class="summary-icon"><ShieldCheck class="h-7 w-7" /></div>
        <div>
          <div class="summary-title">{{ current?.username || '尚未创建脚本账号' }}</div>
          <div class="summary-state">
            <el-tag
              v-if="current"
              :type="current.status === 'enabled' ? 'success' : 'info'"
              effect="light"
            >
              {{ current.status === 'enabled' ? '可登录' : '已禁用' }}
            </el-tag>
            <span v-if="current" class="updated-at">更新于 {{ formatDate(current.updated_at) }}</span>
          </div>
        </div>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="account-form">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" maxlength="100" placeholder="请输入脚本登录账号">
            <template #prefix><KeyRound class="h-4 w-4" /></template>
          </el-input>
        </el-form-item>
        <el-form-item :label="isCreated ? '新密码（留空保持不变）' : '登录密码'" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少 8 位"
          />
        </el-form-item>
        <el-form-item label="登录状态" prop="status">
          <el-switch
            v-model="form.status"
            active-value="enabled"
            inactive-value="disabled"
            active-text="允许登录"
            inactive-text="禁止登录"
          />
        </el-form-item>
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="脚本账号只能领取资料和管理自己的接码订单，不能修改或删除后台配置。"
        />
        <div class="form-actions">
          <el-button type="primary" :icon="Save" :loading="saving" @click="submit">
            保存账号
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.registration-panel { padding: 16px; border: 1px solid #dbe4ed; border-radius: 6px; background: #fff; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.panel-toolbar h2 { color: #26384a; font-size: 15px; font-weight: 700; }
.panel-toolbar p { margin-top: 4px; color: #718096; font-size: 12px; }
.account-layout { display: grid; grid-template-columns: minmax(260px, 0.8fr) minmax(420px, 1.4fr); gap: 26px; align-items: start; }
.account-summary { display: flex; gap: 14px; align-items: center; padding: 20px; border: 1px solid #dce6ef; border-radius: 6px; background: #f8fbfd; }
.summary-icon { display: flex; width: 52px; height: 52px; align-items: center; justify-content: center; border-radius: 8px; color: #1f668f; background: #eaf6fc; }
.summary-title { color: #26384a; font-size: 15px; font-weight: 700; }
.summary-state { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.updated-at { color: #8492a6; font-size: 12px; }
.account-form { max-width: 620px; }
.form-actions { display: flex; justify-content: flex-end; margin-top: 18px; }
@media (max-width: 900px) {
  .account-layout { grid-template-columns: 1fr; }
  .account-form { max-width: none; }
}
</style>
