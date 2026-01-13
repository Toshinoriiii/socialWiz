'use client'

import React, { useState, useRef } from 'react'
import styles from './ContentEditor.module.css'

export interface ContentEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  maxLength?: number
}

export const ContentEditor: React.FC<ContentEditorProps> = ({
  content,
  onChange,
  placeholder = '分享你的想法...',
  maxLength = 2000
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (maxLength && value.length > maxLength) return
    onChange(value)
  }

  const insertText = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.substring(0, start) + text + content.substring(end)
    onChange(newContent)

    // 恢复光标位置
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  const insertHashtag = () => {
    insertText('#话题# ')
  }

  const insertMention = () => {
    insertText('@用户 ')
  }

  const insertEmoji = (emoji: string) => {
    insertText(emoji)
  }

  const wordCount = content.length
  const remainingChars = maxLength ? maxLength - wordCount : null

  return (
    <div className={styles.editor}>
      {/* 工具栏 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            type="button"
            onClick={insertHashtag}
            className={styles.toolbarButton}
            title="插入话题标签"
          >
            #
          </button>
          <button
            type="button"
            onClick={insertMention}
            className={styles.toolbarButton}
            title="提及用户"
          >
            @
          </button>
          <div className={styles.emojiPicker}>
            <button
              type="button"
              className={styles.toolbarButton}
              title="插入表情"
            >
              😊
            </button>
            <div className={styles.emojiList}>
              {['😊', '😄', '😍', '👍', '❤️', '🎉', '🔥', '💯', '✨', '🚀'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className={styles.emojiItem}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.toolbarRight}>
          {remainingChars !== null && (
            <span
              className={`${styles.charCount} ${
                remainingChars < 50 ? styles.charCountWarning : ''
              }`}
            >
              {wordCount}/{maxLength}
            </span>
          )}
        </div>
      </div>

      {/* 文本输入区 */}
      <div
        className={`${styles.textareaWrapper} ${isFocused ? styles.focused : ''}`}
        onClick={() => textareaRef.current?.focus()}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={styles.textarea}
          rows={8}
        />
        {content.length === 0 && (
          <div className={styles.placeholderHint}>
            <div className={styles.hintItem}>
              <span className={styles.hintIcon}>💡</span>
              <span>使用 # 添加话题标签</span>
            </div>
            <div className={styles.hintItem}>
              <span className={styles.hintIcon}>✨</span>
              <span>使用 @ 提及用户</span>
            </div>
          </div>
        )}
      </div>

      {/* 媒体上传区域 */}
      <div className={styles.mediaSection}>
        <button type="button" className={styles.mediaButton}>
          <span className={styles.mediaIcon}>📷</span>
          <span>添加图片</span>
        </button>
        <button type="button" className={styles.mediaButton}>
          <span className={styles.mediaIcon}>🎬</span>
          <span>添加视频</span>
        </button>
      </div>
    </div>
  )
}
