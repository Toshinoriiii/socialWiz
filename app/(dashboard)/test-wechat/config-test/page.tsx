'use client'

import React, { useState, useEffect } from 'react'
import { WechatOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/user.store'
import styles from './config-test.module.css'

interface WechatConfig {
  id: string
  userId: string
  appId: string
  accountName: string | null
  accountType: string | null
  subjectType: string | null
  canPublish: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface TestResult {
  test: string
  success: boolean
  message: string
  timestamp: string
}

export default function WechatConfigTestPage() {
  const { token, user } = useUserStore()
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState<WechatConfig[]>([])
  const [testResults, setTestResults] = useState<TestResult[]>([])

  // 创建配置表单
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createAppId, setCreateAppId] = useState('')
  const [createAppSecret, setCreateAppSecret] = useState('')
  const [createAccountName, setCreateAccountName] = useState('')

  // 更新配置表单
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [updateAccountName, setUpdateAccountName] = useState('')
  const [updateAppSecret, setUpdateAppSecret] = useState('')

  // 获取配置列表
  const fetchConfigs = async () => {
    if (!token || !user) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/wechat/config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setConfigs(data)
        addTestResult('获取配置列表', true, `成功获取 ${data.length} 个配置`)
      } else {
        const data = await response.json()
        addTestResult('获取配置列表', false, data.error || `请求失败: ${response.status}`)
      }
    } catch (error) {
      addTestResult('获取配置列表', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 初始化加载
  useEffect(() => {
    if (token && user) {
      fetchConfigs()
    }
  }, [token, user])

  // 创建配置
  const createConfig = async () => {
    if (!token) {
      addTestResult('创建配置', false, '用户未登录')
      return
    }

    if (!createAppId.trim() || !createAppSecret.trim()) {
      addTestResult('创建配置', false, 'AppID 和 AppSecret 不能为空')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/wechat/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appId: createAppId,
          appSecret: createAppSecret,
          accountName: createAccountName || undefined
        })
      })

      const data = await response.json()

      if (response.ok) {
        addTestResult('创建配置', true, `配置创建成功！配置ID: ${data.id}`)
        // 清空表单
        setCreateAppId('')
        setCreateAppSecret('')
        setCreateAccountName('')
        setShowCreateForm(false)
        // 刷新列表
        fetchConfigs()
      } else {
        addTestResult('创建配置', false, data.error || '创建失败')
      }
    } catch (error) {
      addTestResult('创建配置', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 更新配置
  const updateConfig = async (configId: string) => {
    if (!token) {
      addTestResult('更新配置', false, '用户未登录')
      return
    }

    const updateData: any = {}
    if (updateAccountName.trim()) {
      updateData.accountName = updateAccountName
    }
    if (updateAppSecret.trim()) {
      updateData.appSecret = updateAppSecret
    }

    if (Object.keys(updateData).length === 0) {
      addTestResult('更新配置', false, '请至少填写一个要更新的字段')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/wechat/config/${configId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (response.ok) {
        addTestResult('更新配置', true, '配置更新成功')
        // 清空表单
        setUpdateAccountName('')
        setUpdateAppSecret('')
        setEditingConfig(null)
        // 刷新列表
        fetchConfigs()
      } else {
        addTestResult('更新配置', false, data.error || '更新失败')
      }
    } catch (error) {
      addTestResult('更新配置', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
    }
  }

  // 删除配置
  const deleteConfig = async (configId: string, appId: string) => {
    if (!token) {
      addTestResult('删除配置', false, '用户未登录')
      return
    }

    if (!confirm(`确定要删除配置 ${appId} 吗？此操作不可恢复。`)) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/wechat/config/${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        addTestResult('删除配置', true, `配置 ${appId} 已删除`)
        // 刷新列表
        fetchConfigs()
      } else {
        const data = await response.json()
        addTestResult('删除配置', false, data.error || '删除失败')
      }
    } catch (error) {
      addTestResult('删除配置', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setLoading(false)
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

  if (!token || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.title}>微信配置管理测试</h2>
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
            <WechatOutlined className={styles.icon} />
            <h2 className={styles.title}>微信公众号配置管理测试</h2>
          </div>
          <button onClick={clearResults} className={styles.clearButton}>
            清空日志
          </button>
        </div>

        {/* 用户信息 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>当前用户</h3>
          <div className={styles.userInfo}>
            <p><strong>用户ID:</strong> {user.id}</p>
            <p><strong>用户名:</strong> {user.name || user.email}</p>
            <p><strong>邮箱:</strong> {user.email}</p>
            <p><strong>Token:</strong> <span style={{ fontSize: '12px', wordBreak: 'break-all', fontFamily: 'monospace' }}>{token?.substring(0, 50)}...</span></p>
          </div>
        </div>

        {/* 配置列表 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>配置列表 ({configs.length})</h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className={styles.addButton}
            >
              {showCreateForm ? '取消' : '+ 添加配置'}
            </button>
          </div>

          {/* 创建配置表单 */}
          {showCreateForm && (
            <div className={styles.form}>
              <h4 className={styles.formTitle}>创建新配置</h4>
              <div className={styles.formGroup}>
                <label className={styles.label}>AppID *</label>
                <input
                  type="text"
                  value={createAppId}
                  onChange={(e) => setCreateAppId(e.target.value)}
                  placeholder="输入微信公众号 AppID"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>AppSecret *</label>
                <input
                  type="password"
                  value={createAppSecret}
                  onChange={(e) => setCreateAppSecret(e.target.value)}
                  placeholder="输入微信公众号 AppSecret"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>账号名称（可选）</label>
                <input
                  type="text"
                  value={createAccountName}
                  onChange={(e) => setCreateAccountName(e.target.value)}
                  placeholder="输入账号名称，便于识别"
                  className={styles.input}
                />
              </div>
              <div className={styles.formActions}>
                <button
                  onClick={createConfig}
                  className={styles.submitButton}
                  disabled={loading || !createAppId.trim() || !createAppSecret.trim()}
                >
                  {loading ? <LoadingOutlined /> : '创建配置'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setCreateAppId('')
                    setCreateAppSecret('')
                    setCreateAccountName('')
                  }}
                  className={styles.cancelButton}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 配置卡片 */}
          <div className={styles.configList}>
            {configs.length === 0 ? (
              <div className={styles.noConfigs}>
                <p>暂无配置</p>
                <p className={styles.hint}>点击"添加配置"按钮创建第一个微信公众号配置</p>
              </div>
            ) : (
              configs.map((config) => (
                <div key={config.id} className={styles.configCard}>
                  <div className={styles.configHeader}>
                    <h4 className={styles.configName}>
                      {config.accountName || '未命名账号'}
                    </h4>
                    <div className={styles.configActions}>
                      <button
                        onClick={() => {
                          setEditingConfig(editingConfig === config.id ? null : config.id)
                          setUpdateAccountName(config.accountName || '')
                          setUpdateAppSecret('')
                        }}
                        className={styles.iconButton}
                        title="编辑"
                      >
                        <EditOutlined />
                      </button>
                      <button
                        onClick={() => deleteConfig(config.id, config.appId)}
                        className={`${styles.iconButton} ${styles.danger}`}
                        title="删除"
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  </div>

                  <div className={styles.configDetails}>
                    <div className={styles.configRow}>
                      <span className={styles.label}>AppID:</span>
                      <span className={styles.value}>{config.appId}</span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.label}>账号类型:</span>
                      <span className={styles.value}>{config.accountType || '未知'}</span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.label}>主体类型:</span>
                      <span className={styles.value}>{config.subjectType || '未知'}</span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.label}>支持发布:</span>
                      <span className={`${styles.value} ${config.canPublish ? styles.success : styles.warning}`}>
                        {config.canPublish ? '是' : '否'}
                      </span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.label}>状态:</span>
                      <span className={`${styles.value} ${config.isActive ? styles.success : styles.error}`}>
                        {config.isActive ? '激活' : '禁用'}
                      </span>
                    </div>
                    <div className={styles.configRow}>
                      <span className={styles.label}>创建时间:</span>
                      <span className={styles.value}>
                        {new Date(config.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>

                  {/* 编辑表单 */}
                  {editingConfig === config.id && (
                    <div className={styles.editForm}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>账号名称</label>
                        <input
                          type="text"
                          value={updateAccountName}
                          onChange={(e) => setUpdateAccountName(e.target.value)}
                          placeholder="更新账号名称"
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>新 AppSecret（留空表示不更新）</label>
                        <input
                          type="password"
                          value={updateAppSecret}
                          onChange={(e) => setUpdateAppSecret(e.target.value)}
                          placeholder="输入新的 AppSecret"
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.formActions}>
                        <button
                          onClick={() => updateConfig(config.id)}
                          className={styles.submitButton}
                          disabled={loading}
                        >
                          {loading ? <LoadingOutlined /> : '保存更新'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingConfig(null)
                            setUpdateAccountName('')
                            setUpdateAppSecret('')
                          }}
                          className={styles.cancelButton}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <button
            onClick={fetchConfigs}
            className={styles.refreshButton}
            disabled={loading}
          >
            {loading ? <LoadingOutlined /> : '刷新列表'}
          </button>
        </div>

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
      </div>
    </div>
  )
}
