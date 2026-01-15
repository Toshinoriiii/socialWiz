'use client'

import React, { useState, useEffect } from 'react'
import { WechatOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/user.store'

interface WechatAccountStatus {
  id: string
  platform: string
  platformUsername: string
  platformUserId: string
  isConnected: boolean
  tokenExpiry: string | null
  needsReauth: boolean
}

interface TestResult {
  test: string
  success: boolean
  message: string
  timestamp: string
}

export default function TestWechatPage() {
  const { token, user } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [accountStatus, setAccountStatus] = useState<WechatAccountStatus | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [publishText, setPublishText] = useState('这是一条测试消息 #SocialWiz #测试')
  const [publishing, setPublishing] = useState(false)

  // 获取微信公众号账号列表
  const fetchWechatAccounts = async () => {
    if (!token || !user) {
      return
    }

    try {
      setLoading(true)
      // 获取用户的平台账号列表
      const response = await fetch('/api/platforms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const accounts = await response.json()
        // 查找微信公众号账号
        const wechatAccount = accounts.find((acc: any) => acc.platform === 'WECHAT')
        
        if (wechatAccount) {
          // 获取详细状态
          await getAccountStatus(wechatAccount.id)
        } else {
          addTestResult('获取账号列表', true, '未找到微信公众号账号，请点击"连接微信公众号账号"按钮')
        }
      } else {
        const data = await response.json()
        addTestResult('获取账号列表', false, data.error || `请求失败: ${response.status}`)
      }
    } catch (error) {
      addTestResult('获取账号列表', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 初始化时检查是否有账号
  useEffect(() => {
    if (token && user) {
      fetchWechatAccounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user])

  // 连接微信公众号账号
  const connectWechat = async () => {
    if (!token) {
      addTestResult('连接微信公众号', false, '用户未登录')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/platforms/wechat/auth', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.authUrl) {
        // 跳转到授权页面
        window.location.href = data.authUrl
        addTestResult('连接微信公众号', true, '正在跳转到授权页面...')
      } else {
        addTestResult('连接微信公众号', false, data.error || '获取授权 URL 失败')
      }
    } catch (error) {
      addTestResult('连接微信公众号', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 断开连接
  const disconnectWechat = async (accountId: string) => {
    if (!token) {
      addTestResult('断开连接', false, '用户未登录')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/platforms/wechat/${accountId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAccountStatus(null)
        addTestResult('断开连接', true, '已断开微信公众号账号连接')
      } else {
        addTestResult('断开连接', false, data.error || '断开连接失败')
      }
    } catch (error) {
      addTestResult('断开连接', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 获取账号状态
  const getAccountStatus = async (accountId: string) => {
    if (!token) {
      addTestResult('获取账号状态', false, '用户未登录')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/platforms/wechat/${accountId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setAccountStatus(data)
        addTestResult('获取账号状态', true, `账号状态: ${data.isConnected ? '已连接' : '未连接'}, 需要重新授权: ${data.needsReauth ? '是' : '否'}`)
      } else {
        addTestResult('获取账号状态', false, data.error || '获取状态失败')
      }
    } catch (error) {
      addTestResult('获取账号状态', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 发布内容
  const publishContent = async (accountId: string) => {
    if (!token) {
      addTestResult('发布内容', false, '用户未登录')
      return
    }

    if (!publishText.trim()) {
      addTestResult('发布内容', false, '内容不能为空')
      return
    }

    try {
      setPublishing(true)
      const response = await fetch(`/api/platforms/wechat/${accountId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: publishText
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addTestResult('发布内容', true, `发布成功！消息 ID: ${data.platformPostId || 'N/A'}, 链接: ${data.publishedUrl || 'N/A'}`)
      } else {
        addTestResult('发布内容', false, data.error || `发布失败: ${data.errorCode || '未知错误'}`)
      }
    } catch (error) {
      addTestResult('发布内容', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setPublishing(false)
    }
  }

  // 添加测试结果
  const addTestResult = (test: string, success: boolean, message: string) => {
    const result: TestResult = {
      test,
      success,
      message,
      timestamp: new Date().toLocaleTimeString('zh-CN')
    }
    setTestResults(prev => [result, ...prev])
  }

  // 清空测试结果
  const clearResults = () => {
    setTestResults([])
  }

  // 检查 URL 参数（OAuth 回调后）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    const platform = params.get('platform')

    if (status === 'connected' && platform === 'wechat') {
      addTestResult('OAuth 回调', true, '微信公众号账号连接成功！正在刷新账号状态...')
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
      // 刷新账号列表
      setTimeout(() => {
        fetchWechatAccounts()
      }, 1000)
    } else if (status === 'error' && platform === 'wechat') {
      const error = params.get('error')
      addTestResult('OAuth 回调', false, `连接失败: ${error || '未知错误'}`)
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!token || !user) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">微信公众号 API 测试</h2>
          <p className="text-red-500">请先登录</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <WechatOutlined className="text-3xl text-green-500" />
            <h2 className="text-2xl font-bold">微信公众号 API 测试页面</h2>
          </div>
          <button
            onClick={clearResults}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
          >
            清空日志
          </button>
        </div>

        {/* 账号状态 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">账号状态</h3>
          {accountStatus ? (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <span className="text-gray-600">用户名:</span>
                  <span className="ml-2 font-medium">{accountStatus.platformUsername}</span>
                </div>
                <div>
                  <span className="text-gray-600">用户ID:</span>
                  <span className="ml-2 font-mono text-sm">{accountStatus.platformUserId}</span>
                </div>
                <div>
                  <span className="text-gray-600">连接状态:</span>
                  <span className={`ml-2 font-medium ${accountStatus.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {accountStatus.isConnected ? '已连接' : '未连接'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Token 过期:</span>
                  <span className="ml-2 text-sm">
                    {accountStatus.tokenExpiry ? new Date(accountStatus.tokenExpiry).toLocaleString('zh-CN') : '未知'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">需要重新授权:</span>
                  <span className={`ml-2 font-medium ${accountStatus.needsReauth ? 'text-orange-600' : 'text-gray-600'}`}>
                    {accountStatus.needsReauth ? '是' : '否'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchWechatAccounts()}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? <LoadingOutlined /> : '刷新状态'}
                </button>
                <button
                  onClick={() => disconnectWechat(accountStatus.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  disabled={loading}
                >
                  断开连接
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
              <p className="mb-4 text-gray-600">未连接微信公众号账号</p>
              <button
                onClick={connectWechat}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2 mx-auto"
                disabled={loading}
              >
                {loading ? <LoadingOutlined /> : <WechatOutlined />}
                连接微信公众号账号
              </button>
            </div>
          )}
        </div>

        {/* 发布测试 */}
        {accountStatus && accountStatus.isConnected && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">发布测试</h3>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">发布内容:</label>
              <textarea
                value={publishText}
                onChange={(e) => setPublishText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={4}
                placeholder="输入要发布的微信公众号内容..."
                maxLength={20000}
              />
              <div className="text-sm text-gray-500 mt-1 text-right">
                {publishText.length} / 20000 字
              </div>
              <button
                onClick={() => publishContent(accountStatus.id)}
                className="mt-4 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                disabled={publishing || !publishText.trim()}
              >
                {publishing ? (
                  <>
                    <LoadingOutlined /> 发布中...
                  </>
                ) : (
                  <>
                    <WechatOutlined /> 发布到微信公众号
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 测试结果日志 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">测试日志</h3>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="text-center text-gray-500 py-8">暂无测试记录</div>
            ) : (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border ${
                      result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{result.test}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{result.timestamp}</span>
                        {result.success ? (
                          <CheckCircleOutlined className="text-green-500" />
                        ) : (
                          <CloseCircleOutlined className="text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                      {result.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 快速测试按钮 */}
        <div>
          <h3 className="text-lg font-semibold mb-3">快速测试</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={connectWechat}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={loading || accountStatus?.isConnected}
            >
              测试 OAuth 授权
            </button>
            {accountStatus && (
              <>
                <button
                  onClick={() => getAccountStatus(accountStatus.id)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={loading}
                >
                  测试获取状态
                </button>
                <button
                  onClick={() => publishContent(accountStatus.id)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                  disabled={publishing || !accountStatus.isConnected}
                >
                  测试发布内容
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
