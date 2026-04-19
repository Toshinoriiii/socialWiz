/**
 * 微信公众号平台适配器实现
 * 
 * 实现 PlatformAdapter 接口，提供微信公众号平台的具体实现。
 * 支持 OAuth 2.0 授权、内容发布、用户信息获取等功能。
 * 
 * @example
 * ```typescript
 * const adapter = new WechatAdapter({
 *   appId: 'your_app_id',
 *   appSecret: 'your_app_secret',
 *   redirectUri: 'http://localhost:3000/callback'
 * })
 * 
 * // 获取授权 URL
 * const authUrl = await adapter.getAuthUrl(config)
 * 
 * // 发布内容
 * const result = await adapter.publish(token, { text: 'Hello WeChat!' })
 * ```
 * 
 * @remarks
 * - Token 刷新机制：需要根据微信 API 文档确认是否支持 refresh_token
 * - 内容发布接口：需要根据微信 API 文档确定具体的发布接口（T019 任务）
 * - 内容限制：需要根据微信 API 文档确认具体的内容限制数值
 */

import { PlatformAdapter } from '../base/platform-adapter'
import type {
  AuthConfig,
  TokenInfo,
  PublishContent,
  PublishResult,
  UserInfo,
  ValidationResult,
  DataQueryOptions,
  ContentData
} from '../base/types'
import { Platform } from '@/types/platform.types'
import { WechatApiClient } from './wechat-client'
import { WECHAT_ERROR_MAP } from './wechat-types'
import { appendWechatMpPublishSettingsHint } from '@/lib/utils/wechat-publish-user-hints'
import FormData from 'form-data'
import fetch from 'node-fetch'

export interface WechatConfig {
  appId: string
  appSecret: string
  redirectUri: string
}

export class WechatAdapter implements PlatformAdapter {
  readonly platform = Platform.WECHAT
  private client: WechatApiClient

  constructor(config: WechatConfig) {
    this.client = new WechatApiClient()
  }

 /**
   * 获取授权 URL
   * 
   * 支持两种授权方式：
   * 1. 服务号网页授权：在微信客户端内打开，使用 snsapi_base 或 snsapi_userinfo
   * 2. 网站应用扫码登录：在PC浏览器中打开，使用 snsapi_login
   * 
   * 服务号网页授权：
   * - 参考文档：https://developers.weixin.qq.com/doc/service/guide/h5/auth.html
   * - URL: https://open.weixin.qq.com/connect/oauth2/authorize
   * - scope: snsapi_base（静默授权）或 snsapi_userinfo（弹窗授权）
   * - 需要在服务号后台配置"网页授权域名"
   * 
   * 网站应用扫码登录：
   * - 参考文档：https://developers.weixin.qq.com/doc/oplatform/developers/dev/auth/web.html
   * - URL: https://open.weixin.qq.com/connect/qrconnect
   * - scope: snsapi_login（固定）
   * - 需要在微信开放平台配置"网站应用"
   * 
   * @param config 授权配置，包含 clientId、clientSecret、redirectUri、state、scope 等
   * @returns 授权 URL
   */
  async getAuthUrl(config: AuthConfig): Promise<string> {
    const wechatConfig = config as (AuthConfig & { 
      clientId: string
      redirectUri: string
      state?: string
      scope?: string
    })
    
    // redirect_uri 必须使用 urlEncode 对链接进行处理
    const redirectUri = encodeURIComponent(wechatConfig.redirectUri)
    
    // 默认使用服务号网页授权（snsapi_userinfo）
    const scope = wechatConfig.scope || 'snsapi_userinfo'
    
    // 根据 scope 决定使用哪种授权方式
    if (scope === 'snsapi_login') {
      // 网站应用扫码登录
      const params = new URLSearchParams({
        appid: wechatConfig.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'snsapi_login',
        state: wechatConfig.state || ''
      })
      return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`
    } else {
      // 服务号网页授权（snsapi_base 或 snsapi_userinfo）
      const params = new URLSearchParams({
        appid: wechatConfig.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope, // snsapi_base 或 snsapi_userinfo
        state: wechatConfig.state || ''
      })
      return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`
    }
  }

