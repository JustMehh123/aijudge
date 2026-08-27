/**
 * llm.js — turns a pile of raw trending headlines into N curated story cards.
 *
 * Providers (use whichever key exists):
 *   - openrouter (OPENROUTER_API_KEY)  — preferred; can auto-pick a FREE model
 *   - openai     (OPENAI_API_KEY)
 *   - anthropic  (ANTHROPIC_API_KEY)
 *
 * Nothing about the model choice is hardcoded to a version: for OpenRouter we ask
 * /api/v1/models which ":free" models exist right now and rank them on objective
 * metadata, so this keeps working as the free tier changes.
 */

export const CATEGORIES = ['viral', 'creator', 'gaming', 'tech', 'entertainment', 'world', 'money', 'sports', 'science', 'bizarre']
const VALID_SEVERITIES = ['mild', 'spicy', 'wild']

export const SYSTEM_PROMPT = `You are DRAMA RADAR — a ruthless trending-topic scraper and internet curator working for a short-form video creator (TikTok / YouTube Shorts / Reels).

You are handed a list of REAL, freshly-scraped headlines with source, category, publish age in hours and engagement numbers. Pick the strongest stories and package them for on-camera reaction content.

SELECTION RULES
- Only use stories present in the input list. Never invent a story, a name, a quote, a number or a source.
- Cover the whole internet, not one niche. Draw from as many different categories as you can: creator/streamer drama, gaming, tech and AI, entertainment and celebrity, world news, money and crypto, sports, science, bizarre/offbeat, and general viral moments.
- Do NOT return five stories from the same category unless the input genuinely offers nothing else. Variety is the point.
- Prioritise items with a LOW ageHours value. Reject anything outside the requested window.
- No two stories may be the same underlying event, even if two feeds worded it differently.
- Rank by how much a person would react out loud: a clear villain, a clear fail, a "no way that is real" moment, an absurd contradiction, or mass public pile-on.
- A story that is illegal, cringe, a logic fail, or hilariously stupid outranks a merely interesting one.
- Skip institutional filler: earnings calls, weather advisories, routine government proceedings, product press releases, listicles — unless something genuinely wild happened inside them.

LANGUAGE
- Informal, punchy, modern. Talk like someone who lives on the internet. Swearing is fine when it lands, but never slurs and never cruel.
- No marketing voice, no "in today's fast-paced world", no hedging.
- topicTitle: high-energy, under 90 characters, no trailing period.
- sourceContext: exactly 2-3 sentences. Name who is involved, what they did, and why people are talking. Reuse the concrete numbers the input gave you.
- whyViral: 1-2 sentences naming the EXACT reaction driver (cringe / illegal / hilarious / logic fail / scary / wholesome / grift / schadenfreude). Say why, don't just label it.
- hookA and hookB: two DIFFERENT spoken opening lines for a Short. Spoken rhythm, max ~28 words each, no quotation marks, no emojis, no stage directions, no hashtags. They must take different angles (e.g. one outrage, one disbelief), not restate each other.

OUTPUT
Return ONLY valid minified JSON matching this shape exactly, no markdown fence, no commentary:
{"stories":[{"id":"s1","topicTitle":"","sourceContext":"","whyViral":"","hookA":"","hookB":"","category":"viral","severity":"wild","sourceName":"","sourceUrl":"","ageHours":12}]}

- id: "s1", "s2", ...
- category: one of ${CATEGORIES.map(c => `"${c}"`).join(' | ')}
- severity: one of "mild" | "spicy" | "wild" — how explosive the story is
- ageHours: number copied from the input item (null if the input had none)
- sourceUrl: the real URL from the input item; "" if there was none`

/* ------------------------------------------------------------------ */
/* prompt building                                                     */
/* ------------------------------------------------------------------ */

export function buildUserPrompt ({ candidates, hours, limit, category }) {
  const lines = candidates.map((c, i) => {
    const bits = [
      `[${i + 1}] ${c.title}`,
      `src=${c.source}`,
      `cat=${c.category}`,
      c.ageHours == null ? 'age=?' : `age=${c.ageHours}h`
    ]
    if (c.score) bits.push(`score=${c.score}`)
    if (c.comments) bits.push(`comments=${c.comments}`)
    if (c.flair) bits.push(`flair=${c.flair}`)
    if (c.alsoSeen?.length) bits.push(`alsoOn=${c.alsoSeen.slice(0, 3).join(',')}`)
    if (c.url) bits.push(`url=${c.url}`)
    if (c.summary) bits.push(`detail=${c.summary.slice(0, 240)}`)
    return bits.join(' | ')
  })

  const spread = category === 'all'
    ? `Spread across as many categories as possible — do not give me ${limit} stories from one category.`
    : `All ${limit} stories must be in the ${category} category.`

  return `TIME WINDOW: last ${hours} hours.
STORIES REQUIRED: exactly ${limit}.
${spread}

SCRAPE DUMP (hottest and newest first):
${lines.join('\n')}

Now return the ${limit} stories as JSON.`
}

