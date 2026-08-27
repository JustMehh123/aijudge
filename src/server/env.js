/**
 * env.js — zero-dependency .env loader.
 *
 * Vite loads .env for the *frontend* only. The API runs under plain Node (local)
 * or the Vercel runtime, neither of which reads .env automatically, so without
 * this a key sitting in .env would silently do nothing.
 *
 * Real environment variables always win over the file, so Vercel dashboard
 * values override a stale local file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let loaded = false

export function loadEnv (cwd = process.cwd()) {
  if (loaded) return
  loaded = true

  // Escape hatch so tests (and anything embedding this) can ignore a local .env.
  if (process.env.DRAMA_RADAR_NO_ENV_FILE === '1') return

  // Walk up from this file so it works from any working directory.
  const candidates = []
  try {
    const here = path.dirname(fileURLToPath(import.meta.url))
    for (let dir = here; dir !== path.dirname(dir); dir = path.dirname(dir)) {
      candidates.push(path.join(dir, '.env'))
      if (fs.existsSync(path.join(dir, 'package.json'))) break
    }
  } catch {}
  candidates.unshift(path.join(cwd, '.env'))

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue
      const text = fs.readFileSync(file, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 1) continue
        const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '')
        if (!key) continue
        let value = trimmed.slice(eq + 1).trim()
        // strip matching quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (value === '') continue
        if (process.env[key] === undefined) process.env[key] = value
      }
      return
    } catch {}
  }
}

/** Which provider keys are present, for /api/health and the UI badge. */
export function envSummary () {
  loadEnv()
  return {
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    DRAMA_RADAR_MODEL: process.env.DRAMA_RADAR_MODEL || null
  }
}
