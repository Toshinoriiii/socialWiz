/**
 * 知乎网页写接口请求头（与 BAIGUANGMEI/zhihu-cli 的 Chrome 指纹对齐，降低风控差异）。
 * 无官方文档，以抓包 / 开源实现为准。
 */

export const ZHIHU_CHROME_VERSION = '145'

export function zhihuBrowserUserAgent (): string {
  return (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    `Chrome/${ZHIHU_CHROME_VERSION}.0.0.0 Safari/537.36`
  )
}

export function zhihuJsonHeaders (xsrf: string): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': zhihuBrowserUserAgent(),
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: 'https://www.zhihu.com/',
    'sec-ch-ua':
      '"Not:A-Brand";v="99", "Google Chrome";v="' +
      ZHIHU_CHROME_VERSION +
      '", "Chromium";v="' +
      ZHIHU_CHROME_VERSION +
      '"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    Origin: 'https://www.zhihu.com'
  }
  if (xsrf) {
    h['x-xsrftoken'] = xsrf
  }
  return h
}

/** 专栏写作台 API（zhuanlan.zhihu.com/api）与页面 Origin/Referer 一致，降低写接口校验差异。 */
export function zhihuZhuanlanJsonHeaders (xsrf: string): Record<string, string> {
  const h = zhihuJsonHeaders(xsrf)
  h.Referer = 'https://zhuanlan.zhihu.com/'
  h.Origin = 'https://zhuanlan.zhihu.com'
  return h
}
