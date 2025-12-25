'use client'

import React, { useState } from 'react'
import { BarChartOutlined, WechatOutlined, WeiboOutlined, InstagramOutlined } from '@ant-design/icons'
import styles from './analytics.module.css'

const platforms = [
  { id: 1, name: '微信', icon: <WechatOutlined />, color: 'bg-green-500', connected: true },
  { id: 2, name: '微博', icon: <WeiboOutlined />, color: 'bg-red-500', connected: true },
  { id: 3, name: '抖音', icon: <InstagramOutlined />, color: 'bg-purple-500', connected: true }
]

const analyticsMetrics = [
  { id: 1, name: '浏览量', value: '128,456', change: '+12.5%' },
  { id: 2, name: '互动率', value: '42.3%', change: '+8.2%' },
  { id: 3, name: '转发量', value: '12,432', change: '+5.7%' },
  { id: 4, name: '转化率', value: '3.8%', change: '-1.2%' }
]

export default function AnalyticsPage() {
  const [analysisState, setAnalysisState] = useState({
    aiAnalysis: '',
    isAnalyzing: false,
    chartType: '线形图',
    dateRange: '7天'
  })

  const analyzeDataWithAI = () => {
    setAnalysisState(prev => ({ ...prev, isAnalyzing: true }))
    
    setTimeout(() => {
      const sampleAnalyses = [
        "📊 数据洞察：过去 7 天浏览量增长 12.5%，主要来源于微信平台的内容推广。建议增加短视频内容以提高互动率。",
        "📈 趋势分析：互动率显著提升，特别是下午时段表现最佳。建议优化发布时间以最大化曝光效果。",
        "📉 异常检测：转化率略有下降，可能与内容相关性有关。建议调整目标受众定位并优化内容策略。",
        "🎯 优化建议：转发量增长明显，说明内容具有传播价值。建议加强用户生成内容（UGC）的引导。"
      ]
      const randomAnalysis = sampleAnalyses[Math.floor(Math.random() * sampleAnalyses.length)]
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        aiAnalysis: randomAnalysis
      }))
    }, 2000)
  }

  return (
    <div className={styles.analyticsPage}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>数据分析</h2>
          <div className={styles.headerActions}>
            <select
              className={styles.select}
              value={analysisState.dateRange}
              onChange={(e) => setAnalysisState(prev => ({ ...prev, dateRange: e.target.value }))}
            >
              <option value="7天">最近 7 天</option>
              <option value="30天">最近 30 天</option>
              <option value="90天">最近 90 天</option>
            </select>
            <button
              className={styles.analyzeButton}
              onClick={analyzeDataWithAI}
              disabled={analysisState.isAnalyzing}
            >
              {analysisState.isAnalyzing ? '分析中...' : 'AI 一键分析'}
            </button>
          </div>
        </div>

        {analysisState.aiAnalysis && (
          <div className={styles.aiAnalysis}>
            <div className={styles.aiAnalysisContent}>
              <div className={styles.aiAnalysisIcon}>
                <BarChartOutlined />
              </div>
              <div className={styles.aiAnalysisText}>
                <h3 className={styles.aiAnalysisTitle}>AI 智能分析</h3>
                <p className={styles.aiAnalysisDesc}>{analysisState.aiAnalysis}</p>
              </div>
            </div>
          </div>
        )}

        <div className={styles.metricsGrid}>
          {analyticsMetrics.map(metric => (
            <div key={metric.id} className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3 className={styles.metricName}>{metric.name}</h3>
                <span className={`${styles.metricChange} ${metric.change.startsWith('+') ? styles.positive : styles.negative}`}>
                  {metric.change}
                </span>
              </div>
              <div className={styles.metricValue}>{metric.value}</div>
              <div className={styles.metricProgress}>
                <div
                  className={`${styles.metricProgressBar} ${metric.change.startsWith('+') ? styles.positive : styles.negative}`}
                  style={{ width: metric.change.startsWith('+') ? metric.change : metric.change.substring(1) }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>流量趋势</h3>
            <div className={styles.chartTypeButtons}>
              {['线形图', '柱状图', '面积图'].map((type) => (
                <button
                  key={type}
                  className={`${styles.chartTypeButton} ${analysisState.chartType === type ? styles.active : ''}`}
                  onClick={() => setAnalysisState(prev => ({ ...prev, chartType: type }))}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.chartPlaceholder}>
            <div className={styles.chartPlaceholderContent}>
              <div className={styles.chartPlaceholderInner}>
                <BarChartOutlined className={styles.chartPlaceholderIcon} />
                <p className={styles.chartPlaceholderText}>流量趋势图表</p>
                <p className={styles.chartPlaceholderSubtext}>此处将显示基于 {analysisState.dateRange} 的数据</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.platformSection}>
          <h3 className={styles.platformTitle}>各平台表现</h3>
          <div className={styles.platformGrid}>
            {platforms.filter(p => p.connected).map(platform => (
              <div key={platform.id} className={styles.platformCard}>
                <div className={styles.platformHeader}>
                  <div className={`${styles.platformIcon} ${platform.color}`}>
                    {platform.icon}
                  </div>
                  <div className={styles.platformInfo}>
                    <h4 className={styles.platformName}>{platform.name}</h4>
                    <p className={styles.platformMetric}>浏览量: 24,568</p>
                  </div>
                </div>
                <div className={styles.platformProgress}>
                  <div className={styles.platformProgressHeader}>
                    <span className={styles.platformProgressLabel}>互动率</span>
                    <span className={styles.platformProgressValue}>42.3%</span>
                  </div>
                  <div className={styles.platformProgressBar}>
                    <div className={styles.platformProgressFill} style={{ width: '42.3%' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