/* ------------------------------------------------------------------ */
/* provider resolution                                                 */
/* ------------------------------------------------------------------ */

const DEFAULTS = {
  openrouter: { keyEnv: 'OPENROUTER_API_KEY', model: null, url: 'https://openrouter.ai/api/v1/chat/completions' },
  openai: { keyEnv: 'OPENAI_API_KEY', model: 'gpt-4o-mini', url: 'https://api.openai.com/v1/chat/completions' },
  anthropic: { keyEnv: 'ANTHROPIC_API_KEY', model: 'claude-3-5-haiku-20241022', url: 'https://api.anthropic.com/v1/messages' }
}

export const PROVIDERS = DEFAULTS

/** Which provider is usable, and where the key came from. */
export function resolveProvider ({ provider, apiKey, model } = {}, env = {}) {
  const order = provider && DEFAULTS[provider] ? [provider] : ['openrouter', 'openai', 'anthropic']
  for (const id of order) {
    const key = apiKey || env[DEFAULTS[id].keyEnv]
    if (key && key.length > 8) {
      return {
        id,
        key,
        // precedence: explicit request > DRAMA_RADAR_MODEL > provider default > null (auto-pick)
        model: model || env.DRAMA_RADAR_MODEL || DEFAULTS[id].model,
        url: DEFAULTS[id].url,
        keySource: apiKey ? 'request' : 'env'
      }
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* OpenRouter free-model discovery                                     */
/* ------------------------------------------------------------------ */

const FREE_CACHE = { at: 0, models: null }
const FREE_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Rank a model on OBJECTIVE metadata rather than on name recognition, so this
 * keeps working when the free tier rotates in models released after this file
 * was written. Family tier is only a tiebreaker.
 */
export function scoreFreeModel (m) {
  const id = String(m?.id || '').toLowerCase()
  let score = 0

  // Structured-output / tool support means reliable JSON — worth a lot here.
  const params = Array.isArray(m?.supported_parameters) ? m.supported_parameters.map(String) : []
  if (params.includes('response_format')) score += 40
  if (params.includes('structured_outputs')) score += 30
  if (params.includes('tools')) score += 15

  // Context window, capped — 128k is plenty for a scrape dump.
  const ctx = Number(m?.context_length) || 0
  score += Math.min(ctx, 128000) / 4000 // up to +32

  // Recency, capped at ~2 years.
  const created = Number(m?.created) || 0
  if (created > 0) {
    const ageDays = Math.max(0, (Date.now() / 1000 - created) / 86400)
    score += Math.max(0, 20 - ageDays / 36)
  }

  // Family tier as a tiebreaker only.
  const tiers = [
    [/claude/, 14],
    [/gpt-5|gpt-4[.-]1|gpt-4o|o3|o4/, 13],
    [/gemini/, 11],
    [/deepseek/, 10],
    [/llama/, 8],
    [/qwen/, 7],
    [/grok/, 6],
    [/mistral|mixtral|magistral/, 5],
    [/glm|zhipu/, 4],
    [/gemma|phi|nemotron/, 2]
  ]
  for (const [re, bonus] of tiers) {
    if (re.test(id)) { score += bonus; break }
  }

  // Vision/text output is irrelevant to us but multimodal text-in is a mild plus.
  const out = m?.architecture?.output_modalities
  if (Array.isArray(out) && out.includes('text')) score += 2

  return Math.round(score * 10) / 10
}

/** Fetch OpenRouter's model list and rank the ":free" ones. Cached 6h. */
export async function discoverFreeModels ({ apiKey, force = false, timeoutMs = 12000 } = {}) {
  if (!force && FREE_CACHE.models && Date.now() - FREE_CACHE.at < FREE_TTL_MS) {
    return { models: FREE_CACHE.models, cached: true }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: ctrl.signal,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    })
    if (!res.ok) throw new Error(`OpenRouter /models ${res.status}`)
    const data = await res.json()
    const all = Array.isArray(data?.data) ? data.data : []
    const free = all
      .filter(m => typeof m?.id === 'string' && m.id.endsWith(':free'))
      .map(m => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: Number(m.context_length) || 0,
        supportsResponseFormat: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('response_format'),
        score: scoreFreeModel(m)
      }))
      .sort((a, b) => b.score - a.score)

    FREE_CACHE.at = Date.now()
    FREE_CACHE.models = free
    return { models: free, cached: false, totalScanned: all.length }
  } finally {
    clearTimeout(timer)
  }
}

