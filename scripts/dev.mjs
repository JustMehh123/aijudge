#!/usr/bin/env node
/**
 * scripts/dev.mjs — one command, both halves.
 *
 * Starts the API on :8787 and Vite on :5173 (Vite proxies /api -> API_TARGET).
 *   node scripts/dev.mjs
 * `npm run dev` alone also works if you start the API yourself.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = Number(process.env.API_PORT || 8787)

const api = spawn(process.execPath, ['scripts/api-server.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT) }
})

// Call the vite binary directly — going through `npm run` would re-enter this
// script (npm run dev -> dev.mjs -> npm run dev -> ...).
const viteBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite')
const vite = spawn(viteBin, ['--port', '5173', '--host', '0.0.0.0'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, API_TARGET: `http://localhost:${PORT}` }
})

const shutdown = () => {
  for (const p of [api, vite]) {
    try { p.kill('SIGTERM') } catch {}
  }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
api.on('exit', code => { console.error(`[dev] api exited (${code})`); shutdown() })
vite.on('exit', code => { console.error(`[dev] vite exited (${code})`); shutdown() })
