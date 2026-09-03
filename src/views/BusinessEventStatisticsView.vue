<script setup lang="ts">
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FolderCog,
  Plus,
  RefreshCw,
  SquarePen,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import {
  createBusinessEventProject,
  createBusinessEventType,
  getBusinessEventStatistics,
  listBusinessEventProjects,
  listBusinessEventTypes,
  updateBusinessEventProject,
  updateBusinessEventType,
  type BusinessEventPeriod,
  type BusinessEventProject,
  type BusinessEventProjectPayload,
  type BusinessEventStatistics,
  type BusinessEventStatus,
  type BusinessEventType,
  type BusinessEventTypePayload,
} from '@/api/businessEvents'
import { useAuthStore } from '@/stores/auth'
import {
  businessEventTrendMaximum,
  flattenBusinessEventStatistics,
} from '@/utils/businessEvents'
import { notifyError } from '@/utils/notify'

const auth = useAuthStore()
const activeTab = ref('overview')
const loading = ref(false)
const projectLoading = ref(false)
const typeLoading = ref(false)
const saving = ref(false)
const period = ref<BusinessEventPeriod>('today')
const statisticsProjectId = ref('')
const statistics = ref<BusinessEventStatistics | null>(null)
const projects = ref<BusinessEventProject[]>([])
const eventTypes = ref<BusinessEventType[]>([])
const selectedProjectInternalId = ref('')
const projectDialogVisible = ref(false)
const typeDialogVisible = ref(false)
const editingProject = ref<BusinessEventProject | null>(null)
const editingType = ref<BusinessEventType | null>(null)

const periodOptions: { label: string; value: BusinessEventPeriod }[] = [
  { label: '今日', value: 'today' },
  { label: '近 3 天', value: '3d' },
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
]

const projectForm = reactive<BusinessEventProjectPayload>({
  project_id: '',
  name: '',
  description: '',
  status: 'active',
})
const typeForm = reactive<BusinessEventTypePayload>({
  event_id: '',
  name: '',
  description: '',
  status: 'active',
  sort_order: 0,
})

const canManage = computed(() => auth.can('event_statistics.manage'))
const selectedProject = computed(() => (
  projects.value.find((item) => item.id === selectedProjectInternalId.value) || null
))
const statisticsRows = computed(() => flattenBusinessEventStatistics(statistics.value?.projects || []))
const trendMaximum = computed(() => businessEventTrendMaximum(statistics.value))
const periodLabel = computed(() => (
  periodOptions.find((item) => item.value === period.value)?.label || '当前周期'
))

function statusLabel(status: BusinessEventStatus) {
  return status === 'active' ? '启用' : '停用'
}

function trendBarHeight(value: number) {
  if (value <= 0) return '2px'
  return `${Math.max(8, Math.round((value / trendMaximum.value) * 112))}px`
}

async function loadProjects() {
  projectLoading.value = true
  try {
    const rows = await listBusinessEventProjects()
    projects.value = rows
    if (!rows.some((item) => item.id === selectedProjectInternalId.value)) {
      selectedProjectInternalId.value = rows[0]?.id || ''
    }
  } catch (error) {
    notifyError(error, '加载失败', '无法加载事件项目')
  } finally {
    projectLoading.value = false
  }
}

async function loadEventTypes() {
  if (!selectedProjectInternalId.value) {
    eventTypes.value = []
    return
  }
  typeLoading.value = true
  try {
    eventTypes.value = await listBusinessEventTypes(selectedProjectInternalId.value)
  } catch (error) {
    notifyError(error, '加载失败', '无法加载事件类型')
  } finally {
    typeLoading.value = false
  }
}

async function loadStatistics() {
  loading.value = true
  try {
    statistics.value = await getBusinessEventStatistics(
      period.value,
      statisticsProjectId.value || undefined,
    )
  } catch (error) {
    notifyError(error, '加载失败', '无法加载事件统计')
  } finally {
    loading.value = false
  }
}

async function refreshCurrent() {
  if (activeTab.value === 'overview') {
    await Promise.all([loadProjects(), loadStatistics()])
    return
  }
  await loadProjects()
  await loadEventTypes()
}

