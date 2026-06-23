import type { SelectOption } from '@/types/crud'

export const businessPlatformOptions: SelectOption[] = [
  { label: 'Threads', value: 'threads' },
  { label: 'X', value: 'x' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: '其他', value: 'other' },
]

export const accountStatusOptions: SelectOption[] = [
  { label: '正常', value: 'normal' },
  { label: '禁用', value: 'disabled' },
  { label: '归档', value: 'archived' },
]

export const loginStatusOptions: SelectOption[] = [
  { label: '未知', value: 'unknown' },
  { label: '已登录', value: 'logged_in' },
  { label: '需要登录', value: 'login_required' },
  { label: '需要 2FA', value: 'twofa_required' },
  { label: '挑战', value: 'challenge' },
  { label: '受限', value: 'restricted' },
  { label: '失败', value: 'failed' },
]

export const enabledStatusOptions: SelectOption[] = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
  { label: '归档', value: 'archived' },
]

export const slotStatusOptions: SelectOption[] = [
  { label: '空闲', value: 'idle' },
  { label: '启动中', value: 'starting' },
  { label: '运行中', value: 'running' },
  { label: '停止中', value: 'stopping' },
  { label: '异常', value: 'error' },
  { label: '离线', value: 'offline' },
  { label: '禁用', value: 'disabled' },
  { label: '归档', value: 'archived' },
]

export const runtimeStatusOptions: SelectOption[] = [
  { label: '在线', value: 'online' },
  { label: '离线', value: 'offline' },
]

export const runtimePlatformOptions: SelectOption[] = [
  { label: '指纹浏览器', value: 'fingerprint_browser' },
  { label: '云手机', value: 'cloud_phone' },
]

export const slotTypeOptions: SelectOption[] = [
  { label: '指纹 Profile', value: 'fingerprint_profile' },
  { label: '云手机设备', value: 'cloud_phone_device' },
]

export const twoFaOptions: SelectOption[] = [
  { label: '无', value: 'none' },
  { label: 'TOTP', value: 'totp' },
  { label: '短信', value: 'sms' },
  { label: '邮箱', value: 'email' },
  { label: '备用码', value: 'backup_code' },
  { label: '人工处理', value: 'manual' },
]

export const taskStatusOptions: SelectOption[] = [
  { label: '草稿', value: 'draft' },
  { label: '排队中', value: 'queued' },
  { label: '等待 Slot', value: 'waiting_slot' },
  { label: '等待 Runtime', value: 'waiting_runtime' },
  { label: '下发中', value: 'dispatching' },
  { label: '运行中', value: 'running' },
  { label: '重试等待', value: 'retry_wait' },
  { label: '限流', value: 'rate_limited' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'canceled' },
  { label: '超时', value: 'expired' },
  { label: '丢失', value: 'lost' },
]

export const scriptParamTypeOptions: SelectOption[] = [
  { label: '字符串', value: 'string' },
  { label: '长文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'bool' },
  { label: '枚举', value: 'enum' },
  { label: '日期时间', value: 'datetime' },
  { label: 'JSON', value: 'json' },
  { label: '资源', value: 'res' },
  { label: '账号', value: 'account' },
  { label: '账号组', value: 'account_group' },
  { label: '内容', value: 'content' },
  { label: '媒体资源', value: 'media_asset' },
  { label: 'Execution Slot', value: 'execution_slot' },
  { label: '密钥', value: 'secret' },
]
