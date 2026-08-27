import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/http'
import { getErrorMessage } from './notify'

describe('接口错误提示', () => {
  it('优先展示参数校验的具体业务原因', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [
        {
          msg: 'Value error, 行为配置不正确',
          ctx: {
            error: '随机关注设置为第 3 天开始，但目标养号周期只有 1 天',
          },
        },
      ],
    })

    expect(getErrorMessage(error)).toBe('随机关注设置为第 3 天开始，但目标养号周期只有 1 天')
  })

  it('去除校验错误中的技术前缀', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [{ msg: 'Value error, 浏览最小时长不能大于最大时长' }],
    })

    expect(getErrorMessage(error)).toBe('浏览最小时长不能大于最大时长')
  })

  it('将缺少字段提示转换为中文', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [{ msg: 'Field required', loc: ['body', 'name'] }],
    })

    expect(getErrorMessage(error)).toBe('缺少必填内容')
  })
})
