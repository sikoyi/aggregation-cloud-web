<script setup lang="ts">
import { Database, Download, Eye, Plus, RefreshCw, Trash2, Upload } from 'lucide-vue-next'
import { ElMessage, ElMessageBox, ElNotification, type UploadFile } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

import {
  createRegistrationResourceTemplate,
  deleteRegistrationResourceBatch,
  downloadRegistrationResourceTemplate,
  importRegistrationResourceBatch,
  listRegistrationResourceBatches,
  listRegistrationResourceItems,
  listRegistrationResourceTemplates,
  updateRegistrationResourceTemplate,
  type RegistrationResourceBatch,
  type RegistrationResourceItem,
  type RegistrationResourceTemplate,
  type RegistrationResourceTemplateField,
} from '@/api/registrationResources'
import { ApiError } from '@/api/http'
import { businessPlatformOptions, businessPlatformLabel } from '@/config/options'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const activeTab = ref('batches')
const loading = ref(false)
const templates = ref<RegistrationResourceTemplate[]>([])
const batches = ref<RegistrationResourceBatch[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', template_id: '', availability: '' })

const importVisible = ref(false)
const importSubmitting = ref(false)
const importForm = reactive({ template_id: '', batch_name: '', file: null as File | null })

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailBatch = ref<RegistrationResourceBatch | null>(null)
const detailItems = ref<RegistrationResourceItem[]>([])
const detailTotal = ref(0)
const detailPage = ref(1)
const detailPageSize = ref(20)
const detailStatus = ref('')

const templateVisible = ref(false)
const templateSubmitting = ref(false)
const templateForm = reactive({
  template_key: '',
  version: 1,
  name: '',
  business_platform: 'shopify',
  description: '',
  fields: [] as RegistrationResourceTemplateField[],
})

const canManageTemplates = computed(() => auth.can('registration_resources.manage_templates'))
const enabledTemplates = computed(() => templates.value.filter((item) => item.status === 'enabled'))
const detailTemplate = computed(() => templates.value.find((item) => item.id === detailBatch.value?.template_id))
const detailFields = computed(() => detailTemplate.value?.fields || [])
const detailValidationErrors = computed(() => (
  detailBatch.value?.validation_errors || []
).slice(0, 20))

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function templateLabel(template: RegistrationResourceTemplate) {
  return `${template.name} v${template.version}`
}

function importErrorMessage(error: unknown) {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== 'object') {
    return error instanceof Error ? error.message : '请检查文件内容'
  }
  const errors = (error.data as { errors?: Array<{ row_number?: number; errors?: string[] }> }).errors
  if (!Array.isArray(errors) || !errors.length) return error.message
  const details = errors
    .slice(0, 3)
    .map((item) => `第 ${item.row_number || '-'} 行：${(item.errors || []).join('、')}`)
    .join('；')
  return `${error.message}。${details}`
}

async function loadTemplates() {
  templates.value = await listRegistrationResourceTemplates()
}

