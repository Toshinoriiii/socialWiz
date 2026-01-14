'use client'

import React, { useState } from 'react'
import { BarChart3, MessageCircle, MessageSquare, Instagram } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

const platforms = [
  { id: 1, name: '微信', icon: <MessageCircle className="size-5" />, color: 'bg-green-500', connected: true },
  { id: 2, name: '微博', icon: <MessageSquare className="size-5" />, color: 'bg-red-500', connected: true },
  { id: 3, name: '抖音', icon: <Instagram className="size-5" />, color: 'bg-purple-500', connected: true }
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
    <div className="max-w-5xl mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">数据分析</CardTitle>
            <div className="flex gap-3">
              <Select
                value={analysisState.dateRange}
                onValueChange={(value) => setAnalysisState(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7天">最近 7 天</SelectItem>
                  <SelectItem value="30天">最近 30 天</SelectItem>
                  <SelectItem value="90天">最近 90 天</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={analyzeDataWithAI}
                disabled={analysisState.isAnalyzing}
              >
                {analysisState.isAnalyzing ? '分析中...' : 'AI 一键分析'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {analysisState.aiAnalysis && (
          <CardContent>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-blue-600">
                  <BarChart3 className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">AI 智能分析</h3>
                  <p className="text-sm text-foreground">{analysisState.aiAnalysis}</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {analyticsMetrics.map(metric => {
              const changeValue = parseFloat(metric.change.replace(/[+%]/g, ''))
              return (
                <Card key={metric.id}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{metric.name}</h3>
                      <Badge
                        variant={metric.change.startsWith('+') ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {metric.change}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold mb-3">{metric.value}</div>
                    <Progress
                      value={Math.min(changeValue, 100)}
                      className={metric.change.startsWith('+') ? 'h-2' : 'h-2'}
                    />
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="bg-muted/50 rounded-lg p-5 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">流量趋势</h3>
              <div className="flex gap-2">
                {['线形图', '柱状图', '面积图'].map((type) => (
                  <Button
                    key={type}
                    variant={analysisState.chartType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAnalysisState(prev => ({ ...prev, chartType: type }))}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-80 bg-background rounded-lg p-4 border border-border">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="size-9 text-blue-300 mx-auto mb-2" />
                  <p className="text-muted-foreground">流量趋势图表</p>
                  <p className="text-sm text-muted-foreground mt-1">此处将显示基于 {analysisState.dateRange} 的数据</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-5">
            <h3 className="font-medium mb-4">各平台表现</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platforms.filter(p => p.connected).map(platform => (
                <Card key={platform.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center mb-3">
                      <div className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center text-white`}>
                        {platform.icon}
                      </div>
                      <div className="ml-3">
                        <h4 className="font-medium">{platform.name}</h4>
                        <p className="text-sm text-muted-foreground">浏览量: 24,568</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">互动率</span>
                        <span className="font-medium">42.3%</span>
                      </div>
                      <Progress value={42.3} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
