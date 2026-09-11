const assert = require('node:assert/strict')
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5187') + '/scripts/fixtures/account-statistics-preview.html')
    const bar = page.locator('.account-statistics')
    await page.locator('[data-status="total"] strong').filter({ hasText: '6' }).waitFor()
    assert.equal(await page.locator('[data-status="online"] strong').innerText(), '1')
    assert.equal(await page.locator('[data-status="logged_in"] strong').innerText(), '2')
    await page.locator('[data-status="banned"]').click()
    await page.waitForFunction(() => window.__overviewRequests.some(url => url.includes('account_status=banned')))
    await page.locator('.el-table__expand-icon').first().click()
    await page.getByText('Preview instagram', { exact: true }).waitFor()
    assert.equal(await page.getByText('Preview threads', { exact: true }).count(), 0)
    assert.equal(await page.locator('[data-status="total"] strong').innerText(), '6')
    await page.getByRole('button', { name: '查询', exact: true }).click()
    assert.equal(await page.locator('[data-status="total"]').getAttribute('aria-pressed'), 'true')
    await page.locator('.filter-card .el-select').first().click()
    await page.locator('.el-select-dropdown__item:visible').filter({ hasText: /^Threads$/ }).click()
    await page.getByRole('button', { name: '查询', exact: true }).click()
    await page.locator('[data-status="total"] strong').filter({ hasText: '3' }).waitFor()
    assert.equal(await page.locator('[data-status="banned"] strong').innerText(), '0')
    await page.getByRole('button', { name: '清空', exact: true }).click()
    await page.locator('[data-status="total"] strong').filter({ hasText: '6' }).waitFor()
    for (const width of [1600, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.mouse.move(0, 0)
      await page.locator('.account-statistics__metric').first().waitFor()
      const boxes = await page.locator('.account-statistics__metric').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect()
        return { x: box.x, right: box.right, top: box.top, bottom: box.bottom, fits: node.scrollWidth <= node.clientWidth }
      }))
      assert.equal(boxes.length, 8)
      for (const box of boxes) assert(box.x >= 0 && box.right <= width && box.fits)
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        assert(!(a.x < b.right && b.x < a.right && a.top < b.bottom && b.top < a.bottom))
      }
      await bar.screenshot({ path: (process.env.SMOKE_OUTPUT_DIR || '.') + '/account-statistics-' + width + '.png' })
    }
    assert.deepEqual(errors, [])
    console.log('PASS: summary counts, shortcut, expanded scope, reset, desktop/tablet/mobile layout')
  } finally {
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
