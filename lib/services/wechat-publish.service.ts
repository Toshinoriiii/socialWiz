import prisma from '@/lib/db/prisma'
import { WechatConfigService } from './wechat-config.service'
import { WechatTokenService } from './wechat-token.service'
import FormData from 'form-data'
import fetch from 'node-fetch'

/**
 * 微信公众号内容发布服务
 * 
 * 负责内容发布到微信公众号的业务逻辑
 */
export class WechatPublishService {
  private configService: WechatConfigService
  private tokenService: WechatTokenService

  constructor() {
    this.configService = new WechatConfigService()
    this.tokenService = new WechatTokenService()
  }

  /**
   * 发布内容到微信公众号
   * 
   * @param userId 用户ID
   * @param configId 配置ID
   * @param content 发布内容
   * @param thumbImage 封面图片文件（Buffer）
   * @returns 发布结果
   */
  async publishContent(
    userId: string,
    configId: string,
    content: {
      title: string
      author?: string
      digest?: string
      content: string
      contentSourceUrl?: string
    },
    thumbImage: {
      buffer: Buffer
      filename: string
      contentType: string
    }
  ): Promise<{
    success: boolean
    mediaId?: string
    url?: string
    error?: string
  }> {
    try {
      // 1. 验证配置是否存在且属于该用户
      const config = await this.configService.getConfigById(configId, userId)
      if (!config) {
        throw new Error('配置不存在或无权访问')
      }

      // 2. 验证配置是否激活
      if (!config.isActive) {
        throw new Error('配置已禁用，请先激活配置')
      }

      // 3. 检查是否为个人主体（个人主体不支持发布）
      if (config.subjectType === 'personal' || !config.canPublish) {
        throw new Error('个人主体公众号不支持发布功能，请使用企业主体公众号或测试账号')
      }

      // 4. 验证内容
      const validationResult = this.validateContent(content)
      if (!validationResult.valid) {
        throw new Error(validationResult.errors.join('; '))
      }

      // 5. 获取access_token（自动管理）
      const accessToken = await this.tokenService.getOrRefreshToken(userId, configId)
      if (!accessToken) {
        throw new Error('获取access_token失败')
      }

      // 6. 上传封面图片到微信（永久素材）
      console.log('[Wechat Publish] Step 1: Uploading thumb image...')
      const thumbMediaId = await this.uploadThumbImage(accessToken, thumbImage)
      if (!thumbMediaId) {
        throw new Error('上传封面图片失败')
      }
      console.log('[Wechat Publish] Thumb image uploaded, media_id:', thumbMediaId)

      // 7. 创建草稿并发布
      const publishResult = await this.createAndPublishDraft(
        accessToken,
        { ...content, thumbMediaId }
      )

      if (!publishResult.success) {
        throw new Error(publishResult.error || '发布失败')
      }

      return {
        success: true,
        mediaId: publishResult.mediaId,
        url: publishResult.url
      }
    } catch (error) {
      console.error('[Wechat Publish Service] Publish error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '发布失败'
      }
    }
  }

  /**
   * 验证发布内容
   */
  private validateContent(content: {
    title: string
    content: string
  }): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // 标题验证
    if (!content.title || content.title.trim() === '') {
      errors.push('标题不能为空')
    } else if (content.title.length > 64) {
      errors.push('标题长度不能超过64个字符')
    }

    // 内容验证
    if (!content.content || content.content.trim() === '') {
      errors.push('内容不能为空')
    } else if (content.content.length > 20000) {
      errors.push('内容长度不能超过20000个字符')
    }

    return {
      valid: errors.length === 0,
      errors
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
        console.error('[Upload Thumb] Error:', data)
        return null
      }

