# 📡 Drama Radar

**Trending topic scraper + internet drama curator**, built for short-form creators.

It scrapes real stories from the last 24–48 hours out of Reddit and public news feeds, then
packages 5 of them into the exact brief you need to film a Short:

```
1. TOPIC TITLE:      high-energy summary
2. SOURCE / CONTEXT: 2-3 sentences of the actual facts
3. WHY IT'S VIRAL:   the exact reason people are reacting
4. THE HOOK LINE:    2 spoken opening lines, ready to say to camera
```

It curates. It never writes your script — you still react yourself.

---

## Quick start (localhost)

```bash
npm install
npm run dev
```

Open **http://localhost:5173** → hit **⚡ SCRAPE NEW BATCH**.

That's it. It works with **zero configuration** — no API key, no `.env`, no accounts.

> `npm run dev` starts two things: the API on `:8787` and the Vite frontend on `:5173`
> (Vite proxies `/api` to the API). If you'd rather run them separately:
> `npm run dev:api` and `npm run dev:web`.

---

## Two modes

### 🟡 Demo mode (default, zero setup)
No key configured → the app serves a hand-curated batch so everything is usable immediately.
Good for trying the UI, the copy buttons and the output format.

### 🟢 Live mode (one env var)

`OPENROUTER_API_KEY` is the recommended one — it is already set in `.env` here.

```bash
npm run dev      # .env is loaded automatically
```

**Leave the model field blank and it picks the best FREE model for you.** The app queries
`https://openrouter.ai/api/v1/models`, keeps the `:free` ones, and ranks them on *objective*
metadata — structured-output support, context window, recency — with model family as a mere
tiebreaker. Nothing is hardcoded to a version, so it keeps working as the free tier rotates.
The list is cached 6h. **⚙️ Settings → 🔍 LIST FREE MODELS** shows the ranking live and lets you
pin one.

Other providers also work, but need an explicit model name:

| Variable | Where to get it | Default model |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | openrouter.ai/keys | *(auto — best free)* |
| `OPENAI_API_KEY` | platform.openai.com/api-keys | `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | console.anthropic.com | `claude-3-5-haiku-20241022` |

You can also paste a key into **⚙️ Settings** — it stays in your browser's localStorage and is
sent only with your own requests. For a shared deploy, set the env var in the Vercel dashboard
instead and leave that field blank.

**The scraping itself needs no key at all.** The LLM is only the curation step, so the app always
scrapes first: a dead key, an unreachable model list, or a model that returns garbage all still
leave you looking at the real scraped headlines instead of an error page.

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Vercel auto-detects Vite (`vercel.json` pins it). Then **Project → Settings → Environment
Variables** → add `OPENAI_API_KEY` → redeploy.

Or one-click: push this repo to GitHub and import it at vercel.com/new. No build settings to
touch — `buildCommand`, `outputDirectory` and the `/api` rewrite are already in `vercel.json`.

---

## What it scrapes

**129 sources**, all public and keyless, spread across the whole internet:

| | |
| --- | --- |
| Reddit (64) | `r/popular`, `r/AskReddit`, `r/memes`, `r/LivestreamFail`, `r/youtubedrama`, `r/Twitch`, `r/TikTokCringe`, `r/gaming`, `r/GamingLeaksAndRumours`, `r/technology`, `r/ArtificialInteligence`, `r/movies`, `r/worldnews`, `r/CryptoCurrency`, `r/wallstreetbets`, `r/sports`, `r/science`, `r/nottheonion`, `r/OutOfTheLoop`, … |
| RSS / Atom (53) | The Verge, Ars Technica, Wired, Engadget, TechCrunch, The Register, BleepingComputer, Hacker News, Product Hunt, Kotaku, Polygon, PC Gamer, GamesRadar, Destructoid, IGN, Nintendo Life, Dexerto, Dot Esports, Variety, Hollywood Reporter, Deadline, TMZ, Rolling Stone, BBC, Guardian, NPR, NYT, CNN, Al Jazeera, CoinDesk, Cointelegraph, CNBC, ESPN, ScienceDaily, NASA, BuzzFeed, Mashable, KnowYourMeme, … |
| Google News (12) | keyless saved searches: "goes viral", trending, streamer drama, TikTok, game leaks, AI incidents, cyberattacks, celebrity, crypto, offbeat, sports shocks, science |

Ten categories: **Viral · Creators · Gaming · Tech/AI · Entertainment · World · Money · Sports ·
Science · Bizarre** — plus an Everything firehose.

Fetches run 24-wide under a hard 20s deadline (`DRAMA_RADAR_DEADLINE_MS`), so a handful of slow or
dead feeds can never stall the batch; whatever answered is used. Candidates are de-duplicated
across sources, filtered to your window, capped at 140, and ranked by engagement plus recency. A
story carried by four feeds is treated as a stronger signal than one carried by one.

Set the window to 24h / 48h / 72h / 7d and ask for **5–12 stories**. The prompt explicitly demands
category spread, so you will not get eight gaming stories in a row.

Every card has **COPY** on each hook line, **COPY CARD** for one story, and **COPY FULL BRIEF** for
all of them in the numbered format above.

---

## Development

```bash
npm run check     # 29 offline self-tests against the real modules
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

`npm run check` needs no network — 42 checks. It exercises the RSS/Atom/Reddit parsers, the model-output
parser (including fenced and malformed responses), the prompt builder, provider resolution, the
seed batch, and the `/api` route handler end-to-end over fake request/response pairs. Two of them
stub `fetch` to drive the full scrape → free-model-pick → curate path, and the full scrape →
rejected-key → raw-fallback path, so both branches are actually executed rather than assumed.
Another spawns a child process to prove `.env` really reaches `process.env`.

### Layout

```
api/index.js            the whole backend (Vite dev + Vercel serverless, same file)
src/server/feeds.js     129 sources + RSS/Atom/Reddit parsers (no dependencies)
src/server/llm.js       system prompt, 3 providers, free-model ranking, output normalisation
src/server/env.js       zero-dep .env loader (plain Node does not read .env on its own)
src/server/seed.js      the zero-config demo batch
src/App.jsx             UI
src/format.js           clipboard formatting in the exact brief shape
scripts/dev.mjs         runs API + frontend together
scripts/api-server.mjs  the API on its own
scripts/check.mjs       self-tests
```

### Endpoints

```
GET  /api/health          mode, provider, source count, categories   (?feeds=1 probes all 129)
GET  /api/models          ranked free models on OpenRouter           (?refresh=1 busts the 6h cache)
POST /api/scrape          { hours, limit, category, provider, apiKey, model, force }
```

### Failure modes it handles

- **No network / all feeds blocked** → clear notice with the `reached/attempted` source count, falls back to the demo batch.
- **OpenRouter `/models` unreachable** → tries a short list of long-standing free models instead of dead-ending.
- **One model errors** → the next candidate model is tried before giving up.
- **Bad or expired key** → detected by status, stops immediately (switching models would not help) and shows raw scraped candidates.
- **Model returns markdown instead of JSON** → the fence is stripped and parsed anyway.
- **Model rejects `response_format`** → retried once without it.
- **Model returns junk** → you get the real scraped headlines as rough cards, round-robined across categories.
- **Repeated clicks** → results are cached for 10 minutes so you don't burn credits.
- **A local `.env` on a deploy** → real environment variables always win over the file.

---

## Note

Stories come from live third-party feeds and an LLM summarises them. Names, numbers and quotes
should be checked against the linked source before you repeat them on camera — the source link is
on every card for exactly that reason.
