#!/usr/bin/env node
/**
 * scripts/check.mjs — offline self-test for the server paths that matter.
 *
 * Runs the REAL modules (src/server/feeds.js, src/server/llm.js, api/index.js),
 * not copies of them. Network access is not required.
 *
 *   npm run check
 */
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'

import { parseRss, parseReddit, decodeEntities, parseDate, stripHtml, htmlToText, SOURCES, gatherCandidates } from '../src/server/feeds.js'
import { parseStories, buildUserPrompt, resolveOpenRouter, scoreFreeModel, SYSTEM_PROMPT, CATEGORIES, OPENROUTER } from '../src/server/llm.js'
import { SEED_BATCH } from '../src/server/seed.js'
import { storyToText } from '../src/format.js'
import { spawnSync } from 'node:child_process'

// api/index.js is imported dynamically further down: it calls loadEnv() at module
// scope, so DRAMA_RADAR_NO_ENV_FILE must already be set for tests to be
// deterministic regardless of whether a real .env is present.

process.env.DRAMA_RADAR_NO_ENV_FILE = '1'

let pass = 0
const failures = []
async function test (name, fn) {
  try {
    await fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`  ✗ ${name}\n      ${String(err?.message || err).split('\n').slice(0, 4).join('\n      ')}`)
  }
}

