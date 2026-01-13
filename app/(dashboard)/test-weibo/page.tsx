'use client'

import React, { useState, useEffect } from 'react'
import { WeiboOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/user.store'
import styles from './test-weibo.module.css'

interface WeiboAccountStatus {
  id: string
  platform: string
  platformUsername: string
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

export default function TestWeiboPage() {
  const { token, user } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [accountStatus, setAccountStatus] = useState<WeiboAccountStatus | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [publishText, setPublishText] = useState('这是一条测试微博 #SocialWiz #测试')
  const [publishing, setPublishing] = useState(false)

  // 获取微博账号列表
  const fetchWeiboAccounts = async () => {
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
        // 查找微博账号
        const weiboAccount = accounts.find((acc: any) => acc.platform === 'WEIBO')
        
        if (weiboAccount) {
          // 获取详细状态
          await getAccountStatus(weiboAccount.id)
        } else {
          addTestResult('获取账号列表', true, '未找到微博账号，请点击"连接微博账号"按钮')
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
      fetchWeiboAccounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user])

  // 连接微博账号
  const connectWeibo = async () => {
    if (!token) {
      addTestResult('连接微博', false, '用户未登录')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/platforms/weibo/auth', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.authUrl) {
        // 跳转到授权页面
        window.location.href = data.authUrl
        addTestResult('连接微博', true, '正在跳转到授权页面...')
      } else {
        addTestResult('连接微博', false, data.error || '获取授权 URL 失败')
      }
    } catch (error) {
      addTestResult('连接微博', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 断开连接
  const disconnectWeibo = async (accountId: string) => {
    if (!token) {
      addTestResult('断开连接', false, '用户未登录')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/platforms/weibo/${accountId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAccountStatus(null)
        addTestResult('断开连接', true, '已断开微博账号连接')
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
      const response = await fetch(`/api/platforms/weibo/${accountId}/status`, {
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
      const response = await fetch(`/api/platforms/weibo/${accountId}/publish`, {
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
        addTestResult('发布内容', true, `发布成功！微博 ID: ${data.platformPostId}, 链接: ${data.publishedUrl}`)
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

    if (status === 'connected' && platform === 'weibo') {
      addTestResult('OAuth 回调', true, '微博账号连接成功！正在刷新账号状态...')
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
      // 刷新账号列表
      setTimeout(() => {
        fetchWeiboAccounts()
      }, 1000)
    } else if (status === 'error' && platform === 'weibo') {
      const error = params.get('error')
      addTestResult('OAuth 回调', false, `连接失败: ${error || '未知错误'}`)
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!token || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.title}>微博 API 测试</h2>
          <p className={styles.error}>请先登录</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <WeiboOutlined className={styles.icon} />
            <h2 className={styles.title}>微博 API 测试页面</h2>
          </div>
          <button onClick={clearResults} className={styles.clearButton}>
            清空日志
          </button>
        </div>

        {/* 账号状态 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>账号状态</h3>
          {accountStatus ? (
            <div className={styles.statusCard}>
              <div className={styles.statusRow}>
                <span className={styles.label}>用户名:</span>
                <span className={styles.value}>{accountStatus.platformUsername}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.label}>连接状态:</span>
                <span className={`${styles.value} ${accountStatus.isConnected ? styles.connected : styles.disconnected}`}>
                  {accountStatus.isConnected ? '已连接' : '未连接'}
                </span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.label}>Token 过期:</span>
                <span className={styles.value}>
                  {accountStatus.tokenExpiry ? new Date(accountStatus.tokenExpiry).toLocaleString('zh-CN') : '未知'}
                </span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.label}>需要重新授权:</span>
                <span className={`${styles.value} ${accountStatus.needsReauth ? styles.warning : ''}`}>
                  {accountStatus.needsReauth ? '是' : '否'}
                </span>
              </div>
              <div className={styles.actions}>
                <button
                  onClick={() => fetchWeiboAccounts()}
                  className={styles.button}
                  disabled={loading}
                >
                  {loading ? <LoadingOutlined /> : '刷新状态'}
                </button>
                <button
                  onClick={() => disconnectWeibo(accountStatus.id)}
                  className={`${styles.button} ${styles.danger}`}
                  disabled={loading}
                >
                  断开连接
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.noAccount}>
              <p>未连接微博账号</p>
              <button
                onClick={connectWeibo}
                className={styles.connectButton}
                disabled={loading}
              >
                {loading ? <LoadingOutlined /> : <WeiboOutlined />}
                连接微博账号
              </button>
            </div>
          )}
        </div>

        {/* 发布测试 */}
        {accountStatus && accountStatus.isConnected && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>发布测试</h3>
            <div className={styles.publishForm}>
              <label className={styles.label}>发布内容:</label>
              <textarea
                value={publishText}
                onChange={(e) => setPublishText(e.target.value)}
                className={styles.textarea}
                rows={4}
                placeholder="输入要发布的微博内容..."
                maxLength={2000}
              />
              <div className={styles.charCount}>
                {publishText.length} / 2000 字
              </div>
              <button
                onClick={() => publishContent(accountStatus.id)}
                className={styles.publishButton}
                disabled={publishing || !publishText.trim()}
              >
                {publishing ? (
                  <>
                    <LoadingOutlined /> 发布中...
                  </>
                ) : (
                  <>
                    <WeiboOutlined /> 发布到微博
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 测试结果日志 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>测试日志</h3>
          <div className={styles.logContainer}>
            {testResults.length === 0 ? (
              <div className={styles.noLogs}>暂无测试记录</div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className={`${styles.logItem} ${result.success ? styles.success : styles.error}`}>
                  <div className={styles.logHeader}>
                    <span className={styles.logTest}>{result.test}</span>
                    <span className={styles.logTime}>{result.timestamp}</span>
                    {result.success ? (
                      <CheckCircleOutlined className={styles.logIcon} />
                    ) : (
                      <CloseCircleOutlined className={styles.logIcon} />
                    )}
                  </div>
                  <div className={styles.logMessage}>{result.message}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 快速测试按钮 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>快速测试</h3>
          <div className={styles.quickTests}>
            <button
              onClick={connectWeibo}
              className={styles.quickButton}
              disabled={loading || accountStatus?.isConnected}
            >
              测试 OAuth 授权
            </button>
            {accountStatus && (
              <>
                <button
                  onClick={() => getAccountStatus(accountStatus.id)}
                  className={styles.quickButton}
                  disabled={loading}
                >
                  测试获取状态
                </button>
                <button
                  onClick={() => publishContent(accountStatus.id)}
                  className={styles.quickButton}
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
