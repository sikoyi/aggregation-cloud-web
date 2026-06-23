<script setup lang="ts">
import { computed } from 'vue'

import { statusLabel, statusTagType } from '@/utils/format'

const props = defineProps<{
  value: unknown
}>()

const text = computed(() => statusLabel(props.value))
const type = computed(() => statusTagType(props.value))
</script>

<template>
  <el-tag :type="type" effect="light" round>{{ text }}</el-tag>
</template>
