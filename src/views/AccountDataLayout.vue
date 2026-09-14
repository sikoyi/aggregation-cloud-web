<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const platforms = useScopedBusinessPlatformOptions()
const activeSection = computed({
  get: () => String(route.name || 'account-data-social'),
  set: name => {
    if (name !== route.name) void router.push({ name })
  },
})
</script>

<template>
  <el-radio-group v-model="activeSection" class="account-data-navigation" aria-label="账号数据分类">
    <el-radio-button value="account-data-social">社媒账号数据</el-radio-button>
    <el-radio-button v-if="auth.can('operations.view')" value="account-data-external">外部账号监听</el-radio-button>
    <el-radio-button v-if="platforms.some(option => option.value === 'shopify')" value="account-data-shopify">Shopify 店铺监听</el-radio-button>
  </el-radio-group>
  <router-view />
</template>

<style scoped>
.account-data-navigation { margin-bottom: 16px; max-width: 100%; flex-wrap: wrap; }
</style>
