// 格式化日期时间
export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 格式化日期
export const formatDate = (date: Date | string): string => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

// 获取相对时间
export const getRelativeTime = (date: Date | string): string => {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day
  const year = 365 * day
  
  if (diffMs < minute) {
    return '刚刚'
  } else if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)} 分钟前`
  } else if (diffMs < day) {
    return `${Math.floor(diffMs / hour)} 小时前`
  } else if (diffMs < month) {
    return `${Math.floor(diffMs / day)} 天前`
  } else if (diffMs < year) {
    return `${Math.floor(diffMs / month)} 个月前`
  } else {
    return `${Math.floor(diffMs / year)} 年前`
  }
}

// 获取日期范围
export const getDateRange = (days: number): { startDate: Date; endDate: Date } => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return { startDate, endDate }
}

// 判断是否是今天
export const isToday = (date: Date | string): boolean => {
  const d = new Date(date)
  const today = new Date()
  
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

// 判断是否过期
export const isExpired = (expiryDate: Date | string): boolean => {
  return new Date(expiryDate) < new Date()
}

// 获取月份的天数
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate()
}

// 获取星期几 (0=周日, 1=周一...)
export const getDayOfWeek = (date: Date | string): number => {
  return new Date(date).getDay()
}
// 格式化日期时间
export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 格式化日期
export const formatDate = (date: Date | string): string => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

// 获取相对时间
export const getRelativeTime = (date: Date | string): string => {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day
  const year = 365 * day
  
  if (diffMs < minute) {
    return '刚刚'
  } else if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)} 分钟前`
  } else if (diffMs < day) {
    return `${Math.floor(diffMs / hour)} 小时前`
  } else if (diffMs < month) {
    return `${Math.floor(diffMs / day)} 天前`
  } else if (diffMs < year) {
    return `${Math.floor(diffMs / month)} 个月前`
  } else {
    return `${Math.floor(diffMs / year)} 年前`
  }
}

// 获取日期范围
export const getDateRange = (days: number): { startDate: Date; endDate: Date } => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return { startDate, endDate }
}

// 判断是否是今天
export const isToday = (date: Date | string): boolean => {
  const d = new Date(date)
  const today = new Date()
  
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

// 判断是否过期
export const isExpired = (expiryDate: Date | string): boolean => {
  return new Date(expiryDate) < new Date()
}

// 获取月份的天数
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate()
}

// 获取星期几 (0=周日, 1=周一...)
export const getDayOfWeek = (date: Date | string): number => {
  return new Date(date).getDay()
}
