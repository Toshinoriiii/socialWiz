/**
 * 个人本地：用 Playwright 打开微博，你在浏览器里手动登录（含验证码），
 * 回终端按 Enter 后把 Cookie/LocalStorage 存到 .weibo-storage.json。
 *
 * 首次请先执行: npx playwright install chromium
 * 运行: npm run weibo:session
 */
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORAGE = path.join(__dirname, '.weibo-storage.json')

function ask (q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(q, (ans) => {
      rl.close()
      resolve(ans)
    })
  })
}

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({
  locale: 'zh-CN',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})
const page = await context.newPage()

await page.goto('https://weibo.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })

console.log(`
已在 Chromium 中打开 weibo.com。
请在本窗口完成登录（短信/扫码/验证码等）。
确认首页已登录成功后，回到此终端按 Enter 保存会话文件：
  ${STORAGE}
`)
await ask('按 Enter 保存并退出… ')

await context.storageState({ path: STORAGE })
await browser.close()

console.log('已写入:', STORAGE)
console.log('勿将上述文件提交到 Git；已与 Next 主站 OAuth 无关，仅供本机脚本使用。')