  /**
   * 交换授权码获取 Token
   * 
   * 使用授权码换取 access_token 和 refresh_token（如果支持）。
   * 
   * @param code OAuth 授权码
   * @param config 授权配置
   * @returns Token 信息，包含 accessToken、refreshToken、expiresIn、openid 等
   */
  async exchangeToken(code: string, config: AuthConfig): Promise<TokenInfo & { openid?: string }> {
    try {
      const wechatConfig = config as (AuthConfig & { clientId: string; clientSecret: string })
      const response = await this.client.getAccessToken(wechatConfig.clientId, wechatConfig.clientSecret)

      return {
        accessToken: response.access_token,
        refreshToken: undefined,
        expiresIn: response.expires_in,
        tokenType: 'Bearer',
        scope: undefined,
        openid: undefined
      }
    } catch (error: any) {
      throw new Error(`获取 Token 失败: ${error.message}`)
    }
  }

  /**
   * 刷新 Token
   * 
   * 使用 refresh_token 刷新 access_token（如果微信支持）。
   * 注意：微信公众号 OAuth 2.0 可能不支持 refresh_token，需要根据实际 API 文档调整。
   * 
   * @param refreshToken 刷新令牌
   * @returns 新的 Token 信息
   */
  async refreshToken(refreshToken: string): Promise<TokenInfo> {
    throw new Error('微信公众号不支持 refresh_token')
  }

  /**
   * 获取用户信息
   * 
   * 通过 access_token 和 openid 获取微信公众号用户信息。
   * 
   * @param token 访问令牌
   * @param openid 用户唯一标识（可选，如果未提供则从 token 中提取）
   * @returns 用户信息
   */
  async getUserInfo(token: string, openid?: string): Promise<UserInfo> {
    throw new Error('微信公众号 getUserInfo 未实现')
  }

  /**
   * 发布内容
   * 
   * 发布内容到微信公众号，完整流程：
   * 1. 上传封面图片到微信（永久素材thumb类型）
   * 2. 创建草稿（使用封面图片media_id）
   * 3. 发布草稿
   * 
   * @param token 访问令牌（access_token）
   * @param content 发布内容（包含标题、正文、封面图片等）
   * @returns 发布结果
   */
  async publish(token: string, content: PublishContent): Promise<PublishResult> {
    try {
      // 验证内容
      const validation = this.validateContent(content)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        }
      }

      // 验证微信必需字段
      if (!content.title) {
        return {
          success: false,
          error: '标题不能为空'
        }
      }

      if (!content.thumbImage) {
        return {
          success: false,
          error: '封面图片不能为空'
        }
      }

      // 步骤1: 上传封面图片
      console.log('[WechatAdapter] Step 1: Uploading thumb image...')
      const thumbMediaId = await this.uploadThumbImage(token, content.thumbImage)
      if (!thumbMediaId) {
        return {
          success: false,
          error: appendWechatMpPublishSettingsHint('上传封面图片失败')
        }
      }
      console.log('[WechatAdapter] Thumb image uploaded, media_id:', thumbMediaId)

      // 步骤2&3: 创建草稿并发布
      const publishResult = await this.createAndPublishDraft(token, {
        title: content.title,
        author: content.author,
        digest: content.digest,
        content: content.text,
        contentSourceUrl: content.contentSourceUrl,
        thumbMediaId
      })