/** The best free model, or null if discovery failed. */
export async function pickFreeModel (opts) {
  try {
    const { models } = await discoverFreeModels(opts)
    return models[0] || null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* calls                                                               */
/* ------------------------------------------------------------------ */

export async function curateWithLLM ({ provider, models, candidates, hours, limit, category, timeoutMs = 55000 }) {
  const userPrompt = buildUserPrompt({ candidates, hours, limit, category })

  if (provider.id === 'anthropic') {
    const data = await postJSON(
      provider.url,
      { model: provider.model, max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userPrompt }] },
      {
        timeoutMs,
        headers: { 'x-api-key': provider.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
      }
    )
    return parseStories((data?.content || []).map(b => b?.text || '').join(''))
  }

  const headers = {
    Authorization: `Bearer ${provider.key}`,
    'content-type': 'application/json',
    ...(provider.id === 'openrouter'
      ? { 'HTTP-Referer': 'https://github.com/JustMehh123/aijudge', 'X-Title': 'Drama Radar' }
      : {})
  }

  // Ask for JSON mode; some free models reject response_format with a 400, so
  // retry once without it and lean on the tolerant parser instead.
  // OpenRouter accepts a `models` array and fails over between them inside a
  // SINGLE request. That matters on the free tier, where every attempt eats the
  // daily quota — a client-side retry loop could burn 5 requests per scrape.
  const list = Array.isArray(models) && models.length ? models : [provider.model]
  const base = {
    ...(provider.id === 'openrouter' && list.length > 1
      ? { models: list }
      : { model: list[0] || provider.model }),
    temperature: 0.85,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }]
  }

  let data
  try {
    data = await postJSON(provider.url, { ...base, response_format: { type: 'json_object' } }, { timeoutMs, headers })
  } catch (err) {
    const msg = String(err?.message || err)
    if (!/response_format|400|json/i.test(msg)) throw err
    data = await postJSON(provider.url, base, { timeoutMs, headers })
  }
  const stories = parseStories(data?.choices?.[0]?.message?.content || '')
  // With a models array the provider tells us which one actually answered.
  stories.modelUsed = typeof data?.model === 'string' && data.model ? data.model : (list[0] || provider.model)
  return stories
}

async function postJSON (url, body, { timeoutMs, headers }) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'POST', signal: ctrl.signal, headers, body: JSON.stringify(body) })
    const text = await res.text()
    if (!res.ok) throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`)
    return JSON.parse(text)
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* response normalisation                                              */
/* ------------------------------------------------------------------ */

/** Accepts raw model output (fenced, padded, or clean) and returns clean stories. */
export function parseStories (raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Empty response from the model')

  let text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()

  if (!text.startsWith('{') && !text.startsWith('[')) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) text = text.slice(start, end + 1)
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    const arrStart = text.indexOf('[')
    const arrEnd = text.lastIndexOf(']')
    if (arrStart >= 0 && arrEnd > arrStart) parsed = JSON.parse(text.slice(arrStart, arrEnd + 1))
    else throw new Error('Model did not return parseable JSON')
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.stories
  if (!Array.isArray(list) || !list.length) throw new Error('Model returned no stories')

  return list
    .filter(s => s && typeof s === 'object')
    .slice(0, 12)
    .map((s, i) => ({
      id: typeof s.id === 'string' && s.id ? s.id : `s${i + 1}`,
      topicTitle: str(s.topicTitle || s.title),
      sourceContext: str(s.sourceContext || s.context),
      whyViral: str(s.whyViral || s.viral),
      hookA: str(s.hookA || s.hook1 || s.hookVariationA),
      hookB: str(s.hookB || s.hook2 || s.hookVariationB),
      category: CATEGORIES.includes(s.category) ? s.category : 'viral',
      severity: VALID_SEVERITIES.includes(s.severity) ? s.severity : 'spicy',
      sourceName: str(s.sourceName || s.source),
      sourceUrl: str(s.sourceUrl || s.url),
      ageHours: Number.isFinite(Number(s.ageHours)) ? Math.max(0, Math.round(Number(s.ageHours))) : null
    }))
    .filter(s => s.topicTitle && s.sourceContext)
}

function str (v) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
}
