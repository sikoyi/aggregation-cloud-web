<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <el-tooltip :content="isDark ? '切换浅色模式' : '切换暗黑模式'" placement="bottom">
    <el-button
      circle
      :icon="isDark ? Sun : Moon"
      :aria-label="isDark ? '切换浅色模式' : '切换暗黑模式'"
      :aria-pressed="isDark"
      @click="toggleTheme"
    />
  </el-tooltip>
</template>