      if (!publishResult.success) {
        return {
          ...publishResult,
          error: appendWechatMpPublishSettingsHint(
            publishResult.error || '微信官方接口发布失败'
          )
        }
      }
      return publishResult
    } catch (error: any) {
      console.error('[WechatAdapter] Publish error:', error)
      return {
        success: false,
        error: appendWechatMpPublishSettingsHint(
          error.message || '发布失败'
        ),
        errorCode: 'PUBLISH_FAILED'
      }
    }
  }

  /**
   * 上传封面图片到微信（永久素材thumb类型）
   */
  private async uploadThumbImage(
    accessToken: string,
    thumbImage: {
      buffer: Buffer
      filename: string
      contentType: string
    }
  ): Promise<string | null> {
    try {
      const formData = new FormData()
      formData.append('media', thumbImage.buffer, {
        filename: thumbImage.filename,
        contentType: thumbImage.contentType
      })

      const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=thumb`
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders()
      })

      const data = await response.json() as any

      if (data.errcode && data.errcode !== 0) {
        console.error('[WechatAdapter] Upload thumb error:', data)
        return null
      }

      return data.media_id
    } catch (error) {
      console.error('[WechatAdapter] Upload thumb exception:', error)
      return null
    }
  }

  /**
   * 创建草稿并发布
   */
  private async createAndPublishDraft(
    accessToken: string,
    content: {
      title: string
      author?: string
      digest?: string
      content: string
      contentSourceUrl?: string
      thumbMediaId: string
    }
  ): Promise<PublishResult> {
    const maxRetries = 3
    let lastError: string = ''

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 步骤1: 创建草稿
        const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`

        const requestBody = {
          articles: [
            {
              title: content.title,
              author: content.author || '',
              digest: content.digest || '',
              content: content.content,
              content_source_url: content.contentSourceUrl || '',
              thumb_media_id: content.thumbMediaId,
              need_open_comment: 0,
              only_fans_can_comment: 0
            }
          ]
        }
        
        console.log(`[WechatAdapter] Attempt ${attempt}/${maxRetries} - Creating draft...`)

        const draftResponse = await fetch(draftUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(10000)
        })

        const draftData = await draftResponse.json() as any

        // 检查草稿创建是否成功
        if (draftData.errcode && draftData.errcode !== 0) {
          const errorMessage = this.getWechatErrorMessage(draftData.errcode, draftData.errmsg)
          lastError = errorMessage

          // 某些错误不需要重试
          if (this.shouldNotRetry(draftData.errcode)) {
            console.error('[WechatAdapter] Non-retryable error (draft):', errorMessage)
            return {
              success: false,
              error: errorMessage,
              errorCode: draftData.errcode.toString()
            }
          }

          // 可重试错误，等待后重试
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000
            console.warn(`[WechatAdapter] Retrying in ${delay}ms...`)
            await this.sleep(delay)
            continue
          }
        } else {
          // 草稿创建成功，继续发布
          const draftMediaId = draftData.media_id
          console.log('[WechatAdapter] Draft created successfully, media_id:', draftMediaId)

          // 步骤2: 发布草稿
          const publishUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`
          
          console.log('[WechatAdapter] Submitting for publish...')
          
          const publishResponse = await fetch(publishUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              media_id: draftMediaId
            }),
            signal: AbortSignal.timeout(10000)
          })

          const publishData = await publishResponse.json() as any

          // 检查发布是否成功
          if (publishData.errcode && publishData.errcode !== 0) {
            const errorMessage = this.getWechatErrorMessage(publishData.errcode, publishData.errmsg)
            console.error('[WechatAdapter] Publish failed:', errorMessage)
            return {
              success: false,
              error: `草稿创建成功但发布失败: ${errorMessage}`,
              errorCode: publishData.errcode.toString()
            }
          }

          // 任务提交成功，轮询发布状态以获取文章链接（微信发布为异步）
          const publishId = publishData.publish_id
          const msgDataId =
            typeof publishData.msg_data_id === 'string' && publishData.msg_data_id
              ? publishData.msg_data_id
              : typeof publishData.msg_data_id === 'number'
                ? String(publishData.msg_data_id)
                : undefined
          console.log('[WechatAdapter] Publish task submitted, publish_id:', publishId)
          const { articleUrl, articleId, firstArticleIdx } =
            await this.pollPublishStatus(accessToken, publishId)
          let wechatDatacubeMsgid: string | undefined
          if (msgDataId) {
            const idx = firstArticleIdx ?? 1
            wechatDatacubeMsgid = `${msgDataId}_${idx}`
          }
          // 发布成功后自动群发推送给粉丝
          if (articleId) {
            this.massSendToFollowers(accessToken, articleId).catch((err) => {
              console.warn('[WechatAdapter] 群发推送失败（文章已发布）:', err)
            })
          }
          return {
            success: true,
            platformPostId: publishId,
            publishedUrl: articleUrl,
            wechatDatacubeMsgid
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : '网络请求失败'
        console.error(`[WechatAdapter] Attempt ${attempt} failed:`, error)

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await this.sleep(delay)
          continue
        }
      }
    }

    return {
      success: false,
      error: `发布失败（已重试${maxRetries}次）: ${lastError}`,
      errorCode: 'PUBLISH_FAILED'
    }
  }

  /**
   * 轮询发布状态，获取文章永久链接和 article_id
   * 微信 freepublish/submit 为异步，需通过 freepublish/get 查询最终结果
   */
  private async pollPublishStatus(
    accessToken: string,
    publishId: string,
    maxAttempts = 10,
    intervalMs = 2000
  ): Promise<{
    articleUrl?: string
    articleId?: string
    /** 首篇图文在群发中的序号，用于拼 datacube msgid */
    firstArticleIdx?: number
  }> {
    const getUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/get?access_token=${accessToken}`
    for (let i = 0; i < maxAttempts; i++) {
      await this.sleep(intervalMs)
      try {
        const res = await fetch(getUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publish_id: publishId }),
          signal: AbortSignal.timeout(5000),
        })
        const data = (await res.json()) as {
          publish_status?: number
          article_id?: string
          article_detail?: { item?: Array<{ article_url?: string }> }
          errcode?: number
        }
        if (data.errcode && data.errcode !== 0) {
          console.warn('[WechatAdapter] Poll status error:', data)
          continue
        }
        const status = data.publish_status ?? -1
        if (status === 0) {
          const first = data.article_detail?.item?.[0]
          const url = first?.article_url
          const articleId = data.article_id
          const idxRaw = first?.idx
          const firstArticleIdx =
            typeof idxRaw === 'number'
              ? idxRaw
              : typeof idxRaw === 'string'
                ? Number.parseInt(idxRaw, 10)
                : undefined
          if (url) console.log('[WechatAdapter] Article URL:', url)
          if (articleId) console.log('[WechatAdapter] Article ID:', articleId)
          return {
            articleUrl: url,
            articleId,
            firstArticleIdx: Number.isFinite(firstArticleIdx)
              ? firstArticleIdx
              : undefined
          }
        }
        if (status >= 2 && status <= 6) {
          console.warn('[WechatAdapter] Publish failed, status:', status)
          return {}
        }
        console.log(`[WechatAdapter] Publish status: ${status} (1=发布中), retry ${i + 1}/${maxAttempts}`)
      } catch (e) {
        console.warn('[WechatAdapter] Poll exception:', e)
      }
    }
    return {}
  }

  /**
   * 发布成功后群发推送给粉丝
   * 流程：getarticle 获取已发布文章 -> uploadnews 转为群发 media_id -> sendall 群发
   */
  private async massSendToFollowers(accessToken: string, articleId: string): Promise<void> {
    try {
      // 1. 获取已发布文章详情
      const getArticleUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/getarticle?access_token=${accessToken}`
      const getRes = await fetch(getArticleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId }),
        signal: AbortSignal.timeout(10000),
      })
      const getData = (await getRes.json()) as {
        errcode?: number
        errmsg?: string
        news_item?: Array<{
          title: string
          author?: string
          digest?: string
          content: string
          content_source_url?: string
          thumb_media_id: string
          need_open_comment?: number
          only_fans_can_comment?: number
        }>
      }
      if (getData.errcode && getData.errcode !== 0) {
        throw new Error(`getarticle 失败: ${getData.errmsg} (${getData.errcode})`)
      }
      const article = getData.news_item?.[0]
      if (!article || !article.thumb_media_id) {
        throw new Error('获取文章内容失败')
      }
      // 2. 上传图文素材（群发需要用 uploadnews 的 media_id）
      const uploadNewsUrl = `https://api.weixin.qq.com/cgi-bin/media/uploadnews?access_token=${accessToken}`
      const uploadBody = {
        articles: [{
          title: article.title,
          author: article.author || '',
          digest: article.digest || '',
          content: article.content,
          content_source_url: article.content_source_url || '',
          thumb_media_id: article.thumb_media_id,
          need_open_comment: article.need_open_comment ?? 0,
          only_fans_can_comment: article.only_fans_can_comment ?? 0,
        }],
      }
      const uploadRes = await fetch(uploadNewsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadBody),
        signal: AbortSignal.timeout(15000),
      })
      const uploadData = (await uploadRes.json()) as { errcode?: number; errmsg?: string; media_id?: string }
      if (uploadData.errcode && uploadData.errcode !== 0) {
        throw new Error(`uploadnews 失败: ${uploadData.errmsg} (${uploadData.errcode})`)
      }
      const massMediaId = uploadData.media_id
      if (!massMediaId) {
        throw new Error('uploadnews 未返回 media_id')
      }
      // 3. 群发推送给全部粉丝
      const sendAllUrl = `https://api.weixin.qq.com/cgi-bin/message/mass/sendall?access_token=${accessToken}`
      const sendBody = {
        filter: { is_to_all: true },
        mpnews: { media_id: massMediaId },
        msgtype: 'mpnews',
        send_ignore_reprint: 0,
      }
      const sendRes = await fetch(sendAllUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendBody),
        signal: AbortSignal.timeout(10000),
      })
      const sendData = (await sendRes.json()) as { errcode?: number; errmsg?: string; msg_id?: number }
      if (sendData.errcode && sendData.errcode !== 0) {
        throw new Error(`群发失败: ${sendData.errmsg} (${sendData.errcode})`)
      }
      console.log('[WechatAdapter] 群发推送成功, msg_id:', sendData.msg_id)
    } catch (error) {
      console.error('[WechatAdapter] massSendToFollowers 错误:', error)
      throw error
    }
  }

  /**
   * 获取友好的微信错误信息
   */
  private getWechatErrorMessage(errcode: number, errmsg: string): string {
    const errorMap: Record<number, string> = {
      40001: 'access_token无效或已过期，请重新配置',
      40007: '不合法的媒体文件ID',
      40013: '不合法的AppID',
      40014: '不合法的access_token',
      40164: 'IP地址不在白名单中，请在微信公众平台配置服务器IP白名单',
      42001: 'access_token超时，请重新获取',
      48001: 'api功能未授权，请确认公众号类型（个人主体不支持发布）',
      87014: '内容含有违法违规内容'
    }

    const friendlyMessage = errorMap[errcode]
    if (friendlyMessage) {
      return `${friendlyMessage} (错误码: ${errcode})`
    }

    return `微信API错误: ${errmsg} (错误码: ${errcode})`
  }

  /**
   * 判断错误是否不应该重试
   */
  private shouldNotRetry(errcode: number): boolean {
    const nonRetryableCodes = [
      40001, // access_token无效
      40007, // 不合法的媒体文件ID
      40013, // 不合法的AppID
      40014, // 不合法的access_token
      40164, // IP不在白名单
      42001, // access_token超时
      48001, // api功能未授权
      87014  // 内容违规
    ]

    return nonRetryableCodes.includes(errcode)
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取内容数据
   * 
   * 从微信公众号获取已发布的内容数据。
   * 
   * @param token 访问令牌
   * @param options 查询选项
   * @returns 内容数据列表
   */
  async getContentData(token: string, options: DataQueryOptions): Promise<ContentData[]> {
    // TODO: 实现内容数据获取
    throw new Error('getContentData 待实现')
  }

  /**
   * 验证内容是否符合平台限制
   * 
   * 验证内容是否符合微信公众号的限制要求。
   * 注意：具体限制数值需要根据微信 API 文档确认。
   * 
   * @param content 发布内容
   * @returns 验证结果，包含 valid 和 errors 数组
   */
  validateContent(content: PublishContent): ValidationResult {
    const errors: string[] = []

    // TODO: 根据微信 API 文档确定具体的内容限制
    // 目前使用临时值，实际需要根据微信文档调整
    const MAX_TEXT_LENGTH = 20000 // 临时值，需要确认微信的实际限制

    if (!content.text || content.text.trim().length === 0) {
      errors.push('内容不能为空')
    }

    if (content.text && content.text.length > MAX_TEXT_LENGTH) {
      errors.push(`文字内容超过限制（最多 ${MAX_TEXT_LENGTH} 字）`)
    }

    // 图片数量限制（需要确认微信的实际限制）
    if (content.images && content.images.length > 8) {
      errors.push('图片数量超过限制（最多 8 张）')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 提取错误码
   * 
   * 从错误消息中提取微信错误码。
   * 
   * @param errorMessage 错误消息
   * @returns 错误码字符串
   */
  private extractErrorCode(errorMessage: string): string {
    // 尝试从错误消息中提取错误码（格式：错误码: 错误信息）
    const match = errorMessage.match(/\((\d+)\)|错误码[：:]\s*(\d+)/i)
    return match ? (match[1] || match[2]) : 'UNKNOWN'
  }

  /**
   * 获取用户友好的错误消息
   * 
   * 将微信 API 错误转换为用户友好的错误消息。
   * 
   * @param errorMessage 原始错误消息
   * @param errorCode 错误码
   * @returns 用户友好的错误消息
   */
  private getUserFriendlyError(errorMessage: string, errorCode: string): string {
    // 如果是频率限制错误
    if (errorCode === '45009' || errorCode === '45011' || errorMessage.includes('频率')) {
      return '请求频率过高，请稍后再试'
    }

    // 如果是 Token 错误
    if (errorCode === '40001' || errorCode === '40014' || errorMessage.includes('Token') || errorMessage.includes('token')) {
      return '授权已过期，请重新连接账号'
    }

    // 如果是内容错误
    if (errorCode === '87014' || errorMessage.includes('内容') || errorMessage.includes('敏感')) {
      return '内容不符合平台规范，请修改后重试'
    }

    // 使用错误码映射
    const errorInfo = WECHAT_ERROR_MAP[parseInt(errorCode, 10)]
    if (errorInfo && errorInfo.message) {
      return errorInfo.message
    }

    // 默认错误消息
    return '操作失败，请稍后重试'
  }
}
