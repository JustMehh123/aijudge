/**
 * /api — works unchanged in three environments:
 *   1. Vite dev server   (connect middleware: (req,res,next))
 *   2. `vite preview`    (same signature)
 *   3. Vercel serverless (Node runtime handler: (req,res))
 *
 * Routes:
 *   GET  /api/health          -> mode + provider + optional feed diagnostics
 *   GET  /api/models          -> ranked free models on OpenRouter
 *   POST /api/scrape          -> { hours, limit, category, provider, apiKey, model, force }
 */
import { loadEnv } from '../src/server/env.js'
import { gatherCandidates, SOURCES } from '../src/server/feeds.js'
import { curateWithLLM, resolveProvider, discoverFreeModels, pickFreeModel, PROVIDERS, parseStories, CATEGORIES } from '../src/server/llm.js'
import { SEED_BATCH } from '../src/server/seed.js'

// Must run before anything reads process.env. feeds.js and llm.js only read env
// lazily (inside functions), so module-evaluation order is not a hazard here.
loadEnv()

// Tiny in-memory cache so repeat clicks don't burn API credits.
// Vercel may recycle it between invocations; that's just a nicety.
const CACHE = new Map()
const CACHE_TTL_MS = 10 * 60 * 1000

// Tried in order only if OpenRouter's /models endpoint is unreachable, so a
// blocked endpoint cannot dead-end the app. Long-standing free models first.
const FALLBACK_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen-2.5-72b-instruct:free'
]

export default async function handler (req, res) {
  try {
    const method = (req.method || 'GET').toUpperCase()
    const path = String(req.url || '/api/health')

    if (path.startsWith('/api/health')) return await handleHealth(req, res)
    if (path.startsWith('/api/models')) return await handleModels(req, res)
    if (path.startsWith('/api/scrape')) {
      if (method !== 'POST') return sendJSON(res, 405, { error: 'Use POST' })
      return await handleScrape(res, await readBody(req))
    }
    return sendJSON(res, 404, { error: 'Not found' })
  } catch (err) {
    return sendJSON(res, 500, { error: String(err?.message || err) })
  }
}

/* ------------------------------------------------------------------ */

async function handleHealth (req, res) {
  const provider = resolveProvider({}, process.env)
  const payload = {
    ok: true,
    runtime: typeof EdgeRuntime !== 'undefined' ? 'edge' : 'node',
    sources: SOURCES.length,
    categories: CATEGORIES,
    mode: provider ? 'live' : 'demo',
    provider: provider ? provider.id : null,
    model: provider ? provider.model : null,
    autoModel: Boolean(provider && !provider.model),
    keySource: provider ? provider.keySource : null,
    providers: Object.keys(PROVIDERS),
    env: Object.keys(PROVIDERS).map(id => ({ id, set: Boolean(process.env[PROVIDERS[id].keyEnv]) })),
    time: new Date().toISOString()
  }

  // ?feeds=1 runs a real connectivity check (handy for debugging a deploy)
  if (/[?&]feeds=1/.test(req.url || '')) {
    const { diagnostics, reachedSources, attemptedSources, elapsedMs } = await gatherCandidates({ hours: 48, limitPerSource: 1 })
    payload.diagnostics = diagnostics
    payload.reachable = reachedSources
    payload.attempted = attemptedSources
    payload.elapsedMs = elapsedMs
  }

  return sendJSON(res, 200, payload)
}

async function handleModels (req, res) {
  const provider = resolveProvider({}, process.env)
  if (!provider || provider.id !== 'openrouter') {
    return sendJSON(res, 200, {
      ok: false,
      notice: 'Free-model discovery needs an OpenRouter key (OPENROUTER_API_KEY).'
    })
  }
  try {
    const { models, cached, totalScanned } = await discoverFreeModels({
      apiKey: provider.key,
      force: /[?&]refresh=1/.test(req.url || '')
    })
    return sendJSON(res, 200, { ok: true, count: models.length, cached, totalScanned, models: models.slice(0, 25) })
  } catch (err) {
    return sendJSON(res, 200, { ok: false, notice: String(err?.message || err) })
  }
}

