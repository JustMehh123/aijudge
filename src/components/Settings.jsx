import { useState } from 'react'

const PROVIDER_INFO = {
  openrouter: {
    label: 'OpenRouter  ← recommended',
    env: 'OPENROUTER_API_KEY',
    defaultModel: '',
    hint: 'Leave the model blank and it auto-picks the best FREE model on OpenRouter at runtime. One key, hundreds of models.'
  },
  openai: {
    label: 'OpenAI',
    env: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    hint: 'Paid. Needs an explicit model name.'
  },
  anthropic: {
    label: 'Anthropic',
    env: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-haiku-20241022',
    hint: 'Paid. Needs an explicit model name.'
  }
}

export default function Settings ({ open, onClose, settings, onSave, health }) {
  const [draft, setDraft] = useState(settings)
  const [models, setModels] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const info = PROVIDER_INFO[draft.provider] || PROVIDER_INFO.openrouter
  const envReady = health?.env?.find(e => e.id === draft.provider)?.set

  const findFree = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/models?refresh=1')
      const data = await res.json()
      setModels(data)
    } catch (err) {
      setModels({ ok: false, notice: String(err?.message || err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>⚙️ Curator settings</h3>
        <p className="sub">
          Optional. Without a key the app runs in demo mode with a bundled batch. With a key it scrapes
          live trending feeds and writes the brief for you.
        </p>

        <div className="field">
          <label>Provider</label>
          <select value={draft.provider} onChange={e => set('provider', e.target.value)}>
            {Object.entries(PROVIDER_INFO).map(([id, p]) => (
              <option key={id} value={id}>{p.label}</option>
            ))}
          </select>
          <span className="hint">
            {info.hint} Server env var <code>{info.env}</code>
            {envReady ? ' is set on this deployment ✅' : ' is not set on this deployment.'}
          </span>
        </div>

        <div className="field">
          <label>API key (optional)</label>
          <input
            type="password"
            value={draft.apiKey}
            placeholder={envReady ? `Using ${info.env} from the server — paste here to override` : 'sk-or-v1-...'}
            onChange={e => set('apiKey', e.target.value.trim())}
            autoComplete="off"
            spellCheck="false"
          />
          <span className="hint">
            Stored in this browser's localStorage and sent to <code>/api/scrape</code> for that request only.
            For a shared deploy set <code>{info.env}</code> in the Vercel dashboard and leave this blank.
          </span>
        </div>

        <div className="field">
          <label>Model — blank = auto-pick best free</label>
          <input
            value={draft.model}
            placeholder={draft.provider === 'openrouter' ? '(auto — best free model)' : info.defaultModel}
            onChange={e => set('model', e.target.value.trim())}
            spellCheck="false"
          />
          <div className="row" style={{ marginTop: 6 }}>
            {draft.provider === 'openrouter' && (
              <button className="btn sm" onClick={findFree} disabled={loading}>
                {loading ? 'LOADING…' : '🔍 LIST FREE MODELS'}
              </button>
            )}
            {draft.model && (
              <button className="btn sm ghost" onClick={() => set('model', '')}>
                clear → auto
              </button>
            )}
          </div>
        </div>

        {models && (
          <div className="field">
            <label>Free models on OpenRouter right now</label>
            {models.ok === false ? (
              <span className="hint">⚠️ {models.notice}</span>
            ) : (
              <>
                <span className="hint">
                  {models.count} free models found{models.cached ? ' (cached)' : ''}. Ranked on structured-output
                  support, context window and recency — not on a hardcoded list, so this stays current.
                </span>
                <div className="model-list">
                  {(models.models || []).slice(0, 12).map((m, i) => (
                    <button
                      key={m.id}
                      className={`model-row${draft.model === m.id ? ' on' : ''}`}
                      onClick={() => set('model', m.id)}
                    >
                      <span className="model-rank">{i === 0 ? '★' : i + 1}</span>
                      <span className="model-id">{m.id}</span>
                      <span className="model-meta">
                        {Math.round(m.contextLength / 1000)}k
                        {m.supportsResponseFormat ? ' · json' : ''}
                        {' · '}{m.score}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={() => { onSave(draft); onClose() }}>
            Save settings
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              const cleared = { provider: 'openrouter', apiKey: '', model: '' }
              setDraft(cleared)
              setModels(null)
              onSave(cleared)
              onClose()
            }}
          >
            Clear key → demo mode
          </button>
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
