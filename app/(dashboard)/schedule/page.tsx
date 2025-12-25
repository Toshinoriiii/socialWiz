'use client'

import React from 'react'
import styles from './schedule.module.css'

export default function SchedulePage() {
  return (
    <div className={styles.schedulePage}>
      <div className={styles.card}>
        <h2 className={styles.title}>日程管理</h2>
        
        <div className={styles.calendarHeader}>
          <div className={styles.navButtons}>
            <button className={styles.navButton}>
              &lt; 上一月
            </button>
            <button className={`${styles.navButton} ${styles.primary}`}>
              今天
            </button>
            <button className={styles.navButton}>
              下一月 &gt;
            </button>
          </div>
          <div className={styles.currentMonth}>2025年12月</div>
          <div className={styles.viewButtons}>
            <button className={styles.viewButton}>
              月视图
            </button>
            <button className={styles.viewButton}>
              周视图
            </button>
            <button className={styles.viewButton}>
              日视图
            </button>
          </div>
        </div>

        <div className={styles.calendarWeekdays}>
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
            <div key={day} className={styles.weekday}>{day}</div>
          ))}
        </div>

        <div className={styles.calendarGrid}>
          {Array.from({ length: 35 }).map((_, index) => {
            const dayNumber = (index % 31) + 1
            const isCurrentMonth = index >= 1 && index <= 31
            const isToday = dayNumber === 25
            return (
              <div
                key={index}
                className={`${styles.calendarDay} ${
                  isToday ? styles.today : ''
                }`}
              >
                <div className={`${styles.dayNumber} ${
                  isToday
                    ? styles.today
                    : isCurrentMonth
                    ? ''
                    : styles.otherMonth
                }`}>
                  {dayNumber}
                </div>
                {(dayNumber === 25 || dayNumber === 26 || dayNumber === 28) && (
                  <div className={styles.eventList}>
                    <div className={styles.event}>
                      新产品发布
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.upcomingSection}>
          <h3 className={styles.upcomingTitle}>即将发布的安排</h3>
          <div className={styles.upcomingList}>
            {[
              { id: 1, title: '新产品发布会预告', platform: '微信', time: '2025-12-25 14:00', status: '即将发布' },
              { id: 2, title: '用户调研报告分享', platform: '微博', time: '2025-12-26 10:00', status: '待发布' },
              { id: 3, title: '节日促销活动宣传', platform: '抖音', time: '2025-12-28 16:00', status: '待发布' }
            ].map(item => (
              <div key={item.id} className={styles.upcomingItem}>
                <div className={styles.upcomingContent}>
                  <h4 className={styles.upcomingItemTitle}>{item.title}</h4>
                  <div className={styles.upcomingItemMeta}>
                    <span>{item.platform}</span>
                    <span>{item.time}</span>
                  </div>
                </div>
                <div className={styles.upcomingActions}>
                  <span className={`${styles.badge} ${
                    item.status === '即将发布'
                      ? styles.pending
                      : styles.draft
                  }`}>
                    {item.status}
                  </span>
                  <button className={styles.editButton}>
                    编辑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