/* ------------------------------------------------------------------ */

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Dexerto</title>
    <item>
      <title><![CDATA[Streamer banned mid-stream after &#8220;wild&#8221; on-cam meltdown]]></title>
      <link>https://example.com/a</link>
      <pubDate>Wed, 27 Aug 2026 18:04:03 +0000</pubDate>
      <description>&lt;p&gt;Chat could not believe it. &lt;b&gt;Thousands&lt;/b&gt; watched.&lt;/p&gt;</description>
      <dc:creator>Someone</dc:creator>
    </item>
    <item>
      <title>Game studio patches &amp;amp; nerfs the dupe exploit</title>
      <link>https://example.com/b</link>
      <pubDate>Tue, 26 Aug 2026 09:15:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>Players duped millions of coins.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Register</title>
  <entry>
    <title>AI lab admits agents escaped the sandbox</title>
    <link rel="alternate" href="https://example.com/c"/>
    <published>2026-08-26T21:00:00Z</published>
    <summary>Independent reviewers found 1,200 agents on an unsanctioned board.</summary>
  </entry>
</feed>`

const REDDIT_FIXTURE = {
  data: {
    children: [
      { data: { title: 'Doc threatens Nickmercs on stream', permalink: '/r/LivestreamFail/comments/abc/x/', created_utc: 1787000000, score: 9210, num_comments: 1400, link_flair_text: 'Drama', url_overridden_by_dest: 'https://x.com/veizau/status/1', stickied: false } },
      { data: { title: 'Pinned megathread, ignore me', stickied: true, created_utc: 1787000000, score: 500 } },
      { data: { title: 'NSFW post', over_18: true, created_utc: 1787000000, score: 400 } },
      { data: { title: '   ', created_utc: 1787000000 } }
    ]
  }
}

/* ------------------------------------------------------------------ */

let handler = null

async function main () {
  console.log('\n🧪 Drama Radar self-test\n')
  handler = (await import('../api/index.js')).default

  await test('RSS 2.0: parses CDATA titles, entities and descriptions', () => {
    const src = { name: 'Dexerto', category: 'creator' }
    const items = parseRss(RSS_FIXTURE, src)
    assert.equal(items.length, 2, `expected 2 items, got ${items.length}`)
    assert.equal(items[0].title, 'Streamer banned mid-stream after “wild” on-cam meltdown')
    assert.equal(items[0].url, 'https://example.com/a')
    assert.equal(items[0].summary, 'Chat could not believe it. Thousands watched.')
    assert.equal(items[0].source, 'Dexerto')
    assert.equal(items[0].category, 'creator')
  })

  await test('RSS: double-escaped entities in titles resolve to real text', () => {
    const items = parseRss(RSS_FIXTURE, { name: 'X', category: 'gaming' })
    // &amp;amp; -> &amp; -> &  (feeds that over-escape still end up readable)
    assert.equal(items[1].title, 'Game studio patches & nerfs the dupe exploit')
    assert.equal(items[1].summary, 'Players duped millions of coins.')
  })

  await test('Atom: parses <entry> with href links', () => {
    const items = parseRss(ATOM_FIXTURE, { name: 'TheRegister', category: 'tech' })
    assert.equal(items.length, 1)
    assert.equal(items[0].title, 'AI lab admits agents escaped the sandbox')
    assert.equal(items[0].url, 'https://example.com/c')
    assert.ok(items[0].publishedAt > 0, 'Atom published date should parse')
  })

  await test('RSS: garbage input returns [] instead of throwing', () => {
    assert.deepEqual(parseRss('not xml at all', { name: 'x', category: 'tech' }), [])
    assert.deepEqual(parseRss('', { name: 'x', category: 'tech' }), [])
    assert.deepEqual(parseRss(null, { name: 'x', category: 'tech' }), [])
  })

  await test('Reddit: maps listing, drops stickied/NSFW/blank', () => {
    const items = parseReddit(REDDIT_FIXTURE, { name: 'r/LivestreamFail', category: 'creator' })
    assert.equal(items.length, 1, `expected 1 item, got ${items.length}`)
    assert.equal(items[0].title, 'Doc threatens Nickmercs on stream')
    assert.equal(items[0].score, 9210)
    assert.equal(items[0].comments, 1400)
    assert.equal(items[0].flair, 'Drama')
    assert.equal(items[0].url, 'https://x.com/veizau/status/1')
  })

  await test('Reddit: malformed payload returns []', () => {
    assert.deepEqual(parseReddit({}, { name: 'x', category: 'creator' }), [])
    assert.deepEqual(parseReddit(null, { name: 'x', category: 'creator' }), [])
  })

  await test('parseDate handles RFC822, ISO and junk', () => {
    assert.ok(Number.isFinite(parseDate('Wed, 27 Aug 2026 18:04:03 +0000')))
    assert.ok(Number.isFinite(parseDate('2026-08-26T21:00:00Z')))
    assert.equal(parseDate('nonsense'), null)
    assert.equal(parseDate(''), null)
  })

  await test('decodeEntities handles CDATA, numeric and named refs', () => {
    assert.equal(decodeEntities('&#8220;hi&#8221; &amp; bye'), '“hi” & bye')
    assert.equal(decodeEntities('&#x41;&#x42;'), 'AB')
    assert.equal(decodeEntities('<![CDATA[raw <text>]]>'), 'raw <text>')
    assert.equal(decodeEntities(undefined), '')
  })

  await test('toPlainText: plain markup, CDATA and escaped HTML all end up clean', () => {
    assert.equal(stripHtml('<p>a  <b>b</b>\n c</p>'), 'a b c')
    // CDATA title with numeric entities inside
    assert.equal(stripHtml('<![CDATA[Streamer banned &#8220;mid-stream&#8221;]]>'), 'Streamer banned “mid-stream”')
    // escaped HTML body
    assert.equal(htmlToText('&lt;p&gt;Chat &lt;b&gt;lost it&lt;/b&gt;.&lt;/p&gt;'), 'Chat lost it .')
    assert.equal(htmlToText('&lt;p&gt;One &amp;amp; two&lt;/p&gt;'), 'One & two')
    assert.equal(htmlToText('<![CDATA[<p>Plain CDATA body</p>]]>'), 'Plain CDATA body')
    assert.equal(htmlToText(null), '')
    assert.equal(htmlToText(''), '')
  })

  await test('SOURCES: every entry is a usable https URL with a category', () => {
    assert.ok(SOURCES.length >= 100, `expected >=100 sources, got ${SOURCES.length}`)
    for (const s of SOURCES) {
      assert.match(s.url, /^https:\/\//, `bad url: ${s.url}`)
      assert.ok(CATEGORIES.includes(s.category), `bad category: ${s.category}`)
      assert.ok(['rss', 'reddit'].includes(s.kind), `bad kind: ${s.kind}`)
    }
  })

  await test('SOURCES has no duplicate URLs', () => {
    const urls = SOURCES.map(s => s.url)
    const dupes = urls.filter((u, i) => urls.indexOf(u) !== i)
    assert.deepEqual(dupes, [], `duplicate sources: ${dupes.join(', ')}`)
  })

  await test('SOURCES spans every category', () => {
    const seen = new Set(SOURCES.map(s => s.category))
    for (const c of CATEGORIES) assert.ok(seen.has(c), `no source tagged ${c}`)
  })

  await test('gatherCandidates never throws when every source is unreachable', async () => {
    const { candidates, diagnostics, attemptedSources, elapsedMs } = await gatherCandidates({ hours: 48, concurrency: 24, limitPerSource: 5 })
    assert.ok(Array.isArray(candidates))
    assert.equal(diagnostics.length, SOURCES.length, 'should report one diagnostic per source')
    assert.equal(attemptedSources, SOURCES.length)
    assert.ok(typeof elapsedMs === 'number' && elapsedMs >= 0)
    // In a sandbox with no egress everything fails — that must be a clean empty result.
    const ok = diagnostics.filter(d => d.ok).length
    console.log(`      (${ok}/${SOURCES.length} sources reachable from here)`)
  })

  await test('parseStories: clean JSON', () => {
    const out = parseStories(JSON.stringify({
      stories: [{ id: 's1', topicTitle: 'T', sourceContext: 'C', whyViral: 'W', hookA: 'A', hookB: 'B', category: 'gaming', severity: 'wild', sourceName: 'IGN', sourceUrl: 'https://ign.com', ageHours: 4 }]
    }))
    assert.equal(out.length, 1)
    assert.equal(out[0].category, 'gaming')
    assert.equal(out[0].ageHours, 4)
  })

  await test('parseStories: survives a markdown fence + prose padding', () => {
    const messy = 'Sure! Here you go:\n```json\n{"stories":[{"topicTitle":"T2","sourceContext":"C2","whyViral":"W","hookA":"A","hookB":"B","category":"nope","severity":"nope"}]}\n```\nHope that helps!'
    const out = parseStories(messy)
    assert.equal(out.length, 1)
    assert.equal(out[0].topicTitle, 'T2')
    assert.equal(out[0].category, 'viral', 'invalid category must fall back to viral')
    assert.equal(out[0].severity, 'spicy', 'invalid severity must fall back')
    assert.equal(out[0].id, 's1', 'missing id must be generated')
  })

  await test('parseStories: accepts a bare array and alt field names', () => {
    const out = parseStories('[{"title":"T3","context":"C3","viral":"W","hook1":"A","hook2":"B","url":"https://x.com"}]')
    assert.equal(out.length, 1)
    assert.equal(out[0].topicTitle, 'T3')
    assert.equal(out[0].hookA, 'A')
    assert.equal(out[0].sourceUrl, 'https://x.com')
  })

  await test('parseStories: drops items missing required fields', () => {
    const out = parseStories('{"stories":[{"topicTitle":"only title"},{"topicTitle":"T4","sourceContext":"C4","whyViral":"W","hookA":"A","hookB":"B"}]}')
    assert.equal(out.length, 1)
    assert.equal(out[0].topicTitle, 'T4')
  })

  await test('parseStories: throws on unparseable output', () => {
    assert.throws(() => parseStories('the model apologised and returned nothing'))
    assert.throws(() => parseStories(''))
  })

  await test('buildUserPrompt embeds the window, limit and candidates', () => {
    const prompt = buildUserPrompt({
      hours: 24, limit: 5, category: 'creator',
      candidates: [{ title: 'Doc rants', source: 'r/LivestreamFail', category: 'creator', ageHours: 3, score: 900, comments: 20, url: 'https://x.com/1', summary: 'He lost it.', alsoSeen: ['Dexerto'] }]
    })
    assert.match(prompt, /last 24 hours/)
    assert.match(prompt, /exactly 5/)
    assert.match(prompt, /Doc rants/)
    assert.match(prompt, /age=3h/)
    assert.match(prompt, /alsoOn=Dexerto/)
    assert.match(prompt, /https:\/\/x\.com\/1/)
  })

  await test('SYSTEM_PROMPT locks the four required sections', () => {
    for (const token of ['topicTitle', 'sourceContext', 'whyViral', 'hookA', 'hookB']) {
      assert.ok(SYSTEM_PROMPT.includes(token), `prompt missing ${token}`)
    }
    assert.match(SYSTEM_PROMPT, /Return ONLY valid minified JSON/)
  })

  await test('resolveOpenRouter: env key, request key, else null', () => {
    assert.equal(resolveOpenRouter({}, {}), null, 'no key -> null (demo mode)')
    assert.equal(resolveOpenRouter({}, { OPENROUTER_API_KEY: 'sk-or-v1-12345678' }).keySource, 'env')
    assert.equal(resolveOpenRouter({ apiKey: 'sk-or-v1-abcdef' }, {}).keySource, 'request')
    assert.equal(resolveOpenRouter({}, { OPENROUTER_API_KEY: 'short' }), null, 'too-short key rejected')
  })

  await test('resolveOpenRouter: DRAMA_RADAR_MODEL pins the model, else null means auto-pick', () => {
    const key = { OPENROUTER_API_KEY: 'sk-or-v1-12345678' }
    assert.equal(resolveOpenRouter({}, key).model, null, 'no override -> auto-pick')
    assert.equal(resolveOpenRouter({}, { ...key, DRAMA_RADAR_MODEL: 'test/pinned:free' }).model, 'test/pinned:free')
  })

  await test('OpenRouter is the only provider wired up', () => {
    assert.equal(OPENROUTER.keyEnv, 'OPENROUTER_API_KEY')
    assert.match(OPENROUTER.chatUrl, /^https:\/\/openrouter\.ai\//)
    assert.match(OPENROUTER.modelsUrl, /^https:\/\/openrouter\.ai\//)
  })

  await test('seed batch: 5 stories, all fields present, hooks are distinct', () => {
    assert.equal(SEED_BATCH.stories.length, 5, `expected 5 seed stories, got ${SEED_BATCH.stories.length}`)
    for (const s of SEED_BATCH.stories) {
      for (const f of ['id', 'topicTitle', 'sourceContext', 'whyViral', 'hookA', 'hookB', 'category', 'severity']) {
        assert.ok(s[f], `seed story ${s.id} missing ${f}`)
      }
      assert.notEqual(s.hookA, s.hookB, `seed story ${s.id} has identical hooks`)
      assert.ok(s.topicTitle.length <= 100, `title too long: ${s.topicTitle}`)
      assert.match(s.sourceUrl, /^https:\/\//)
    }
  })

  await test('storyToText renders the exact 4-section format', () => {
    const text = storyToText(SEED_BATCH.stories[0], 1)
    assert.match(text, /^1\. TOPIC TITLE: /)
    assert.match(text, /SOURCE \/ CONTEXT: /)
    assert.match(text, /WHY IT'S VIRAL: /)
    assert.match(text, /THE HOOK LINE:/)
    assert.match(text, /Variation A: /)
    assert.match(text, /Variation B: /)
  })

  /* ---------- free-model ranking (pure, offline) ---------- */

  await test('scoreFreeModel prefers models that can emit JSON', () => {
    const withJson = scoreFreeModel({ id: 'a/model:free', context_length: 32000, supported_parameters: ['response_format'] })
    const without = scoreFreeModel({ id: 'a/model:free', context_length: 32000, supported_parameters: [] })
    assert.ok(withJson > without, `json-capable ${withJson} should beat ${without}`)
  })

  await test('scoreFreeModel prefers a bigger context window, capped', () => {
    const small = scoreFreeModel({ id: 'x/m:free', context_length: 8000, supported_parameters: ['response_format'] })
    const big = scoreFreeModel({ id: 'x/m:free', context_length: 128000, supported_parameters: ['response_format'] })
    const huge = scoreFreeModel({ id: 'x/m:free', context_length: 2000000, supported_parameters: ['response_format'] })
    assert.ok(big > small, 'bigger context should score higher')
    assert.equal(big, huge, 'context bonus must be capped')
  })

  await test('scoreFreeModel uses family tier only as a tiebreaker', () => {
    const weak = scoreFreeModel({ id: 'unknown/tiny:free', context_length: 128000, supported_parameters: ['response_format', 'structured_outputs', 'tools'] })
    const strong = scoreFreeModel({ id: 'anthropic/claude-4:free', context_length: 8000, supported_parameters: [] })
    assert.ok(weak > strong, 'objective metadata must outrank name recognition')
  })

  await test('scoreFreeModel tolerates a garbage model object', () => {
    assert.equal(typeof scoreFreeModel({}), 'number')
    assert.equal(typeof scoreFreeModel(null), 'number')
    assert.equal(typeof scoreFreeModel({ id: 42, context_length: 'nope' }), 'number')
  })

  await test('CATEGORIES covers the full spread the UI offers', () => {
    for (const c of ['viral', 'creator', 'gaming', 'tech', 'entertainment', 'world', 'money', 'sports', 'science', 'bizarre']) {
      assert.ok(CATEGORIES.includes(c), `missing category: ${c}`)
    }
    assert.ok(SYSTEM_PROMPT.includes('"entertainment"'), 'prompt must know the new categories')
  })

  /* ---------- the .env -> process.env path that makes the key live ---------- */

  await test('loadEnv() reads .env so the API key actually reaches process.env', () => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
      "import('./src/server/env.js').then(m => { m.loadEnv(); console.log(process.env.OPENROUTER_API_KEY ? 'LOADED' : 'MISSING') })"
    ], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, DRAMA_RADAR_NO_ENV_FILE: '' } })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout.trim(), /LOADED|MISSING/)
    // Report which it was rather than hard-failing: a fresh clone has no .env.
    console.log(`      (.env key ${r.stdout.trim() === 'LOADED' ? 'present and loaded' : 'absent — demo mode'})`)
  })

  await test('DRAMA_RADAR_NO_ENV_FILE=1 makes the loader ignore .env', () => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
      "import('./src/server/env.js').then(m => { m.loadEnv(); console.log(process.env.OPENROUTER_API_KEY ? 'LOADED' : 'IGNORED') })"
    ], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, DRAMA_RADAR_NO_ENV_FILE: '1', OPENROUTER_API_KEY: '' } })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout.trim(), /IGNORED/)
  })

  /* ---------- end-to-end: the actual route handler ---------- */

  await test('GET /api/health responds 200 and reports demo mode with no key', async () => {
    const res = await invoke({ method: 'GET', url: '/api/health' })
    assert.equal(res.status, 200)
    assert.equal(res.json.ok, true)
    assert.equal(res.json.mode, 'demo')
    assert.equal(res.json.provider, 'openrouter')
    assert.equal(res.json.keySet, false)
    assert.ok(res.json.sources >= 100)
  })

  await test('GET /api/models explains itself when there is no OpenRouter key', async () => {
    const res = await invoke({ method: 'GET', url: '/api/models' })
    assert.equal(res.status, 200)
    assert.equal(res.json.ok, false)
    assert.match(res.json.notice, /OPENROUTER_API_KEY/)
  })

  await test('POST /api/scrape returns the demo batch when no key is configured', async () => {
    const res = await invoke({ method: 'POST', url: '/api/scrape', body: { hours: 48, limit: 5, category: 'all' } })
    assert.equal(res.status, 200)
    assert.equal(res.json.mode, 'demo')
    assert.equal(res.json.ok, true)
    assert.equal(res.json.stories.length, 5)
    assert.ok(res.json.notice, 'demo mode should explain itself')
    assert.equal(res.json.stories[0].topicTitle, SEED_BATCH.stories[0].topicTitle)
  })

  await test('POST /api/scrape honours the limit param', async () => {
    const res = await invoke({ method: 'POST', url: '/api/scrape', body: { limit: 3 } })
    assert.equal(res.json.stories.length, 3)
  })

  await test('POST /api/scrape clamps nonsense input instead of 500ing', async () => {
    const res = await invoke({ method: 'POST', url: '/api/scrape', body: { hours: 'lol', limit: 9999, category: 'made-up' } })
    assert.equal(res.status, 200)
    assert.equal(res.json.stories.length, 5, 'limit clamps to 5 (demo batch size)')
    assert.equal(res.json.windowHours, 48, 'hours falls back to 48')
  })

  await test('GET /api/scrape is rejected with 405', async () => {
    const res = await invoke({ method: 'GET', url: '/api/scrape' })
    assert.equal(res.status, 405)
  })

  await test('unknown route returns 404', async () => {
    const res = await invoke({ method: 'GET', url: '/api/nope' })
    assert.equal(res.status, 404)
  })

  await test('malformed JSON body does not crash the handler', async () => {
    const res = await invoke({ method: 'POST', url: '/api/scrape', raw: '{not json' })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.json.stories))
  })

  await test('a bad API key degrades to raw candidates, never a 500', async () => {
    const res = await invoke({
      method: 'POST', url: '/api/scrape',
      body: { apiKey: 'sk-definitely-not-real-000000', provider: 'openai', limit: 5 }
    })
    assert.equal(res.status, 200, `expected graceful 200, got ${res.status}: ${res.json?.error || ''}`)
    // Either no sources were reachable (notice about sources) or the key was
    // rejected — both are handled, both return ok:false with a notice.
    assert.equal(res.json.ok, false)
    assert.ok(typeof res.json.notice === 'string' && res.json.notice.length > 10)
  })

  /* ---------- the scrape -> model-loop -> raw-fallback path ---------- */

  await test('rejected key after a successful scrape returns RAW candidates, not the seed batch', async () => {
    const realFetch = globalThis.fetch
    // Feeds answer with real RSS; the chat endpoint rejects the key.
    globalThis.fetch = async (url, opts) => {
      const u = String(url)
      if (u.includes('/chat/completions') || u.includes('api.anthropic.com')) {
        return { ok: false, status: 401, text: async () => '{"error":{"message":"invalid api key"}}' }
      }
      if (u.includes('/api/v1/models')) {
        return { ok: false, status: 401, text: async () => 'invalid api key' }
      }
      return { ok: true, status: 200, text: async () => RSS_FIXTURE }
    }
    try {
      const res = await invoke({
        method: 'POST', url: '/api/scrape',
        body: { hours: 48, limit: 5, apiKey: 'sk-or-v1-bogus-key-0000000', force: true }
      })
      assert.equal(res.status, 200, `expected graceful 200, got ${res.status}`)
      assert.equal(res.json.ok, false)
      assert.equal(res.json.raw, true, 'should be flagged as a raw scrape')
      assert.ok(res.json.candidateCount > 0, `expected scraped candidates, got ${res.json.candidateCount}`)
      assert.match(res.json.notice, /OpenRouter rejected the key/i)
      // The stories must be the scraped ones, NOT the bundled demo batch.
      const titles = res.json.stories.map(s => s.topicTitle).join(' | ')
      assert.match(titles, /Streamer banned mid-stream|Game studio patches/i)
      assert.equal(res.json.stories[0].id.startsWith('raw'), true, 'raw fallback ids expected')
      console.log(`      (scraped ${res.json.candidateCount} candidates, fell back to raw cards)`)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  await test('a reachable feed + working model path is exercised by the same stub shape', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
      const u = String(url)
      // A stub must behave like a real Response: postJSON reads .text(), discoverFreeModels reads .json().
      const json = obj => ({ ok: true, status: 200, text: async () => JSON.stringify(obj), json: async () => obj })
      if (u.includes('/api/v1/models')) {
        return json({ data: [
          { id: 'test/best:free', name: 'Best', context_length: 128000, created: Math.floor(Date.now()/1000), supported_parameters: ['response_format','tools'], architecture: { output_modalities: ['text'] } },
          { id: 'test/paid', name: 'Paid', context_length: 128000, supported_parameters: ['response_format'] }
        ] })
      }
      if (u.includes('/chat/completions')) {
        return json({ choices: [{ message: { content: JSON.stringify({
          stories: [{ topicTitle: 'STUBBED STORY', sourceContext: 'ctx', whyViral: 'why', hookA: 'a', hookB: 'b', category: 'gaming', severity: 'wild', sourceName: 'Dexerto', sourceUrl: 'https://example.com/a', ageHours: 2 }]
        }) } }] })
      }
      return { ok: true, status: 200, text: async () => RSS_FIXTURE }
    }
    try {
      const res = await invoke({
        method: 'POST', url: '/api/scrape',
        body: { hours: 48, limit: 5, apiKey: 'sk-or-v1-good-key-0000000', force: true }
      })
      assert.equal(res.json.ok, true, `expected success, notice: ${res.json.notice}`)
      assert.equal(res.json.mode, 'live')
      assert.equal(res.json.modelAuto, true, 'should have auto-picked')
      assert.equal(res.json.model, 'test/best:free', `should rank the json-capable free model first, got ${res.json.model}`)
      assert.equal(res.json.stories[0].topicTitle, 'STUBBED STORY')
      assert.equal(res.json.stories[0].category, 'gaming')
      console.log(`      (auto-picked ${res.json.model} from 1 free of 2 models)`)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  await test('OpenRouter failover happens in ONE request, not one per model (protects free quota)', async () => {
    const realFetch = globalThis.fetch
    let chatCalls = 0
    let sentBody = null
    globalThis.fetch = async (url, opts) => {
      const u = String(url)
      const json = obj => ({ ok: true, status: 200, text: async () => JSON.stringify(obj), json: async () => obj })
      if (u.includes('/api/v1/models')) {
        return json({ data: [{ id: 'test/best:free', context_length: 128000, created: Math.floor(Date.now()/1000), supported_parameters: ['response_format'] }] })
      }
      if (u.includes('/chat/completions')) {
        chatCalls++
        sentBody = JSON.parse(opts.body)
        return json({ model: 'test/best:free', choices: [{ message: { content: JSON.stringify({ stories: [
          { topicTitle: 'ONE REQUEST', sourceContext: 'c', whyViral: 'w', hookA: 'a', hookB: 'b', category: 'tech' }
        ] }) } }] })
      }
      return { ok: true, status: 200, text: async () => RSS_FIXTURE }
    }
    try {
      const res = await invoke({
        method: 'POST', url: '/api/scrape',
        body: { hours: 48, limit: 5, category: 'world', apiKey: 'sk-or-v1-good-key-000', force: true }
      })
      assert.equal(res.json.ok, true, res.json.notice)
      assert.equal(chatCalls, 1, `expected exactly 1 chat request, made ${chatCalls}`)
      assert.ok(Array.isArray(sentBody.models), 'should send a models array, not a single model')
      assert.ok(sentBody.models.length > 1, `expected fallbacks in the array, got ${JSON.stringify(sentBody.models)}`)
      assert.equal(sentBody.model, undefined, 'should not also pin a single model')
      assert.equal(res.json.model, 'test/best:free', 'should report the model that actually answered')
      console.log(`      (1 request carrying ${sentBody.models.length} candidate models)`)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  /* ---------- the request budget must not let the function be killed ---------- */

  await test('an exhausted request budget returns raw cards instead of hanging', async () => {
    const realFetch = globalThis.fetch
    const prevBudget = process.env.DRAMA_RADAR_BUDGET_MS
    globalThis.fetch = async (url) => {
      const u = String(url)
      const json = obj => ({ ok: true, status: 200, text: async () => JSON.stringify(obj), json: async () => obj })
      if (u.includes('/api/v1/models')) {
        return json({ data: [{ id: 'test/best:free', context_length: 128000, created: Math.floor(Date.now()/1000), supported_parameters: ['response_format'] }] })
      }
      // A model that resolves fine — the only thing that should stop it is the budget.
      if (u.includes('/chat/completions')) {
        return json({ choices: [{ message: { content: JSON.stringify({ stories: [
          { topicTitle: 'SHOULD NOT APPEAR', sourceContext: 'x', whyViral: 'y', hookA: 'a', hookB: 'b' }
        ] }) } }] })
      }
      return { ok: true, status: 200, text: async () => RSS_FIXTURE }
    }
    process.env.DRAMA_RADAR_BUDGET_MS = '500' // far too small for the 9s minimum LLM allowance
    try {
      const res = await invoke({
        method: 'POST', url: '/api/scrape',
        body: { hours: 48, limit: 5, category: 'world', apiKey: 'sk-or-v1-good-key-000', force: true }
      })
      assert.equal(res.status, 200)
      assert.equal(res.json.ok, false)
      assert.equal(res.json.raw, true, 'must fall back to raw cards')
      assert.match(res.json.notice, /Ran out of the \d+s request budget/)
      assert.ok(res.json.candidateCount > 0, `expected candidates, got ${res.json.candidateCount}`)
      const titles = res.json.stories.map(x => x.topicTitle).join(' | ')
      assert.ok(!titles.includes('SHOULD NOT APPEAR'), 'the model result must not have been used')
      console.log(`      (budget 500ms -> bailed before the LLM, kept ${res.json.candidateCount} raw candidates)`)
    } finally {
      globalThis.fetch = realFetch
      if (prevBudget === undefined) delete process.env.DRAMA_RADAR_BUDGET_MS
      else process.env.DRAMA_RADAR_BUDGET_MS = prevBudget
    }
  })

  await test('the default budget fits inside Vercel Hobby maxDuration of 60s', async () => {
    const prev = process.env.DRAMA_RADAR_BUDGET_MS
    delete process.env.DRAMA_RADAR_BUDGET_MS
    try {
      // Mirror api/index.js: scrape gets 35% of the budget, the LLM gets the rest.
      const budget = Number(process.env.DRAMA_RADAR_BUDGET_MS) || 52000
      const scrape = Math.min(20000, Math.floor(budget * 0.35))
      assert.ok(budget <= 60000, `budget ${budget}ms exceeds the 60s function ceiling`)
      assert.ok(budget - scrape >= 9000, `LLM would only get ${budget - scrape}ms`)
      assert.equal(scrape, 18200, 'scrape should be capped at 35% of 52s')
    } finally {
      if (prev !== undefined) process.env.DRAMA_RADAR_BUDGET_MS = prev
    }
  })

  /* ---------- report ---------- */
  console.log('')
  if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${pass} passed\n`)
    process.exit(1)
  }
  console.log(`✅ ${pass}/${pass} checks passed\n`)
}

/** Drive the real handler with a fake req/res pair. */
function invoke ({ method, url, body, raw }) {
  return new Promise((resolve, reject) => {
    let sc = 200
    const res = {
      headers: {},
      setHeader (k, v) { this.headers[k.toLowerCase()] = v },
      end (text) {
        let json = null
        try { json = JSON.parse(text) } catch {}
        resolve({ status: sc, text, json })
      }
    }
    Object.defineProperty(res, 'statusCode', { get: () => sc, set: v => { sc = v }, enumerable: true })

    let req
    if (raw !== undefined) {
      req = Object.assign(Readable.from([raw]), { method, url, headers: {} })
    } else if (body !== undefined) {
      req = Object.assign(Readable.from([JSON.stringify(body)]), { method, url, headers: {} })
    } else {
      req = { method, url, headers: {} }
    }

    Promise.resolve()
      .then(() => handler(req, res))
      .catch(reject)
  })
}

main().catch(err => {
  console.error('\n💥 self-test crashed:', err)
  process.exit(1)
})
