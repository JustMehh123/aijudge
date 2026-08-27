import { useCallback, useEffect, useMemo, useState } from 'react'
import StoryCard from './components/StoryCard.jsx'
import Settings from './components/Settings.jsx'
import { batchToText, copyText } from './format.js'

const CATEGORIES = [
  { id: 'all', label: '🔥 Everything' },
  { id: 'viral', label: '🚀 Viral' },
  { id: 'creator', label: '🎥 Creators' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'tech', label: '🤖 Tech / AI' },
  { id: 'entertainment', label: '🎬 Entertainment' },
  { id: 'world', label: '🌍 World' },
  { id: 'money', label: '💸 Money' },
  { id: 'sports', label: '🏆 Sports' },
  { id: 'science', label: '🔬 Science' },
  { id: 'bizarre', label: '👁️ Bizarre' }
]

const LS_SETTINGS = 'dramaradar.settings.v1'
const LS_BATCH = 'dramaradar.batch.v1'

const DEFAULT_SETTINGS = { provider: 'openrouter', apiKey: '', model: '' }

function loadJSON (key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export default function App () {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [health, setHealth] = useState(null)
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const [category, setCategory] = useState('all')
  const [hours, setHours] = useState(48)
  const [limit, setLimit] = useState(8)

  /* ---------- boot: restore last batch + settings, then probe health ---------- */
  useEffect(() => {
    const s = loadJSON(LS_SETTINGS, DEFAULT_SETTINGS)
    setSettings(s)
    const b = loadJSON(LS_BATCH, null)
    if (b && Array.isArray(b.stories) && b.stories.length) setBatch(b)
  }, [])

  useEffect(() => {
    let alive = true
    fetch('/api/health')
      .then(r => (r.ok ? r.json() : null))
      .then(h => alive && h && setHealth(h))
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const say = msg => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  /* ---------- the scrape ---------- */
  const scrape = useCallback(
    async (force = false) => {
      setLoading(true)
      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hours,
            limit,
            category,
            force,
            provider: settings.provider,
            apiKey: settings.apiKey || undefined,
            model: settings.model || undefined
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setBatch(data)
        try { localStorage.setItem(LS_BATCH, JSON.stringify(data)) } catch {}
        say(
          data.mode === 'live' && data.ok
            ? `⚡ ${data.stories.length} live stories from ${data.candidateCount} candidates`
            : data.mode === 'demo'
              ? 'Demo batch loaded — add a key for live scraping'
              : 'Scrape finished with warnings'
        )
      } catch (err) {
        setBatch(prev => prev || null)
        say(`❌ ${String(err?.message || err).slice(0, 120)}`)
      } finally {
        setLoading(false)
      }
    },
    [category, hours, limit, settings]
  )

  /* ---------- derived ---------- */
  const stories = useMemo(() => {
    const list = batch?.stories || []
    return category === 'all' ? list : list.filter(s => s.category === category)
  }, [batch, category])

  const mode = batch?.mode || health?.mode || 'demo'
  const modeDot = !health ? '' : health.mode === 'live' ? 'live' : 'demo'

  const saveSettings = next => {
    setSettings(next)
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)) } catch {}
    say(next.apiKey ? '🔑 Key saved — hit SCRAPE for live stories' : 'Settings saved')
  }

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <div className="brand-mark">📡</div>
            <div>
              <h1>DRAMA RADAR</h1>
              <span>trending scraper + hook writer</span>
            </div>
          </div>

          <span className="pill" title={mode === 'live' ? 'LLM key detected' : 'No key — bundled batch'}>
            <i className={`dot ${modeDot}`} />
            {mode === 'live' ? `LIVE · ${batch?.provider || health?.provider || ''}` : 'DEMO'}
          </span>

          <button className="btn ghost sm" onClick={() => setShowSettings(true)}>⚙️ Settings</button>
          <button className="btn primary" onClick={() => scrape(true)} disabled={loading}>
            {loading ? 'SCRAPING…' : '⚡ SCRAPE NEW BATCH'}
          </button>
        </div>
      </header>

      <div className="wrap">
        <div className="controls">
          <div className="chips">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`chip ${category === c.id ? 'on' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <select className="mini" value={hours} onChange={e => setHours(Number(e.target.value))} title="Time window">
            <option value={24}>last 24h</option>
            <option value={48}>last 48h</option>
            <option value={72}>last 72h</option>
            <option value={168}>last 7d</option>
          </select>
          <select className="mini" value={limit} onChange={e => setLimit(Number(e.target.value))} title="How many stories">
            {[5, 6, 7, 8, 9, 10, 11, 12].map(n => (
              <option key={n} value={n}>{n} stories</option>
            ))}
          </select>
        </div>

        {batch?.notice && (
          <div className={`notice ${batch.ok === false ? 'err' : ''}`}>
            <span>{batch.ok === false ? '⚠️' : 'ℹ️'}</span>
            <span>{batch.notice}</span>
          </div>
        )}

        {!health && (
          <div className="notice err">
            <span>🔌</span>
            <span>
              Cannot reach <b>/api</b>. If you ran <b>npm run dev</b>, make sure the API side started too
              (<b>node scripts/dev.mjs</b> runs both). On Vercel, redeploy once so <b>api/index.js</b> is picked up.
            </span>
          </div>
        )}

        <div className="meta">
          {batch && (
            <>
              <span>
                <b>{batch.stories?.length || 0}</b> stories
              </span>
              <span>·</span>
              <span>
                window <b>{batch.windowHours || hours}h</b>
              </span>
              {batch.candidateCount ? (
                <>
                  <span>·</span>
                  <span>
                    <b>{batch.candidateCount}</b> raw candidates scraped
                  </span>
                </>
              ) : null}
              {batch.model ? (
                <>
                  <span>·</span>
                  <span>
                    curated by <b>{batch.model}</b>
                  </span>
                </>
              ) : null}
              <span>·</span>
              <span>{batch.generatedAt ? new Date(batch.generatedAt).toLocaleString() : ''}</span>
              <span className="spacer" />
              <button
                className="btn sm"
                onClick={async () => {
                  const ok = await copyText(batchToText(batch.stories, batch))
                  say(ok ? '📋 Full brief copied' : 'Copy blocked by the browser')
                }}
              >
                📋 COPY FULL BRIEF
              </button>
            </>
          )}
        </div>

        {loading && !batch && (
          <div className="grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="sk" key={i}>
                <div className="line" style={{ width: '70%', height: 16 }} />
                <div className="line" style={{ width: '100%' }} />
                <div className="line" style={{ width: '92%' }} />
                <div className="line" style={{ width: '45%' }} />
              </div>
            ))}
          </div>
        )}

        {!loading && !batch && (
          <div className="empty">
            <h3>Nothing scraped yet</h3>
            <p>Hit <b>⚡ SCRAPE NEW BATCH</b> to pull the last {hours} hours of internet chaos.</p>
          </div>
        )}

        {batch && stories.length === 0 && !loading && (
          <div className="empty">
            <h3>No {category} stories in this batch</h3>
            <p>Switch the filter back to Everything, or scrape again with a wider window.</p>
          </div>
        )}

        {stories.length > 0 && (
          <div className="grid">
            {stories.map((s, i) => (
              <StoryCard key={s.id || i} story={s} index={i} />
            ))}
          </div>
        )}

        <footer className="foot">
          <span>Drama Radar — curates, never scripts. React to it yourself.</span>
          <span className="spacer" />
          <span>Sources: Reddit JSON + public RSS/Atom. No scraping keys needed.</span>
        </footer>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <Settings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={saveSettings}
        health={health}
      />
    </>
  )
}
