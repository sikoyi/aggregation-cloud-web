import { expect, it } from 'vitest'
import accountData from './AccountDataView.vue?raw'
import resources from '../config/resources.ts?raw'

it('账号回复和互动生成均提供台湾繁体语言选项', () => {
  const replySelect = accountData.split('label="回复语言"')[1]!.split('</el-select>')[0]!
  expect(replySelect).toContain('label="中国台湾（繁体中文）" value="zh-TW"')
  const generationSelect = resources.split('label: "生成语言"')[1]!.split('key: "ai_tone"')[0]!
  expect(generationSelect).toContain('{ label: "中国台湾（繁体中文）", value: "zh-TW" }')
})
