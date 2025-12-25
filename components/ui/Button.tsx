import React from 'react'
import styles from './Button.module.css'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否加载中 */
  loading?: boolean
  /** 是否全宽 */
  fullWidth?: boolean
  /** 图标 */
  icon?: React.ReactNode
  /** 子元素 */
  children?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      icon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth && styles.fullWidth,
      loading && styles.loading,
      className
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {loading && (
          <span className={styles.spinner}>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
        {icon && !loading && <span className={styles.icon}>{icon}</span>}
        {children && <span className={styles.label}>{children}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
