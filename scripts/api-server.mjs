#!/usr/bin/env node
/**
 * scripts/api-server.mjs — the same /api handler, served standalone.
 * Used for local dev (proxied by Vite) and by `npm run check`.
 */
import { createServer } from 'node:http'
import handler from '../api/index.js'

const PORT = Number(process.env.PORT || 8787)

const server = createServer((req, res) => {
  // CORS is only needed if you point the frontend at a different origin.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  const result = handler(req, res)
  if (result && typeof result.then === 'function') result.catch(err => {
    try {
      res.statusCode = 500
      res.end(JSON.stringify({ error: String(err?.message || err) }))
    } catch {}
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] Drama Radar API listening on http://0.0.0.0:${PORT}`)
})
