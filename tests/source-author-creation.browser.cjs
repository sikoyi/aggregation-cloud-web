// Local mocked APIs only: no model charges, collection, or real publication.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const output = process.env.SELECTION_SCREENSHOTS || path.resolve('.tmp/source-author-creation')
  await fs.mkdir(output, { recursive: true })
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => localStorage.setItem('access_token', 'local-author-test'))
      const source = { id: 'source1', business_platform: 'threads', profile_url: 'https://www.threads.com/@author',
        profile: { username: 'author', display_name: '原作者' }, enabled: false, status: 'paused', version: 1 }
      const post = { id: 'post1', source_id: 'source1', business_platform: 'threads',
        content_url: 'https://www.threads.com/@author/post/1', text_body: '傍晚到海边散步，停下来看看落日。',
        media: [], media_type: 'text', author: { username: 'author', display_name: '原作者' },
        updated_at: '2026-10-19T00:00:00Z', published_at: '2026-10-18T00:00:00Z', likes_count: 10, comments_count: 0 }
      const candidates = ['给自己留一段看落日的时间。', '傍晚慢一点，去海边走走。', '散步到海边，刚好遇见落日。']
      let generation = null
      let generationCount = 0
      let saved = null
      let published = null
      let forbiddenCalls = 0
      const job = { id: 'job1', account_id: 'source:source1', target_account_id: '22', post_id: 'post1', persona_id: null,
        kind: 'generate', status: 'succeeded', created_at: post.updated_at, attempts: 1, draft_version: 0,
        result: { candidates: candidates.map((text_body, i) => ({ title: `候选 ${i + 1}`, text_body,
          review_notes: '原作者历史主帖不足 3 条，风格参考有限，请人工核对。' })) }, usage: [],
        input: { source_revision: post.updated_at } }
      await page.route(url => url.pathname.startsWith('/api/'), async route => {
        const request = route.request()
        const p = decodeURIComponent(new URL(request.url()).pathname)
        const method = request.method()
        let data = { items: [], total: 0 }
        if (p === '/api/auth/me') data = { id: 'local', username: 'local', display_name: '本地测试', roles: ['super_admin'], permissions: [] }
        else if (p === '/api/content-selection/sources') data = [source]
        else if (p === '/api/content-selection/local-state-scope') data = { tenant_id: 'local', user_id: 'local' }
        else if (p === '/api/content-selection/posts' || p === '/api/content-selection/posts/query') data = { items: [post], total: 1 }
        else if (p === '/api/content-selection/posts/post1') data = post
        else if (p === '/api/accounts/selection-options') data = [{ id: '22', business_platform: 'x', username: 'operator', display_name: '发布账号', bound_slot_id: '6' }]
        else if (p === '/api/account-personas/source:source1') data = { versions: [], jobs: generation ? [job] : [] }
        else if (p.endsWith('/analyze') || p.endsWith('/confirm')) forbiddenCalls++
        else if (p === '/api/account-personas/source:source1/generate') {
          generationCount++
          if (generationCount > 1) return route.fulfill({ status: 503, json: { code: 50000, msg: 'AI 暂时不可用，原稿未变更' } })
          generation = request.postDataJSON()
          assert(!Object.hasOwn(generation, 'persona_id'))
          data = { ...job, status: 'queued', result: {} }
        } else if (p === '/api/account-personas/source:source1/jobs/job1') data = job
        else if (p === '/api/account-personas/source:source1/jobs/job1/draft' && method === 'PUT') {
          saved = request.postDataJSON()
          Object.assign(job, { draft_text: saved.text_body, draft_version: saved.expected_version + 1 })
          data = job
        } else if (p === '/api/content-selection/posts/post1/dispatch') {
          published = request.postDataJSON()
          data = { id: 'order1', status: 'queued', account: { username: 'operator' }, business_platform: 'x',
            original: post, draft: { text_body: published.text_body, media: [] }, attempts: [] }
        }
        await route.fulfill({ json: { code: 0, msg: 'ok', data } })
      })
      await page.goto(`${process.env.SELECTION_BASE_URL || 'http://127.0.0.1:5173'}/content-selection`)
      await page.getByRole('button', { name: '查看选题', exact: true }).click().catch(async error => {
        console.log(await page.locator('body').innerText(), errors)
        await page.screenshot({ path: path.join(output, `failed-${viewport.width}.png`), fullPage: true })
        throw error
      })
      const dialog = page.getByRole('dialog', { name: '选题发布', exact: true })
      await dialog.locator('.publish-account .el-select').click()
      await page.getByRole('option').filter({ hasText: '发布账号' }).click()
      const create = dialog.getByRole('button', { name: 'AI 创作', exact: true })
      await create.waitFor()
      assert(await create.isEnabled(), 'no author persona must not block creation')
      assert.equal(generationCount, 0)
      assert.equal(forbiddenCalls, 0)
      await create.click()
      await dialog.getByRole('tab', { name: '候选 1', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true }).inputValue(), post.text_body)
      await dialog.getByRole('tab', { name: '候选 2', exact: true }).click()
      await dialog.getByRole('button', { name: '应用候选稿', exact: true }).click()
      await page.getByRole('button', { name: '确定', exact: true }).click()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true }).inputValue(), candidates[1])
      await dialog.getByRole('textbox', { name: '发布正文', exact: true }).fill('人工确认后的发布正文。')
      await dialog.getByRole('button', { name: '保存当前发布稿', exact: true }).click()
      await page.getByText('人工草稿已保存', { exact: true }).waitFor()
      assert.deepEqual(saved, { text_body: '人工确认后的发布正文。', expected_version: 0 })
      await page.screenshot({ path: path.join(output, `source-author-${viewport.width}.png`), fullPage: true })
      await create.click()
      await dialog.getByText('AI 暂时不可用，原稿未变更', { exact: true }).waitFor()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true }).inputValue(), saved.text_body)
      assert.equal(published, null)
      assert.equal(forbiddenCalls, 0)
      assert.equal(generation.target_account_id, '22')
      const bounds = await dialog.boundingBox()
      assert(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1)
      await page.screenshot({ path: path.join(output, `source-author-error-${viewport.width}.png`), fullPage: true })
      await dialog.getByRole('button', { name: '确认发布', exact: true }).click()
      await page.getByRole('button', { name: '确定', exact: true }).click()
      await page.getByRole('dialog', { name: '选题发布工单', exact: true }).waitFor()
      assert.deepEqual(published, { account_id: '22', text_body: saved.text_body, media_indexes: [],
        source_revision: post.updated_at, creation_job_id: 'job1' })
      assert.deepEqual(errors, [])
      await page.close()
      console.log(`PASS source-author manual generation/apply/save/publish and failure preservation: ${viewport.width}px`)
    }
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
