import type { SelectOption } from '@/types/crud'

export const businessPlatformOptions: SelectOption[] = [
  { label: 'Threads', value: 'threads' },
  { label: 'X', value: 'x' },
  { label: 'Instagram', value: 'instagram' },
]

const accountCountryNames = [
  '阿富汗',
  '阿尔巴尼亚',
  '阿尔及利亚',
  '安道尔',
  '安哥拉',
  '安提瓜和巴布达',
  '阿根廷',
  '亚美尼亚',
  '澳大利亚',
  '奥地利',
  '阿塞拜疆',
  '巴哈马',
  '巴林',
  '孟加拉国',
  '巴巴多斯',
  '白俄罗斯',
  '比利时',
  '伯利兹',
  '贝宁',
  '不丹',
  '玻利维亚',
  '波黑',
  '博茨瓦纳',
  '巴西',
  '文莱',
  '保加利亚',
  '布基纳法索',
  '布隆迪',
  '佛得角',
  '柬埔寨',
  '喀麦隆',
  '加拿大',
  '中非',
  '乍得',
  '智利',
  '中国',
  '中国香港',
  '中国澳门',
  '中国台湾',
  '哥伦比亚',
  '科摩罗',
  '刚果（布）',
  '刚果（金）',
  '哥斯达黎加',
  '科特迪瓦',
  '克罗地亚',
  '古巴',
  '塞浦路斯',
  '捷克',
  '丹麦',
  '吉布提',
  '多米尼克',
  '多米尼加共和国',
  '厄瓜多尔',
  '埃及',
  '萨尔瓦多',
  '赤道几内亚',
  '厄立特里亚',
  '爱沙尼亚',
  '斯威士兰',
  '埃塞俄比亚',
  '斐济',
  '芬兰',
  '法国',
  '加蓬',
  '冈比亚',
  '格鲁吉亚',
  '德国',
  '加纳',
  '希腊',
  '格林纳达',
  '危地马拉',
  '几内亚',
  '几内亚比绍',
  '圭亚那',
  '海地',
  '洪都拉斯',
  '匈牙利',
  '冰岛',
  '印度',
  '印度尼西亚',
  '伊朗',
  '伊拉克',
  '爱尔兰',
  '以色列',
  '意大利',
  '牙买加',
  '日本',
  '约旦',
  '哈萨克斯坦',
  '肯尼亚',
  '基里巴斯',
  '朝鲜',
  '韩国',
  '科威特',
  '吉尔吉斯斯坦',
  '老挝',
  '拉脱维亚',
  '黎巴嫩',
  '莱索托',
  '利比里亚',
  '利比亚',
  '列支敦士登',
  '立陶宛',
  '卢森堡',
  '马达加斯加',
  '马拉维',
  '马来西亚',
  '马尔代夫',
  '马里',
  '马耳他',
  '马绍尔群岛',
  '毛里塔尼亚',
  '毛里求斯',
  '墨西哥',
  '密克罗尼西亚',
  '摩尔多瓦',
  '摩纳哥',
  '蒙古',
  '黑山',
  '摩洛哥',
  '莫桑比克',
  '缅甸',
  '纳米比亚',
  '瑙鲁',
  '尼泊尔',
  '荷兰',
  '新西兰',
  '尼加拉瓜',
  '尼日尔',
  '尼日利亚',
  '北马其顿',
  '挪威',
  '阿曼',
  '巴基斯坦',
  '帕劳',
  '巴勒斯坦',
  '巴拿马',
  '巴布亚新几内亚',
  '巴拉圭',
  '秘鲁',
  '菲律宾',
  '波兰',
  '葡萄牙',
  '卡塔尔',
  '罗马尼亚',
  '俄罗斯',
  '卢旺达',
  '圣基茨和尼维斯',
  '圣卢西亚',
  '圣文森特和格林纳丁斯',
  '萨摩亚',
  '圣马力诺',
  '圣多美和普林西比',
  '沙特阿拉伯',
  '塞内加尔',
  '塞尔维亚',
  '塞舌尔',
  '塞拉利昂',
  '新加坡',
  '斯洛伐克',
  '斯洛文尼亚',
  '所罗门群岛',
  '索马里',
  '南非',
  '南苏丹',
  '西班牙',
  '斯里兰卡',
  '苏丹',
  '苏里南',
  '瑞典',
  '瑞士',
  '叙利亚',
  '塔吉克斯坦',
  '坦桑尼亚',
  '泰国',
  '东帝汶',
  '多哥',
  '汤加',
  '特立尼达和多巴哥',
  '突尼斯',
  '土耳其',
  '土库曼斯坦',
  '图瓦卢',
  '乌干达',
  '乌克兰',
  '阿联酋',
  '英国',
  '美国',
  '乌拉圭',
  '乌兹别克斯坦',
  '瓦努阿图',
  '梵蒂冈',
  '委内瑞拉',
  '越南',
  '也门',
  '赞比亚',
  '津巴布韦',
] as const

