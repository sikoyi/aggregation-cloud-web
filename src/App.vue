<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import DeploymentBanner from '@/components/DeploymentBanner.vue'
</script>

<template>
  <el-config-provider :locale="zhCn">
    <DeploymentBanner />
    <RouterView />
  </el-config-provider>
</template>
