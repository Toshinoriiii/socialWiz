/**
 * 使用 save-session 保存的登录态打开微博首页（验证会话是否仍有效）。
 * 运行: npm run weibo:open
 */
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import readline from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE = path.join(__dirname, '.weibo-storage.json')

if (!fs.existsSync(STORAGE)) {
  console.error('未找到会话文件，请先运行: npm run weibo:session')
  process.exit(1)
}

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({
  storageState: STORAGE,
  locale: 'zh-CN',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})
const page = await context.newPage()
await page.goto('https://weibo.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
console.log('已用本地会话打开 weibo.com。')

function ask (q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(q, (ans) => {
      rl.close()
      resolve(ans)
    })
  })
}

await ask('用毕后按 Enter 关闭浏览器… ')
await browser.close()
