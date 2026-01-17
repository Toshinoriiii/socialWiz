'use client'

import React, { useState, useEffect } from 'react'
import { WechatOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/user.store'
import WechatConfigGuide from '@/components/dashboard/platforms/WechatConfigGuide'
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
  const [createSubjectType, setCreateSubjectType] = useState<'personal' | 'enterprise'>('enterprise')

  // 更新配置表单
  const [editingConfig, setEditingConfig] = useState<string | null>(null)
  const [updateAccountName, setUpdateAccountName] = useState('')
  const [updateAppSecret, setUpdateAppSecret] = useState('')

  // Token测试状态
  const [testingToken, setTestingToken] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<{ token: string; expiresAt: number; configId: string } | null>(null)

  // 发布测试状态
  const [showPublishForm, setShowPublishForm] = useState(false)
  const [publishConfigId, setPublishConfigId] = useState('')
  const [publishTitle, setPublishTitle] = useState('')
  const [publishAuthor, setPublishAuthor] = useState('')
  const [publishDigest, setPublishDigest] = useState('')
  const [publishContent, setPublishContent] = useState('')
  const [publishImageFile, setPublishImageFile] = useState<File | null>(null)
  const [publishImagePreview, setPublishImagePreview] = useState('')
  const [publishing, setPublishing] = useState(false)

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
          accountName: createAccountName || undefined,
          subjectType: createSubjectType
        })
      })

      const data = await response.json()

      if (response.ok) {
        addTestResult('创建配置', true, `配置创建成功！配置ID: ${data.id}`)
        // 清空表单
        setCreateAppId('')
        setCreateAppSecret('')
        setCreateAccountName('')
        setCreateSubjectType('enterprise')
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

  // 测试获取Token
  const testGetToken = async (configId: string, appId: string) => {
    if (!token) {
      addTestResult('Token测试', false, '用户未登录')
      return
    }

    try {
      setTestingToken(true)
      const response = await fetch(`/api/wechat/token/${configId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok && data.accessToken) {
        setTokenInfo({
          token: data.accessToken,
          expiresAt: data.expiresAt,
          configId
        })
        const remainingSeconds = Math.floor((data.expiresAt - Date.now()) / 1000)
        addTestResult('Token测试', true, `成功获取Token! AppID: ${appId}, 剩余有效期: ${remainingSeconds}秒 (约${Math.floor(remainingSeconds / 60)}分钟)`)
      } else {
        addTestResult('Token测试', false, data.error || '获取Token失败')
      }
    } catch (error) {
      addTestResult('Token测试', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setTestingToken(false)
    }
  }

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 验证文件类型
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!allowedTypes.includes(file.type)) {
        addTestResult('图片选择', false, '只支持JPG/PNG格式的图片')
        return
      }

      // 验证文件大小
      const maxSize = 2 * 1024 * 1024 // 2MB
      if (file.size > maxSize) {
        addTestResult('图片选择', false, `图片大小不能超过2MB，当前${(file.size / 1024 / 1024).toFixed(2)}MB`)
        return
      }

      // 保存文件和预览
      setPublishImageFile(file)
      setPublishImagePreview(URL.createObjectURL(file))
      addTestResult('图片选择', true, `已选择: ${file.name}`)
    }
  }

  // 测试发布内容
  const testPublishContent = async () => {
    if (!token) {
      addTestResult('发布测试', false, '用户未登录')
      return
    }

    if (!publishConfigId) {
      addTestResult('发布测试', false, '请选择公众号配置')
      return
    }

    if (!publishTitle.trim() || !publishContent.trim() || !publishImageFile) {
      addTestResult('发布测试', false, '标题、内容和封面图片不能为空')
      return
    }

    try {
      setPublishing(true)
      
      // 创建FormData
      const formData = new FormData()
      formData.append('configId', publishConfigId)
      formData.append('title', publishTitle)
      formData.append('content', publishContent)
      if (publishAuthor) formData.append('author', publishAuthor)
      if (publishDigest) formData.append('digest', publishDigest)
      formData.append('image', publishImageFile)

      const response = await fetch('/api/platforms/wechat/publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addTestResult('发布测试', true, `发布成功! Media ID: ${data.platformPostId}`)
        // 清空表单
        setPublishTitle('')
        setPublishAuthor('')
        setPublishDigest('')
        setPublishContent('')
        setPublishImageFile(null)
        setPublishImagePreview('')
        setShowPublishForm(false)
      } else {
        addTestResult('发布测试', false, data.details || data.error || '发布失败')
      }
    } catch (error) {
      addTestResult('发布测试', false, `错误: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setPublishing(false)
    }
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
          </div>
        </div>

        {/* 配置指引 */}
        <div className={styles.section}>
          <WechatConfigGuide
            showPersonalWarning={configs.some(c => c.subjectType === 'personal')}
            accountType={configs[0]?.accountType || undefined}
            subjectType={configs[0]?.subjectType || undefined}
          />
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

              <div className={styles.formGroup}>
                <label className={styles.label}>主体类型 *</label>
                <select
                  value={createSubjectType}
                  onChange={(e) => setCreateSubjectType(e.target.value as 'personal' | 'enterprise')}
                  className={styles.input}
                >
                  <option value="enterprise">企业主体 (支持发布功能)</option>
                  <option value="personal">个人主体 (不支持发布)</option>
                </select>
                <small style={{ color: '#999', display: 'block', marginTop: '4px' }}>
                  {createSubjectType === 'personal' 
                    ? '⚠️ 个人主体公众号不支持内容发布功能'
                    : '✅ 企业主体支持完整的发布功能'
                  }
                </small>
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
                    setCreateSubjectType('enterprise')
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
                      <span className={`${styles.value} ${config.subjectType === 'enterprise' ? styles.success : styles.warning}`}>
                        {config.subjectType === 'personal' ? '个人主体' : config.subjectType === 'enterprise' ? '企业主体' : '未设置'}
                      </span>
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

                  {/* Token测试按钮 */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                    <button
                      onClick={() => testGetToken(config.id, config.appId)}
                      className={styles.submitButton}
                      disabled={testingToken}
                      style={{ width: '100%' }}
                    >
                      {testingToken ? <LoadingOutlined /> : '🔑 测试获取Access Token'}
                    </button>
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

        {/* Token信息显示 */}
        {tokenInfo && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>🔑 Access Token 信息</h3>
            <div className={styles.tokenInfo}>
              <div className={styles.configRow}>
                <span className={styles.label}>Token:</span>
                <span className={styles.value} style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                  {tokenInfo.token.substring(0, 30)}...{tokenInfo.token.substring(tokenInfo.token.length - 10)}
                </span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.label}>过期时间:</span>
                <span className={styles.value}>
                  {new Date(tokenInfo.expiresAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.label}>剩余时间:</span>
                <span className={`${styles.value} ${Math.floor((tokenInfo.expiresAt - Date.now()) / 1000) < 300 ? styles.warning : styles.success}`}>
                  {Math.floor((tokenInfo.expiresAt - Date.now()) / 1000)}秒 (约{Math.floor((tokenInfo.expiresAt - Date.now()) / 60000)}分钟)
                </span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.label}>配置ID:</span>
                <span className={styles.value} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {tokenInfo.configId}
                </span>
              </div>
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                💡 提示：Token会自动缓存到Redis，剩余有效期{'<'}5分钟时自动刷新
              </p>
            </div>
          </div>
        )}

        {/* 内容发布测试 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>📤 内容发布测试</h3>
            <button
              onClick={() => setShowPublishForm(!showPublishForm)}
              className={styles.addButton}
              disabled={configs.length === 0}
            >
              {showPublishForm ? '取消' : '📤 测试发布'}
            </button>
          </div>

          {configs.length === 0 && (
            <p className={styles.hint}>请先添加公众号配置</p>
          )}

          {showPublishForm && configs.length > 0 && (
            <div className={styles.form}>
              <h4 className={styles.formTitle}>发布测试表单</h4>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>选择公众号 *</label>
                <select
                  value={publishConfigId}
                  onChange={(e) => setPublishConfigId(e.target.value)}
                  className={styles.input}
                >
                  <option value="">请选择...</option>
                  {configs.map(config => (
                    <option key={config.id} value={config.id}>
                      {config.accountName || config.appId} {!config.canPublish ? '(不支持发布)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>标题 * (最多64字符)</label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  placeholder="输入文章标题"
                  maxLength={64}
                  className={styles.input}
                />
                <small style={{ color: '#999' }}>{publishTitle.length}/64</small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>作者 (可选)</label>
                <input
                  type="text"
                  value={publishAuthor}
                  onChange={(e) => setPublishAuthor(e.target.value)}
                  placeholder="输入作者名称"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>摘要 (可选, 最多120字符)</label>
                <input
                  type="text"
                  value={publishDigest}
                  onChange={(e) => setPublishDigest(e.target.value)}
                  placeholder="输入文章摘要"
                  maxLength={120}
                  className={styles.input}
                />
                <small style={{ color: '#999' }}>{publishDigest.length}/120</small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>内容 * (支持HTML, 最多20000字符)</label>
                <textarea
                  value={publishContent}
                  onChange={(e) => setPublishContent(e.target.value)}
                  placeholder="输入文章内容，支持HTML格式"
                  maxLength={20000}
                  className={styles.textarea}
                  rows={6}
                />
                <small style={{ color: '#999' }}>{publishContent.length}/20000</small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>封面图片 * </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleImageSelect}
                      disabled={publishing || !publishConfigId}
                      className={styles.input}
                      style={{ cursor: 'pointer' }}
                    />
                    <small style={{ color: '#999', display: 'block', marginTop: '4px' }}>
                      支持JPG/PNG格式，最大2MB
                    </small>
                    {publishImageFile && (
                      <small style={{ color: '#52c41a', display: 'block', marginTop: '4px' }}>
                        ✅ 已选择: {publishImageFile.name}
                      </small>
                    )}
                  </div>
                  {publishImagePreview && (
                    <div style={{ 
                      width: '100px', 
                      height: '100px', 
                      border: '1px solid #d9d9d9', 
                      borderRadius: '6px',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      <img 
                        src={publishImagePreview} 
                        alt="封面预览" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  onClick={testPublishContent}
                  className={styles.submitButton}
                  disabled={publishing || !publishConfigId || !publishTitle.trim() || !publishContent.trim() || !publishImageFile}
                >
                  {publishing ? <LoadingOutlined /> : '🚀 发布到微信'}
                </button>
                <button
                  onClick={() => {
                    setShowPublishForm(false)
                    setPublishTitle('')
                    setPublishAuthor('')
                    setPublishDigest('')
                    setPublishContent('')
                    setPublishImageFile(null)
                    setPublishImagePreview('')
                  }}
                  className={styles.cancelButton}
                >
                  取消
                </button>
              </div>
            </div>
          )}
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
