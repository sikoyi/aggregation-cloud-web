<script setup lang="ts">
import {
  Boxes,
  Bot,
  ClipboardList,
  Gauge,
  Layers3,
  LayoutDashboard,
  LogOut,
  Network,
  PlaySquare,
  ScrollText,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const navItems = [
  { label: '总览', to: '/', icon: LayoutDashboard },
  { label: '账号', to: '/accounts', icon: Users },
  { label: '账号组', to: '/account-groups', icon: Layers3 },
  { label: 'Slot', to: '/slots', icon: Boxes },
  { label: 'Slot 组', to: '/slot-groups', icon: Network },
  { label: '代理', to: '/proxies', icon: ShieldCheck },
  { label: '脚本', to: '/scripts', icon: ScrollText },
  { label: '模板', to: '/task-templates', icon: ClipboardList },
  { label: '任务', to: '/tasks', icon: PlaySquare },
  { label: 'Runtime', to: '/runtimes', icon: Server },
  { label: '分发', to: '/dispatcher', icon: Bot },
]

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-paper">
    <aside class="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-white lg:block">
      <div class="flex h-16 items-center gap-2 border-b border-line px-5">
        <Gauge class="h-6 w-6 text-brand-600" />
        <div>
          <div class="text-sm font-semibold text-ink">Aggregation Cloud</div>
          <div class="text-xs text-slate-500">Control Console</div>
        </div>
      </div>
      <nav class="space-y-1 px-3 py-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-ink"
          active-class="bg-brand-50 text-brand-700"
        >
          <component :is="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="lg:pl-60">
      <header class="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div class="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div class="flex min-w-0 items-center gap-3 lg:hidden">
            <Gauge class="h-5 w-5 text-brand-600" />
            <span class="truncate text-sm font-semibold text-ink">Aggregation Cloud</span>
          </div>
          <div class="hidden min-w-0 overflow-x-auto lg:block">
            <div class="flex gap-1">
              <RouterLink
                v-for="item in navItems"
                :key="`top-${item.to}`"
                :to="item.to"
                class="hidden"
              >
                {{ item.label }}
              </RouterLink>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="max-w-40 truncate text-sm text-slate-600">{{ auth.displayName }}</span>
            <button class="btn btn-secondary h-8 px-2" type="button" title="退出登录" @click="logout">
              <LogOut class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div class="overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
          <div class="flex gap-1">
            <RouterLink
              v-for="item in navItems"
              :key="`mobile-${item.to}`"
              :to="item.to"
              class="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600"
              active-class="bg-brand-50 text-brand-700"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </div>
        </div>
      </header>

      <main class="px-4 py-5 lg:px-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
