/**
 * 微信公众号发布失败时给用户的统一说明（多为后台安全/二次验证限制）。
 */

const HINT_SIGNATURE = '风险操作保护'

const WECHAT_MP_ADMIN = 'https://mp.weixin.qq.com/'
const WECHAT_MP_HELP_HOME = 'https://kf.qq.com/product/weixinmp.html'

/**
 * 在原有错误信息后追加公众平台设置说明（已含签名时不重复追加）。
 */
export function appendWechatMpPublishSettingsHint (detail: string): string {
  const d = (detail ?? '').trim()
  const block = [
    '若自动发布失败，常见原因是公众号后台启用了需管理员扫码等二次验证。',
    '请使用管理员登录微信公众平台，在「设置与开发」→「安全中心」→「风险操作保护」中，按需关闭或调整群发、发文相关等需额外确认项；并确认运营者具备发文权限。',
    `登录公众平台：${WECHAT_MP_ADMIN}`,
    `帮助与客服（含运营者、安全相关说明）：${WECHAT_MP_HELP_HOME}`
  ].join('\n')

  if (!d) return block
  if (d.includes(HINT_SIGNATURE) && d.includes('mp.weixin.qq.com')) return detail
  return `${d}\n\n${block}`
}
