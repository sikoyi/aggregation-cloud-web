// Synthetic UI verification only: every API request is intercepted; no paid calls or publishing.
const assert = require('node:assert/strict')
const { mkdirSync } = require('node:fs')
const { chromium } = require('playwright')

async function main() {
  const base = 'http://127.0.0.1:5173'
  const browser = await chromium.launch({ headless: true })
  mkdirSync('logs', { recursive: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.setDefaultTimeout(10000)
    const errors = [], requests = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin !== base) return route.abort()
      if (url.pathname === '/__persona_stability') return route.fulfill({ contentType: 'text/html',
        body: '<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="app" style="padding:16px;max-width:1000px;margin:auto"></div></body></html>' })
      if (!url.pathname.startsWith('/api/')) return route.continue()
      assert.ok(url.pathname.endsWith('/resume'))
      requests.push(route.request().postDataJSON())
      if (requests.length === 1) return route.fulfill({ status: 503, json: { code: 503, message: '模拟网络失败', data: null } })
      return route.fulfill({ json: { code: 0, data: { id: 'job', account_id: 'source:s', status: 'queued', result: {} } } })
    })
    await page.goto(`${base}/__persona_stability`)
    await page.evaluate(async () => {
      await import('/src/styles.css')
      const entry = await (await fetch('/src/main.ts')).text()
      for (const match of entry.matchAll(/import "([^\"]*(?:message|message-box|notification)[^\"]*)"/g)) await import(match[1])
      const source = await (await fetch('/src/components/PersonaJobStatus.vue')).text()
      const { createApp, h, reactive } = await import(source.match(/from "(\/node_modules\/\.vite\/deps\/vue\.js[^"]*)"/)[1])
      const { default: View } = await import('/src/components/PersonaJobStatus.vue')
      const state = reactive({ canResume: true, job: { id: 'job', account_id: 'source:s', status: 'failed',
        budget: { limit_cny: 10, known_cny: 2.5, unknown_cost_calls: 1, calls: 3, max_calls: 20, tokens: 48000, max_tokens: 300000, blocked_reason: '' },
        result: { stage_metrics: { 图片准备: { attempts: 12, succeeded: 10, duration_ms: 2500 } }, model_calls: [
          { id: '1', stage: '图文分析 · 第 1/4 批', status: 'succeeded', duration_ms: 2000 },
          { id: '2', stage: '图文分析 · 第 2/4 批', status: 'succeeded', duration_ms: 3000 },
          { id: '3', stage: '图文分析 · 第 3/4 批', status: 'failed', duration_ms: 180000 },
        ] } } })
      window.__personaState = state
      createApp({ setup: () => () => h(View, { ...state, onResumed: job => { state.job = job } }) }).mount('#app')
    })
    await page.getByRole('button', { name: '从断点继续' }).waitFor()
    assert.equal(requests.length, 0)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `logs/persona-stability-${width}.png`, fullPage: true })
    }
    await page.getByRole('button', { name: '从断点继续' }).click()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(requests.length, 0)
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole('button', { name: '从断点继续' }).click()
      await page.getByRole('button', { name: '继续分析', exact: true }).click()
      if (attempt === 0) await page.locator('.el-alert--error').waitFor()
    }
    await page.getByRole('button', { name: '从断点继续' }).waitFor({ state: 'hidden' })
    assert.equal(requests.length, 2)
    assert.equal(requests[0].request_key, requests[1].request_key)
    await page.evaluate(() => { window.__personaState.job.status = 'failed' })
    await page.getByRole('button', { name: '从断点继续' }).click()
    await page.getByRole('button', { name: '继续分析', exact: true }).click()
    await page.getByRole('button', { name: '从断点继续' }).waitFor({ state: 'hidden' })
    assert.equal(requests.length, 3)
    assert.notEqual(requests[1].request_key, requests[2].request_key)
    await page.evaluate(() => {
      window.__personaState.job.status = 'failed'
      window.__personaState.job.budget = { limit_cny: 10, known_cny: 10, unknown_cost_calls: 0, calls: 5,
        max_calls: 20, tokens: 5000, max_tokens: 300000, blocked_reason: '已报告费用达到 10 元预算' }
    })
    assert.ok(await page.getByRole('button', { name: '从断点继续' }).isDisabled())
    await page.evaluate(() => { window.__personaState.canResume = false })
    await page.getByRole('button', { name: '从断点继续' }).waitFor({ state: 'hidden' })
    assert.deepEqual(errors, [])
    console.log('PASS: desktop/mobile, explicit confirmation, no automatic requests, retry idempotency, budget and permission guards; mocked API only')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
