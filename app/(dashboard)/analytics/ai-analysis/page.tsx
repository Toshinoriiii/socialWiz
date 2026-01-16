'use client'

import React, { useState } from 'react'
import { Brain, Loader2, Sparkles, TrendingUp, AlertCircle, Lightbulb, BarChart3 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useUserStore } from '@/store/user.store'
import { toast } from 'sonner'

interface AnalysisResult {
  summary: string
  trends: string[]
  insights: string[]
  recommendations: string[]
  anomalies?: string[]
}

export default function AIAnalysisPage() {
  const { token } = useUserStore()
  const [dateRange, setDateRange] = useState('7天')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  const analyzeDataWithAI = async () => {
    if (!token) {
      toast.error('请先登录')
      return
    }

    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      // TODO: 调用实际的AI分析API
      // 这里先用模拟数据
      await new Promise(resolve => setTimeout(resolve, 2000))

      const mockResults: AnalysisResult[] = [
        {
          summary: '过去 7 天您的社交媒体数据表现良好，整体呈现上升趋势。浏览量增长 12.5%，互动率提升 8.2%，但转化率略有下降，需要关注内容质量优化。',
          trends: [
            '浏览量在下午 2-4 点达到峰值，建议在此时间段发布内容',
            '微信平台表现最佳，占总浏览量的 45%',
            '图文内容比纯文字内容互动率高 30%'
          ],
          insights: [
            '用户更偏好带有图片和视频的视觉化内容',
            '周末的互动率比工作日高 15%',
            '转发量增长明显，说明内容具有传播价值'
          ],
          recommendations: [
            '增加短视频内容以提高互动率',
            '优化发布时间，集中在下午 2-4 点发布',
            '加强用户生成内容（UGC）的引导和激励',
            '调整目标受众定位，提高转化率'
          ],
          anomalies: [
            '周三的浏览量异常下降 20%，可能与内容主题相关',
            '转化率在周末下降，建议分析周末内容策略'
          ]
        },
        {
          summary: '数据趋势显示您的账号正在快速增长期。粉丝增长稳定，内容质量持续提升，建议继续保持当前发布频率并优化内容形式。',
          trends: [
            '粉丝增长率保持在 5% 以上',
            '视频内容的完播率比图文高 25%',
            '互动率在发布后 2 小时内达到峰值'
          ],
          insights: [
            '用户对实用性和教育性内容反馈最好',
            '评论区互动活跃，建议加强社区运营',
            '跨平台内容表现差异明显，需要针对性优化'
          ],
          recommendations: [
            '增加视频内容比例，提高完播率',
            '在发布后 2 小时内积极回复评论',
            '针对不同平台制定差异化内容策略',
            '建立内容系列，提高用户粘性'
          ]
        }
      ]

      const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)]
      setAnalysisResult(randomResult)
      toast.success('AI 分析完成')
    } catch (error) {
      console.error('AI 分析失败:', error)
      toast.error('分析失败，请重试')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">AI 智能分析</h1>
        <p className="text-gray-600">使用 AI 深度分析您的社交媒体数据，获取专业洞察和优化建议</p>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-black">数据分析</CardTitle>
              <CardDescription className="text-gray-600 mt-1">
                选择时间范围，让 AI 为您分析数据趋势和优化建议
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Select
                value={dateRange}
                onValueChange={setDateRange}
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
                disabled={isAnalyzing}
                className="bg-black text-white hover:bg-gray-800"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Brain className="size-4 mr-2" />
                    开始分析
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isAnalyzing && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <Brain className="size-16 text-gray-300 animate-pulse" />
                <Sparkles className="size-6 text-blue-500 absolute -top-1 -right-1 animate-ping" />
              </div>
              <p className="text-gray-600 mt-4">AI 正在分析您的数据...</p>
              <p className="text-sm text-gray-500 mt-2">这可能需要几秒钟</p>
            </div>
          </CardContent>
        )}

        {analysisResult && !isAnalyzing && (
          <CardContent className="space-y-6">
            {/* 数据摘要 */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <BarChart3 className="size-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-medium text-black mb-2">数据摘要</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{analysisResult.summary}</p>
                </div>
              </div>
            </div>

            {/* 趋势分析 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="size-5 text-green-600" />
                <h3 className="font-medium text-black">趋势分析</h3>
              </div>
              <div className="space-y-2">
                {analysisResult.trends.map((trend, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-700">{trend}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 数据洞察 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="size-5 text-yellow-600" />
                <h3 className="font-medium text-black">数据洞察</h3>
              </div>
              <div className="space-y-2">
                {analysisResult.insights.map((insight, index) => (
                  <div key={index} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-gray-700">{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 优化建议 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-5 text-purple-600" />
                <h3 className="font-medium text-black">优化建议</h3>
              </div>
              <div className="space-y-2">
                {analysisResult.recommendations.map((recommendation, index) => (
                  <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5 border-purple-300 text-purple-700">
                        {index + 1}
                      </Badge>
                      <p className="text-sm text-gray-700 flex-1">{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 异常检测 */}
            {analysisResult.anomalies && analysisResult.anomalies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="size-5 text-orange-600" />
                  <h3 className="font-medium text-black">异常检测</h3>
                </div>
                <div className="space-y-2">
                  {analysisResult.anomalies.map((anomaly, index) => (
                    <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm text-gray-700">{anomaly}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}

        {!analysisResult && !isAnalyzing && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12">
              <Brain className="size-16 text-gray-300 mb-4" />
              <p className="text-gray-600 mb-2">还没有分析结果</p>
              <p className="text-sm text-gray-500">点击"开始分析"按钮，让 AI 为您分析数据</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
