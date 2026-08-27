import { useState } from 'react'

export default function Settings ({ open, onClose, settings, onSave, health }) {
  const [draft, setDraft] = useState(settings)
  const [models, setModels] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const keyReady = health?.keySet || Boolean(draft.apiKey)

  const findFree = async () => {
    setLoading(true)
    try {
      const data = await (await fetch('/api/models?refresh=1')).json()
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
        <h3>⚙️ Settings</h3>
        <p className="sub">
          Runs on OpenRouter. Leave the model blank and it picks the best <b>free</b> one for you.
        </p>

        <div className="field">
          <label>OpenRouter API key</label>
          <input
            type="password"
            value={draft.apiKey}
            placeholder={keyReady ? 'Server key in use — paste here to override' : 'sk-or-v1-...'}
            onChange={e => set('apiKey', e.target.value.trim())}
            autoComplete="off"
            spellCheck="false"
          />
          <span className="hint">
            {keyReady
              ? <>A key is already live on this deployment (<code>{health?.keySource || 'env'}</code>). You only need to paste one to test a different key.</>
              : <>No key on this deployment yet. Set <code>OPENROUTER_API_KEY</code> in Vercel, or paste one here — it stays in this browser's localStorage and is sent only with your own requests.</>}
          </span>
        </div>

        <div className="field">
          <label>Model — blank = auto-pick best free</label>
          <input
            value={draft.model}
            placeholder="(auto — best free model)"
            onChange={e => set('model', e.target.value.trim())}
            spellCheck="false"
          />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn sm" onClick={findFree} disabled={loading}>
              {loading ? 'LOADING…' : '🔍 LIST FREE MODELS'}
            </button>
            {draft.model && (
              <button className="btn sm ghost" onClick={() => set('model', '')}>clear → auto</button>
            )}
          </div>
          <span className="hint">
            The free roster rotates, so the app re-ranks it every 6 hours instead of trusting a
            hardcoded model name. Free models are capped at ~50 requests/day per key.
          </span>
        </div>

        {models && (
          <div className="field">
            <label>Free models on OpenRouter right now</label>
            {models.ok === false ? (
              <span className="hint">⚠️ {models.notice}</span>
            ) : (
              <>
                <span className="hint">
                  {models.count} free models{models.cached ? ' (cached)' : ''}, ranked on
                  structured-output support, context window and recency.
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
          <button className="btn primary" onClick={() => { onSave(draft); onClose() }}>Save</button>
          <button
            className="btn ghost"
            onClick={() => {
              const cleared = { apiKey: '', model: '' }
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
