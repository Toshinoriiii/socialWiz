/**
 * 图片格式转换工具
 * 微信公众号 thumb 素材仅支持 JPG（40113=unsupported file type 多为格式不符）
 */

import sharp from 'sharp'

/**
 * 生成默认封面图（无封面时使用，满足微信 API 必填要求）
 */
export async function createDefaultWechatCover(): Promise<{
  buffer: Buffer
  filename: string
  contentType: string
}> {
  const buffer = await sharp({
    create: {
      width: 900,
      height: 500,
      channels: 3,
      background: { r: 245, g: 245, b: 245 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
  return { buffer, filename: 'default-cover.jpg', contentType: 'image/jpeg' }
}

/**
 * 将图片转为 JPG Buffer（微信公众号 thumb 仅支持 JPG）
 * 支持输入 WebP、PNG、GIF 等格式，统一转为 JPG
 */
export async function convertToJpegForWechat(input: Buffer): Promise<{
  buffer: Buffer
  filename: string
  contentType: string
}> {
  try {
    const buffer = await sharp(input)
      .rotate()
      .resize(900, 500, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    return { buffer, filename: 'cover.jpg', contentType: 'image/jpeg' }
  } catch (error) {
    console.error('[image-convert] 转换为 JPG 失败:', error)
    throw new Error('封面图格式转换失败，请使用 JPG/PNG 图片')
  }
}
