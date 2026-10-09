export interface PostProcessing {
  translation_language?: string
  translation_check?: 'succeeded' | 'failed'
  hashtag_localization?: boolean
  ai_shortening?: 'succeeded' | 'failed'
  ai_regenerated?: boolean
  image_reduction?: { before: number; after: number }
}

const languages: Record<string, string> = {
  en: '英语', ko: '韩语', ja: '日语', es: '西班牙语', fr: '法语', de: '德语',
  pt: '葡萄牙语', it: '意大利语', id: '印尼语', th: '泰语', vi: '越南语',
  ar: '阿拉伯语', hi: '印地语', tr: '土耳其语', 'zh-CN': '简体中文', 'zh-TW': '繁体中文',
}

export function postProcessingLabels(row: {
  system_processing?: PostProcessing; operator_modified?: boolean; final_content: string
  final_media_urls?: string[]; snapshot: { text_content?: string; media_urls?: string[] }
}) {
  const result: { label: string; type: 'info' | 'warning' | 'danger' }[] = []
  const processing = row.system_processing || {}
  if (processing.translation_language) result.push({ label: `已翻译 · ${languages[processing.translation_language] || processing.translation_language}`, type: 'info' })
  if (processing.hashtag_localization) result.push({ label: '话题已本地化', type: 'info' })
  if (processing.translation_check === 'failed') result.push({ label: '翻译或话题检查失败', type: 'danger' })
  if (processing.ai_shortening) result.push({ label: processing.ai_shortening === 'succeeded' ? (processing.ai_regenerated ? 'AI 已重新缩写' : 'AI 已缩写') : 'AI 缩写失败', type: processing.ai_shortening === 'succeeded' ? 'warning' : 'danger' })
  if (processing.image_reduction) result.push({ label: `系统精简图片 ${processing.image_reduction.before} → ${processing.image_reduction.after}`, type: 'warning' })
  if (row.operator_modified) result.push({ label: '运营已修改', type: 'info' })
  if (!result.length) {
    if (row.final_content !== (row.snapshot.text_content || '')) result.push({ label: '文案已调整', type: 'info' })
    if (JSON.stringify(row.final_media_urls || []) !== JSON.stringify(row.snapshot.media_urls || [])) result.push({ label: '媒体已调整', type: 'info' })
  }
  return result
}