async function loadBatches() {
  loading.value = true
  try {
    const data = await listRegistrationResourceBatches({
      keyword: filters.keyword || undefined,
      template_id: filters.template_id || undefined,
      availability: filters.availability || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    batches.value = data.items
    total.value = data.total
  } catch (error) {
    ElNotification.error({ title: '加载失败', message: error instanceof Error ? error.message : '注册资源加载失败' })
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await loadTemplates()
  await loadBatches()
}

function search() {
  page.value = 1
  void loadBatches()
}

function resetFilters() {
  filters.keyword = ''
  filters.template_id = ''
  filters.availability = ''
  search()
}

function changeBatchPage() {
  void loadBatches()
}

function changeDetailPage() {
  void loadDetailItems()
}

function filterDetailItems() {
  detailPage.value = 1
  void loadDetailItems()
}

function openImport() {
  importForm.template_id = enabledTemplates.value[0]?.id || ''
  importForm.batch_name = ''
  importForm.file = null
  importVisible.value = true
}

function selectImportFile(uploadFile: UploadFile) {
  importForm.file = uploadFile.raw || null
}

async function downloadTemplate(templateId?: string) {
  const selected = templates.value.find((item) => item.id === templateId)
    || enabledTemplates.value[0]
  if (!selected) {
    ElMessage.warning('暂无可下载的注册资源模板')
    return
  }
  try {
    await downloadRegistrationResourceTemplate(selected)
  } catch (error) {
    ElNotification.error({ title: '下载失败', message: error instanceof Error ? error.message : '模板下载失败' })
  }
}

async function submitImport() {
  if (!importForm.template_id) {
    ElMessage.warning('请选择注册资源模板')
    return
  }
  if (!importForm.file) {
    ElMessage.warning('请选择要导入的 Excel 文件')
    return
  }
  const formData = new FormData()
  formData.append('template_id', importForm.template_id)
  formData.append('batch_name', importForm.batch_name)
  formData.append('file', importForm.file)
  importSubmitting.value = true
  try {
    const result = await importRegistrationResourceBatch(formData)
    importVisible.value = false
    await loadBatches()
    ElNotification.success({
      title: '导入完成',
      message: result.invalid_count
        ? `成功 ${result.imported_count} 条，跳过 ${result.invalid_count} 条无效资料`
        : `成功导入 ${result.imported_count} 条资料`,
    })
  } catch (error) {
    ElNotification.error({ title: '导入失败', message: importErrorMessage(error), duration: 8000 })
  } finally {
    importSubmitting.value = false
  }
}

async function loadDetailItems() {
  if (!detailBatch.value) return
  detailLoading.value = true
  try {
    const data = await listRegistrationResourceItems(detailBatch.value.id, {
      status: detailStatus.value || undefined,
      page: detailPage.value,
      page_size: detailPageSize.value,
    })
    detailItems.value = data.items
    detailTotal.value = data.total
  } catch (error) {
    ElNotification.error({ title: '加载失败', message: error instanceof Error ? error.message : '资料明细加载失败' })
  } finally {
    detailLoading.value = false
  }
}

function openDetail(rawBatch: unknown) {
  const batch = rawBatch as RegistrationResourceBatch
  detailBatch.value = batch
  detailPage.value = 1
  detailStatus.value = ''
  detailVisible.value = true
  void loadDetailItems()
}

async function removeBatch(rawBatch: unknown) {
  const batch = rawBatch as RegistrationResourceBatch
  await ElMessageBox.confirm(`确认删除批次“${batch.name}”及其中全部未使用资料吗？`, '删除注册资源', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
  try {
    await deleteRegistrationResourceBatch(batch.id)
    ElMessage.success('注册资源批次已删除')
    await loadBatches()
  } catch (error) {
    ElNotification.error({ title: '删除失败', message: error instanceof Error ? error.message : '批次删除失败' })
  }
}

function emptyTemplateField(index: number): RegistrationResourceTemplateField {
  return {
    field_key: '',
    display_name: '',
    data_type: 'string',
    required: true,
    sensitive: false,
    description: '',
    example: '',
    sort_order: (index + 1) * 10,
  }
}

function openTemplateCreate() {
  templateForm.template_key = ''
  templateForm.version = 1
  templateForm.name = ''
  templateForm.business_platform = 'shopify'
  templateForm.description = ''
  templateForm.fields = [emptyTemplateField(0)]
  templateVisible.value = true
}

function addTemplateField() {
  templateForm.fields.push(emptyTemplateField(templateForm.fields.length))
}

function removeTemplateField(index: number) {
  if (templateForm.fields.length <= 1) return
  templateForm.fields.splice(index, 1)
}

async function submitTemplate() {
  if (!templateForm.template_key || !templateForm.name || !templateForm.fields.length) {
    ElMessage.warning('请完整填写模板基本信息和字段')
    return
  }
  if (templateForm.fields.some((item) => !item.field_key || !item.display_name)) {
    ElMessage.warning('每个模板字段都必须填写列名称和字段 Key')
    return
  }
  templateSubmitting.value = true
  try {
    await createRegistrationResourceTemplate({ ...templateForm })
    templateVisible.value = false
    await loadTemplates()
    ElMessage.success('注册资源模板版本已创建')
  } catch (error) {
    ElNotification.error({ title: '创建失败', message: error instanceof Error ? error.message : '模板创建失败' })
  } finally {
    templateSubmitting.value = false
  }
}

async function toggleTemplate(rawTemplate: unknown) {
  const template = rawTemplate as RegistrationResourceTemplate
  try {
    await updateRegistrationResourceTemplate(template.id, {
      status: template.status === 'enabled' ? 'disabled' : 'enabled',
    })
    await loadTemplates()
  } catch (error) {
    ElNotification.error({ title: '保存失败', message: error instanceof Error ? error.message : '模板状态保存失败' })
  }
}

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <section class="registration-resources-page overflow-hidden rounded-md border border-line bg-white">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4">
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <Database class="h-5 w-5" />
        </span>
        <div>
          <h1 class="text-lg font-semibold text-ink">注册资源</h1>
          <p class="mt-0.5 text-xs text-slate-500">按版本化模板导入客户注册资料，任务投递时自动分配。</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <el-button :icon="RefreshCw" circle title="刷新" @click="refreshAll" />
        <el-button :icon="Download" @click="downloadTemplate()">下载模板</el-button>
        <el-button v-if="auth.can('registration_resources.create')" type="primary" :icon="Upload" @click="openImport">导入资源</el-button>
      </div>
    </header>

    <el-tabs v-model="activeTab" class="registration-tabs">
      <el-tab-pane label="资源批次" name="batches">
        <div class="flex flex-wrap items-end gap-3 border-b border-line bg-slate-50 px-4 py-3">
          <label class="filter-field">
            <span>关键词</span>
            <el-input v-model="filters.keyword" clearable placeholder="批次名称 / 文件名" @keyup.enter="search" />
          </label>
          <label class="filter-field">
            <span>资源模板</span>
            <el-select v-model="filters.template_id" clearable filterable placeholder="全部模板">
              <el-option v-for="template in templates" :key="template.id" :label="templateLabel(template)" :value="template.id" />
            </el-select>
          </label>
          <label class="filter-field filter-field--short">
            <span>可用状态</span>
            <el-select v-model="filters.availability" clearable placeholder="全部">
              <el-option label="有可用资料" value="available" />
              <el-option label="已用完" value="exhausted" />
            </el-select>
          </label>
          <el-button @click="resetFilters">清空</el-button>
          <el-button type="primary" @click="search">查询</el-button>
        </div>

        <el-table v-loading="loading" :data="batches" border>
          <el-table-column prop="name" label="批次名称" min-width="190" />
          <el-table-column label="资源模板" min-width="190">
            <template #default="{ row }">
              <div class="font-medium text-slate-800">{{ row.template_name }} v{{ row.template_version }}</div>
            </template>
          </el-table-column>
          <el-table-column label="业务 App" width="130" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ businessPlatformLabel(row.business_platform) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="source_filename" label="导入文件" min-width="200" show-overflow-tooltip />
          <el-table-column label="资源数量" min-width="220" align="center">
            <template #default="{ row }">
              <div class="count-grid">
                <span><b>{{ row.total_count }}</b><small>总数</small></span>
                <span class="text-emerald-700"><b>{{ row.available_count }}</b><small>可用</small></span>
                <span class="text-slate-500"><b>{{ row.used_count }}</b><small>已用</small></span>
                <span v-if="row.invalid_count" class="text-red-600"><b>{{ row.invalid_count }}</b><small>无效</small></span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="导入时间" width="180" align="center">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" fixed="right" class-name="registration-operation-column">
            <template #default="{ row }">
              <div class="operation-actions operation-actions--icons">
                <el-tooltip content="查看资料" placement="top"><el-button text circle :icon="Eye" @click="openDetail(row)" /></el-tooltip>
                <el-tooltip v-if="auth.can('registration_resources.delete')" content="删除批次" placement="top"><el-button text circle type="danger" :icon="Trash2" @click="removeBatch(row)" /></el-tooltip>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="flex justify-end px-4 py-3">
          <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, sizes, prev, pager, next" @current-change="changeBatchPage" @size-change="changeBatchPage" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="模板配置" name="templates">
        <div v-if="canManageTemplates" class="flex justify-end border-b border-line px-4 py-3">
          <el-button type="primary" :icon="Plus" @click="openTemplateCreate">新增模板版本</el-button>
        </div>
        <el-table :data="templates" border>
          <el-table-column prop="name" label="模板名称" min-width="190" />
          <el-table-column prop="template_key" label="模板 Key" min-width="190" />
          <el-table-column prop="version" label="版本" width="90" align="center" />
          <el-table-column label="业务 App" width="130" align="center">
            <template #default="{ row }">{{ businessPlatformLabel(row.business_platform) }}</template>
          </el-table-column>
          <el-table-column label="字段" min-width="280">
            <template #default="{ row }">
              <div class="flex flex-wrap gap-1"><el-tag v-for="field in row.fields" :key="field.field_key" size="small" effect="plain">{{ field.display_name }}</el-tag></div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }"><el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ row.status === 'enabled' ? '启用' : '停用' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="170" align="center">
            <template #default="{ row }">
              <div class="operation-actions">
                <el-button text :icon="Download" @click="downloadTemplate(row.id)">下载</el-button>
                <el-button v-if="canManageTemplates" text @click="toggleTemplate(row)">{{ row.status === 'enabled' ? '停用' : '启用' }}</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="importVisible" title="导入注册资源" width="560px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="注册资源模板" required>
          <el-select v-model="importForm.template_id" class="w-full" filterable>
            <el-option v-for="template in enabledTemplates" :key="template.id" :label="templateLabel(template)" :value="template.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="批次名称">
          <el-input v-model="importForm.batch_name" maxlength="120" placeholder="不填则使用文件名" />
        </el-form-item>
        <el-form-item label="Excel 文件" required>
          <el-upload drag :auto-upload="false" :limit="1" accept=".xlsx" :on-change="selectImportFile">
            <Upload class="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <div class="text-sm text-slate-600">点击或拖入系统模板填写后的 .xlsx 文件</div>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importSubmitting" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" :title="detailBatch ? `${detailBatch.name} · 资料明细` : '资料明细'" size="86%" destroy-on-close>
      <el-alert
        v-if="detailBatch?.invalid_count"
        class="mb-3"
        type="warning"
        :closable="false"
        show-icon
        :title="`导入时已跳过 ${detailBatch.invalid_count} 条无效资料`"
      >
        <template #default>
          <div class="mt-1 max-h-32 space-y-1 overflow-y-auto text-xs">
            <div v-for="item in detailValidationErrors" :key="item.row_number">
              第 {{ item.row_number }} 行：{{ item.errors.join('、') }}
            </div>
            <div v-if="detailBatch.validation_errors.length > detailValidationErrors.length">
              仅展示前 {{ detailValidationErrors.length }} 条错误，请修正原文件后重新导入。
            </div>
          </div>
        </template>
      </el-alert>
      <div class="mb-3 flex items-center justify-between gap-3">
        <el-select v-model="detailStatus" clearable placeholder="全部状态" class="w-36" @change="filterDetailItems">
          <el-option label="未使用" value="unused" />
          <el-option label="已使用" value="used" />
        </el-select>
        <span class="text-sm text-slate-500">共 {{ detailTotal }} 条</span>
      </div>
      <el-table v-loading="detailLoading" :data="detailItems" border max-height="calc(100vh - 230px)">
        <el-table-column prop="row_number" label="Excel 行" width="90" align="center" fixed />
        <el-table-column v-for="field in detailFields" :key="field.field_key" :label="field.display_name" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.payload[field.field_key] || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center" fixed="right">
          <template #default="{ row }"><el-tag :type="row.status === 'used' ? 'info' : 'success'">{{ row.status === 'used' ? '已使用' : '未使用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="任务 ID" width="110" align="center" fixed="right">
          <template #default="{ row }">{{ row.used_task_run_id || '-' }}</template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end py-3">
        <el-pagination v-model:current-page="detailPage" v-model:page-size="detailPageSize" :total="detailTotal" layout="total, sizes, prev, pager, next" @current-change="changeDetailPage" @size-change="changeDetailPage" />
      </div>
    </el-drawer>

    <el-dialog v-model="templateVisible" title="新增注册资源模板版本" width="860px" destroy-on-close>
      <el-form label-position="top">
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="模板 Key" required><el-input v-model="templateForm.template_key" placeholder="例如 shopify_registration" /></el-form-item></el-col>
          <el-col :span="4"><el-form-item label="版本" required><el-input-number v-model="templateForm.version" :min="1" class="w-full" /></el-form-item></el-col>
          <el-col :span="7"><el-form-item label="模板名称" required><el-input v-model="templateForm.name" /></el-form-item></el-col>
          <el-col :span="5"><el-form-item label="业务 App" required><el-select v-model="templateForm.business_platform" class="w-full"><el-option v-for="option in businessPlatformOptions" :key="String(option.value)" :label="option.label" :value="option.value" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item label="说明"><el-input v-model="templateForm.description" type="textarea" :rows="2" /></el-form-item>
        <div class="mb-2 flex items-center justify-between"><span class="text-sm font-semibold text-slate-800">Excel 字段</span><el-button :icon="Plus" @click="addTemplateField">新增字段</el-button></div>
        <div class="max-h-80 space-y-2 overflow-y-auto pr-1">
          <div v-for="(field, index) in templateForm.fields" :key="index" class="field-row">
            <el-input v-model="field.display_name" placeholder="Excel 列名称" />
            <el-input v-model="field.field_key" placeholder="脚本字段 Key" />
            <el-select v-model="field.data_type"><el-option label="文本" value="string" /><el-option label="日期" value="date" /></el-select>
            <el-checkbox v-model="field.required">必填</el-checkbox>
            <el-checkbox v-model="field.sensitive">敏感</el-checkbox>
            <el-input v-model="field.example" placeholder="示例" />
            <el-button text type="danger" :icon="Trash2" :disabled="templateForm.fields.length <= 1" @click="removeTemplateField(index)" />
          </div>
        </div>
      </el-form>
      <template #footer><el-button @click="templateVisible = false">取消</el-button><el-button type="primary" :loading="templateSubmitting" @click="submitTemplate">创建版本</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.registration-tabs :deep(.el-tabs__header) { margin: 0; padding: 0 16px; }
.registration-tabs :deep(.el-tabs__content) { overflow: visible; }
.filter-field { display: grid; gap: 6px; width: 230px; font-size: 12px; color: #64748b; }
.filter-field--short { width: 160px; }
.count-grid { display: flex; justify-content: center; gap: 18px; }
.count-grid span { display: grid; min-width: 34px; line-height: 1.1; }
.count-grid b { font-size: 14px; }
.count-grid small { margin-top: 5px; font-size: 11px; color: #94a3b8; }
.operation-actions { display: inline-flex; align-items: center; justify-content: center; flex-wrap: nowrap; gap: 4px; white-space: nowrap; }
.operation-actions :deep(.el-button) { margin: 0; }
.operation-actions--icons :deep(.el-button) { width: 30px; height: 30px; padding: 0; }
.registration-resources-page :deep(.registration-operation-column .cell) { overflow: visible; text-overflow: clip; white-space: nowrap; }
.field-row { display: grid; grid-template-columns: 1fr 1.2fr 100px 64px 64px 1fr 36px; align-items: center; gap: 8px; }
@media (max-width: 900px) { .field-row { grid-template-columns: 1fr 1fr; } }
</style>
