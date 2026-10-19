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
      let confirmation = null
      let versions = []
      let refreshedJob = null
      let failedAnalysis = null
      let pagedHistory = false
      const authorAnalysis = { observations: [{ dimension: '表达风格', finding: '生活观察、克制短句', confidence: 'low', evidence_ids: ['post1'] }],
        suggested_persona: { positioning: '生活观察与慢节奏记录', audience: '关注生活细节的读者', voice: '克制短句，平实自然',
          facts: '', boundaries: '不虚构个人身份与经历', preferences: '日常散步、自然景色' }, limitations: '仅依据已采集内容，样本有限', sample_count: 1, available_posts: 1 }
      const job = { id: 'job1', account_id: 'source:source1', target_account_id: '22', post_id: 'post1', persona_id: null,
        kind: 'generate', status: 'succeeded', created_at: post.updated_at, attempts: 1, draft_version: 0,
        result: { author_analysis: authorAnalysis, candidates: candidates.map((text_body, i) => ({ title: `候选 ${i + 1}`, text_body,
          review_notes: '原作者历史主帖不足 3 条，风格参考有限，请人工核对。' })) }, usage: [],
        input: { source_revision: post.updated_at, prompt_version: 'source-author-creation-v3', post } }
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
        else if (p === '/api/account-personas/source:source1') data = { versions, jobs: failedAnalysis ? [failedAnalysis] : generation ? [...(refreshedJob ? [refreshedJob] : []), job] : [] }
        else if (p === '/api/account-personas/source:source1/jobs') {
          const query = new URL(request.url()).searchParams
          const records = generation ? [job, ...(pagedHistory ? Array.from({ length: 40 }, (_, i) => ({ ...job, id: `older-${i}`,
            created_at: new Date(Date.parse(job.created_at) - (i + 1) * 86400000).toISOString(), draft_text: null,
            result: { ...job.result, candidates: candidates.map((text_body, n) => ({ title: `候选 ${n + 1}`, text_body: `${text_body} 历史 ${i}`, review_notes: '' })) } })) : [])] : []
          const visible = records.filter(j => !query.get('target_account_id') || j.target_account_id === query.get('target_account_id'))
          const start = (Number(query.get('page') || 1) - 1) * 20
          data = { items: visible.slice(start, start + 20).map(j => ({ ...j, target_account: { id: '22', name: '发布账号', platform: 'x' } })), total: visible.length, page: Number(query.get('page') || 1), page_size: 20 }
        }
        else if (p.endsWith('/analyze')) forbiddenCalls++
        else if (p === '/api/account-personas/source:source1/confirm') {
          confirmation = request.postDataJSON()
          const version = { id: 'manual1', version: 1, document: confirmation.document,
            analysis_job_id: confirmation.analysis_job_id, created_at: '2026-10-19T03:00:00Z' }
          versions = [version]
          data = version
        }
        else if (p === '/api/account-personas/source:source1/generate') {
          generationCount++
          if (generationCount > 1) return route.fulfill({ status: 503, json: { code: 50000, msg: 'AI 暂时不可用，原稿未变更' } })
          generation = request.postDataJSON()
          assert(!Object.hasOwn(generation, 'persona_id'))
          data = { ...job, status: 'queued', result: {} }
        } else if (p === '/api/account-personas/source:source1/jobs/analysis-failed') data = failedAnalysis
        else if (p === '/api/account-personas/source:source1/jobs/job1') data = job
        else if (p.includes('/jobs/older-')) {
          const i = Number(p.split('/jobs/older-')[1])
          data = { ...job, id: `older-${i}`, draft_text: null,
            result: { ...job.result, candidates: candidates.map((text_body, n) => ({ title: `候选 ${n + 1}`, text_body: `${text_body} 历史 ${i}`, review_notes: '' })) } }
        }
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
      const showHistory = () => dialog.getByRole('tab', { name: /^创作记录/ }).click()
      const showEditor = () => dialog.getByRole('tab', { name: '内容编辑', exact: true }).click()
      await dialog.locator('.publish-account .el-select').click()
      await page.getByRole('option').filter({ hasText: '发布账号' }).click()
      const create = dialog.getByRole('button', { name: 'AI 创作', exact: true })
      await create.waitFor()
      assert(await create.isEnabled(), 'no author persona must not block creation')
      await dialog.getByRole('button', { name: '作者 AI 人设', exact: true }).click()
      let personaDialog = page.getByRole('dialog', { name: '原帖作者 AI 人设 · 原作者', exact: true })
      await personaDialog.getByText('暂无作者 AI 分析结果', { exact: true }).waitFor()
      assert.equal(await personaDialog.getByRole('textbox', { name: '账号定位', exact: true }).count(), 0)
      failedAnalysis = { ...job, id: 'analysis-failed', kind: 'analyze', status: 'failed', attempts: 4,
        result: { progress: { stage: 'analysis_batch', label: '历史分析 · 第 2/3 批', completed_batches: 1, total_batches: 3 } },
        error_message: '历史分析 · 第 2/3 批失败：OpenAI 请求失败：ReadTimeout；已完成 1/3 批，保留断点（已尝试 4 次），自动重试已停止' }
      await Promise.all([
        page.waitForResponse(response => decodeURIComponent(new URL(response.url()).pathname) === '/api/account-personas/source:source1'),
        personaDialog.getByRole('button', { name: '刷新人设记录', exact: true }).click(),
      ])
      await personaDialog.getByRole('tab', { name: 'AI 画像', exact: true }).click()
      await personaDialog.getByRole('combobox', { name: '选择分析记录', exact: true }).press('Enter')
      await page.getByRole('option').filter({ hasText: '未完成' }).click()
      await page.getByRole('option').filter({ hasText: '未完成' }).waitFor({ state: 'hidden' })
      await personaDialog.getByText(failedAnalysis.error_message, { exact: true }).waitFor()
      await personaDialog.getByRole('status').filter({ hasText: '历史分析 · 第 2/3 批 · 已完成 1/3 批' }).waitFor()
      const failureAlert = personaDialog.locator('.el-alert--error')
      assert.equal(await failureAlert.count(), 1)
      const alertBounds = await failureAlert.boundingBox()
      assert(alertBounds.x >= 0 && alertBounds.x + alertBounds.width <= viewport.width + 1)
      await page.screenshot({ path: path.join(output, `analysis-checkpoint-error-${viewport.width}.png`), fullPage: true })
      failedAnalysis.status = 'queued'
      failedAnalysis.error_message = failedAnalysis.error_message.replace('自动重试已停止', '将自动重试')
      await Promise.all([
        page.waitForResponse(response => decodeURIComponent(new URL(response.url()).pathname) === '/api/account-personas/source:source1'),
        personaDialog.getByRole('button', { name: '刷新人设记录', exact: true }).click(),
      ])
      await personaDialog.getByText(failedAnalysis.error_message, { exact: true }).waitFor()
      assert.equal(await personaDialog.locator('.el-alert--warning').count(), 1)
      failedAnalysis = null
      await personaDialog.getByRole('button', { name: '关闭', exact: true }).click()
      assert.equal(generationCount, 0)
      assert.equal(forbiddenCalls, 0)
      await create.click()
      await showHistory()
      await dialog.getByRole('tab', { name: '候选 1', exact: true }).waitFor()
      assert.equal(confirmation, null)
      await showEditor()
      await dialog.getByRole('button', { name: '作者 AI 人设', exact: true }).click()
      personaDialog = page.getByRole('dialog', { name: '原帖作者 AI 人设 · 原作者', exact: true })
      const positioning = personaDialog.getByRole('textbox', { name: '账号定位', exact: true })
      await positioning.waitFor()
      assert.equal(await positioning.inputValue(), authorAnalysis.suggested_persona.positioning)
      assert.equal(await personaDialog.getByRole('textbox', { name: '表达风格', exact: true }).inputValue(), authorAnalysis.suggested_persona.voice)
      assert(!(await personaDialog.getByRole('button', { name: '保存调整', exact: true }).isEnabled()))
      await positioning.fill('运营微调后的作者定位')
      refreshedJob = { ...job, id: 'analysis2', kind: 'analyze', created_at: '2026-10-19T02:00:00Z',
        result: { ...authorAnalysis, suggested_persona: { ...authorAnalysis.suggested_persona, positioning: '更新的 AI 结果' } } }
      await Promise.all([
        page.waitForResponse(response => decodeURIComponent(new URL(response.url()).pathname) === '/api/account-personas/source:source1'),
        personaDialog.getByRole('button', { name: '刷新人设记录', exact: true }).click(),
      ])
      await personaDialog.getByRole('tab', { name: 'AI 画像', exact: true }).click()
      await personaDialog.getByRole('tab', { name: '内容人设', exact: true }).click()
      assert.equal(await positioning.inputValue(), '运营微调后的作者定位')
      await page.screenshot({ path: path.join(output, `author-persona-${viewport.width}.png`), fullPage: true })
      await personaDialog.getByRole('button', { name: '保存调整', exact: true }).click()
      await page.getByText('人设 v1 已确认', { exact: true }).waitFor()
      assert.equal(confirmation.analysis_job_id, 'job1')
      assert.equal(confirmation.document.positioning, '运营微调后的作者定位')
      refreshedJob = null
      job.created_at = '2026-10-19T04:00:00Z'
      job.result.analysis_reference = { job_id: 'original-analysis', analyzed_at: post.updated_at,
        posts: [{ id: post.id, text_content: post.text_body, content_url: post.content_url }] }
      await personaDialog.getByRole('button', { name: '关闭', exact: true }).click()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true }).inputValue(), post.text_body)
      await showHistory()
      await dialog.getByRole('tab', { name: '候选 2', exact: true }).click()
      await dialog.getByRole('button', { name: '应用候选稿', exact: true }).click()
      await page.getByRole('button', { name: '确定', exact: true }).click()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true }).inputValue(), candidates[1])
      await dialog.getByRole('textbox', { name: '发布正文', exact: true }).fill('人工确认后的发布正文。')
      await showHistory()
      await dialog.getByRole('button', { name: '保存当前发布稿', exact: true }).click()
      await page.getByText('人工草稿已保存', { exact: true }).waitFor()
      assert.deepEqual(saved, { text_body: '人工确认后的发布正文。', expected_version: 0 })
      await page.screenshot({ path: path.join(output, `source-author-${viewport.width}.png`), fullPage: true })
      pagedHistory = true
      await dialog.getByRole('button', { name: '关闭', exact: true }).click()
      await page.getByRole('button', { name: '查看选题', exact: true }).click()
      assert.equal(await dialog.getByRole('tab', { name: '内容编辑', exact: true }).getAttribute('aria-selected'), 'true')
      await showHistory()
      await dialog.getByRole('tab', { name: '人工稿', exact: true }).waitFor()
      await dialog.getByText(saved.text_body, { exact: true }).waitFor()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true, includeHidden: true }).inputValue(), post.text_body)
      assert(!(await dialog.getByRole('button', { name: '应用人工稿', exact: true }).isEnabled()))
      assert.equal(generationCount, 1, 'reopening must not start another model call')
      await showEditor()
      await dialog.getByRole('button', { name: '作者 AI 人设', exact: true }).click()
      personaDialog = page.getByRole('dialog', { name: '原帖作者 AI 人设 · 原作者', exact: true })
      await personaDialog.getByRole('textbox', { name: '账号定位', exact: true }).waitFor()
      assert.equal(await personaDialog.getByRole('textbox', { name: '账号定位', exact: true }).inputValue(), confirmation.document.positioning,
        'a newly created job reusing an older analysis must not override newer operator corrections')
      await personaDialog.getByRole('button', { name: '关闭', exact: true }).click()
      await showHistory()
      await dialog.getByText(saved.text_body, { exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(output, `creation-history-reopened-${viewport.width}.png`), fullPage: true, animations: 'disabled' })
      await dialog.locator('.persona-creation .el-pagination .btn-next').click()
      await dialog.getByText(`${candidates[0]} 历史 19`, { exact: true }).waitFor()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true, includeHidden: true }).inputValue(), post.text_body)
      await dialog.locator('.persona-creation .el-pagination .btn-prev').click()
      await dialog.getByText(saved.text_body, { exact: true }).waitFor()
      await dialog.locator('.publish-account .el-select').click()
      await page.getByRole('option').filter({ hasText: '发布账号' }).click()
      await dialog.getByRole('button', { name: '应用人工稿', exact: true }).click()
      await page.getByRole('button', { name: '确定', exact: true }).click()
      assert.equal(await dialog.getByRole('textbox', { name: '发布正文', exact: true }).inputValue(), saved.text_body)
      await create.click()
      await dialog.getByText('AI 暂时不可用，原稿未变更', { exact: true }).filter({ visible: true }).waitFor()
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
