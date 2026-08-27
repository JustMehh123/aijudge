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

It runs with **zero configuration** — no key, no `.env`, no accounts. Add a key to go live.

> `npm run dev` starts two things: the API on `:8787` and Vite on `:5173` (Vite proxies `/api`).
> Separately if you prefer: `npm run dev:api` and `npm run dev:web`.
> `npm run serve` does the same with the **production** build — closest match to Vercel.

---

## Deploy to Vercel

Five steps, about three minutes. One environment variable.

**1. Get the code on GitHub.** If it isn't already:

```bash
git remote add origin https://github.com/<you>/aijudge.git
git push -u origin main
```

**2. Import it.** Go to [vercel.com/new](https://vercel.com/new), pick the repo. Vercel detects
Vite automatically — `vercel.json` already pins the build command, output directory and the `/api`
rewrite, so **leave every build setting alone**.

**3. Add the one environment variable.** Before or after the first deploy:
**Project → Settings → Environment Variables**, then

| Name | Value | Environment |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | `sk-or-v1-…` (your key) | Production ✅ Preview ✅ Development ✅ |

That is the only required variable. Get a key free at [openrouter.ai/keys](https://openrouter.ai/keys).

**4. Deploy** (or hit **Redeploy** if you added the variable after the first build — env vars are
baked in at build time, so a redeploy is required).

**5. Check it.** Open your URL, hit **⚡ SCRAPE NEW BATCH**. The badge should read `LIVE`. If it
says `DEMO`, the variable didn't take — confirm the name is exactly `OPENROUTER_API_KEY` and that
you redeployed.

Sanity-check the deployment without the UI: `/api/health` should return
`"mode":"live","keySet":true,"sources":129`, and `/api/models` lists the free models it can pick.

### Optional variables

| Variable | Default | What it does |
| --- | --- | --- |
| `DRAMA_RADAR_MODEL` | *(blank = auto-pick best free)* | Pin a specific model |
| `DRAMA_RADAR_BUDGET_MS` | `52000` | Wall-clock budget per scrape. Keep under Vercel's 60s. |
| `DRAMA_RADAR_DEADLINE_MS` | `20000` | Max time for the feed-fetch phase |

### Command line instead of the dashboard

```bash
npm i -g vercel
vercel env add OPENROUTER_API_KEY production   # paste the key when prompted
vercel --prod
```

---

## How the AI side works

One provider: **OpenRouter**. It is OpenAI-compatible and its free tier covers this app, so there
is nothing to choose and nothing to pay.

**Leave the model blank and it picks the best FREE model for you.** The app queries
`https://openrouter.ai/api/v1/models`, keeps the `:free` ones, and ranks them on *objective*
metadata — structured-output support, context window, recency — with model family as a mere
tiebreaker. Nothing is hardcoded to a model version, so it keeps working as the free roster
rotates. Re-ranked every 6 hours. **⚙️ Settings → 🔍 LIST FREE MODELS** shows the ranking live and
lets you pin one.

If a specific model is unavailable, the whole candidate list goes to OpenRouter in **one** request
and it fails over internally — so a bad day costs one unit of free quota, not five.

**The scraping itself needs no key at all.** The app always scrapes before it curates, so a dead
key, an unreachable model list, or a model that returns garbage all still leave you looking at the
real scraped headlines instead of an error page.

---

## Vercel: what to expect once it's live

Three constraints worth knowing.

**1. Function duration.** `vercel.json` sets `maxDuration: 60`, the ceiling Hobby allows. The code
self-limits to a **52s budget** (`DRAMA_RADAR_BUDGET_MS`): scraping gets 18.2s, the model gets the
rest, and running out returns raw scraped cards rather than a 504. Locally you can raise it.

**2. OpenRouter free-tier rate limits.** Free (`:free`) models are capped at **20 requests/minute
and ~50 requests/day**; a one-time $10 credit purchase raises the daily cap to 1,000 permanently.
Each scrape is **one** request, so that's ~50 scrapes/day on an unfunded key — plenty for one
person making a few Shorts a day.

**3. Reddit may block Vercel's IPs.** 64 of the 129 sources are Reddit JSON endpoints, and Reddit
is known to reject datacenter IPs. **This is unverified** — it depends on their current policy. If
it happens you'll see `Reached 65/129 trending sources` and still get a full batch from the 53
RSS/Atom feeds and 12 Google News searches. Every card names its source, so you'll be able to tell
which half went quiet.

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
parser (including fenced and malformed responses), the prompt builder, key resolution, the
seed batch, and the `/api` route handler end-to-end over fake request/response pairs. Two of them
stub `fetch` to drive the full scrape → free-model-pick → curate path, and the full scrape →
rejected-key → raw-fallback path, so both branches are actually executed rather than assumed.
Another spawns a child process to prove `.env` really reaches `process.env`.

### Layout

```
api/index.js            the whole backend (Vite dev + Vercel serverless, same file)
src/server/feeds.js     129 sources + RSS/Atom/Reddit parsers (no dependencies)
src/server/llm.js       system prompt, OpenRouter client, free-model ranking, output normalisation
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
GET  /api/health          mode, keySet, source count, categories     (?feeds=1 probes all 129)
GET  /api/models          ranked free models on OpenRouter           (?refresh=1 busts the 6h cache)
POST /api/scrape          { hours, limit, category, apiKey, model, force }
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
