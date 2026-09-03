<script setup lang="ts">
import { FileImage, Film, RotateCcw, Trash2, UploadCloud } from 'lucide-vue-next'
import { ElNotification, type UploadFile } from 'element-plus'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import { uploadMediaAssets, type MediaAssetUploadResult } from '@/api/mediaAssets'
import { useScopedBusinessPlatformOptions } from '@/composables/useScopedBusinessPlatformOptions'
import { mediaAssetStatusOptions, socialBusinessPlatformOptions } from '@/config/options'

interface UploadItem {
  id: string
  file: File
  previewUrl: string
  status: 'pending' | 'uploading' | 'succeeded' | 'failed'
  error: string
}

const emit = defineEmits<{
  completed: [summary: { total: number; succeeded: number; failed: number }]
  'uploading-change': [value: boolean]
}>()

const businessPlatformOptions = useScopedBusinessPlatformOptions(socialBusinessPlatformOptions)
const form = reactive({
  businessPlatform: 'threads',
  status: 'enabled',
  tags: [] as string[],
  remark: '',
})
const items = ref<UploadItem[]>([])
const uploading = ref(false)
const currentFile = ref('')
const supportedMediaExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'm4v', 'mov', 'webm'])

function isSupportedMediaFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const mediaTypeMatches = !file.type || file.type.startsWith('image/') || file.type.startsWith('video/')
  return supportedMediaExtensions.has(extension) && mediaTypeMatches
}

const succeeded = computed(() => items.value.filter((item) => item.status === 'succeeded').length)
const failed = computed(() => items.value.filter((item) => item.status === 'failed').length)
const waiting = computed(() => items.value.filter((item) => item.status === 'pending').length)
const retryable = computed(() => items.value.filter((item) => ['pending', 'failed'].includes(item.status)))
const progress = computed(() => {
  if (!items.value.length) return 0
  return Math.round(((succeeded.value + failed.value) / items.value.length) * 100)
})
const actionLabel = computed(() => failed.value && !waiting.value ? '重试失败文件' : '开始上传')

function fileId(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function previewUrl(file: File) {
  return file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
}

function addFile(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file || items.value.some((item) => item.id === fileId(file))) return
  if (!isSupportedMediaFile(file)) {
    ElNotification.warning({
      title: '不支持该文件',
      message: '仅支持 JPG、PNG、GIF、WebP、MP4、MOV、WebM 图片或视频',
    })
    return
  }
  items.value.push({
    id: fileId(file),
    file,
    previewUrl: previewUrl(file),
    status: 'pending',
    error: '',
  })
}

function removeFile(item: UploadItem) {
  if (uploading.value) return
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  items.value = items.value.filter((candidate) => candidate.id !== item.id)
}

function clearFiles() {
  if (uploading.value) return
  releasePreviews()
  items.value = []
  currentFile.value = ''
}

function releasePreviews() {
  items.value.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

function fileIcon(item: UploadItem) {
  return item.file.type.startsWith('video/') ? Film : FileImage
}

function statusLabel(status: UploadItem['status']) {
  return {
    pending: '等待上传',
    uploading: '上传中',
    succeeded: '已完成',
    failed: '失败',
  }[status]
}

function statusType(status: UploadItem['status']): 'success' | 'danger' | 'primary' | 'info' {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'uploading') return 'primary'
  return 'info'
}

function applyResult(result: MediaAssetUploadResult) {
  const item = items.value.find((candidate) => candidate.id === fileId(result.file))
  if (!item) return
  item.status = result.status
  item.error = result.error || ''
}

async function startUpload() {
  if (!form.businessPlatform) {
    ElNotification.warning({ title: '请选择业务 App', message: '整批素材需要指定所属业务 App' })
    return
  }
  const candidates = retryable.value
  if (!candidates.length) {
    ElNotification.warning({ title: '请选择素材', message: '可一次选择多个图片或视频' })
    return
  }

  uploading.value = true
  emit('uploading-change', true)
  candidates.forEach((item) => {
    item.status = 'pending'
    item.error = ''
  })
  candidates[0].status = 'uploading'
  currentFile.value = candidates[0].file.name
  try {
    const results = await uploadMediaAssets(
      candidates.map((item) => item.file),
      {
        businessPlatform: form.businessPlatform,
        status: form.status,
        tags: form.tags,
        remark: form.remark,
      },
      (result, done) => {
        applyResult(result)
        const next = candidates[done]
        if (next) {
          next.status = 'uploading'
          currentFile.value = next.file.name
        } else {
          currentFile.value = ''
        }
      },
    )
    const successCount = results.filter((result) => result.status === 'succeeded').length
    const failedCount = results.length - successCount
    emit('completed', { total: results.length, succeeded: successCount, failed: failedCount })
  } finally {
    uploading.value = false
    currentFile.value = ''
    emit('uploading-change', false)
  }
}

watch(businessPlatformOptions, (options) => {
  const allowedValues = options.map((option) => String(option.value))
  if (!allowedValues.includes(form.businessPlatform)) {
    form.businessPlatform = allowedValues[0] || ''
  }
}, { immediate: true })

onBeforeUnmount(releasePreviews)
</script>

