<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessageBox, ElNotification } from 'element-plus'
import { http } from '@/api/http'
import ExternalAccountTagSelect from './ExternalAccountTagSelect.vue'

interface Group { id: string; name: string; version: number; member_count: number }
const props = defineProps<{ modelValue: string[]; groups: Group[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]]; changed: []; busy: [value: boolean] }>()
const ordered = ref<Group[]>([])
const busy = ref(false)
watch(() => props.groups, groups => { ordered.value = [...groups] }, { immediate: true })
function setBusy(value: boolean) { busy.value = value; emit('busy', value) }
async function create() {
  if (props.disabled || busy.value) return
  setBusy(true)
  try {
    const { value } = await ElMessageBox.prompt('标签名称', '新增账号标签', {
      confirmButtonText: '新增', cancelButtonText: '取消', closeOnClickModal: false,
      inputValidator: value => !value?.trim() ? '请输入标签名称' : value.trim().length > 80 ? '标签名称不能超过80个字符' : true,
    })
    if (props.disabled) return
    const group = await http.post<Group>('/api/external-account-monitors/tags', { name: value.trim() })
    ordered.value = [...ordered.value.filter(item => item.id !== group.id), group]
    emit('update:modelValue', [...new Set([...props.modelValue, group.id])])
    emit('changed')
    ElNotification.success({ title: '标签已新增' })
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElNotification.error({ title: '新增标签失败', message: error instanceof Error ? error.message : '请重试' })
  } finally { setBusy(false) }
}
async function move(from: number, to: number) {
  if (props.disabled || busy.value || from === to || from < 0 || to < 0 || from >= ordered.value.length || to >= ordered.value.length) return
  const groups = [...ordered.value]
  groups.splice(to, 0, groups.splice(from, 1)[0])
  setBusy(true)
  try {
    ordered.value = await http.put<Group[]>('/api/external-account-monitors/tags/order', { items: groups.map(group => ({ id: group.id, expected_version: group.version })) })
    emit('changed')
  } catch (error) {
    ElNotification.error({ title: '保存标签顺序失败', message: error instanceof Error ? error.message : '请刷新重试' })
    emit('changed')
  } finally { setBusy(false) }
}
</script>

<template>
  <ExternalAccountTagSelect :model-value="modelValue" :options="ordered.map(group => ({ value: group.id, label: group.name }))" label="账号标签" :disabled="disabled || busy" reorderable creatable @update:model-value="emit('update:modelValue', $event)" @create="create" @move="move" />
</template>