function selectProject(row: BusinessEventProject) {
  selectedProjectInternalId.value = row.id
}

function openCreateProject() {
  editingProject.value = null
  Object.assign(projectForm, {
    project_id: '',
    name: '',
    description: '',
    status: 'active' as BusinessEventStatus,
  })
  projectDialogVisible.value = true
}

function openEditProject(tableRow: unknown) {
  const row = tableRow as BusinessEventProject
  editingProject.value = row
  Object.assign(projectForm, {
    project_id: row.project_id,
    name: row.name,
    description: row.description || '',
    status: row.status,
  })
  projectDialogVisible.value = true
}

async function saveProject() {
  if (!projectForm.project_id.trim() || !projectForm.name.trim()) {
    ElMessage.warning('请填写项目 ID 和项目名称')
    return
  }
  saving.value = true
  try {
    if (editingProject.value) {
      await updateBusinessEventProject(editingProject.value.id, {
        name: projectForm.name.trim(),
        description: projectForm.description?.trim() || null,
        status: projectForm.status,
      })
      ElMessage.success('事件项目已保存')
    } else {
      const created = await createBusinessEventProject({
        ...projectForm,
        project_id: projectForm.project_id.trim().toLowerCase(),
        name: projectForm.name.trim(),
        description: projectForm.description?.trim() || null,
      })
      selectedProjectInternalId.value = created.id
      ElMessage.success('事件项目已创建')
    }
    projectDialogVisible.value = false
    await loadProjects()
    await loadEventTypes()
  } catch (error) {
    notifyError(error, '保存失败', '无法保存事件项目')
  } finally {
    saving.value = false
  }
}

function openCreateType() {
  if (!selectedProject.value) {
    ElMessage.warning('请先选择事件项目')
    return
  }
  editingType.value = null
  Object.assign(typeForm, {
    event_id: '',
    name: '',
    description: '',
    status: 'active' as BusinessEventStatus,
    sort_order: 0,
  })
  typeDialogVisible.value = true
}

function openEditType(tableRow: unknown) {
  const row = tableRow as BusinessEventType
  editingType.value = row
  Object.assign(typeForm, {
    event_id: row.event_id,
    name: row.name,
    description: row.description || '',
    status: row.status,
    sort_order: row.sort_order,
  })
  typeDialogVisible.value = true
}

async function saveType() {
  if (!selectedProject.value) return
  if (!typeForm.event_id.trim() || !typeForm.name.trim()) {
    ElMessage.warning('请填写事件 ID 和事件名称')
    return
  }
  saving.value = true
  try {
    if (editingType.value) {
      await updateBusinessEventType(editingType.value.id, {
        name: typeForm.name.trim(),
        description: typeForm.description?.trim() || null,
        status: typeForm.status,
        sort_order: typeForm.sort_order,
      })
      ElMessage.success('事件类型已保存')
    } else {
      await createBusinessEventType(selectedProject.value.id, {
        ...typeForm,
        event_id: typeForm.event_id.trim().toLowerCase(),
        name: typeForm.name.trim(),
        description: typeForm.description?.trim() || null,
      })
      ElMessage.success('事件类型已创建')
    }
    typeDialogVisible.value = false
    await Promise.all([loadEventTypes(), loadProjects()])
  } catch (error) {
    notifyError(error, '保存失败', '无法保存事件类型')
  } finally {
    saving.value = false
  }
}

watch(period, loadStatistics)
watch(statisticsProjectId, loadStatistics)
watch(selectedProjectInternalId, () => {
  if (activeTab.value === 'configuration') void loadEventTypes()
})
watch(activeTab, (value) => {
  if (value === 'configuration') void loadEventTypes()
})

onMounted(async () => {
  await Promise.all([loadProjects(), loadStatistics()])
})
</script>

