import { createRequire } from 'node:module'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require('/Users/ivsingh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')

const outputDir = new URL('../tmp/verification/', import.meta.url)
await fs.mkdir(outputDir, { recursive: true })
const runId = String(Date.now()).slice(-6)
const normalName = `Aarav Mehta ${runId}`
const riskName = `Priya Shah ${runId}`
const mobileNormalName = `Meera Rao ${runId}`
const mobileRiskName = `Kabir Khan ${runId}`

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: chromePath })
const consoleMessages = []

async function submitNormalUser(page) {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.screenshot({ path: new URL('intake-start-desktop.png', outputDir).pathname, fullPage: true })
  await page.getByLabel('Name').fill(normalName)
  await page.getByLabel('WhatsApp / phone').fill('9999999999')
  await page.getByLabel('City').fill('Mumbai')
  await page.getByLabel(/I agree/).check()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Weight loss/ }).click()
  await page.getByRole('button', { name: /Better energy/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^North Indian$/ }).click()
  await page.getByRole('button', { name: /^South Indian$/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^Sweet$/ }).click()
  await page.getByRole('button', { name: /^Milk$/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Run safety review|Create plan/ }).click()
  await page.getByText('AI-generated nutrition disclaimer').waitFor({ timeout: 15000 })
  await page.screenshot({ path: new URL('normal-disclaimer-desktop.png', outputDir).pathname, fullPage: true })
  await page.getByLabel(/I understand this is an AI-generated/).check()
  await page.getByRole('button', { name: /Unlock my 7-day plan/ }).click()
  await page.getByText('Plan ready').waitFor({ timeout: 15000 })
  await page.screenshot({ path: new URL('normal-plan-desktop.png', outputDir).pathname, fullPage: true })
  await page.getByRole('button', { name: /Save check-in/ }).click()
  await page.getByText('Check-in saved').waitFor()
  await page.locator('.upgrade-card').filter({ hasText: 'AI continuation' }).getByRole('button', { name: /Select/ }).click()
  await page.getByText(/Intent captured/).waitFor()
  await page.screenshot({ path: new URL('normal-after-upgrade.png', outputDir).pathname, fullPage: true })
}

async function submitRiskUser(page) {
  await page.getByRole('button', { name: /NutriAlign/ }).click()
  await page.getByLabel('Name').fill(riskName)
  await page.getByLabel('WhatsApp / phone').fill('8888888888')
  await page.getByLabel('City').fill('Delhi')
  await page.getByLabel(/I agree/).check()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Fat loss/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^North Indian$/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^Diabetes$/ }).click()
  await page.getByRole('button', { name: /Send for dietician review|Prepare dietician brief|Create plan/ }).click()
  await page.getByText('Expert review', { exact: true }).waitFor({ timeout: 15000 })
  if (await page.getByText('Plan ready').count()) {
    throw new Error('Risk user unexpectedly saw plan-ready state')
  }
  await page.locator('.upgrade-card').filter({ hasText: 'Human dietician' }).getByRole('button', { name: /Select/ }).click()
  await page.getByText(/Intent captured/).waitFor()
  await page.screenshot({ path: new URL('risk-brief-desktop.png', outputDir).pathname, fullPage: true })
}

async function submitMobileNormalUser(page) {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.screenshot({ path: new URL('mobile-start.png', outputDir).pathname, fullPage: true })
  await page.getByLabel('Name').fill(mobileNormalName)
  await page.getByLabel('WhatsApp / phone').fill('7777777777')
  await page.getByLabel('City').fill('Pune')
  await page.getByLabel(/I agree/).check()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Body toning/ }).click()
  await page.getByRole('button', { name: /Better energy/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^Gujarati$/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^Evening snacking$/ }).click()
  await page.getByRole('button', { name: /^Paneer$/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Run safety review|Create plan/ }).click()
  await page.getByText('AI-generated nutrition disclaimer').waitFor({ timeout: 15000 })
  await page.screenshot({ path: new URL('mobile-disclaimer.png', outputDir).pathname, fullPage: true })
  await page.getByLabel(/I understand this is an AI-generated/).check()
  await page.getByRole('button', { name: /Unlock my 7-day plan/ }).click()
  await page.getByText('Plan ready').waitFor({ timeout: 15000 })
  await page.screenshot({ path: new URL('mobile-plan.png', outputDir).pathname, fullPage: true })
  await page.getByRole('button', { name: /Save check-in/ }).click()
  await page.getByText('Check-in saved').waitFor()
  await page.locator('.upgrade-card').filter({ hasText: 'Human dietician' }).getByRole('button', { name: /Select/ }).click()
  await page.getByText(/Intent captured/).waitFor()
  await page.screenshot({ path: new URL('mobile-after-upgrade.png', outputDir).pathname, fullPage: true })
}

async function submitMobileRiskUser(page) {
  await page.getByRole('button', { name: /NutriAlign/ }).click()
  await page.getByLabel('Name').fill(mobileRiskName)
  await page.getByLabel('WhatsApp / phone').fill('6666666666')
  await page.getByLabel('City').fill('Bengaluru')
  await page.getByLabel(/I agree/).check()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Maintenance/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^South Indian$/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /^Kidney disease$/ }).click()
  await page.getByRole('button', { name: /Send for dietician review|Prepare dietician brief|Create plan/ }).click()
  await page.getByText('Expert review', { exact: true }).waitFor({ timeout: 15000 })
  if (await page.getByText('Plan ready').count()) {
    throw new Error('Mobile risk user unexpectedly saw plan-ready state')
  }
  await page.screenshot({ path: new URL('mobile-risk-brief.png', outputDir).pathname, fullPage: true })
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`))
  page.on('pageerror', (err) => consoleMessages.push(`pageerror: ${err.message}`))

  await submitNormalUser(page)
  await submitRiskUser(page)

  await page.getByRole('button', { name: /Admin/ }).click()
  await page.getByText('Lead review dashboard').waitFor()
  await page.getByText(normalName).first().waitFor()
  await page.getByText(riskName).first().waitFor()
  await page.screenshot({ path: new URL('admin-desktop.png', outputDir).pathname, fullPage: true })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  mobile.on('console', (msg) => consoleMessages.push(`mobile ${msg.type()}: ${msg.text()}`))
  mobile.on('pageerror', (err) => consoleMessages.push(`mobile pageerror: ${err.message}`))
  await submitMobileNormalUser(mobile)
  await submitMobileRiskUser(mobile)

  const severe = consoleMessages.filter((message) => message.startsWith('error:') || message.includes('pageerror'))
  if (severe.length) {
    throw new Error(`Console/runtime errors found: ${severe.join('; ')}`)
  }

  console.log(JSON.stringify({ ok: true, screenshots: outputDir.pathname, consoleMessages }, null, 2))
} finally {
  await browser.close()
}
