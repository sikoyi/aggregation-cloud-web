<script setup lang="ts">
import { computed } from 'vue'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ job: AnyRecord }>()
const username = computed(() => String(props.job.operator_account_username || '').replace(/^@+/, ''))
</script>

<template>
  <section class="reply-account">
    <strong>{{ job.operator_account_name || job.operator_account_id }}</strong>
    <span v-if="username" class="reply-account__username">@{{ username }}</span>
  </section>
</template>

<style scoped>
.reply-account { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
.reply-account strong { color: var(--app-text, #243548); }
.reply-account__username { color: var(--app-text-muted, #66788a); font-size: 12px; }
</style>
