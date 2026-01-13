'use client'

import React, { useState } from 'react'
import styles from './AIAssistantPanel.module.css'

export interface AITemplate {
  id: string
  name: string
  description: string
  icon: string
  prompt: string
}

export interface AIAssistantPanelProps {
  onGenerate: (prompt: string, template?: string) => void
  isGenerating?: boolean
  generatedContent?: string
  onUseContent?: (content: string) => void
}

const defaultTemplates: AITemplate[] = [
  {
    id: 'product',
    name: '产品推广',
    description: '突出产品特点和优势',
    icon: '🚀',
    prompt: '写一篇产品推广文案，突出产品特点和优势'
  },
  {
    id: 'activity',
    name: '活动宣传',
    description: '吸引用户参与活动',
    icon: '🎉',
    prompt: '写一篇活动宣传文案，吸引用户参与'
  },
  {
    id: 'festival',
    name: '节日祝福',
    description: '温馨的节日问候',
    icon: '🎄',
    prompt: '写一篇节日祝福文案，温馨感人'
  },
  {
    id: 'knowledge',
    name: '知识分享',
    description: '专业领域的干货内容',
    icon: '📚',
    prompt: '写一篇知识分享文案，专业且有价值'
  },
  {
    id: 'story',
    name: '故事叙述',
    description: '引人入胜的故事内容',
    icon: '📖',
    prompt: '写一篇故事叙述文案，引人入胜'
  },
  {
    id: 'tips',
    name: '实用技巧',
    description: '实用的生活或工作技巧',
    icon: '💡',
    prompt: '写一篇实用技巧分享文案'
  }
]

export const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({
  onGenerate,
  isGenerating = false,
  generatedContent,
  onUseContent
}) => {
  const [customPrompt, setCustomPrompt] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const handleTemplateClick = (template: AITemplate) => {
    setSelectedTemplate(template.id)
    setCustomPrompt(template.prompt)
  }

  const handleGenerate = () => {
    if (!customPrompt.trim()) return
    onGenerate(customPrompt, selectedTemplate || undefined)
  }

  const handleUseContent = () => {
    if (generatedContent && onUseContent) {
      onUseContent(generatedContent)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.aiIcon}>✨</span>
          <span>AI 写作助手</span>
        </div>
        <div className={styles.panelSubtitle}>
          让 AI 帮你创作精彩内容
        </div>
      </div>

      {/* 模板选择 */}
      <div className={styles.templatesSection}>
        <div className={styles.sectionTitle}>快速模板</div>
        <div className={styles.templateGrid}>
          {defaultTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateClick(template)}
              className={`${styles.templateCard} ${
                selectedTemplate === template.id ? styles.selected : ''
              }`}
            >
              <span className={styles.templateIcon}>{template.icon}</span>
              <div className={styles.templateInfo}>
                <div className={styles.templateName}>{template.name}</div>
                <div className={styles.templateDesc}>{template.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 自定义提示词 */}
      <div className={styles.promptSection}>
        <div className={styles.sectionTitle}>自定义提示</div>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="描述你想要的内容，例如：写一篇关于科技创新的文章..."
          className={styles.promptInput}
          rows={3}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!customPrompt.trim() || isGenerating}
          className={styles.generateButton}
        >
          {isGenerating ? (
            <>
              <span className={styles.spinner}>⏳</span>
              生成中...
            </>
          ) : (
            <>
              <span>✨</span>
              生成内容
            </>
          )}
        </button>
      </div>

      {/* 生成结果 */}
      {generatedContent && (
        <div className={styles.resultSection}>
          <div className={styles.resultHeader}>
            <span className={styles.resultTitle}>生成结果</span>
            {onUseContent && (
              <button
                type="button"
                onClick={handleUseContent}
                className={styles.useButton}
              >
                使用此内容
              </button>
            )}
          </div>
          <div className={styles.resultContent}>{generatedContent}</div>
        </div>
      )}
    </div>
  )
}
