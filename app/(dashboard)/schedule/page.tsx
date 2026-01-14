'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'

export default function SchedulePage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">日程管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                &lt; 上一月
              </Button>
              <Button variant="default" size="sm">
                今天
              </Button>
              <Button variant="outline" size="sm">
                下一月 &gt;
              </Button>
            </div>
            <div className="text-lg font-medium">2025年12月</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                月视图
              </Button>
              <Button variant="outline" size="sm">
                周视图
              </Button>
              <Button variant="outline" size="sm">
                日视图
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
              <div key={day} className="text-center p-2 font-medium text-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, index) => {
              const dayNumber = (index % 31) + 1
              const isCurrentMonth = index >= 1 && index <= 31
              const isToday = dayNumber === 25
              return (
                <div
                  key={index}
                  className={`min-h-[8rem] border border-border p-2 bg-background ${
                    isToday ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`text-right p-1 ${
                    isToday
                      ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center ml-auto'
                      : isCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}>
                    {dayNumber}
                  </div>
                  {(dayNumber === 25 || dayNumber === 26 || dayNumber === 28) && (
                    <div className="mt-1 flex flex-col gap-1">
                      <div className="bg-blue-100 text-blue-800 text-xs p-1 rounded truncate">
                        新产品发布
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">即将发布的安排</h3>
            <div className="flex flex-col gap-3">
              {[
                { id: 1, title: '新产品发布会预告', platform: '微信', time: '2025-12-25 14:00', status: '即将发布' },
                { id: 2, title: '用户调研报告分享', platform: '微博', time: '2025-12-26 10:00', status: '待发布' },
                { id: 3, title: '节日促销活动宣传', platform: '抖音', time: '2025-12-28 16:00', status: '待发布' }
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{item.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{item.platform}</span>
                      <span>•</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={item.status === '即将发布' ? 'default' : 'secondary'}
                    >
                      {item.status}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      编辑
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
