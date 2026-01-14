'use client'

export default function DataOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">数据概览</h1>
        <p className="text-muted-foreground mt-2">查看整体数据表现和趋势</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">总作品数</p>
          <p className="text-2xl font-bold text-foreground mt-2">0</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">总浏览量</p>
          <p className="text-2xl font-bold text-foreground mt-2">0</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">总互动数</p>
          <p className="text-2xl font-bold text-foreground mt-2">0</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">总粉丝数</p>
          <p className="text-2xl font-bold text-foreground mt-2">0</p>
        </div>
      </div>
    </div>
  )
}
