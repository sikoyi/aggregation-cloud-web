<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CrudPage from '@/components/CrudPage.vue'
import { resources } from '@/config/resources'

const route = useRoute()
const router = useRouter()
const crudPageRef = ref<InstanceType<typeof CrudPage> | null>(null)

const config = computed(() => resources[String(route.meta.resource)])

// 工作台快捷入口携带 action=create 时，进入页面后直接打开新增表单。
watch(
  () => [route.meta.resource, route.query.action],
  async ([, action]) => {
    if (action !== 'create') return
    await nextTick()
    await crudPageRef.value?.openCreate()
    const query = { ...route.query }
    delete query.action
    await router.replace({ path: route.path, query })
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <CrudPage v-if="config" :key="config.key" ref="crudPageRef" :config="config" />
  <div v-else class="rounded-md border border-line bg-white p-6 text-sm text-slate-600">模块不存在</div>
</template>
