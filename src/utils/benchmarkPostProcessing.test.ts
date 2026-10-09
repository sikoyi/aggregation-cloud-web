import { describe, expect, it } from 'vitest'
import { postProcessingLabels } from './benchmarkPostProcessing'

const base = { final_content: 'Original', final_media_urls: ['a'], snapshot: { text_content: 'Original', media_urls: ['a'] } }

describe('帖子审核处理标注', () => {
  it('重新缩写与首次缩写区分标注', () => {
    expect(postProcessingLabels({ ...base, system_processing: { ai_shortening: 'succeeded', ai_regenerated: true } })).toEqual([{ label: 'AI 已重新缩写', type: 'warning' }])
  })
  it('区分话题本地化成功与翻译检查失败', () => {
    expect(postProcessingLabels({ ...base, system_processing: { hashtag_localization: true, translation_check: 'succeeded' } }).map(item => item.label)).toEqual(['话题已本地化'])
    expect(postProcessingLabels({ ...base, system_processing: { translation_check: 'failed' } })).toEqual([{ label: '翻译或话题检查失败', type: 'danger' }])
  })
  it('未修改的原帖不显示修改标记', () => expect(postProcessingLabels(base)).toEqual([]))
  it('系统处理和运营修改分别标记', () => {
    const result = postProcessingLabels({ ...base, operator_modified: true, system_processing: {
      translation_language: 'ko', ai_shortening: 'succeeded', image_reduction: { before: 5, after: 2 },
    } })
    expect(result.map(item => item.label)).toEqual(['已翻译 · 韩语', 'AI 已缩写', '系统精简图片 5 → 2', '运营已修改'])
  })
  it('失败不能被标为缩写成功', () => {
    expect(postProcessingLabels({ ...base, system_processing: { ai_shortening: 'failed' } })).toEqual([{ label: 'AI 缩写失败', type: 'danger' }])
  })
  it('历史差异不猜测是 AI 或人工操作', () => {
    expect(postProcessingLabels({ ...base, final_content: 'Changed', final_media_urls: [] }).map(item => item.label)).toEqual(['文案已调整', '媒体已调整'])
  })
})
