<script setup lang="ts">
import { LockKeyhole, ServerCog } from 'lucide-vue-next'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { notifyError } from '@/utils/notify'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')

async function submit() {
  try {
    await auth.login(username.value, password.value)
    router.push(String(route.query.redirect || '/'))
  } catch (err) {
    notifyError(err, '登录失败', '登录失败')
  }
}
</script>

<template>
  <main class="grid min-h-screen bg-paper lg:grid-cols-[1.05fr_0.95fr]">
    <section class="hidden border-r border-line bg-white px-12 py-10 lg:flex lg:flex-col lg:justify-between">
      <div class="flex items-center gap-3">
        <ServerCog class="h-8 w-8 text-brand-600" />
        <div>
          <div class="text-lg font-semibold text-ink">Aggregation Cloud</div>
          <div class="text-sm text-slate-500">统一运营控制台</div>
        </div>
      </div>
      <div class="max-w-lg space-y-4">
        <h1 class="text-3xl font-semibold leading-tight text-ink">云控任务管理后台</h1>
        <p class="text-base leading-7 text-slate-600">账号、设备、代理、脚本、任务模板和分发状态集中管理。</p>
      </div>
      <div class="h-1 w-32 rounded-full bg-accent-500" />
    </section>

    <section class="flex items-center justify-center px-4 py-10">
      <el-card class="w-full max-w-sm login-card" shadow="never">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            <LockKeyhole class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-ink">登录</h2>
            <p class="text-sm text-slate-500">使用后台账号进入控制台</p>
          </div>
        </div>

        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="账号">
            <el-input v-model="username" autocomplete="username" size="large" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="password" type="password" autocomplete="current-password" size="large" show-password />
          </el-form-item>
          <el-button type="primary" size="large" class="w-full" :loading="auth.loading" @click="submit">
            登录
          </el-button>
        </el-form>
      </el-card>
    </section>
  </main>
</template>
