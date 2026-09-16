<script setup lang="ts">
import { ref } from 'vue'
import DeviceTableCell from '../../src/components/DeviceTableCell.vue'
import ExternalPostComments from '../../src/components/ExternalPostComments.vue'
const dialog = ref(false)
const state = ref('')
const rows = [{ id: 'preview', display_name: 'P-302', provider_slot_id: 'preview-device', runtime_platform: 'fingerprint_browser', provider: 'morelogin', group_name: '本地测试', status: 'idle' }]
</script>
<template>
  <el-card shadow="never">
    <template #header><div class="flex items-center justify-between"><strong>设备管理</strong><el-button type="primary" @click="dialog = true">查看详情</el-button></div></template>
    <div class="mb-4 flex flex-wrap gap-3">
      <el-input style="width: 220px" placeholder="设备名称" />
      <el-select v-model="state" placeholder="全部状态" style="width: 160px"><el-option label="空闲" value="idle" /><el-option label="运行中" value="running" /></el-select>
      <el-button>查询</el-button><el-button disabled>不可用</el-button>
    </div>
    <el-table :data="rows" border stripe>
      <el-table-column label="设备信息" min-width="180"><template #default="{ row }"><DeviceTableCell kind="deviceIdentity" :row="row" /></template></el-table-column>
      <el-table-column label="所属分组" min-width="130"><template #default="{ row }"><DeviceTableCell kind="deviceGroup" :row="row" /></template></el-table-column>
      <el-table-column label="运行环境" min-width="140"><template #default="{ row }"><DeviceTableCell kind="devicePlatform" :row="row" /></template></el-table-column>
      <el-table-column label="状态" min-width="110"><template #default><el-tag type="success">空闲</el-tag></template></el-table-column>
    </el-table>
    <div class="mt-4 flex gap-3"><el-tag type="danger">失败</el-tag><el-tag type="warning">待审核</el-tag><el-tag type="info">未知</el-tag></div>
  </el-card>
  <el-dialog v-model="dialog" title="详情" width="min(720px, 92vw)">
    <el-alert title="执行失败" type="error" :closable="false" />
    <el-descriptions border class="mt-4"><el-descriptions-item label="设备">P-302</el-descriptions-item></el-descriptions>
    <ExternalPostComments :comments="[{ id: 'demo', author_name: '测试账号', content: '@example 这是一条评论，正文和回复对象分行展示。', like_count: 12 }]" />
    <template #footer><el-button @click="dialog = false">关闭</el-button></template>
  </el-dialog>
</template>
