import React from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import styles from './StatsCard.module.css'

export interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  trend?: 'up' | 'down'
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon,
  trend
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.info}>
          <p className={styles.title}>{title}</p>
          <h3 className={styles.value}>{value}</h3>
        </div>
        {icon && <div className={styles.icon}>{icon}</div>}
      </div>

      {change !== undefined && (
        <div className={styles.footer}>
          <span className={`${styles.change} ${styles[trend || 'up']}`}>
            {trend === 'up' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(change)}%
          </span>
          <span className={styles.label}>较上周</span>
        </div>
      )}
    </div>
  )
}