export const accountCountryOptions: SelectOption[] = accountCountryNames.map((name) => ({
  label: name,
  value: name,
}))

// 注册任务统一使用 ISO 3166-1 alpha-3，数组顺序与上方中文国家名称一一对应。
const registrationCountryCodes = [
  'AFG', 'ALB', 'DZA', 'AND', 'AGO', 'ATG', 'ARG', 'ARM', 'AUS', 'AUT',
  'AZE', 'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BEL', 'BLZ', 'BEN', 'BTN',
  'BOL', 'BIH', 'BWA', 'BRA', 'BRN', 'BGR', 'BFA', 'BDI', 'CPV', 'KHM',
  'CMR', 'CAN', 'CAF', 'TCD', 'CHL', 'CHN', 'HKG', 'MAC', 'TWN', 'COL',
  'COM', 'COG', 'COD', 'CRI', 'CIV', 'HRV', 'CUB', 'CYP', 'CZE', 'DNK',
  'DJI', 'DMA', 'DOM', 'ECU', 'EGY', 'SLV', 'GNQ', 'ERI', 'EST', 'SWZ',
  'ETH', 'FJI', 'FIN', 'FRA', 'GAB', 'GMB', 'GEO', 'DEU', 'GHA', 'GRC',
  'GRD', 'GTM', 'GIN', 'GNB', 'GUY', 'HTI', 'HND', 'HUN', 'ISL', 'IND',
  'IDN', 'IRN', 'IRQ', 'IRL', 'ISR', 'ITA', 'JAM', 'JPN', 'JOR', 'KAZ',
  'KEN', 'KIR', 'PRK', 'KOR', 'KWT', 'KGZ', 'LAO', 'LVA', 'LBN', 'LSO',
  'LBR', 'LBY', 'LIE', 'LTU', 'LUX', 'MDG', 'MWI', 'MYS', 'MDV', 'MLI',
  'MLT', 'MHL', 'MRT', 'MUS', 'MEX', 'FSM', 'MDA', 'MCO', 'MNG', 'MNE',
  'MAR', 'MOZ', 'MMR', 'NAM', 'NRU', 'NPL', 'NLD', 'NZL', 'NIC', 'NER',
  'NGA', 'MKD', 'NOR', 'OMN', 'PAK', 'PLW', 'PSE', 'PAN', 'PNG', 'PRY',
  'PER', 'PHL', 'POL', 'PRT', 'QAT', 'ROU', 'RUS', 'RWA', 'KNA', 'LCA',
  'VCT', 'WSM', 'SMR', 'STP', 'SAU', 'SEN', 'SRB', 'SYC', 'SLE', 'SGP',
  'SVK', 'SVN', 'SLB', 'SOM', 'ZAF', 'SSD', 'ESP', 'LKA', 'SDN', 'SUR',
  'SWE', 'CHE', 'SYR', 'TJK', 'TZA', 'THA', 'TLS', 'TGO', 'TON', 'TTO',
  'TUN', 'TUR', 'TKM', 'TUV', 'UGA', 'UKR', 'ARE', 'GBR', 'USA', 'URY',
  'UZB', 'VUT', 'VAT', 'VEN', 'VNM', 'YEM', 'ZMB', 'ZWE',
] as const

