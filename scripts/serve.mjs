#!/usr/bin/env node
/**
 * scripts/serve.mjs — serve the PRODUCTION build with the API behind it.
 *
 *   npm run serve          # API :8787  +  vite preview :5173 (proxies /api)
 *
 * This is the closest local equivalent to the Vercel deployment: static files
 * out of dist/ with /api served by the same handler Vercel would run.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = Number(process.env.API_PORT || 8787)
// Deliberately not PORT — that name belongs to the API child process.
const WEB_PORT = Number(process.env.WEB_PORT || 5173)

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('[serve] dist/ not found — run `npm run build` first.')
  process.exit(1)
}

const api = spawn(process.execPath, ['scripts/api-server.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT) }
})

const previewBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite')
const web = spawn(previewBin, ['preview', '--port', String(WEB_PORT), '--host', '0.0.0.0'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, API_TARGET: `http://localhost:${PORT}` }
})

const shutdown = () => {
  for (const p of [api, web]) { try { p.kill('SIGTERM') } catch {} }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
api.on('exit', code => { console.error(`[serve] api exited (${code})`); shutdown() })
web.on('exit', code => { console.error(`[serve] web exited (${code})`); shutdown() })