async function handleScrape (res, body) {
  const hours = clamp(intOr(body.hours, 48), 6, 168)
  const limit = clamp(intOr(body.limit, 5), 3, 12)
  const category = CATEGORIES.includes(body.category) || body.category === 'all' ? body.category : 'all'
  const force = Boolean(body.force)

  const provider = resolveProvider(
    { provider: body.provider, apiKey: body.apiKey, model: body.model },
    process.env
  )

  /* ---------- DEMO MODE: no key configured, still fully usable ---------- */
  if (!provider) {
    return sendJSON(res, 200, {
      ok: true,
      mode: 'demo',
      notice: SEED_BATCH.notice,
      generatedAt: SEED_BATCH.generatedAt,
      windowHours: SEED_BATCH.windowHours,
      candidateCount: 0,
      diagnostics: SEED_BATCH.diagnostics,
      stories: SEED_BATCH.stories.slice(0, limit)
    })
  }

  /* ---------- scrape first: this needs no LLM at all ---------- */
  const gathered = await gatherCandidates({ hours, category, limitPerSource: 20 })
  const { candidates, diagnostics } = gathered
  const meta = {
    generatedAt: new Date().toISOString(),
    windowHours: hours,
    candidateCount: candidates.length,
    reachedSources: gathered.reachedSources,
    attemptedSources: gathered.attemptedSources,
    timedOut: gathered.timedOut,
    diagnostics
  }

  if (!candidates.length) {
    return sendJSON(res, 200, {
      ok: false, mode: 'live', ...meta,
      notice:
        `Reached ${gathered.reachedSources}/${gathered.attemptedSources} trending sources — none returned usable stories. ` +
        'On localhost check your connection, VPN or adblocker. On Vercel retry in a moment.',
      stories: SEED_BATCH.stories.slice(0, limit)
    })
  }

  /* ---------- build the model list ---------- */
  // Explicit model wins. Otherwise ask OpenRouter what is free right now, and
  // keep a short fallback list so a blocked /models endpoint cannot dead-end us.
  const modelCandidates = []
  let modelAuto = false
  if (provider.model) {
    modelCandidates.push(provider.model)
  } else if (provider.id === 'openrouter') {
    modelAuto = true
    const best = await pickFreeModel({ apiKey: provider.key })
    if (best) modelCandidates.push(best.id)
    for (const m of FALLBACK_FREE_MODELS) if (!modelCandidates.includes(m)) modelCandidates.push(m)
  }

  if (!modelCandidates.length) {
    return sendJSON(res, 200, {
      ok: false, mode: 'live', provider: provider.id, ...meta,
      notice: `The ${provider.id} provider needs an explicit model name. Set DRAMA_RADAR_MODEL, pick one in Settings, or use an OpenRouter key to auto-pick a free model. Raw scrape below.`,
      stories: rawFallback(candidates, limit),
      raw: true
    })
  }

  const cacheKey = `${provider.id}|${modelCandidates[0]}|${hours}|${limit}|${category}`
  if (!force) {
    const hit = CACHE.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return sendJSON(res, 200, { ...hit.payload, cached: true })
  }

  /* ---------- curate, trying each model in turn ---------- */
  let lastError = ''
  for (const model of modelCandidates) {
    try {
      const stories = await curateWithLLM({ provider: { ...provider, model }, candidates, hours, limit, category })
      if (!stories.length) throw new Error('Model returned zero usable stories')
      const payload = {
        ok: true, mode: 'live', provider: provider.id, model, modelAuto,
        notice: null, ...meta, stories: stories.slice(0, limit)
      }
      CACHE.set(cacheKey, { at: Date.now(), payload })
      if (CACHE.size > 60) CACHE.delete(CACHE.keys().next().value)
      return sendJSON(res, 200, payload)
    } catch (err) {
      lastError = String(err?.message || err)
      // A rejected key will not be fixed by switching models — stop and say so.
      if (/401|403|invalid api key|invalid_api_key|credit|billing|quota|permission/i.test(lastError)) break
    }
  }

  const keyProblem = /401|403|invalid api key|invalid_api_key|credit|billing|quota|permission/i.test(lastError)
  return sendJSON(res, 200, {
    ok: false, mode: 'live', provider: provider.id, model: modelCandidates[0], modelAuto, ...meta,
    notice: keyProblem
      ? `Your ${provider.id} key was rejected (${lastError}). Check it in Settings, or clear it to fall back to demo mode. Raw scrape below.`
      : `No model could curate this batch (${lastError}). Showing raw scraped candidates instead — pin a model name in Settings to fix it.`,
    stories: rawFallback(candidates, limit),
    raw: true
  })
}

/* ------------------------------------------------------------------ */

/**
 * If no model could curate the batch, still show the real scraped headlines as
 * rough cards — a half-useful screen beats an error page.
 */
function rawFallback (candidates, limit) {
  // Keep the "spread across categories" promise even without the model:
  // round-robin by category, falling back to raw rank once variety runs out.
  const picked = []
  const pool = [...candidates]
  while (picked.length < limit && pool.length) {
    const seen = new Set(picked.map(p => p.category))
    const freshIdx = pool.findIndex(c => !seen.has(c.category))
    picked.push(pool.splice(freshIdx >= 0 ? freshIdx : 0, 1)[0])
  }

  return picked.slice(0, limit).map((c, i) => ({
    id: `raw${i + 1}`,
    topicTitle: c.title.slice(0, 90),
    sourceContext:
      (c.summary ? `${c.summary} ` : '') +
      `Pulled from ${c.source}${c.alsoSeen?.length ? ` (also on ${c.alsoSeen.slice(0, 2).join(', ')})` : ''}${
        c.ageHours != null ? `, about ${c.ageHours}h old` : ''
      }. Raw scrape — the AI step did not run, so there is no viral read or hook lines yet.`,
    whyViral: 'Uncurated — the AI step did not run for this batch.',
    hookA: `Hook generator offline, but this ${c.category} story out of ${c.source} is worth a look.`,
    hookB: 'Nobody is talking about this yet and it should be everywhere.',
    category: c.category,
    severity: 'spicy',
    sourceName: c.source,
    sourceUrl: c.url || '',
    ageHours: c.ageHours ?? null
  }))
}

function clamp (n, min, max) {
  return Math.min(max, Math.max(min, n))
}
function intOr (v, fallback) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function sendJSON (res, status, payload) {
  const text = JSON.stringify(payload)
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.statusCode = status
  }
  if (res && typeof res.end === 'function') res.end(text)
  return text
}

async function readBody (req) {
  if (req && typeof req === 'object' && !req.on && !req.pipe) return req
  if (req && typeof req.body === 'object' && req.body) return req.body

  return await new Promise(resolve => {
    let raw = ''
    let done = false
    const finish = value => {
      if (done) return
      done = true
      resolve(value)
    }
    if (!req || typeof req.on !== 'function') return finish({})
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > 1e6) {
        try { req.destroy() } catch {}
        finish({})
      }
    })
    req.on('end', () => {
      if (!raw) return finish({})
      try { finish(JSON.parse(raw)) } catch { finish({}) }
    })
    req.on('error', () => finish({}))
  })
}

export { parseStories }
