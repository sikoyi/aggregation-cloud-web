<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'

const route = useRoute()

const config = computed(() => resources[String(route.meta.resource)])
</script>

<template>
  <CrudPage v-if="config" :key="config.key" :config="config" />
  <div v-else class="rounded-md border border-line bg-white p-6 text-sm text-slate-600">模块不存在</div>
</template>
