import React from 'react'
import styles from './Input.module.css'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 标签文本 */
  label?: string
  /** 错误提示 */
  error?: string
  /** 帮助文本 */
  helpText?: string
  /** 输入框尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 前置图标 */
  prefixIcon?: React.ReactNode
  /** 后置图标 */
  suffixIcon?: React.ReactNode
  /** 是否全宽 */
  fullWidth?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helpText,
      size = 'md',
      prefixIcon,
      suffixIcon,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const wrapperClasses = [
      styles.wrapper,
      fullWidth && styles.fullWidth
    ]
      .filter(Boolean)
      .join(' ')

    const inputClasses = [
      styles.input,
      styles[size],
      error && styles.error,
      prefixIcon && styles.hasPrefix,
      suffixIcon && styles.hasSuffix,
      className
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={wrapperClasses}>
        {label && (
          <label className={styles.label}>
            {label}
            {props.required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div className={styles.inputWrapper}>
          {prefixIcon && <span className={styles.prefixIcon}>{prefixIcon}</span>}
          
          <input ref={ref} className={inputClasses} {...props} />
          
          {suffixIcon && <span className={styles.suffixIcon}>{suffixIcon}</span>}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
        {helpText && !error && <p className={styles.helpText}>{helpText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
