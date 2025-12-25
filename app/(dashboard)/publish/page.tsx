'use client'

import React, { useState } from 'react'
import {
  WechatOutlined,
  WeiboOutlined,
  InstagramOutlined
} from '@ant-design/icons'
import styles from './publish.module.css'

// 平台数据
const platforms = [
  { id: 1, name: '微信', icon: <WechatOutlined />, color: 'bg-green-500', connected: true },
  { id: 2, name: '微博', icon: <WeiboOutlined />, color: 'bg-red-500', connected: true },
  { id: 3, name: '抖音', icon: <InstagramOutlined />, color: 'bg-purple-500', connected: true },
  { id: 4, name: '小红书', icon: <InstagramOutlined />, color: 'bg-pink-500', connected: false }
]

// AI 写作模板
const aiTemplates = [
  { id: 1, name: '产品推广', description: '突出产品特点和优势' },
  { id: 2, name: '活动宣传', description: '吸引用户参与活动' },
  { id: 3, name: '节日祝福', description: '温馨的节日问候' },
  { id: 4, name: '知识分享', description: '专业领域的干货内容' }
]

export default function PublishPage() {
  const [postContent, setPostContent] = useState({
    title: '',
    content: '',
    selectedPlatforms: [] as number[],
    aiPrompt: '',
    isGenerating: false,
    generatedContent: ''
  })

  const handlePlatformSelect = (platformId: number) => {
    setPostContent(prev => {
      const isSelected = prev.selectedPlatforms.includes(platformId)
      return {
        ...prev,
        selectedPlatforms: isSelected
          ? prev.selectedPlatforms.filter(id => id !== platformId)
          : [...prev.selectedPlatforms, platformId]
      }
    })
  }

  const generateAIContent = () => {
    if (!postContent.aiPrompt.trim()) return
    setPostContent(prev => ({ ...prev, isGenerating: true }))
    
    setTimeout(() => {
      const sampleContents = [
        "🚀 全新产品震撼上市！\n\n🌟 突破性技术创新\n💡 智能化用户体验\n🎯 精准满足您的需求\n\n立即体验，开启未来生活！#科技 #创新 #新品发布",
        "🎉 限时优惠活动来袭！\n\n🔥 超值折扣享不停\n🎁 精美礼品免费送\n⏰ 活动时间：本周末\n📍 地点：各大门店同步开启\n\n赶快参与，惊喜不断！#优惠 #活动 #限时抢购",
        "🎄 温馨圣诞祝福！\n\n✨ 愿您拥有一个充满爱与欢笑的圣诞节\n🌟 新的一年，愿所有美好如期而至\n💝 感谢一路相伴，我们继续前行\n\n祝您圣诞快乐，新年幸福！#圣诞快乐 #新年祝福",
        "📚 行业干货分享\n\n🔍 今日知识点：数字化转型的关键要素\n✅ 明确战略目标\n✅ 构建敏捷组织\n✅ 技术创新驱动\n✅ 数据价值挖掘\n\n关注我们，获取更多专业知识！#知识分享 #数字化转型"
      ]
      const randomContent = sampleContents[Math.floor(Math.random() * sampleContents.length)]
      setPostContent(prev => ({
        ...prev,
        isGenerating: false,
        generatedContent: randomContent
      }))
    }, 2000)
  }

  return (
    <div className={styles.publishPage}>
      <div className={styles.card}>
        <h2 className={styles.title}>内容发布</h2>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>标题</label>
          <input
            type="text"
            value={postContent.title}
            onChange={(e) => setPostContent(prev => ({ ...prev, title: e.target.value }))}
            className={styles.input}
            placeholder="请输入内容标题"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>内容</label>
          <textarea
            value={postContent.generatedContent || postContent.content}
            onChange={(e) => setPostContent(prev => ({ ...prev, content: e.target.value }))}
            rows={8}
            className={styles.textarea}
            placeholder="请输入要发布的内容..."
          />
        </div>

        <div className={styles.divider}>
          <h3 className={styles.sectionTitle}>AI 写作助手</h3>
          <div className={styles.templateGrid}>
            {aiTemplates.map(template => (
              <button
                key={template.id}
                className={styles.templateButton}
                onClick={() => setPostContent(prev => ({
                  ...prev,
                  aiPrompt: template.name
                }))}
              >
                <div className={styles.templateName}>{template.name}</div>
                <div className={styles.templateDesc}>{template.description}</div>
              </button>
            ))}
          </div>

          <div className={styles.inputGroup}>
            <input
              type="text"
              value={postContent.aiPrompt}
              onChange={(e) => setPostContent(prev => ({ ...prev, aiPrompt: e.target.value }))}
              className={styles.inputGroupInput}
              placeholder="描述您想要的内容主题，如：新产品推广文案"
            />
            <button
              onClick={generateAIContent}
              disabled={postContent.isGenerating}
              className={styles.generateButton}
            >
              {postContent.isGenerating ? '生成中...' : '生成内容'}
            </button>
          </div>

          {postContent.generatedContent && (
            <div className={styles.aiResult}>
              <div className={styles.aiResultHeader}>
                <h4 className={styles.aiResultTitle}>AI 生成结果</h4>
                <button
                  onClick={() => setPostContent(prev => ({ ...prev, content: prev.generatedContent }))}
                  className={styles.useButton}
                >
                  使用此内容
                </button>
              </div>
              <pre className={styles.aiResultContent}>{postContent.generatedContent}</pre>
            </div>
          )}
        </div>

        <div className={styles.divider}>
          <h3 className={styles.sectionTitle}>发布到平台</h3>
          <div className={styles.platformGrid}>
            {platforms.filter(p => p.connected).map(platform => (
              <button
                key={platform.id}
                onClick={() => handlePlatformSelect(platform.id)}
                className={`${styles.platformButton} ${
                  postContent.selectedPlatforms.includes(platform.id) ? styles.active : ''
                }`}
              >
                <div className={`${styles.platformIcon} ${platform.color}`}></div>
                {platform.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.submitButton}>
            发布内容
          </button>
        </div>
      </div>
    </div>
  )
}