<template>
  <div class="batch-uploader">
    <section class="batch-uploader__settings">
      <div class="batch-uploader__section-title">整批设置</div>
      <el-form label-position="top">
        <el-row :gutter="14">
          <el-col :xs="24" :md="12">
            <el-form-item label="业务 App" required>
              <el-select v-model="form.businessPlatform" class="w-full" :disabled="uploading">
                <el-option v-for="option in businessPlatformOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" class="w-full" :disabled="uploading">
                <el-option v-for="option in mediaAssetStatusOptions" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="标签">
              <el-select v-model="form.tags" multiple filterable allow-create default-first-option class="w-full" placeholder="输入标签后回车" :disabled="uploading" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="备注">
              <el-input v-model="form.remark" maxlength="500" placeholder="可选，应用到本批全部素材" :disabled="uploading" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </section>

    <el-upload
      drag
      multiple
      action="#"
      :auto-upload="false"
      :show-file-list="false"
      accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.m4v,.mov,.webm,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
      :disabled="uploading"
      :on-change="addFile"
      class="batch-uploader__dropzone"
    >
      <UploadCloud :size="30" />
      <div class="el-upload__text">拖放多个图片或视频到这里，或 <em>选择素材</em></div>
      <template #tip>支持 JPG、PNG、GIF、WebP、MP4、MOV、WebM，素材类型由系统识别。</template>
    </el-upload>

    <section v-if="items.length" class="batch-uploader__queue">
      <header>
        <div>
          <strong>上传队列</strong>
          <span>共 {{ items.length }} 个文件</span>
        </div>
        <el-button text :icon="Trash2" :disabled="uploading" @click="clearFiles">清空</el-button>
      </header>

      <div v-if="uploading || succeeded || failed" class="batch-uploader__progress">
        <div class="batch-uploader__summary">
          <span>总进度 {{ progress }}%</span>
          <el-tag type="success" effect="plain">成功 {{ succeeded }}</el-tag>
          <el-tag v-if="failed" type="danger" effect="plain">失败 {{ failed }}</el-tag>
          <span v-if="currentFile" class="batch-uploader__current">正在处理：{{ currentFile }}</span>
        </div>
        <el-progress :percentage="progress" :stroke-width="8" :show-text="false" />
      </div>

      <div class="batch-uploader__files">
        <article v-for="item in items" :key="item.id" class="batch-file">
          <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.file.name">
          <span v-else class="batch-file__icon"><component :is="fileIcon(item)" :size="20" /></span>
          <div class="batch-file__content">
            <strong :title="item.file.name">{{ item.file.name }}</strong>
            <small>{{ (item.file.size / 1024 / 1024).toFixed(2) }} MB</small>
            <p v-if="item.error">{{ item.error }}</p>
          </div>
          <el-tag :type="statusType(item.status)" effect="plain" size="small">{{ statusLabel(item.status) }}</el-tag>
          <el-button v-if="!uploading && item.status !== 'succeeded'" text circle :icon="Trash2" @click="removeFile(item)" />
        </article>
      </div>
    </section>

    <footer class="batch-uploader__actions">
      <el-button v-if="failed && !waiting" :icon="RotateCcw" :disabled="uploading" @click="startUpload">重试失败文件</el-button>
      <el-button v-else type="primary" :icon="UploadCloud" :loading="uploading" :disabled="!retryable.length" @click="startUpload">
        {{ actionLabel }}
      </el-button>
    </footer>
  </div>
</template>

<style scoped>
.batch-uploader { display: grid; gap: 14px; }
.batch-uploader__settings,
.batch-uploader__queue { padding: 14px; border: 1px solid #dbe4ed; border-radius: 7px; background: #fff; }
.batch-uploader__settings :deep(.el-form-item) { margin-bottom: 8px; }
.batch-uploader__section-title { margin-bottom: 10px; color: #26384a; font-size: 14px; font-weight: 700; }
.batch-uploader__dropzone :deep(.el-upload),
.batch-uploader__dropzone :deep(.el-upload-dragger) { width: 100%; }
.batch-uploader__dropzone :deep(.el-upload-dragger) { padding: 22px; border-radius: 7px; }
.batch-uploader__dropzone svg { margin: 0 auto 8px; color: #3978a2; }
.batch-uploader__queue header,
.batch-uploader__summary,
.batch-uploader__actions,
.batch-file { display: flex; align-items: center; }
.batch-uploader__queue header { justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.batch-uploader__queue header strong { margin-right: 8px; color: #243548; }
.batch-uploader__queue header span { color: #7b8b9b; font-size: 12px; }
.batch-uploader__progress { margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; background: #f5f8fb; }
.batch-uploader__summary { flex-wrap: wrap; gap: 8px; margin-bottom: 8px; color: #52667a; font-size: 12px; }
.batch-uploader__current { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-uploader__files { display: grid; max-height: 320px; overflow-y: auto; border-top: 1px solid #e8edf2; }
.batch-file { min-height: 58px; gap: 10px; padding: 8px 2px; border-bottom: 1px solid #edf1f5; }
.batch-file img,
.batch-file__icon { width: 42px; height: 42px; flex: 0 0 42px; border-radius: 6px; }
.batch-file img { object-fit: cover; }
.batch-file__icon { display: inline-flex; align-items: center; justify-content: center; color: #3978a2; background: #edf6fc; }
.batch-file__content { min-width: 0; flex: 1; }
.batch-file__content strong,
.batch-file__content small { display: block; }
.batch-file__content strong { overflow: hidden; color: #2d4053; text-overflow: ellipsis; white-space: nowrap; }
.batch-file__content small { margin-top: 3px; color: #8a98a8; }
.batch-file__content p { margin: 4px 0 0; color: #d9534f; font-size: 12px; }
.batch-uploader__actions { justify-content: flex-end; }
</style>
