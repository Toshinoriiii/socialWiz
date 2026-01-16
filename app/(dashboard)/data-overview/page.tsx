'use client'

import { Card, CardContent } from '@/components/ui/Card'

export default function DataOverviewPage() {
  return (
    <div className="space-y-6 bg-white min-h-screen p-6">
      <div>
        <h1 className="text-2xl font-bold text-black">数据概览</h1>
        <p className="text-gray-600 mt-2">查看整体数据表现和趋势</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-gray-300 bg-white">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">总作品数</p>
            <p className="text-2xl font-bold text-black mt-2">0</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-300 bg-white">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">总浏览量</p>
            <p className="text-2xl font-bold text-black mt-2">0</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-300 bg-white">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">总互动数</p>
            <p className="text-2xl font-bold text-black mt-2">0</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-300 bg-white">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">总粉丝数</p>
            <p className="text-2xl font-bold text-black mt-2">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
