import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/wechat/server-info
 * 
 * 获取服务器公网IP等信息
 * 用于配置指引页面显示IP白名单配置
 * 
 * @internal 仅供内部使用
 */
export async function GET(request: NextRequest) {
  try {
    // 尝试从多个来源获取公网IP
    let publicIp = ''

    // 方法1: 从请求头获取（如果有反向代理）
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')

    if (forwardedFor) {
      // x-forwarded-for 可能包含多个IP，取第一个
      publicIp = forwardedFor.split(',')[0].trim()
    } else if (realIp) {
      publicIp = realIp
    }

    // 方法2: 调用外部IP查询服务
    if (!publicIp || publicIp.startsWith('192.168.') || publicIp.startsWith('10.') || publicIp === '127.0.0.1') {
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
          signal: AbortSignal.timeout(5000) // 5秒超时
        })
        if (ipResponse.ok) {
          const ipData = await ipResponse.json()
          publicIp = ipData.ip
        }
      } catch (error) {
        console.warn('[Server Info] Failed to fetch public IP from ipify:', error)
      }
    }

    // 方法3: 备用服务
    if (!publicIp || publicIp.startsWith('192.168.') || publicIp.startsWith('10.') || publicIp === '127.0.0.1') {
      try {
        const ipResponse = await fetch('https://ifconfig.me/ip', {
          signal: AbortSignal.timeout(5000)
        })
        if (ipResponse.ok) {
          publicIp = await ipResponse.text()
          publicIp = publicIp.trim()
        }
      } catch (error) {
        console.warn('[Server Info] Failed to fetch public IP from ifconfig.me:', error)
      }
    }

    // 获取其他服务器信息
    const serverInfo = {
      publicIp: publicIp || '无法获取',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      // 不暴露敏感信息
      platform: process.platform,
      nodeVersion: process.version
    }

    return NextResponse.json(serverInfo, { status: 200 })
  } catch (error) {
    console.error('[Server Info API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get server info',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
