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
              <div className={styles.contentText}>{message.content}</div>
            )}
          </div>
          {!message.isLoading && message.content && (
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