<template>
  <section class="event-page">
    <el-card shadow="never" class="event-page__workspace">
      <template #header>
        <div class="page-header">
          <div class="page-title">
            <span class="page-title__icon"><BarChart3 :size="19" /></span>
            <div>
              <h1>事件统计</h1>
              <p>集中统计脚本业务事件，快速识别注册及任务执行中的主要异常。</p>
            </div>
          </div>
          <el-tooltip content="刷新当前数据" placement="bottom">
            <el-button
              circle
              :icon="RefreshCw"
              :loading="loading || projectLoading || typeLoading"
              @click="refreshCurrent"
            />
          </el-tooltip>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="event-tabs">
        <el-tab-pane label="统计概览" name="overview">
          <div class="overview-toolbar">
            <el-radio-group v-model="period" size="small">
              <el-radio-button
                v-for="item in periodOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </el-radio-button>
            </el-radio-group>
            <el-select
              v-model="statisticsProjectId"
              clearable
              filterable
              placeholder="全部事件项目"
              class="project-filter"
            >
              <el-option
                v-for="item in projects"
                :key="item.id"
                :label="item.name"
                :value="item.project_id"
              />
            </el-select>
            <span class="timezone-note">统计时区：中国标准时间（UTC+8）</span>
          </div>

          <div class="summary-strip" v-loading="loading">
            <div class="summary-item summary-item--blue">
              <span class="summary-item__icon"><Activity :size="18" /></span>
              <div><small>{{ periodLabel }}事件数</small><strong>{{ statistics?.event_count || 0 }}</strong></div>
            </div>
            <div class="summary-item summary-item--green">
              <span class="summary-item__icon"><ClipboardCheck :size="18" /></span>
              <div><small>受影响任务数</small><strong>{{ statistics?.affected_task_count || 0 }}</strong></div>
            </div>
            <div class="summary-item summary-item--amber">
              <span class="summary-item__icon"><FolderCog :size="18" /></span>
              <div><small>产生事件的项目</small><strong>{{ statistics?.project_count || 0 }}</strong></div>
            </div>
          </div>

          <section class="overview-section">
            <div class="section-heading">
              <div><h2>每日趋势</h2><p>事件次数与受影响任务数按自然日汇总。</p></div>
            </div>
            <div v-if="statistics?.daily.length" class="trend-chart">
              <div
                v-for="item in statistics.daily"
                :key="item.date"
                class="trend-column"
              >
                <div class="trend-column__values">
                  <strong>{{ item.event_count }}</strong>
                  <small>{{ item.affected_task_count }} 个任务</small>
                </div>
                <el-tooltip :content="`${item.date}：${item.event_count} 次事件，影响 ${item.affected_task_count} 个任务`">
                  <span class="trend-column__bar" :style="{ height: trendBarHeight(item.event_count) }" />
                </el-tooltip>
                <span class="trend-column__date">{{ item.date.slice(5) }}</span>
              </div>
            </div>
            <el-empty v-else description="当前周期暂无事件" :image-size="72" />
          </section>

          <section class="overview-section overview-section--table">
            <div class="section-heading">
              <div><h2>事件分布</h2><p>按事件项目和事件类型查看发生次数。</p></div>
            </div>
            <el-table :data="statisticsRows" v-loading="loading" border stripe row-key="key">
              <el-table-column label="事件项目" min-width="190">
                <template #default="{ row }">
                  <div class="identity-cell"><strong>{{ row.projectName }}</strong><small>{{ row.projectId }}</small></div>
                </template>
              </el-table-column>
              <el-table-column label="事件类型" min-width="220">
                <template #default="{ row }">
                  <div class="identity-cell"><strong>{{ row.eventName }}</strong><small>{{ row.eventId }}</small></div>
                </template>
              </el-table-column>
              <el-table-column prop="eventCount" label="事件次数" width="150" align="center" />
              <el-table-column prop="affectedTaskCount" label="受影响任务数" width="170" align="center" />
            </el-table>
          </section>
        </el-tab-pane>

        <el-tab-pane label="事件配置" name="configuration">
          <div class="configuration-layout">
            <section class="configuration-panel configuration-panel--projects">
              <div class="section-heading section-heading--actions">
                <div><h2>事件项目</h2><p>项目 ID 创建后不可修改，供脚本长期使用。</p></div>
                <el-button v-if="canManage" type="primary" :icon="Plus" @click="openCreateProject">新增项目</el-button>
              </div>
              <el-table
                :data="projects"
                v-loading="projectLoading"
                border
                highlight-current-row
                row-key="id"
                :current-row-key="selectedProjectInternalId"
                @row-click="selectProject"
              >
                <el-table-column label="项目信息" min-width="210">
                  <template #default="{ row }">
                    <div class="identity-cell"><strong>{{ row.name }}</strong><small>{{ row.project_id }}</small></div>
                  </template>
                </el-table-column>
                <el-table-column label="事件类型" prop="event_type_count" width="90" align="center" />
                <el-table-column label="状态" width="78" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="light">
                      {{ statusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column v-if="canManage" label="操作" width="68" align="center">
                  <template #default="{ row }">
                    <el-tooltip content="编辑项目">
                      <el-button text circle :icon="SquarePen" @click.stop="openEditProject(row)" />
                    </el-tooltip>
                  </template>
                </el-table-column>
              </el-table>
            </section>

            <section class="configuration-panel configuration-panel--types">
              <div class="section-heading section-heading--actions">
                <div>
                  <h2>{{ selectedProject ? `${selectedProject.name} · 事件类型` : '事件类型' }}</h2>
                  <p>{{ selectedProject ? `项目 ID：${selectedProject.project_id}` : '请先选择左侧事件项目。' }}</p>
                </div>
                <el-button
                  v-if="canManage"
                  type="primary"
                  :icon="Plus"
                  :disabled="!selectedProject"
                  @click="openCreateType"
                >
                  新增事件类型
                </el-button>
              </div>
              <el-table :data="eventTypes" v-loading="typeLoading" border stripe row-key="id">
                <el-table-column label="事件信息" min-width="220">
                  <template #default="{ row }">
                    <div class="identity-cell"><strong>{{ row.name }}</strong><small>{{ row.event_id }}</small></div>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="说明" min-width="190" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.description || '-' }}</template>
                </el-table-column>
                <el-table-column prop="sort_order" label="排序" width="74" align="center" />
                <el-table-column label="状态" width="78" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="light">
                      {{ statusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column v-if="canManage" label="操作" width="68" align="center">
                  <template #default="{ row }">
                    <el-tooltip content="编辑事件类型">
                      <el-button text circle :icon="SquarePen" @click="openEditType(row)" />
                    </el-tooltip>
                  </template>
                </el-table-column>
              </el-table>
            </section>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="projectDialogVisible"
      :title="editingProject ? '编辑事件项目' : '新增事件项目'"
      width="520px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="项目 ID" required>
          <el-input
            v-model="projectForm.project_id"
            :disabled="Boolean(editingProject)"
            maxlength="64"
            placeholder="例如 threads_registration"
          />
          <div class="form-tip">仅支持小写字母、数字和下划线，创建后不可修改。</div>
        </el-form-item>
        <el-form-item label="项目名称" required>
          <el-input v-model="projectForm.name" maxlength="120" placeholder="例如 Threads 注册" />
        </el-form-item>
        <el-form-item label="项目说明">
          <el-input v-model="projectForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="项目状态" required>
          <el-radio-group v-model="projectForm.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="projectDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveProject">确认保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="typeDialogVisible"
      :title="editingType ? '编辑事件类型' : '新增事件类型'"
      width="540px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="所属项目">
          <el-input :model-value="selectedProject?.name || '-'" disabled />
        </el-form-item>
        <el-form-item label="事件 ID" required>
          <el-input
            v-model="typeForm.event_id"
            :disabled="Boolean(editingType)"
            maxlength="64"
            placeholder="例如 sms_code_timeout"
          />
          <div class="form-tip">脚本上报使用该值，创建后不可修改。</div>
        </el-form-item>
        <el-form-item label="事件名称" required>
          <el-input v-model="typeForm.name" maxlength="120" placeholder="例如 验证码超时" />
        </el-form-item>
        <el-form-item label="事件说明">
          <el-input v-model="typeForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="排序" required>
            <el-input-number v-model="typeForm.sort_order" :min="0" :max="100000" controls-position="right" />
          </el-form-item>
          <el-form-item label="事件状态" required>
            <el-radio-group v-model="typeForm.status">
              <el-radio-button value="active">启用</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="typeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveType">确认保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.event-page { min-width: 0; }
.event-page__workspace { border-color: #dfe7ef; border-radius: 8px; }
.event-page__workspace :deep(.el-card__header) { padding: 0; }
.event-page__workspace :deep(.el-card__body) { padding: 0 16px 16px; }
.page-header,
.page-title,
.overview-toolbar,
.section-heading,
.section-heading--actions,
.summary-item { display: flex; align-items: center; }
.page-header { justify-content: space-between; gap: 16px; padding: 13px 16px; }
.page-title { gap: 11px; }
.page-title__icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 7px; background: #eef6fb; color: #176b9b; }
.page-title h1,
.section-heading h2 { margin: 0; color: #172b3f; letter-spacing: 0; }
.page-title h1 { font-size: 17px; }
.page-title p,
.section-heading p { margin: 3px 0 0; color: #718096; font-size: 12px; }
.event-tabs :deep(.el-tabs__header) { margin-bottom: 14px; }
.overview-toolbar { flex-wrap: wrap; gap: 10px; padding: 2px 0 12px; }
.project-filter { width: 230px; }
.timezone-note { margin-left: auto; color: #8190a0; font-size: 11px; }
.summary-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid #dfe7ef; background: #f8fafc; }
.summary-item { min-height: 84px; gap: 12px; padding: 14px 18px; border-right: 1px solid #dfe7ef; }
.summary-item:last-child { border-right: 0; }
.summary-item__icon { display: inline-flex; width: 34px; height: 34px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 7px; }
.summary-item small,
.summary-item strong { display: block; }
.summary-item small { color: #6f8090; font-size: 12px; }
.summary-item strong { margin-top: 5px; color: #172b3f; font-size: 24px; line-height: 1; }
.summary-item--blue .summary-item__icon { background: #e8f3fb; color: #176b9b; }
.summary-item--green .summary-item__icon { background: #e9f7ee; color: #27824c; }
.summary-item--amber .summary-item__icon { background: #fff5df; color: #b56c13; }
.overview-section { margin-top: 14px; border: 1px solid #dfe7ef; }
.section-heading { min-height: 58px; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #e6edf3; background: #f8fafc; }
.section-heading h2 { font-size: 14px; }
.trend-chart { display: flex; min-height: 188px; align-items: flex-end; gap: 8px; overflow-x: auto; padding: 18px 16px 12px; }
.trend-column { display: flex; min-width: 42px; flex: 1 0 42px; flex-direction: column; align-items: center; justify-content: flex-end; }
.trend-column__values { display: flex; min-height: 38px; flex-direction: column; align-items: center; justify-content: flex-end; white-space: nowrap; }
.trend-column__values strong { color: #27445f; font-size: 12px; }
.trend-column__values small { color: #8a99a8; font-size: 9px; }
.trend-column__bar { display: block; width: min(24px, 68%); margin-top: 6px; border-radius: 3px 3px 0 0; background: #4385aa; transition: height .2s ease; }
.trend-column__date { margin-top: 6px; color: #718096; font-size: 10px; }
.overview-section--table :deep(.el-table) { border-top: 0; }
.identity-cell { min-width: 0; }
.identity-cell strong,
.identity-cell small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.identity-cell strong { color: #20364c; font-size: 12px; }
.identity-cell small { margin-top: 4px; color: #8291a0; font-size: 10px; }
.configuration-layout { display: grid; grid-template-columns: minmax(360px, .85fr) minmax(520px, 1.5fr); gap: 12px; }
.configuration-panel { min-width: 0; border: 1px solid #dfe7ef; }
.section-heading--actions { align-items: center; }
.form-tip { margin-top: 5px; color: #8794a2; font-size: 11px; line-height: 1.5; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-grid :deep(.el-input-number) { width: 100%; }

@media (max-width: 1100px) {
  .configuration-layout { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .page-header,
  .section-heading--actions { align-items: flex-start; }
  .overview-toolbar { align-items: stretch; }
  .project-filter { width: 100%; }
  .timezone-note { width: 100%; margin-left: 0; }
  .summary-strip,
  .form-grid { grid-template-columns: 1fr; }
  .summary-item { border-right: 0; border-bottom: 1px solid #dfe7ef; }
  .summary-item:last-child { border-bottom: 0; }
}
</style>
