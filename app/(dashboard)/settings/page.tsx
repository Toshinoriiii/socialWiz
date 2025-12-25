'use client'

import React from 'react'
import { EditOutlined, WechatOutlined, WeiboOutlined, InstagramOutlined } from '@ant-design/icons'
import styles from './settings.module.css'

const platforms = [
  { id: 1, name: '微信', icon: <WechatOutlined />, color: 'bg-green-500', connected: true },
  { id: 2, name: '微博', icon: <WeiboOutlined />, color: 'bg-red-500', connected: true },
  { id: 3, name: '抖音', icon: <InstagramOutlined />, color: 'bg-purple-500', connected: true },
  { id: 4, name: '小红书', icon: <InstagramOutlined />, color: 'bg-pink-500', connected: false }
]

export default function SettingsPage() {
  return (
    <div className={styles.settingsPage}>
      <div className={styles.card}>
        <h2 className={styles.title}>账户设置</h2>
        
        <div className={styles.grid}>
          <div className={styles.gridItem}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>个人信息</h3>
              <div className={styles.profileSection}>
                <div className={styles.avatarContainer}>
                  <div className={styles.avatar}>
                    <img
                      src="https://ai-public.mastergo.com/ai/img_res/ebd5dd28afd15227e18e6b7277380be5.jpg"
                      alt="Profile"
                    />
                  </div>
                  <button className={styles.avatarEditButton}>
                    <EditOutlined />
                  </button>
                </div>
                <div className={styles.formContainer}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>姓名</label>
                    <input
                      type="text"
                      defaultValue="张伟"
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>邮箱</label>
                    <input
                      type="email"
                      defaultValue="zhangwei@example.com"
                      disabled
                      className={styles.input}
                    />
                  </div>
                  <button className={styles.saveButton}>
                    保存更改
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.gridItemWide}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>第三方平台绑定</h3>
              <div className={styles.platformList}>
                {platforms.map(platform => (
                  <div key={platform.id} className={styles.platformItem}>
                    <div className={styles.platformItemContent}>
                      <div className={`${styles.platformIcon} ${platform.color}`}>
                        {platform.icon}
                      </div>
                      <div className={styles.platformInfo}>
                        <div className={styles.platformName}>{platform.name}</div>
                        <div className={styles.platformStatus}>
                          {platform.connected ? '已绑定' : '未绑定'}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`${styles.platformButton} ${
                        platform.connected ? styles.connected : styles.disconnected
                      }`}
                    >
                      {platform.connected ? '解绑' : '绑定'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.securityTitle}>安全设置</h3>
        <div className={styles.securityList}>
          <div className={styles.securityItem}>
            <div className={styles.securityItemInfo}>
              <h4>修改密码</h4>
              <p>定期更换密码以保护账户安全</p>
            </div>
            <button className={styles.securityButton}>
              修改
            </button>
          </div>
          <div className={styles.securityItem}>
            <div className={styles.securityItemInfo}>
              <h4>登录设备管理</h4>
              <p>查看和管理登录过的设备</p>
            </div>
            <button className={styles.securityButton}>
              查看
            </button>
          </div>
          <div className={styles.securityItem}>
            <div className={styles.securityItemInfo}>
              <h4>双重验证</h4>
              <p>为账户增加额外的安全保护</p>
            </div>
            <label className={styles.toggle}>
              <input type="checkbox" />
              <div className={styles.toggleSlider}></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
