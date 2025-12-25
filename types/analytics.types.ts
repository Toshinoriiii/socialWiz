export interface Analytics {
  id: string
  contentPlatformId: string
  platformAccountId: string
  date: Date
  views: number
  likes: number
  comments: number
  shares: number
  followers: number
  engagementRate: number
  createdAt: Date
}

export interface AnalyticsMetric {
  id: number
  name: string
  value: string
  change: string
}

export interface StatsData {
  title: string
  value: string
  change: string
  chartType: 'line' | 'bar' | 'area' | 'pie'
}

export interface DateRangeOption {
  label: string
  value: string
  days: number
}

export interface PlatformPerformance {
  platform: string
  views: number
  likes: number
  comments: number
  shares: number
  followers: number
  engagementRate: number
}

export interface TrendData {
  date: string
  value: number
  metric: string
}

export interface AIAnalysisResult {
  trend: string
  anomalies: string[]
  platformComparison: string
  contentInsights: string
  recommendations: string[]
}
export interface Analytics {
  id: string
  contentPlatformId: string
  platformAccountId: string
  date: Date
  views: number
  likes: number
  comments: number
  shares: number
  followers: number
  engagementRate: number
  createdAt: Date
}

export interface AnalyticsMetric {
  id: number
  name: string
  value: string
  change: string
}

export interface StatsData {
  title: string
  value: string
  change: string
  chartType: 'line' | 'bar' | 'area' | 'pie'
}

export interface DateRangeOption {
  label: string
  value: string
  days: number
}

export interface PlatformPerformance {
  platform: string
  views: number
  likes: number
  comments: number
  shares: number
  followers: number
  engagementRate: number
}

export interface TrendData {
  date: string
  value: number
  metric: string
}

export interface AIAnalysisResult {
  trend: string
  anomalies: string[]
  platformComparison: string
  contentInsights: string
  recommendations: string[]
}
