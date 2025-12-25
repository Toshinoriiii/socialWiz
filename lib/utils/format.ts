// 格式化数字(添加千分位)
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 格式化百分比
export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`
}

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 截断文本
export const truncateText = (text: string, maxLength: number, suffix: string = '...'): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + suffix
}

// 高亮关键词
export const highlightKeywords = (text: string, keywords: string[]): string => {
  let result = text
  keywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi')
    result = result.replace(regex, (match) => `<mark>${match}</mark>`)
  })
  return result
}

// 生成随机字符串
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 清理HTML标签
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '')
}

// 转义HTML
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

// 格式化查询参数
export const formatQueryParams = (params: Record<string, any>): string => {
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  
  return queryString ? `?${queryString}` : ''
}

// 解析查询参数
export const parseQueryParams = (queryString: string): Record<string, string> => {
  const params: Record<string, string> = {}
  const urlParams = new URLSearchParams(queryString)
  
  urlParams.forEach((value, key) => {
    params[key] = value
  })
  
  return params
}

// 格式化手机号（中间4位隐藏）
export const formatPhone = (phone: string): string => {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

// 格式化邮箱（部分隐藏）
export const formatEmail = (email: string): string => {
  const [local, domain] = email.split('@')
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`
  }
  return `${local.substring(0, 3)}***@${domain}`
}
// 格式化数字(添加千分位)
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 格式化百分比
export const formatPercent = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`
}

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 截断文本
export const truncateText = (text: string, maxLength: number, suffix: string = '...'): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + suffix
}

// 高亮关键词
export const highlightKeywords = (text: string, keywords: string[]): string => {
  let result = text
  keywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi')
    result = result.replace(regex, (match) => `<mark>${match}</mark>`)
  })
  return result
}

// 生成随机字符串
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 清理HTML标签
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '')
}

// 转义HTML
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

// 格式化查询参数
export const formatQueryParams = (params: Record<string, any>): string => {
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  
  return queryString ? `?${queryString}` : ''
}

// 解析查询参数
export const parseQueryParams = (queryString: string): Record<string, string> => {
  const params: Record<string, string> = {}
  const urlParams = new URLSearchParams(queryString)
  
  urlParams.forEach((value, key) => {
    params[key] = value
  })
  
  return params
}

// 格式化手机号（中间4位隐藏）
export const formatPhone = (phone: string): string => {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

// 格式化邮箱（部分隐藏）
export const formatEmail = (email: string): string => {
  const [local, domain] = email.split('@')
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`
  }
  return `${local.substring(0, 3)}***@${domain}`
}
