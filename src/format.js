/**
 * format.js — renders stories into the exact briefing format, for clipboard use.
 */

export function storyToText (s, index) {
  const n = index == null ? '' : `${index}. `
  return [
    `${n}TOPIC TITLE: ${s.topicTitle}`,
    '',
    `SOURCE / CONTEXT: ${s.sourceContext}`,
    '',
    `WHY IT'S VIRAL: ${s.whyViral}`,
    '',
    'THE HOOK LINE:',
    `  - Variation A: ${s.hookA}`,
    `  - Variation B: ${s.hookB}`,
    '',
    `[source: ${s.sourceName || 'unknown'}${s.sourceUrl ? ` — ${s.sourceUrl}` : ''}]`
  ].join('\n')
}

export function batchToText (stories, meta = {}) {
  const head = [
    '════════════════════════════════════',
    '  DRAMA RADAR — TRENDING BRIEF',
    meta.generatedAt ? `  Generated: ${new Date(meta.generatedAt).toLocaleString()}` : null,
    meta.windowHours ? `  Window: last ${meta.windowHours}h` : null,
    meta.mode ? `  Mode: ${meta.mode}` : null,
    '════════════════════════════════════',
    ''
  ]
    .filter(Boolean)
    .join('\n')

  const body = stories.map((s, i) => storyToText(s, i + 1)).join('\n\n────────────────────────────────────\n\n')
  return `${head}${body}\n`
}

/** Copy helper with a fallback for non-secure contexts (http:// on a LAN IP). */
export async function copyText (text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
