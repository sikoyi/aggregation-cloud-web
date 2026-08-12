<script setup lang="ts">
import { ShieldX } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <section class="forbidden-page">
    <div class="forbidden-page__icon">
      <ShieldX :size="30" />
    </div>
    <div>
      <div class="forbidden-page__code">403</div>
      <h1>没有访问权限</h1>
      <p>当前账号没有访问此页面的权限，请联系超级管理员调整角色权限。</p>
      <el-button type="primary" @click="router.push('/')">返回工作台</el-button>
    </div>
  </section>
</template>

<style scoped>
.forbidden-page {
  display: flex;
  min-height: 420px;
  align-items: center;
  justify-content: center;
  gap: 22px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #fff;
  text-align: left;
}
.forbidden-page__icon {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border-radius: 8px;
  color: #b42318;
  background: #fff1f0;
}
.forbidden-page__code { color: #1f668f; font-size: 13px; font-weight: 700; }
h1 { margin: 4px 0 8px; color: #1f2933; font-size: 24px; }
p { margin: 0 0 20px; color: #66788a; font-size: 14px; }
</style>
