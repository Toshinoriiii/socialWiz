'use client'

import React, { useState, useRef, useEffect } from 'react'
import styles from './AIChatInput.module.css'

export interface AIChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export const AIChatInput: React.FC<AIChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = '输入消息...'
}) => {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input)
      setInput('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.inputWrapper}>
      <div className={styles.inputContainer}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={styles.textarea}
          rows={1}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className={styles.sendButton}
        >
          {disabled ? (
            <span className={styles.spinner}>⏳</span>
          ) : (
            <span>📤</span>
          )}
        </button>
      </div>
      <div className={styles.inputHint}>
        <span>按 Enter 发送，Shift + Enter 换行</span>
      </div>
    </div>
  )
}
