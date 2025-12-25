import React from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/date'
import { Card } from '@/components/ui'
import styles from './ContentGrid.module.css'

interface ContentItem {
  id: string
  title: string
  coverImage?: string
  createdAt: Date
  platforms: string[]
  status: string
}

export interface ContentGridProps {
  items: ContentItem[]
  loading?: boolean
}

export const ContentGrid: React.FC<ContentGridProps> = ({ items, loading }) => {
  if (loading) {
    return (
      <div className={styles.grid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.skeleton}>
            <div className={styles.skeletonImage} />
            <div className={styles.skeletonText} />
            <div className={styles.skeletonText} style={{ width: '60%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>暂无内容</p>
        <Link href="/publish" className={styles.link}>
          立即创建
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Card key={item.id} hoverable className={styles.contentCard}>
          {item.coverImage && (
            <div className={styles.cover}>
              <img src={item.coverImage} alt={item.title} />
            </div>
          )}
          <div className={styles.content}>
            <h4 className={styles.title}>{item.title}</h4>
            <div className={styles.meta}>
              <span className={styles.date}>{formatDate(item.createdAt)}</span>
              <div className={styles.platforms}>
                {item.platforms.map((platform) => (
                  <span key={platform} className={styles.platform}>
                    {platform}
                  </span>
                ))}
              </div>
            </div>
            <span className={`${styles.status} ${styles[item.status.toLowerCase()]}`}>
              {item.status}
            </span>
          </div>
        </Card>
      ))}
    </div>
  )
}
