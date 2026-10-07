/**
 * Smoke test: open the single-file build in headless Chromium, let the world
 * run, click around, and fail on any page error. Screenshots go to the path
 * given as the first argument.
 *
 *   node scripts/smoke.mjs /tmp/shots
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const out = process.argv[2] || '.'
const file = pathToFileURL(resolve('dist-single/index.html')).href
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const errors = []
async function session(name, opts) {
  const page = await browser.newPage(opts)
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(`[${name}] console: ${m.text()}`) })
  await page.goto(file)
  await page.waitForSelector('.date', { timeout: 20000 })
  await page.waitForFunction(() => document.querySelector('h2.name'), null, { timeout: 30000 })
  return page
}
const page = await session('desktop', { viewport: { width: 1400, height: 880 } })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${out}/1-start.png` })
// Run fast for a while.
await page.click('.speed button:nth-child(5)')
await page.waitForTimeout(9000)
await page.click('.speed button:nth-child(1)')
await page.waitForTimeout(600)
const date = await page.textContent('.date')
console.log('date after running:', date)
await page.screenshot({ path: `${out}/2-running.png` })
for (const [i, tab] of ['Nen', 'Mind', 'Bonds', 'Life'].entries()) {
  const b = page.locator('.scroll .tabs button', { hasText: tab })
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(500); if (i === 0) await page.screenshot({ path: `${out}/3-nen.png` }) }
}
for (const tab of ['Chronicle', 'World', 'Beyond', 'Legends', 'You']) {
  await page.click(`.panel > .tabs button:has-text("${tab}")`)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/4-${tab.split(' ')[0].toLowerCase()}.png` })
}
// Open a fight if there is one.
await page.click('.panel > .tabs button:has-text("Chronicle")')
await page.waitForTimeout(500)
const watch = page.locator('button.more', { hasText: 'watch' })
if (await watch.count()) { await watch.first().click(); await page.waitForTimeout(3500); await page.screenshot({ path: `${out}/5-fight.png` }); await page.keyboard.press('Escape') }
// The cast picker and creator.
await page.click('button:has-text("Choose a character")')
await page.waitForTimeout(800)
await page.screenshot({ path: `${out}/6-cast.png` })
await page.click('.modal button:has-text("Create your own")')
await page.waitForTimeout(500)
await page.fill('#cr-name', 'Rin Aoba')
await page.click('.modal button:has-text("Begin their life")')
await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/7-created.png` })
// Phone width and dark mode.
const phone = await session('phone', { viewport: { width: 400, height: 860 }, colorScheme: 'dark' })
await phone.waitForTimeout(3000)
await phone.screenshot({ path: `${out}/8-phone-dark.png`, fullPage: true })
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
console.log('phone horizontal overflow:', overflow)
await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1) }
console.log('ok')