export const registrationCountryOptions: SelectOption[] = accountCountryNames.map((name, index) => {
  const code = registrationCountryCodes[index]
  return {
    label: `${name}（${code}）`,
    value: code,
  }
})

export const accountDelimiterOptions: SelectOption[] = [
  { label: '---', value: '---' },
  { label: ':', value: ':' },
  { label: ',', value: ',' },
  { label: '|', value: '|' },
  { label: 'Tab', value: '\\t' },
  { label: '空格', value: ' ' },
  { label: '自定义', value: 'custom' },
]

export const loginStatusOptions: SelectOption[] = [
  { label: '未登录', value: 'not_logged_in' },
  { label: '未知', value: 'unknown' },
  { label: '已登录', value: 'logged_in' },
  { label: '已登录（私信不可用）', value: 'logged_in_dm_unavailable' },
  { label: '需要 2FA', value: 'twofa_required' },
  { label: '封禁', value: 'banned' },
]

export const accountSelectionStrategyOptions: SelectOption[] = [
  { label: '仅未登录账号', value: 'not_logged_in' },
  { label: '全部账号', value: 'all' },
]

export const enabledStatusOptions: SelectOption[] = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
]

export const proxyModeOptions: SelectOption[] = [
  { label: '静态代理', value: 'static' },
  { label: '动态代理', value: 'dynamic' },
]

export const proxyProtocolOptions: SelectOption[] = [
  { label: 'Socks5', value: 'socks5' },
  { label: 'HTTP', value: 'http' },
  { label: 'HTTPS', value: 'https' },
]

export const proxyUsageStatusOptions: SelectOption[] = [
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
]

export const proxyUsageStatusFilterOptions: SelectOption[] = [
  { label: '全部', value: 'all' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
]

export const contentTypeOptions: SelectOption[] = [
  { label: '文本内容', value: 'text' },
  { label: '图文内容', value: 'image' },
  { label: '视频内容', value: 'video' },
  { label: '混合内容', value: 'mixed' },
]

export const contentStatusOptions: SelectOption[] = [
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
]

export const contentStatusFilterOptions: SelectOption[] = [
  { label: '全部', value: 'all' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
]

export const publishedContentTypeOptions: SelectOption[] = [
  { label: '帖子', value: 'post' },
  { label: '视频', value: 'video' },
  { label: '图片', value: 'image' },
  { label: '笔记', value: 'note' },
  { label: 'Thread', value: 'thread' },
  { label: '混合内容', value: 'mixed' },
]

export const publishedContentStatusOptions: SelectOption[] = [
  { label: '正常', value: 'normal' },
  { label: '已删除', value: 'deleted' },
  { label: '已隐藏', value: 'hidden' },
  { label: '不可访问', value: 'unavailable' },
  { label: '异常', value: 'error' },
]

export const commentStatusOptions: SelectOption[] = [
  { label: '正常', value: 'normal' },
  { label: '已删除', value: 'deleted' },
  { label: '已隐藏', value: 'hidden' },
  { label: '异常', value: 'error' },
]

export const interactionActionTypeOptions: SelectOption[] = [
  { label: '评论', value: 'comment' },
  { label: '回复评论', value: 'reply_comment' },
  { label: '点赞内容', value: 'like_content' },
  { label: '点赞评论', value: 'like_comment' },
  { label: '收藏', value: 'collect' },
]

export const interactionActionStatusOptions: SelectOption[] = [
  { label: '待执行', value: 'pending' },
  { label: '执行中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
]

export const interactionSessionStatusOptions: SelectOption[] = [
  { label: '排队中', value: 'queued' },
  { label: '运行中', value: 'running' },
  { label: '已完成', value: 'completed' },
  { label: '全部失败', value: 'all_failed' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'canceled' },
]

export const interactionStepActionOptions: SelectOption[] = [
  { label: '首页刷帖评论', value: 'homepage_browse_comment' },
  { label: '主号回复评论', value: 'main_reply_comment' },
  { label: '评论号二次回复', value: 'commenter_reply_main' },
]

export const mediaAssetTypeOptions: SelectOption[] = [
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '文件', value: 'file' },
  { label: '外链', value: 'link' },
]

export const mediaAssetStatusOptions: SelectOption[] = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
]

export const templateStatusOptions: SelectOption[] = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
]

