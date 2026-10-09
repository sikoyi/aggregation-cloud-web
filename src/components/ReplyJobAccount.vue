<script setup lang="ts">
import { computed } from 'vue'
import { UserRound } from 'lucide-vue-next'
import { externalAvatarUrl } from '@/utils/externalAvatar'
import type { AnyRecord } from '@/types/api'

const props = defineProps<{ job: AnyRecord }>()
const username = computed(() => String(props.job.operator_account_username || '').replace(/^@+/, ''))
</script>

<template>
  <section class="reply-account">
    <el-avatar :size="40" :src="externalAvatarUrl(job.operator_account_avatar_url)"><UserRound :size="20" /></el-avatar>
    <div class="reply-account__text">
    <strong>{{ job.operator_account_name || job.operator_account_id }}</strong>
    <span v-if="username" class="reply-account__username">@{{ username }}</span>
    </div>
  </section>
</template>

<style scoped>
.reply-account { display: flex; align-items: center; gap: 10px; min-width: 0; }
.reply-account :deep(.el-avatar) { flex-shrink: 0; background: var(--app-surface-muted, #eaf4fb); color: var(--app-blue, #316589); }
.reply-account__text { display: flex; flex-direction: column; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
.reply-account strong { color: var(--app-text, #243548); }
.reply-account__username { color: var(--app-text-muted, #66788a); font-size: 12px; }
</style>
