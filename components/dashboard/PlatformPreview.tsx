'use client'

import React from 'react'
import styles from './PlatformPreview.module.css'

export interface PlatformPreviewProps {
  platform: {
    id: string
    name: string
    icon?: string | React.ReactNode
    color: string
    maxLength?: number
  }
  content: string
  images?: string[]
  isSelected: boolean
  onSelect: () => void
}

export const PlatformPreview: React.FC<PlatformPreviewProps> = ({
  platform,
  content,
  images = [],
  isSelected,
  onSelect
}) => {
  const wordCount = content.length
  const remainingChars = platform.maxLength ? platform.maxLength - wordCount : null
  const isOverLimit = remainingChars !== null && remainingChars < 0

  return (
    <div
      className={`${styles.previewCard} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      {/* 平台头部 */}
      <div className={styles.platformHeader}>
        <div className={styles.platformInfo}>
          <div
            className={styles.platformIcon}
            style={{ backgroundColor: platform.color }}
          >
            {typeof platform.icon === 'string' ? platform.icon : platform.icon || platform.name.charAt(0)}
          </div>
          <div>
            <div className={styles.platformName}>{platform.name}</div>
            <div className={styles.platformSubtitle}>
              {platform.maxLength ? `最多 ${platform.maxLength} 字` : '无字数限制'}
            </div>
          </div>
        </div>
        <div className={styles.checkbox}>
          {isSelected && <span className={styles.checkmark}>✓</span>}
        </div>
      </div>

      {/* 预览内容 */}
      <div className={styles.previewContent}>
        {images.length > 0 && (
          <div className={styles.previewImages}>
            {images.slice(0, 3).map((img, index) => (
              <div key={index} className={styles.previewImage}>
                <img src={img} alt={`预览 ${index + 1}`} />
              </div>
            ))}
            {images.length > 3 && (
              <div className={styles.moreImages}>+{images.length - 3}</div>
            )}
          </div>
        )}
        <div className={styles.previewText}>
          {content || (
            <span className={styles.emptyText}>内容将显示在这里...</span>
          )}
        </div>
      </div>

      {/* 字数统计 */}
      {platform.maxLength && (
        <div
          className={`${styles.charCount} ${
            isOverLimit ? styles.charCountError : ''
          } ${remainingChars !== null && remainingChars < 50 ? styles.charCountWarning : ''}`}
        >
          {wordCount}/{platform.maxLength}
          {isOverLimit && <span className={styles.errorText}> 超出限制</span>}
        </div>
      )}
    </div>
  )
}