export const scriptStatusOptions: SelectOption[] = [
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' },
]

export const scriptPurposeOptions: SelectOption[] = [
  { label: '普通任务', value: 'general_task' },
  { label: '发布内容', value: 'content_publish' },
  { label: '互动首次评论', value: 'interaction_initial_comment' },
  { label: '互动后续回复', value: 'interaction_reply' },
  { label: '账号环境创建及上号', value: 'account_onboarding' },
]

export const slotStatusOptions: SelectOption[] = [
  { label: '空闲', value: 'idle' },
  { label: '启动中', value: 'starting' },
  { label: '运行中', value: 'running' },
  { label: '停止中', value: 'stopping' },
  { label: '异常', value: 'error' },
  { label: '离线', value: 'offline' },
  { label: '禁用', value: 'disabled' },
]

export const runtimeStatusOptions: SelectOption[] = [
  { label: '在线', value: 'online' },
  { label: '离线', value: 'offline' },
]

export const runtimePlatformOptions: SelectOption[] = [
  { label: '指纹浏览器', value: 'fingerprint_browser' },
  { label: '云手机', value: 'cloud_phone' },
]

export const providerOptions: SelectOption[] = [
  { label: 'MoreLogin', value: 'morelogin' },
  { label: 'AdsPower', value: 'adspower' },
]

export const executionModeOptions: SelectOption[] = [
  { label: '立即执行', value: 'immediate' },
  { label: '计划执行', value: 'scheduled' },
]

export const accountScopeTypeOptions: SelectOption[] = [
  { label: '单个账号', value: 'single_account' },
  { label: '多个账号', value: 'account_list' },
  { label: '账号分组', value: 'account_group' },
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
  { label: '人工处理', value: 'manual' },
]

export const taskStatusOptions: SelectOption[] = [
  { label: '草稿', value: 'draft' },
  { label: '排队中', value: 'queued' },
  { label: '等待设备', value: 'waiting_slot' },
  { label: '等待 Runtime', value: 'waiting_runtime' },
  { label: '下发中', value: 'dispatching' },
  { label: '运行中', value: 'running' },
  { label: '重试等待', value: 'retry_wait' },
  { label: '限流', value: 'rate_limited' },
  { label: '成功', value: 'succeeded' },
  { label: '已完成', value: 'completed' },
  { label: '全部失败', value: 'all_failed' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'canceled' },
  { label: '超时', value: 'expired' },
  { label: '丢失', value: 'lost' },
]

export const scriptParamTypeOptions: SelectOption[] = [
  { label: '字符串', value: 'string' },
  { label: '布尔', value: 'bool' },
  { label: '国家/地区', value: 'country' },
  { label: '接码平台', value: 'registration_provider' },
  { label: '代理', value: 'proxy' },
  { label: '代理组', value: 'proxy_group' },
  { label: '资源', value: 'res' },
  { label: '账号', value: 'account' },
  { label: '账号组', value: 'account_group' },
  { label: '内容', value: 'content' },
  { label: '内容池', value: 'content_group' },
  { label: '素材', value: 'media_asset' },
  { label: '素材组', value: 'media_asset_group' },
  { label: '设备', value: 'execution_slot' },
]

export const registrationProviderOptions: SelectOption[] = [
  { label: 'Hero SMS', value: 'hero_sms' },
  { label: '火狐狸', value: 'firefox' },
]
