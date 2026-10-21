<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import ExternalAccountTagSelect from './ExternalAccountTagSelect.vue'

const props = defineProps<{ modelValue: string[]; unset: boolean; unsetLabel: string; label: string; options: { value: string; label: string }[] }>()
const emit = defineEmits<{ change: [values: string[], unset: boolean] }>()
const rail = ref<HTMLElement>()
const expanded = ref(false)
const overflowing = ref(false)
let observer: ResizeObserver | undefined
function measure() {
  if (!expanded.value && rail.value) overflowing.value = rail.value.scrollWidth > rail.value.clientWidth + 1
}
watch(() => props.options, async () => { await nextTick(); measure() }, { deep: true })
async function toggle() {
  expanded.value = !expanded.value
  await nextTick()
  if (rail.value) rail.value.scrollLeft = 0
  measure()
}
onMounted(() => { observer = new ResizeObserver(measure); if (rail.value) observer.observe(rail.value); measure() })
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="selection-options" :class="{ 'is-expanded': expanded }" role="group" :aria-label="label">
    <div ref="rail" class="selection-options__rail" tabindex="0" :aria-label="label">
      <div class="selection-options__defaults">
        <el-check-tag :checked="!modelValue.length && !unset" @change="emit('change', [], false)">全部</el-check-tag>
        <el-checkbox :model-value="unset" @change="emit('change', [], Boolean($event))">{{ unsetLabel }}</el-checkbox>
      </div>
      <ExternalAccountTagSelect v-if="options.length" :model-value="modelValue" :label="`${label}选项`" :options="options" @update:model-value="emit('change', $event, false)" />
    </div>
    <el-button v-if="overflowing || expanded" link type="primary" class="selection-options__toggle" :icon="expanded ? ChevronUp : ChevronDown" :aria-expanded="expanded" @click="toggle">{{ expanded ? '收起' : '展开全部' }}</el-button>
  </div>
</template>

<style scoped>
.selection-options { display: flex; align-items: flex-start; gap: 8px; width: 100%; min-width: 0; }
.selection-options__rail { display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1; overflow-x: auto; scrollbar-width: thin; }
.selection-options__rail:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.selection-options__defaults { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
.selection-options__defaults :deep(.el-checkbox) { margin: 0; }
.selection-options__toggle { flex-shrink: 0; height: 36px; margin: 0; }
.selection-options:not(.is-expanded) :deep(.group-tags) { flex-wrap: nowrap; flex-shrink: 0; width: max-content; max-height: none; overflow: visible; }
.selection-options:not(.is-expanded) :deep(.group-tags__item) { flex-shrink: 0; max-width: none; }
.selection-options:not(.is-expanded) :deep(.el-checkbox__label) { white-space: nowrap; }
.is-expanded .selection-options__rail { flex-wrap: wrap; overflow: visible; }
.is-expanded :deep(.group-tags) { max-height: none; overflow: visible; }
</style>
