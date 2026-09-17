<script setup lang="ts">
import { FileCheck2 } from 'lucide-vue-next'
import BenchmarkPostReviews from '@/components/BenchmarkPostReviews.vue'
import TelegramReviewBinding from '@/components/TelegramReviewBinding.vue'
</script>

<template>
  <section class="post-review">
    <header class="post-review__header">
      <div class="post-review__heading">
        <span class="post-review__icon"><FileCheck2 :size="20" /></span>
        <h1>帖子审核</h1>
      </div>
      <TelegramReviewBinding />
    </header>
    <BenchmarkPostReviews />
  </section>
</template>

<style scoped>
.post-review {
  min-width: 0;
  border: 1px solid var(--app-border, #d9e2ec);
  border-radius: 8px;
  background: var(--app-surface, #fff);
}
.post-review__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--app-border, #e6edf3);
}
.post-review__heading { display: flex; align-items: center; gap: 10px; }
.post-review__heading h1 { margin: 0; font-size: 18px; font-weight: 600; }
.post-review__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--app-blue, #1f6f9f);
  background: var(--app-surface-muted, #f7fafc);
}
</style>
