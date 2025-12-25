'use client'

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseOutlined } from '@ant-design/icons'
import styles from './Modal.module.css'

export interface ModalProps {
  /** 是否显示 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 标题 */
  title?: React.ReactNode
  /** 内容 */
  children: React.ReactNode
  /** 底部操作区 */
  footer?: React.ReactNode
  /** 宽度 */
  width?: string | number
  /** 是否显示关闭按钮 */
  closable?: boolean
  /** 点击遮罩是否关闭 */
  maskClosable?: boolean
  /** 自定义类名 */
  className?: string
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  closable = true,
  maskClosable = true,
  className = ''
}) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && closable) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, closable, onClose])

  if (!open) return null

  const handleMaskClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && maskClosable) {
      onClose()
    }
  }

  const modalStyle = {
    width: typeof width === 'number' ? `${width}px` : width
  }

  const modalContent = (
    <div className={styles.overlay} onClick={handleMaskClick}>
      <div className={`${styles.modal} ${className}`} style={modalStyle}>
        {(title || closable) && (
          <div className={styles.header}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {closable && (
              <button className={styles.closeButton} onClick={onClose}>
                <CloseOutlined />
              </button>
            )}
          </div>
        )}

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
