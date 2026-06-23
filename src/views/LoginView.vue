<script setup lang="ts">
import { LockKeyhole, ServerCog } from 'lucide-vue-next'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const username = ref('admin')
const password = ref('admin123456')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    router.push(String(route.query.redirect || '/'))
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败'
  }
}
</script>

<template>
  <main class="grid min-h-screen bg-paper lg:grid-cols-[1.1fr_0.9fr]">
    <section class="hidden border-r border-line bg-white px-12 py-10 lg:flex lg:flex-col lg:justify-between">
      <div class="flex items-center gap-3">
        <ServerCog class="h-8 w-8 text-brand-600" />
        <div>
          <div class="text-lg font-semibold text-ink">Aggregation Cloud</div>
          <div class="text-sm text-slate-500">{{ http.apiBaseUrl }}</div>
        </div>
      </div>
      <div class="max-w-lg space-y-4">
        <h1 class="text-3xl font-semibold leading-tight text-ink">云控任务管理后台</h1>
        <p class="text-base leading-7 text-slate-600">
          账号、Slot、代理、脚本、任务模板和分发状态集中管理。
        </p>
      </div>
      <div class="h-1 w-32 rounded-full bg-accent-500" />
    </section>

    <section class="flex items-center justify-center px-4 py-10">
      <form class="w-full max-w-sm rounded-md border border-line bg-white p-6 shadow-panel" @submit.prevent="submit">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700">
            <LockKeyhole class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-ink">登录</h2>
            <p class="text-sm text-slate-500">使用后台账号进入控制台</p>
          </div>
        </div>

        <div class="space-y-4">
          <label class="space-y-1.5">
            <span class="label">账号</span>
            <input v-model="username" class="input" autocomplete="username" />
          </label>
          <label class="space-y-1.5">
            <span class="label">密码</span>
            <input v-model="password" class="input" type="password" autocomplete="current-password" />
          </label>
          <div v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ error }}
          </div>
          <button class="btn btn-primary w-full" type="submit" :disabled="auth.loading">登录</button>
        </div>
      </form>
    </section>
  </main>
</template>
