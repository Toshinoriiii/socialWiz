'use client'

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">账号管理</h1>
        <p className="text-muted-foreground mt-2">管理您的社交媒体账号</p>
      </div>
      
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">暂无账号，请添加您的社交媒体账号</p>
      </div>
    </div>
  )
}
