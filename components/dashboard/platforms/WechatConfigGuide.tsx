'use client'

import React, { useState, useEffect } from 'react'
import { InfoCircleOutlined, CheckCircleOutlined, WarningOutlined, CopyOutlined } from '@ant-design/icons'
import { Card, CardContent } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { Info, Check, AlertCircle, Copy } from 'lucide-react'

interface WechatConfigGuideProps {
  /**
   * 当棄用，不再显示顶部警告
   */
  showPersonalWarning?: boolean
}

export default function WechatConfigGuide({
  showPersonalWarning = false
}: WechatConfigGuideProps) {
  const [serverIp, setServerIp] = useState<string>('')
  const [loadingIp, setLoadingIp] = useState(false)
  const [copiedItem, setCopiedItem] = useState<string>('')

  // 获取服务器IP
  useEffect(() => {
    fetchServerIp()
  }, [])

  const fetchServerIp = async () => {
    setLoadingIp(true)
    try {
      const response = await fetch('/api/wechat/server-info')
      if (response.ok) {
        const data = await response.json()
        setServerIp(data.publicIp || '无法获取')
      }
    } catch (error) {
      console.error('Failed to fetch server IP:', error)
      setServerIp('获取失败')
    } finally {
      setLoadingIp(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(label)
    setTimeout(() => setCopiedItem(''), 2000)
  }

  return (
    <div className="space-y-6">
      {/* 步骤1: 获取AppID和AppSecret */}
      <Card className="border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0 text-sm font-semibold">
              1
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-black mb-3">获取 AppID 和 AppSecret</h4>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    登录{' '}
                    <a
                      href="https://mp.weixin.qq.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-black underline hover:text-gray-700"
                    >
                      微信公众平台
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>进入 <strong>开发</strong> → <strong>基本配置</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    找到 <strong>开发者ID (AppID)</strong> 和{' '}
                    <strong>开发者密码 (AppSecret)</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>如果AppSecret已重置，需要管理员扫码确认</span>
                </li>
              </ol>
              <Alert className="mt-3 border-blue-200 bg-blue-50">
                <Info className="size-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-xs">
                  测试账号可在{' '}
                  <a
                    href="https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    微信测试号平台
                  </a>
                  {' '}快速申请
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 步骤2: 配置IP白名单 */}
      <Card className="border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0 text-sm font-semibold">
              2
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-black mb-3">配置 IP 白名单（必需）</h4>
              
              <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                <AlertCircle className="size-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 text-xs">
                  <strong>重要：</strong>必须配置服务器IP白名单，否则无法调用微信API
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                <div className="text-xs text-gray-600 mb-1">当前服务器公网IP：</div>
                <div className="flex items-center gap-2">
                  {loadingIp ? (
                    <span className="text-sm text-gray-500">加载中...</span>
                  ) : (
                    <>
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-200 flex-1">
                        {serverIp}
                      </code>
                      {serverIp && serverIp !== '无法获取' && serverIp !== '获取失败' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(serverIp, 'ip')}
                          className="shrink-0"
                        >
                          {copiedItem === 'ip' ? (
                            <Check className="size-4 text-green-600" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>在微信公众平台，进入 <strong>开发</strong> → <strong>基本配置</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>找到 <strong>IP白名单</strong>，点击“修改”</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    添加上方显示的IP地址：<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{serverIp}</code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>保存并等待生效（通常立即生效）</span>
                </li>
              </ol>

              <Alert className="mt-3 border-blue-200 bg-blue-50">
                <Info className="size-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-xs">
                  注意：必须配置<strong>公网IP</strong>，不能使用域名或内网IP
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 步骤3: 配置安全域名 */}
      <Card className="border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0 text-sm font-semibold">
              3
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-black mb-3">配置安全域名（可选）</h4>
              <p className="text-sm text-gray-600 mb-3">
                如果使用自定义域名访问本系统，需要配置JS接口安全域名
              </p>
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    在微信公众平台，进入{' '}
                    <strong>设置与开发</strong> → <strong>公众号设置</strong> →{' '}
                    <strong>功能设置</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>找到 <strong>JS接口安全域名</strong>，点击“设置”</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>添加您的域名（例如：<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">your-domain.com</code>）</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>下载验证文件并上传到网站根目录</span>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 步骤4: 主体类型限制 */}
      <Card className="border-gray-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0 text-sm font-semibold">
              4
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-black mb-3">了解主体类型限制</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* 表头 */}
                <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                  <div className="px-4 py-3 text-sm font-semibold text-black">主体类型</div>
                  <div className="px-4 py-3 text-sm font-semibold text-black border-l border-gray-200">支持发布</div>
                  <div className="px-4 py-3 text-sm font-semibold text-black border-l border-gray-200">适用场景</div>
                </div>
                {/* 企业主体 */}
                <div className="grid grid-cols-3 border-b border-gray-200">
                  <div className="px-4 py-3 text-sm font-semibold text-black">企业主体</div>
                  <div className="px-4 py-3 text-sm border-l border-gray-200">
                    <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                      <Check className="size-3 mr-1" /> 是
                    </Badge>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-200">
                    生产环境，支持完整功能
                  </div>
                </div>
                {/* 个人主体 */}
                <div className="grid grid-cols-3 border-b border-gray-200">
                  <div className="px-4 py-3 text-sm font-semibold text-black">个人主体</div>
                  <div className="px-4 py-3 text-sm border-l border-gray-200">
                    <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">
                      <AlertCircle className="size-3 mr-1" /> 否
                    </Badge>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-200">
                    仅支持查询配置，不支持发布
                  </div>
                </div>
                {/* 测试账号 */}
                <div className="grid grid-cols-3">
                  <div className="px-4 py-3 text-sm font-semibold text-black">测试账号</div>
                  <div className="px-4 py-3 text-sm border-l border-gray-200">
                    <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                      <Check className="size-3 mr-1" /> 是
                    </Badge>
                  </div>
                  <div className="px-4 py-3 text-sm text-gray-600 border-l border-gray-200">
                    开发测试，支持所有API接口
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
