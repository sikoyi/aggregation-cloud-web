<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { http } from '@/api/http'

const props = defineProps<{ modelValue: string; retainedCountry?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const countries = ref<string[]>([])
const loading = ref(false)
const error = ref('')
const retained = computed(() => props.retainedCountry && !countries.value.includes(props.retainedCountry) ? props.retainedCountry : '')
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try { countries.value = (await http.get<{ countries: string[] }>('/api/external-account-monitors/country-options')).countries }
  catch (e) { error.value = e instanceof Error ? e.message : '加载常用国家失败' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div class="external-country-select">
    <el-select :model-value="modelValue" placeholder="请选择国家" filterable clearable :disabled="disabled || !!error" :loading="loading" no-data-text="暂无常用国家" @update:model-value="emit('update:modelValue', $event || '')" @visible-change="open => { if (open) void load() }">
      <el-option v-for="country in countries" :key="country" :value="country" :label="country" />
      <el-option v-if="retained" :value="retained" :label="`${retained}（已移出常用）`" disabled />
    </el-select>
    <div v-if="error" role="alert" class="external-country-select__error">{{ error }}<el-button link :icon="RefreshCw" :disabled="disabled || loading" @click="load">重试</el-button></div>
  </div>
</template>

<style scoped>
.external-country-select { width: 100%; min-width: 0; }
.external-country-select__error { color: var(--el-color-danger); overflow-wrap: anywhere; }
</style>