      return data.media_id
    } catch (error) {
      console.error('[Upload Thumb] Exception:', error)
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
  ): Promise<{
    success: boolean
    mediaId?: string
    url?: string
    error?: string
  }> {
    const maxRetries = 3
    let lastError: string = ''

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 步骤1: 创建草稿
        const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`

        // 构造请求体
        const requestBody = {
          articles: [
            {
              title: content.title,
              author: content.author || '',
              digest: content.digest || '',
              content: content.content,
              content_source_url: content.contentSourceUrl || '',
              thumb_media_id: content.thumbMediaId, // 永久素材thumb类型的media_id
              need_open_comment: 0,
              only_fans_can_comment: 0
            }
          ]
        }
        
        console.log(`[Wechat Publish] Attempt ${attempt}/${maxRetries} - Creating draft...`)
        console.log(`[Wechat Publish] Using thumb_media_id: ${content.thumbMediaId}`)
        console.log(`[Wechat Publish] Request body:`, JSON.stringify(requestBody, null, 2))

        const draftResponse = await fetch(draftUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(10000) // 10秒超时
        })

        const draftData = await draftResponse.json() as any

        // 检查草稿创建是否成功
        if (draftData.errcode && draftData.errcode !== 0) {
          const errorMessage = this.getWechatErrorMessage(draftData.errcode, draftData.errmsg)
          lastError = errorMessage

          // 某些错误不需要重试
          if (this.shouldNotRetry(draftData.errcode)) {
            console.error('[Wechat Publish] Non-retryable error (draft):', errorMessage)
            return {
              success: false,
              error: errorMessage
            }
          }

          // 可重试错误，等待后重试
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000 // 指数退避: 2s, 4s, 8s
            console.warn(`[Wechat Publish] Retrying in ${delay}ms...`)
            await this.sleep(delay)
            continue
          }
        } else {
          // 草稿创建成功，继续发布
          const draftMediaId = draftData.media_id
          console.log('[Wechat Publish] Draft created successfully, media_id:', draftMediaId)

          // 步骤2: 发布草稿
          const publishUrl = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`
          
          console.log('[Wechat Publish] Submitting for publish...')
          
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
            console.error('[Wechat Publish] Publish failed:', errorMessage)
            return {
              success: false,
              error: `草稿创建成功但发布失败: ${errorMessage}`
            }
          }

          // 发布成功
          console.log('[Wechat Publish] Published successfully, publish_id:', publishData.publish_id)
          return {
            success: true,
            mediaId: draftMediaId,
            url: publishData.article_url || undefined
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : '网络请求失败'
        console.error(`[Wechat Publish] Attempt ${attempt} failed:`, error)

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await this.sleep(delay)
          continue
        }
      }
    }

    return {
      success: false,
      error: `发布失败（已重试${maxRetries}次）: ${lastError}`
    }
  }

  /**
   * 获取友好的微信错误信息
   */
  private getWechatErrorMessage(errcode: number, errmsg: string): string {
    const errorMap: Record<number, string> = {
      40001: 'access_token无效或已过期，请重新配置',
      40002: '不合法的凭证类型',
      40003: '不合法的OpenID',
      40004: '不合法的媒体文件类型',
      40005: '不合法的文件类型',
      40006: '不合法的文件大小',
      40007: '不合法的媒体文件ID',
      40008: '不合法的消息类型',
      40009: '不合法的图片文件大小',
      40010: '不合法的语音文件大小',
      40011: '不合法的视频文件大小',
      40012: '不合法的缩略图文件大小',
      40013: '不合法的AppID',
      40014: '不合法的access_token',
      40164: 'IP地址不在白名单中，请在微信公众平台配置服务器IP白名单',
      41001: '缺少access_token参数',
      41002: '缺少appid参数',
      41003: '缺少refresh_token参数',
      41004: '缺少secret参数',
      41005: '缺少多媒体文件数据',
      41006: '缺少media_id参数',
      41007: '缺少子菜单数据',
      41008: '缺少oauth code',
      41009: '缺少openid',
      42001: 'access_token超时，请重新获取',
      42002: 'refresh_token超时',
      42003: 'oauth_code超时',
      43001: '需要GET请求',
      43002: '需要POST请求',
      43003: '需要HTTPS请求',
      43004: '需要接收者关注',
      43005: '需要好友关系',
      44001: '多媒体文件为空',
      44002: 'POST的数据包为空',
      44003: '图文消息内容为空',
      44004: '文本消息内容为空',
      45001: '多媒体文件大小超过限制',
      45002: '消息内容超过限制',
      45003: '标题字段超过限制',
      45004: '描述字段超过限制',
      45005: '链接字段超过限制',
      45006: '图片链接字段超过限制',
      45007: '语音播放时间超过限制',
      45008: '图文消息超过限制',
      45009: '接口调用超过限制',
      45015: '回复时间超过限制',
      45016: '系统分组不允许修改',
      45017: '分组名字过长',
      45018: '分组数量超过上限',
      46001: '不存在媒体数据',
      46002: '不存在的菜单版本',
      46003: '不存在的菜单数据',
      46004: '不存在的用户',
      47001: '解析JSON/XML内容错误',
      48001: 'api功能未授权，请确认公众号类型（个人主体不支持发布）',
      50001: '用户未授权该api',
      87014: '内容含有违法违规内容',
      89503: '此IP调用需要管理员确认，请联系管理员'
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
      41001, // 缺少access_token
      41002, // 缺少appid
      41006, // 缺少media_id
      42001, // access_token超时
      43004, // 需要接收者关注
      44003, // 图文消息内容为空
      46001, // 不存在媒体数据
      48001, // api功能未授权
      50001, // 用户未授权
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
}

// 导出单例
export const wechatPublishService = new WechatPublishService()
