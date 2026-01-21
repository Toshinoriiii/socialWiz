'use client'

import React, { useState } from 'react'
import { ChatMessage } from './AIChatPanel'
import styles from './AIChatMessage.module.css'

export interface AIChatMessageProps {
  message: ChatMessage
  onUseContent?: (content: string) => void
  onPublish?: (content: string, platforms: string[]) => void
  selectedPlatforms?: string[]
}

export const AIChatMessage: React.FC<AIChatMessageProps> = ({
  message,
  onUseContent,
  onPublish,
  selectedPlatforms = []
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    // 可以添加 toast 提示
  }

  const handleUse = () => {
    if (onUseContent && message.content) {
      onUseContent(message.content)
    }
  }

  const handlePublish = () => {
    if (onPublish && message.content && selectedPlatforms.length > 0) {
      onPublish(message.content, selectedPlatforms)
    }
  }

  // 处理意图识别标记:如果出现了INTENT_RECOGNITION_START,则移除整个INTENT_RECOGNIZING部分
  const processContent = (content: string) => {
    if (!content) return content
    
    let processedContent = content
    
    // 如果内容中包含意图识别结果,则移除"正在识别"的整个部分
    if (processedContent.includes('<!--INTENT_RECOGNITION_START-->')) {
      processedContent = processedContent.replace(
        /<!--INTENT_RECOGNIZING_START-->[\s\S]*?<!--INTENT_RECOGNIZING_END-->/g,
        ''
      )
    }
    
    // 移除所有剩余的HTML注释标签(但保留STEP标记和FINAL_RESULT等特殊标记)
    processedContent = processedContent.replace(
      /<!--(?!STEP|FINAL_RESULT|SEARCH_RESULT|IMAGE_GENERATION)(INTENT_[A-Z_]+?)-->/g,
      ''
    )
    
    return processedContent
  }

  if (isUser) {
    return (
      <div className={styles.messageWrapper}>
        <div className={styles.userMessage}>
          <div className={styles.messageContent}>{message.content}</div>
          <div className={styles.messageTime}>
            {message.timestamp.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    )
  }

  const displayContent = processContent(message.content)

  return (
    <div
      className={styles.messageWrapper}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.assistantMessage}>
        <div className={styles.avatar}>✨</div>
        <div className={styles.messageBody}>
          <div className={styles.messageContent}>
            {message.isLoading ? (
              <div className={styles.loading}>
                <span className={styles.loadingDot}>●</span>
                <span className={styles.loadingDot}>●</span>
                <span className={styles.loadingDot}>●</span>
              </div>
            ) : (
              <div className={styles.contentText}>{displayContent}</div>
            )}
          </div>
          {!message.isLoading && displayContent && (
            <div
              className={`${styles.messageActions} ${
                isHovered ? styles.visible : ''
              }`}
            >
              <button
                type="button"
                onClick={handleCopy}
                className={styles.actionButton}
                title="复制"
              >
                📋 复制
              </button>
              {onUseContent && (
                <button
                  type="button"
                  onClick={handleUse}
                  className={styles.actionButton}
                  title="使用此内容"
                >
                  ✓ 使用
                </button>
              )}
              {onPublish && selectedPlatforms.length > 0 && (
                <button
                  type="button"
                  onClick={handlePublish}
                  className={`${styles.actionButton} ${styles.publishButton}`}
                  title="发布"
                >
                  🚀 发布
                </button>
              )}
            </div>
          )}
          <div className={styles.messageTime}>
            {message.timestamp.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
