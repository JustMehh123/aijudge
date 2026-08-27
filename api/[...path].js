/**
 * Catch-all for /api/*.
 *
 * Vercel maps api/index.js to the EXACT path "/api" only. Without this file,
 * /api/health, /api/scrape and /api/models would each 404 even though the
 * handler knows how to serve them — the requests simply never reach it.
 *
 * Re-exporting the same handler means one implementation, every route.
 * req.url still carries the full path (e.g. "/api/scrape"), so the internal
 * path matching in index.js works unchanged.
 */
export { default } from './index.js'
