'use client'

import React, { useState, useEffect } from 'react'
import { InfoCircleOutlined, CheckCircleOutlined, WarningOutlined, CopyOutlined } from '@ant-design/icons'
import styles from './WechatConfigGuide.module.css'

interface WechatConfigGuideProps {
  /**
   * 当检测到个人主体时显示警告
   */
  showPersonalWarning?: boolean
  /**
   * 当前配置的账号类型
   */
  accountType?: string
  /**
   * 当前配置的主体类型
   */
  subjectType?: string
}

export default function WechatConfigGuide({
  showPersonalWarning = false,
  accountType,
  subjectType
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
    <div className={styles.container}>
      <div className={styles.header}>
        <InfoCircleOutlined className={styles.headerIcon} />
        <h3 className={styles.title}>微信公众号配置指引</h3>
      </div>

      {/* 个人主体警告 */}
      {showPersonalWarning && (
        <div className={styles.warningBox}>
          <WarningOutlined className={styles.warningIcon} />
          <div className={styles.warningContent}>
            <h4 className={styles.warningTitle}>个人主体公众号限制</h4>
            <p>
              检测到您的公众号为<strong>个人主体</strong>，该类型公众号<strong>不支持发布功能</strong>。
              如需使用内容发布功能，请升级为企业主体公众号或使用测试账号进行开发测试。
            </p>
          </div>
        </div>
      )}

      {/* 步骤1: 获取AppID和AppSecret */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>1</span>
          <h4 className={styles.stepTitle}>获取AppID和AppSecret</h4>
        </div>
        <div className={styles.stepContent}>
          <ol className={styles.list}>
            <li>
              登录{' '}
              <a
                href="https://mp.weixin.qq.com/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                微信公众平台
              </a>
            </li>
            <li>进入 <strong>开发</strong> → <strong>基本配置</strong></li>
            <li>
              找到 <strong>开发者ID (AppID)</strong> 和{' '}
              <strong>开发者密码 (AppSecret)</strong>
            </li>
            <li>
              如果AppSecret已重置，需要管理员扫码确认
            </li>
          </ol>
          <div className={styles.note}>
            <InfoCircleOutlined className={styles.noteIcon} />
            <span>
              测试账号可在{' '}
              <a
                href="https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                微信测试号平台
              </a>
              {' '}快速申请
            </span>
          </div>
        </div>
      </div>

      {/* 步骤2: 配置IP白名单 */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>2</span>
          <h4 className={styles.stepTitle}>配置IP白名单（必需）</h4>
        </div>
        <div className={styles.stepContent}>
          <div className={styles.highlight}>
            <WarningOutlined className={styles.highlightIcon} />
            <span>
              <strong>重要：</strong>必须配置服务器IP白名单，否则无法调用微信API
            </span>
          </div>

          <div className={styles.ipBox}>
            <div className={styles.ipLabel}>当前服务器公网IP:</div>
            <div className={styles.ipValue}>
              {loadingIp ? (
                '加载中...'
              ) : (
                <>
                  <code>{serverIp}</code>
                  {serverIp && serverIp !== '无法获取' && serverIp !== '获取失败' && (
                    <button
                      onClick={() => copyToClipboard(serverIp, 'ip')}
                      className={styles.copyButton}
                      title="复制IP地址"
                    >
                      {copiedItem === 'ip' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <CopyOutlined />
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <ol className={styles.list}>
            <li>在微信公众平台，进入 <strong>开发</strong> → <strong>基本配置</strong></li>
            <li>找到 <strong>IP白名单</strong>，点击"修改"</li>
            <li>
              添加上方显示的IP地址：<code>{serverIp}</code>
            </li>
            <li>保存并等待生效（通常立即生效）</li>
          </ol>

          <div className={styles.note}>
            <InfoCircleOutlined className={styles.noteIcon} />
            <span>
              注意：必须配置<strong>公网IP</strong>，不能使用域名或内网IP
            </span>
          </div>
        </div>
      </div>

      {/* 步骤3: 配置安全域名（可选） */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>3</span>
          <h4 className={styles.stepTitle}>配置安全域名（可选）</h4>
        </div>
        <div className={styles.stepContent}>
          <p className={styles.desc}>
            如果使用自定义域名访问本系统，需要配置JS接口安全域名
          </p>
          <ol className={styles.list}>
            <li>
              在微信公众平台，进入{' '}
              <strong>设置与开发</strong> → <strong>公众号设置</strong> →{' '}
              <strong>功能设置</strong>
            </li>
            <li>找到 <strong>JS接口安全域名</strong>，点击"设置"</li>
            <li>添加您的域名（例如：<code>your-domain.com</code>）</li>
            <li>下载验证文件并上传到网站根目录</li>
          </ol>
        </div>
      </div>

      {/* 步骤4: 主体类型说明 */}
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <span className={styles.stepNumber}>4</span>
          <h4 className={styles.stepTitle}>了解主体类型限制</h4>
        </div>
        <div className={styles.stepContent}>
          <div className={styles.comparisonTable}>
            <div className={styles.tableHeader}>
              <div className={styles.tableCell}>主体类型</div>
              <div className={styles.tableCell}>支持发布</div>
              <div className={styles.tableCell}>适用场景</div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.tableCell}>
                <strong>企业主体</strong>
              </div>
              <div className={styles.tableCell}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> 是
              </div>
              <div className={styles.tableCell}>
                生产环境，支持完整功能
              </div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.tableCell}>
                <strong>个人主体</strong>
              </div>
              <div className={styles.tableCell}>
                <WarningOutlined style={{ color: '#faad14' }} /> 否
              </div>
              <div className={styles.tableCell}>
                仅支持查询配置，不支持发布
              </div>
            </div>
            <div className={styles.tableRow}>
              <div className={styles.tableCell}>
                <strong>测试账号</strong>
              </div>
              <div className={styles.tableCell}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> 是
              </div>
              <div className={styles.tableCell}>
                开发测试，支持所有API接口
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 当前配置状态 */}
      {(accountType || subjectType) && (
        <div className={styles.statusBox}>
          <h4 className={styles.statusTitle}>当前配置状态</h4>
          <div className={styles.statusContent}>
            {accountType && (
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>账号类型:</span>
                <span className={styles.statusValue}>{accountType}</span>
              </div>
            )}
            {subjectType && (
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>主体类型:</span>
                <span className={styles.statusValue}>{subjectType}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 常见错误提示 */}
      <div className={styles.troubleshoot}>
        <h4 className={styles.troubleshootTitle}>常见问题排查</h4>
        <div className={styles.errorList}>
          <div className={styles.errorItem}>
            <div className={styles.errorCode}>40164: invalid ip</div>
            <div className={styles.errorSolution}>
              → IP白名单未配置或配置错误，请检查步骤2
            </div>
          </div>
          <div className={styles.errorItem}>
            <div className={styles.errorCode}>40001: invalid credential</div>
            <div className={styles.errorSolution}>
              → AppID或AppSecret错误，请检查步骤1
            </div>
          </div>
          <div className={styles.errorItem}>
            <div className={styles.errorCode}>48001: api unauthorized</div>
            <div className={styles.errorSolution}>
              → 个人主体公众号不支持发布，请查看步骤4
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
