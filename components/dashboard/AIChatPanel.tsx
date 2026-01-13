'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AIChatMessage } from './AIChatMessage'
import { AIChatInput } from './AIChatInput'
import styles from './AIChatPanel.module.css'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

export interface AIChatPanelProps {
  onContentReady?: (content: string) => void
  onPublish?: (content: string, platforms: string[]) => void
  selectedPlatforms?: string[]
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  onContentReady,
  onPublish,
  selectedPlatforms = []
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 加载对话历史（从 localStorage）
  useEffect(() => {
    const savedMessages = localStorage.getItem('ai_chat_history')
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })))
      } catch (e) {
        console.error('Failed to load chat history:', e)
      }
    }
  }, [])

  // 保存对话历史
  const saveHistory = (newMessages: ChatMessage[]) => {
    try {
      localStorage.setItem('ai_chat_history', JSON.stringify(newMessages))
    } catch (e) {
      console.error('Failed to save chat history:', e)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isGenerating) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    saveHistory(newMessages)

    // 创建 AI 回复占位符
    const aiMessageId = (Date.now() + 1).toString()
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }

    const messagesWithAI = [...newMessages, aiMessage]
    setMessages(messagesWithAI)
    setIsGenerating(true)

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()

    try {
      // 调用流式 API
      const response = await fetch(`/api/ai/generate?prompt=${encodeURIComponent(content)}&stream=true`, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error('AI 生成失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                continue
              }

              try {
                const parsed = JSON.parse(data)
                if (parsed.content) {
                  aiContent += parsed.content
                  // 实时更新 AI 消息
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, content: aiContent, isLoading: true }
                        : msg
                    )
                  )
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 最终更新消息（移除重复）
      const finalMessages = newMessages.map((msg) =>
        msg.id === aiMessageId
          ? { ...msg, content: aiContent, isLoading: false }
          : msg
      )

      setMessages(finalMessages)
      saveHistory(finalMessages)

      // 通知父组件内容已准备好
      if (onContentReady && aiContent) {
        onContentReady(aiContent)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return
      }

      // 错误处理
      const errorMessage: ChatMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: '抱歉，生成内容时出现错误。请稍后重试。',
        timestamp: new Date(),
        isLoading: false
      }

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiMessageId ? errorMessage : msg))
      )
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const handleUseContent = (content: string) => {
    if (onContentReady) {
      onContentReady(content)
    }
  }

  const handleClearHistory = () => {
    if (confirm('确定要清空对话历史吗？')) {
      setMessages([])
      localStorage.removeItem('ai_chat_history')
    }
  }

  return (
    <div className={styles.chatPanel}>
      {/* 头部 */}
      <div className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.aiIcon}>✨</span>
          <div>
            <h2 className={styles.chatTitle}>AI 对话创作</h2>
            <p className={styles.chatSubtitle}>与 AI 对话，创作精彩内容</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className={styles.clearButton}
          >
            清空对话
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💬</div>
            <h3 className={styles.emptyTitle}>开始对话</h3>
            <p className={styles.emptyText}>
              告诉我你想要创作什么内容，我会帮你生成精彩的文案
            </p>
            <div className={styles.quickPrompts}>
              <button
                type="button"
                onClick={() => handleSendMessage('写一篇产品推广文案')}
                className={styles.quickPromptButton}
              >
                🚀 产品推广
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('写一篇活动宣传文案')}
                className={styles.quickPromptButton}
              >
                🎉 活动宣传
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('写一篇知识分享文章')}
                className={styles.quickPromptButton}
              >
                📚 知识分享
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.messagesList}>
            {messages.map((message) => (
              <AIChatMessage
                key={message.id}
                message={message}
                onUseContent={handleUseContent}
                onPublish={onPublish}
                selectedPlatforms={selectedPlatforms}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className={styles.inputContainer}>
        <AIChatInput
          onSend={handleSendMessage}
          disabled={isGenerating}
          placeholder="输入你的想法..."
        />
      </div>
    </div>
  )
}
