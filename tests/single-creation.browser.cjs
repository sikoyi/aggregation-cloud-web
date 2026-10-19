// Mocked APIs: no model charges or real publishing.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const output = process.env.SELECTION_SCREENSHOTS || path.resolve('.tmp/single-creation')
  await fs.mkdir(output, { recursive: true })
  try {
    for (const mode of ['normal', 'edited', 'reverted', 'closed', 'account', 'revision', 'wrong-target', 'failed', 'mobile']) {
      const page = await browser.newPage({ viewport: { width: mode === 'mobile' ? 390 : 1440, height: mode === 'mobile' ? 844 : 1000 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => localStorage.setItem('access_token', 'local-single-test'))
      const source = { id: 'source1', business_platform: 'threads', profile_url: 'https://www.threads.com/@author', profile: { username: 'author', display_name: '原作者' }, enabled: false, status: 'paused', version: 1 }
      const post = { id: 'post1', source_id: 'source1', business_platform: 'threads', content_url: 'https://www.threads.com/@author/post/1', text_body: '原始内容，等待创作。', media: [], media_type: 'text', author: { username: 'author', display_name: '原作者' }, updated_at: '2026-10-19T00:00:00Z', published_at: '2026-10-18T00:00:00Z', likes_count: 10, comments_count: 0 }
      const jobs = []
      let publishes = 0
      const exposed = job => ({ ...job, status: job.ready ? (mode === 'failed' ? 'failed' : 'succeeded') : 'running',
        target_account_id: job.ready && mode === 'wrong-target' ? 'foreign' : job.target_account_id,
        error_message: mode === 'failed' ? '文案生成失败：上游超时' : null,
        result: job.ready ? { candidates: [{ title: '正文', text_body: `第 ${job.id} 次完整正文。\n\n这是可以发布的第二段。`, review_notes: '' }] } : {} })
      await page.route(url => url.pathname.startsWith('/api/'), async route => {
        const req = route.request()
        const url = new URL(req.url())
        const p = decodeURIComponent(url.pathname)
        let data = { items: [], total: 0 }
        if (p === '/api/auth/me') data = { id: 'local', username: 'local', roles: ['super_admin'], permissions: [] }
        else if (p === '/api/content-selection/sources') data = [source]
        else if (p === '/api/content-selection/local-state-scope') data = { tenant_id: 'local', user_id: 'local' }
        else if (p === '/api/content-selection/posts' || p === '/api/content-selection/posts/query') data = { items: [post], total: 1 }
        else if (p === '/api/content-selection/posts/post1') data = post
        else if (p === '/api/accounts/selection-options') data = ['22', '23'].map(id => ({ id, business_platform: 'x', username: `account${id}`, display_name: `发布账号${id}`, bound_slot_id: '6' }))
        else if (p === '/api/account-personas/source:source1') data = { versions: [], jobs: jobs.map(exposed) }
        else if (p.endsWith('/generate')) {
          const payload = req.postDataJSON()
          const job = { id: String(jobs.length + 1), account_id: 'source:source1', target_account_id: payload.target_account_id, post_id: 'post1', kind: 'generate', ready: false, created_at: post.updated_at, attempts: 1, draft_text: null, draft_version: 0, usage: [], input: { prompt_version: 'source-author-creation-v5', source_revision: post.updated_at, post } }
          jobs.unshift(job)
          data = exposed(job)
        } else if (p === '/api/account-personas/source:source1/jobs') {
          const visible = jobs.filter(j => !url.searchParams.get('target_account_id') || j.target_account_id === url.searchParams.get('target_account_id'))
          data = { items: visible.map(exposed), total: visible.length, page: 1, page_size: 20 }
        } else if (p.includes('/jobs/')) data = exposed(jobs.find(j => j.id === p.split('/jobs/')[1]))
        else if (p.endsWith('/dispatch')) publishes++
        await route.fulfill({ json: { code: 0, msg: 'ok', data } })
      })
      await page.goto('http://127.0.0.1:5173/content-selection')
      await page.getByRole('button', { name: '查看选题', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: '选题发布', exact: true })
      const editor = dialog.getByRole('textbox', { name: '发布正文', exact: true })
      const choose = async id => {
        await dialog.locator('.publish-account .el-select').click()
        await page.getByRole('option').filter({ hasText: `发布账号${id}` }).click()
      }
      await choose('22')
      await dialog.getByRole('button', { name: 'AI 创作', exact: true }).click()
      await dialog.getByRole('button', { name: '创作处理中', exact: true }).waitFor()
      assert.equal(jobs.length, 1)
      if (mode === 'edited' || mode === 'reverted') await editor.fill('运营在等待期间修改的正文。')
      if (mode === 'reverted') await editor.fill(post.text_body)
      if (mode === 'closed') await dialog.getByRole('button', { name: '关闭', exact: true }).click()
      if (mode === 'account') await choose('23')
      if (mode === 'revision') jobs[0].input.source_revision = '2026-10-20T00:00:00Z'
      const refreshed = page.waitForResponse(r => decodeURIComponent(new URL(r.url()).pathname) === '/api/account-personas/source:source1/jobs')
      jobs[0].ready = true
      if (mode === 'closed') await page.getByRole('button', { name: '查看选题', exact: true }).click()
      await refreshed
      if (mode === 'normal' || mode === 'mobile') {
        await page.getByText('正文已生成并填入发布稿', { exact: true }).waitFor()
        assert.equal(await editor.inputValue(), exposed(jobs[0]).result.candidates[0].text_body)
        assert.equal(publishes, 0)
        await dialog.getByRole('button', { name: '重新生成', exact: true }).click()
        await dialog.getByRole('button', { name: '创作处理中', exact: true }).waitFor()
        assert.equal(jobs.length, 2)
        jobs[0].ready = true
        await dialog.getByRole('button', { name: '重新生成', exact: true }).waitFor()
        assert.equal(await editor.inputValue(), exposed(jobs[0]).result.candidates[0].text_body)
        await dialog.getByRole('tab', { name: '创作记录（2）', exact: true }).click()
        await dialog.getByText(exposed(jobs[0]).result.candidates[0].text_body, { exact: true }).waitFor()
        assert.equal(await dialog.locator('.creation-history [role="tab"]').count(), 0)
        await page.screenshot({ path: path.join(output, `single-${mode}.png`), fullPage: true, animations: 'disabled' })
      } else {
        await dialog.getByRole('button', { name: /^(AI 创作|重新生成)$/ }).waitFor()
        const expected = mode === 'edited' ? '运营在等待期间修改的正文。' : post.text_body
        assert.equal(await editor.inputValue(), expected, `${mode} must preserve the editor`)
        if (['edited', 'reverted', 'revision'].includes(mode)) await dialog.getByText('正文已生成并保存；当前编辑内容或状态已变化，请在创作记录中查看并应用。', { exact: true }).waitFor()
        if (mode === 'wrong-target') await dialog.getByText('生成记录与当前创作不一致，请查看创作记录', { exact: true }).filter({ visible: true }).waitFor()
        if (mode === 'failed') await dialog.getByText('文案生成失败：上游超时', { exact: true }).filter({ visible: true }).waitFor()
      }
      assert.equal(publishes, 0, 'generation never dispatches publication')
      assert.deepEqual(errors, [])
      console.log(`PASS single creation: ${mode}`)
      await page.close()
    }
  } finally { await browser.close() }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
