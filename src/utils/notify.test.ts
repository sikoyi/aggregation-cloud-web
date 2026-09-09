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

  it('将任务执行模式的枚举报错转换为可操作的中文', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [{ type: 'literal_error', loc: ['body', 'execution_mode'], msg: "Input should be 'immediate' or 'scheduled'" }],
    })
    expect(getErrorMessage(error)).toBe('执行模式无效，请选择“立即执行”或“计划执行”')
  })

  it('兼容不带错误类型的历史枚举响应', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [{ loc: ['body', 'execution_mode'], msg: "Input should be 'immediate' or 'scheduled'" }],
    })
    expect(getErrorMessage(error)).toBe('执行模式无效，请选择“立即执行”或“计划执行”')
  })

  it('任务字段缺失时明确提示字段，重复错误只展示一次', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [
        { type: 'missing', loc: ['body', 'template_id'], msg: 'Field required' },
        { type: 'missing', loc: ['body', 'template_id'], msg: 'Field required' },
        { type: 'missing', loc: ['body', 'execution_mode'], msg: 'Field required' },
      ],
    })
    expect(getErrorMessage(error)).toBe('请选择任务模板；请选择执行模式（立即执行或计划执行）')
  })

  it('说明计划时间和执行次数格式错误，不回显输入值', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [
        { type: 'datetime_from_date_parsing', loc: ['body', 'scheduled_at'], msg: 'Invalid datetime', input: 'private-input' },
        { type: 'greater_than_equal', loc: ['body', 'execution_count'], msg: 'Input should be greater than or equal to 1' },
      ],
    })
    expect(getErrorMessage(error)).toBe('计划执行时间格式不正确，请重新选择；每个目标执行次数必须为 1 至 1000 的整数')
  })

  it('不覆盖业务中文错误或嵌套脚本参数的同名字段', () => {
    const error = new ApiError('请求参数校验失败', 422, 42200, {
      errors: [
        { type: 'value_error', loc: ['body', 'execution_mode'], msg: 'Value error, 该任务不支持计划执行' },
        { type: 'literal_error', loc: ['body', 'params', 'execution_mode'], msg: '脚本模式不正确' },
      ],
    })
    expect(getErrorMessage(error)).toBe('该任务不支持计划执行；脚本模式不正确')
  })
})
