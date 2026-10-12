// Run against a local Vite server. All APIs and media are intercepted; no real publication.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const screenshotDir = process.env.SELECTION_SCREENSHOTS || path.resolve('.tmp/selection-screenshots')
  await fs.mkdir(screenshotDir, { recursive: true })
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => localStorage.setItem('access_token', 'selection-test-token'))
      const source = { id:'source1', business_platform:'threads', profile_url:'https://www.threads.com/@demo', remark:'旅行选题', enabled:true, interval_minutes:60, version:1, status:'collecting', history_complete:false, pages_collected:12, post_count:220 }
      const post = { id:'post1', source_id:'source1', business_platform:'threads', content_url:'https://www.threads.com/@demo/post/123', text_body:'傍晚沿海边走了一圈，看落日，也给自己留一点慢下来的时间。\n#海边 #旅行', media:['https://pbs.twimg.com/selection-demo.png'], media_type:'image', author:{username:'demo', display_name:'旅行记录', profile_url:source.profile_url}, published_at:'2026-10-12T05:00:00Z', likes_count:1320, comments_count:null }
      const order = { id:'order1', post_id:'post1', account_id:'22', business_platform:'x', account:{username:'operator',display_name:'运营测试'}, original:post, draft:{text_body:'编辑后的正文',media:[]}, status:'queued', task_id:'123', created_at:'2026-10-12T06:00:00Z', attempts:[{task_id:'123',status:'queued',created_at:'2026-10-12T06:00:00Z'}] }
      let submitted = null
      const postQueries = []
      await page.route('https://pbs.twimg.com/**', route => route.fulfill({contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XQAAAAASUVORK5CYII=', 'base64')}))
      await page.route(url => url.pathname.startsWith('/api/'), async route => {
        const url = new URL(route.request().url())
        const p = url.pathname
        let data = {items:[],total:0}
        if (p === '/api/auth/me') data = {id:'test',username:'test',display_name:'本地测试',roles:['super_admin'],permissions:[]}
        else if (p === '/api/content-selection/sources') data = [source]
        else if (p === '/api/content-selection/posts') { postQueries.push(Object.fromEntries(url.searchParams)); data = {items:[post],total:61} }
        else if (p === '/api/content-selection/posts/post1') data = post
        else if (p === '/api/content-selection/orders/order1') data = order
        else if (p === '/api/accounts/selection-options') data = [{id:'22',business_platform:'x',username:'operator',display_name:'运营测试',bound_slot_id:'6'}]
        else if (p === '/api/content-selection/posts/post1/dispatch') { submitted = route.request().postDataJSON(); data = order }
        await route.fulfill({json:{code:0,msg:'ok',data}})
      })
      await page.goto(`${process.env.SELECTION_BASE_URL || 'http://127.0.0.1:5173'}/content-selection`)
      post.updated_at = '2026-10-12T06:00:00Z'
      await page.getByRole('button',{name:'查看选题'}).waitFor().catch(async error => {
        await page.screenshot({path:path.join(screenshotDir,`error-${viewport.width}.png`),fullPage:true})
        console.log(await page.locator('body').innerText(), errors)
        throw error
      })
      assert.equal(await page.locator('.post-item').count(),1)
      const filters = page.locator('.selection-filters')
      await filters.getByText('筛选条件', {exact:true}).waitFor()
      await filters.getByPlaceholder('正文 / 作者').fill('海边')
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/content-selection/posts?') && new URL(response.url()).searchParams.get('keyword') === '海边'),
        filters.getByRole('button', {name:'查询', exact:true}).click(),
      ])
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/content-selection/posts?') && new URL(response.url()).searchParams.get('page') === '2'),
        page.locator('.selection-pagination .el-pager').getByText('2', {exact:true}).click(),
      ])
      await page.waitForFunction(() => document.querySelector('.selection-pagination .el-pager .is-active')?.textContent?.trim() === '2')
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/content-selection/posts?') && !new URL(response.url()).searchParams.get('keyword')),
        filters.getByRole('button', {name:'清空', exact:true}).click(),
      ])
      await page.waitForFunction(() => document.querySelector('.selection-pagination .el-pager .is-active')?.textContent?.trim() === '1')
      assert.equal(await filters.getByPlaceholder('正文 / 作者').inputValue(), '')
      assert.equal(postQueries.at(-1).page, '1')
      assert(!postQueries.at(-1).keyword)
      const filterBounds = await filters.boundingBox()
      for (const field of await filters.locator('.el-form-item').all()) {
        const bounds = await field.boundingBox()
        assert(bounds.x >= filterBounds.x && bounds.x + bounds.width <= filterBounds.x + filterBounds.width + 1, 'filter fields must fit panel')
      }
      await page.screenshot({path:path.join(screenshotDir,`posts-${viewport.width}.png`), fullPage:true})
      await page.getByRole('button',{name:'查看选题'}).click()
      const dialog = page.getByRole('dialog',{name:'选题发布',exact:true})
      await dialog.getByText('原帖内容').waitFor()
      await dialog.getByText('保留第 1 项',{exact:true}).click()
      await dialog.locator('textarea').fill('编辑后的正文')
      await dialog.locator('.el-select').click()
      await page.getByRole('option').filter({hasText:'运营测试'}).click()
      await page.screenshot({path:path.join(screenshotDir,`editor-${viewport.width}.png`),fullPage:true})
      const bounds = await dialog.boundingBox()
      assert(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1, 'dialog must fit viewport')
      await dialog.getByRole('button',{name:'确认发布'}).click()
      await page.getByRole('button',{name:'确定',exact:true}).click()
      await page.getByRole('dialog',{name:'选题发布工单'}).getByText('工单 ID：order1').waitFor()
      assert.deepEqual(submitted,{account_id:'22',text_body:'编辑后的正文',media_indexes:[],source_revision:post.updated_at})
      assert.deepEqual(errors,[])
      await page.close()
      console.log(`PASS selection desktop/mobile flow: ${viewport.width}px`)
    }
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode=1 })
