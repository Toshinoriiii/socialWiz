import React from 'react'
import styles from './Card.module.css'

export interface CardProps {
  /** 标题 */
  title?: React.ReactNode
  /** 额外操作 */
  extra?: React.ReactNode
  /** 内容 */
  children: React.ReactNode
  /** 是否有悬停效果 */
  hoverable?: boolean
  /** 是否有边框 */
  bordered?: boolean
  /** 自定义类名 */
  className?: string
  /** 点击事件 */
  onClick?: () => void
}

export const Card: React.FC<CardProps> = ({
  title,
  extra,
  children,
  hoverable = false,
  bordered = true,
  className = '',
  onClick
}) => {
  const cardClasses = [
    styles.card,
    hoverable && styles.hoverable,
    bordered && styles.bordered,
    onClick && styles.clickable,
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClasses} onClick={onClick}>
      {(title || extra) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {extra && <div className={styles.extra}>{extra}</div>}
        </div>
      )}

      <div className={styles.body}>{children}</div>
    </div>
  )
}
