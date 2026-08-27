/**
 * feeds.js — zero-key trending story sources.
 *
 * Everything here is a public, unauthenticated endpoint (Reddit .json + plain RSS/Atom).
 * No API keys, no scraping libraries, no headless browser.
 */

export const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 DramaRadar/1.0'

/**
 * Candidate sources. `kind` decides the parser, `category` is used for filtering
 * and for labelling the resulting stories.
 */
export const SOURCES = [
  // --- general firehose ---
  { kind: 'reddit', name: 'r/popular', url: 'https://www.reddit.com/r/popular/hot.json?limit=25&raw_json=1', category: 'viral' },
  { kind: 'reddit', name: 'r/AskReddit', url: 'https://www.reddit.com/r/AskReddit/hot.json?limit=25&raw_json=1', category: 'viral' },
  { kind: 'reddit', name: 'r/memes', url: 'https://www.reddit.com/r/memes/hot.json?limit=25&raw_json=1', category: 'viral' },
  { kind: 'reddit', name: 'r/pics', url: 'https://www.reddit.com/r/pics/hot.json?limit=25&raw_json=1', category: 'viral' },
  { kind: 'reddit', name: 'r/videos', url: 'https://www.reddit.com/r/videos/hot.json?limit=25&raw_json=1', category: 'viral' },
  // --- creator / streamer ---
  { kind: 'reddit', name: 'r/LivestreamFail', url: 'https://www.reddit.com/r/LivestreamFail/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/Twitch', url: 'https://www.reddit.com/r/Twitch/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/youtubedrama', url: 'https://www.reddit.com/r/youtubedrama/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/HatedYoutubeVideos', url: 'https://www.reddit.com/r/HatedYoutubeVideos/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/youtube', url: 'https://www.reddit.com/r/youtube/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/TikTokCringe', url: 'https://www.reddit.com/r/TikTokCringe/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/Instagram', url: 'https://www.reddit.com/r/Instagram/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/socialmedia', url: 'https://www.reddit.com/r/socialmedia/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/JustUnsubbed', url: 'https://www.reddit.com/r/JustUnsubbed/hot.json?limit=25&raw_json=1', category: 'creator' },
  { kind: 'reddit', name: 'r/TwitchComments', url: 'https://www.reddit.com/r/TwitchComments/hot.json?limit=25&raw_json=1', category: 'creator' },
  // --- gaming ---
  { kind: 'reddit', name: 'r/gaming', url: 'https://www.reddit.com/r/gaming/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/Games', url: 'https://www.reddit.com/r/Games/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/GamingLeaksAndRumours', url: 'https://www.reddit.com/r/GamingLeaksAndRumours/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/pcmasterrace', url: 'https://www.reddit.com/r/pcmasterrace/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/Steam', url: 'https://www.reddit.com/r/Steam/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/PS5', url: 'https://www.reddit.com/r/PS5/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/xbox', url: 'https://www.reddit.com/r/xbox/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/Nintendo', url: 'https://www.reddit.com/r/Nintendo/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/speedrun', url: 'https://www.reddit.com/r/speedrun/hot.json?limit=25&raw_json=1', category: 'gaming' },
  { kind: 'reddit', name: 'r/gachagaming', url: 'https://www.reddit.com/r/gachagaming/hot.json?limit=25&raw_json=1', category: 'gaming' },
  // --- tech / AI ---
  { kind: 'reddit', name: 'r/technology', url: 'https://www.reddit.com/r/technology/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/ArtificialInteligence', url: 'https://www.reddit.com/r/ArtificialInteligence/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/singularity', url: 'https://www.reddit.com/r/singularity/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/LocalLLaMA', url: 'https://www.reddit.com/r/LocalLLaMA/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/privacy', url: 'https://www.reddit.com/r/privacy/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/cybersecurity', url: 'https://www.reddit.com/r/cybersecurity/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/programming', url: 'https://www.reddit.com/r/programming/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/gadgets', url: 'https://www.reddit.com/r/gadgets/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/apple', url: 'https://www.reddit.com/r/apple/hot.json?limit=25&raw_json=1', category: 'tech' },
  { kind: 'reddit', name: 'r/Android', url: 'https://www.reddit.com/r/Android/hot.json?limit=25&raw_json=1', category: 'tech' },
  // --- entertainment ---
  { kind: 'reddit', name: 'r/movies', url: 'https://www.reddit.com/r/movies/hot.json?limit=25&raw_json=1', category: 'entertainment' },
  { kind: 'reddit', name: 'r/television', url: 'https://www.reddit.com/r/television/hot.json?limit=25&raw_json=1', category: 'entertainment' },
  { kind: 'reddit', name: 'r/Music', url: 'https://www.reddit.com/r/Music/hot.json?limit=25&raw_json=1', category: 'entertainment' },
  { kind: 'reddit', name: 'r/popculturechat', url: 'https://www.reddit.com/r/popculturechat/hot.json?limit=25&raw_json=1', category: 'entertainment' },
  { kind: 'reddit', name: 'r/celebs', url: 'https://www.reddit.com/r/celebs/hot.json?limit=25&raw_json=1', category: 'entertainment' },
  { kind: 'reddit', name: 'r/boxoffice', url: 'https://www.reddit.com/r/boxoffice/hot.json?limit=25&raw_json=1', category: 'entertainment' },
  // --- world news ---
  { kind: 'reddit', name: 'r/news', url: 'https://www.reddit.com/r/news/hot.json?limit=25&raw_json=1', category: 'world' },
  { kind: 'reddit', name: 'r/worldnews', url: 'https://www.reddit.com/r/worldnews/hot.json?limit=25&raw_json=1', category: 'world' },
  { kind: 'reddit', name: 'r/UpliftingNews', url: 'https://www.reddit.com/r/UpliftingNews/hot.json?limit=25&raw_json=1', category: 'world' },
  // --- money / crypto ---
  { kind: 'reddit', name: 'r/CryptoCurrency', url: 'https://www.reddit.com/r/CryptoCurrency/hot.json?limit=25&raw_json=1', category: 'money' },
  { kind: 'reddit', name: 'r/wallstreetbets', url: 'https://www.reddit.com/r/wallstreetbets/hot.json?limit=25&raw_json=1', category: 'money' },
  { kind: 'reddit', name: 'r/stocks', url: 'https://www.reddit.com/r/stocks/hot.json?limit=25&raw_json=1', category: 'money' },
  { kind: 'reddit', name: 'r/Economics', url: 'https://www.reddit.com/r/Economics/hot.json?limit=25&raw_json=1', category: 'money' },
  // --- sports ---
  { kind: 'reddit', name: 'r/sports', url: 'https://www.reddit.com/r/sports/hot.json?limit=25&raw_json=1', category: 'sports' },
  { kind: 'reddit', name: 'r/nba', url: 'https://www.reddit.com/r/nba/hot.json?limit=25&raw_json=1', category: 'sports' },
  { kind: 'reddit', name: 'r/soccer', url: 'https://www.reddit.com/r/soccer/hot.json?limit=25&raw_json=1', category: 'sports' },
  { kind: 'reddit', name: 'r/formula1', url: 'https://www.reddit.com/r/formula1/hot.json?limit=25&raw_json=1', category: 'sports' },
  { kind: 'reddit', name: 'r/MMA', url: 'https://www.reddit.com/r/MMA/hot.json?limit=25&raw_json=1', category: 'sports' },
  // --- science ---
  { kind: 'reddit', name: 'r/science', url: 'https://www.reddit.com/r/science/hot.json?limit=25&raw_json=1', category: 'science' },
  { kind: 'reddit', name: 'r/space', url: 'https://www.reddit.com/r/space/hot.json?limit=25&raw_json=1', category: 'science' },
  { kind: 'reddit', name: 'r/Futurology', url: 'https://www.reddit.com/r/Futurology/hot.json?limit=25&raw_json=1', category: 'science' },
  // --- bizarre / internet ---
  { kind: 'reddit', name: 'r/nottheonion', url: 'https://www.reddit.com/r/nottheonion/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  { kind: 'reddit', name: 'r/OutOfTheLoop', url: 'https://www.reddit.com/r/OutOfTheLoop/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  { kind: 'reddit', name: 'r/InternetIsBeautiful', url: 'https://www.reddit.com/r/InternetIsBeautiful/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  { kind: 'reddit', name: 'r/WTF', url: 'https://www.reddit.com/r/WTF/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  { kind: 'reddit', name: 'r/mildlyinfuriating', url: 'https://www.reddit.com/r/mildlyinfuriating/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  { kind: 'reddit', name: 'r/glitch_in_the_matrix', url: 'https://www.reddit.com/r/glitch_in_the_matrix/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  { kind: 'reddit', name: 'r/DeepIntoYouTube', url: 'https://www.reddit.com/r/DeepIntoYouTube/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  { kind: 'reddit', name: 'r/oddlyterrifying', url: 'https://www.reddit.com/r/oddlyterrifying/hot.json?limit=25&raw_json=1', category: 'bizarre' },
  // --- tech / AI ---
  { kind: 'rss', name: 'TheVerge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
  { kind: 'rss', name: 'ArsTechnica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech' },
  { kind: 'rss', name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'tech' },
  { kind: 'rss', name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'tech' },
  { kind: 'rss', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech' },
  { kind: 'rss', name: 'TheRegister', url: 'https://www.theregister.com/headlines.atom', category: 'tech' },
  { kind: 'rss', name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/', category: 'tech' },
  { kind: 'rss', name: 'HackerNewsBest', url: 'https://hnrss.org/best', category: 'tech' },
  { kind: 'rss', name: 'HackerNewsFront', url: 'https://hnrss.org/frontpage', category: 'tech' },
  { kind: 'rss', name: 'ProductHunt', url: 'https://www.producthunt.com/feed', category: 'tech' },
  { kind: 'rss', name: 'Tomshardware', url: 'https://www.tomshardware.com/feeds/all', category: 'tech' },
  { kind: 'rss', name: 'BBCtech', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'tech' },
  // --- gaming ---
  { kind: 'rss', name: 'Kotaku', url: 'https://kotaku.com/rss', category: 'gaming' },
  { kind: 'rss', name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', category: 'gaming' },
  { kind: 'rss', name: 'PCGamer', url: 'https://www.pcgamer.com/rss/', category: 'gaming' },
  { kind: 'rss', name: 'GamesRadar', url: 'https://www.gamesradar.com/rss/', category: 'gaming' },
  { kind: 'rss', name: 'Destructoid', url: 'https://www.destructoid.com/feed/', category: 'gaming' },
  { kind: 'rss', name: 'RockPaperShotgun', url: 'https://www.rockpapershotgun.com/feed', category: 'gaming' },
  { kind: 'rss', name: 'Eurogamer', url: 'https://www.eurogamer.net/feed', category: 'gaming' },
  { kind: 'rss', name: 'NintendoLife', url: 'https://www.nintendolife.com/feeds/latest', category: 'gaming' },
  { kind: 'rss', name: 'PushSquare', url: 'https://www.pushsquare.com/feeds/latest', category: 'gaming' },
  { kind: 'rss', name: 'Gematsu', url: 'https://www.gematsu.com/feed', category: 'gaming' },
  { kind: 'rss', name: 'IGN', url: 'https://feeds.feedburner.com/ign/all', category: 'gaming' },
  // --- creator / streamer ---
  { kind: 'rss', name: 'Dexerto', url: 'https://www.dexerto.com/feed/', category: 'creator' },
  { kind: 'rss', name: 'DotEsports', url: 'https://dotesports.com/feed', category: 'creator' },
  { kind: 'rss', name: 'EsportsInsider', url: 'https://esportsinsider.com/feed', category: 'creator' },
  // --- entertainment ---
  { kind: 'rss', name: 'Variety', url: 'https://variety.com/feed/', category: 'entertainment' },
  { kind: 'rss', name: 'HollywoodReporter', url: 'https://www.hollywoodreporter.com/feed/', category: 'entertainment' },
  { kind: 'rss', name: 'Deadline', url: 'https://deadline.com/feed/', category: 'entertainment' },
  { kind: 'rss', name: 'TMZ', url: 'https://www.tmz.com/rss.xml', category: 'entertainment' },
  { kind: 'rss', name: 'EOnline', url: 'https://www.eonline.com/news/rss', category: 'entertainment' },
  { kind: 'rss', name: 'RollingStone', url: 'https://www.rollingstone.com/feed/', category: 'entertainment' },
  { kind: 'rss', name: 'Pitchfork', url: 'https://pitchfork.com/feed/feed-news/rss', category: 'entertainment' },
  // --- world news ---
  { kind: 'rss', name: 'BBCworld', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world' },
  { kind: 'rss', name: 'GuardianWorld', url: 'https://www.theguardian.com/world/rss', category: 'world' },
  { kind: 'rss', name: 'NPRnews', url: 'https://feeds.npr.org/1001/rss.xml', category: 'world' },
  { kind: 'rss', name: 'NYTworld', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'world' },
  { kind: 'rss', name: 'CNStop', url: 'https://rss.cnn.com/rss/cnn_topstories.rss', category: 'world' },
  { kind: 'rss', name: 'AlJazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'world' },
  // --- money / crypto ---
  { kind: 'rss', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'money' },
  { kind: 'rss', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', category: 'money' },
  { kind: 'rss', name: 'CNBCtop', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', category: 'money' },
  { kind: 'rss', name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'money' },
  // --- sports ---
  { kind: 'rss', name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', category: 'sports' },
  { kind: 'rss', name: 'BBCsport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'sports' },
  // --- science ---
  { kind: 'rss', name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/all.xml', category: 'science' },
  { kind: 'rss', name: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'science' },
  { kind: 'rss', name: 'Spacecom', url: 'https://www.space.com/feeds/all', category: 'science' },
  { kind: 'rss', name: 'LiveScience', url: 'https://www.livescience.com/feeds/all', category: 'science' },
  // --- bizarre / internet ---
  { kind: 'rss', name: 'BuzzFeed', url: 'https://www.buzzfeed.com/index.xml', category: 'bizarre' },
  { kind: 'rss', name: 'Mashable', url: 'https://mashable.com/feeds/rss/all', category: 'bizarre' },
  { kind: 'rss', name: 'OddityCentral', url: 'https://www.odditycentral.com/feed', category: 'bizarre' },
  { kind: 'rss', name: 'KnowYourMeme', url: 'https://knowyourmeme.com/news/feed', category: 'bizarre' },
  // --- general firehose ---
  { kind: 'rss', name: 'News: goes viral', url: 'https://news.google.com/rss/search?q=%22goes+viral%22+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'viral' },
  { kind: 'rss', name: 'News: trending now', url: 'https://news.google.com/rss/search?q=trending+OR+%22the+internet%22+when:1d&hl=en-US&gl=US&ceid=US:en', category: 'viral' },
  // --- creator / streamer ---
  { kind: 'rss', name: 'News: streamer drama', url: 'https://news.google.com/rss/search?q=streamer+OR+youtuber+OR+twitch+drama+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'creator' },
  { kind: 'rss', name: 'News: tiktok', url: 'https://news.google.com/rss/search?q=tiktok+trend+OR+banned+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'creator' },
  // --- gaming ---
  { kind: 'rss', name: 'News: gaming leak', url: 'https://news.google.com/rss/search?q=video+game+leak+OR+glitch+OR+exploit+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'gaming' },
  // --- tech / AI ---
  { kind: 'rss', name: 'News: AI incident', url: 'https://news.google.com/rss/search?q=AI+OR+chatbot+glitch+OR+%22went+wrong%22+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'tech' },
  { kind: 'rss', name: 'News: cyberattack', url: 'https://news.google.com/rss/search?q=hack+OR+breach+OR+scam+when:1d&hl=en-US&gl=US&ceid=US:en', category: 'tech' },
  // --- entertainment ---
  { kind: 'rss', name: 'News: celebrity', url: 'https://news.google.com/rss/search?q=celebrity+OR+influencer+apology+OR+feud+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'entertainment' },
  // --- money / crypto ---
  { kind: 'rss', name: 'News: crypto', url: 'https://news.google.com/rss/search?q=crypto+OR+bitcoin+pump+OR+scam+OR+hack+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'money' },
  // --- bizarre / internet ---
  { kind: 'rss', name: 'News: offbeat', url: 'https://news.google.com/rss/search?q=bizarre+OR+%22florida+man%22+OR+weird+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'bizarre' },
  // --- sports ---
  { kind: 'rss', name: 'News: sports shock', url: 'https://news.google.com/rss/search?q=upset+OR+shock+OR+record+sport+when:1d&hl=en-US&gl=US&ceid=US:en', category: 'sports' },
  // --- science ---
  { kind: 'rss', name: 'News: science', url: 'https://news.google.com/rss/search?q=scientists+discover+OR+breakthrough+when:2d&hl=en-US&gl=US&ceid=US:en', category: 'science' },
]

/* ------------------------------------------------------------------ */
/* text helpers                                                        */
/* ------------------------------------------------------------------ */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', lsquo: '\u2018',
  rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d', middot: '\u00b7',
  bull: '\u2022', trade: '\u2122', copy: '\u00a9', reg: '\u00ae', deg: '\u00b0'
}

/** Decode the XML/HTML entities that actually show up in RSS titles. */
export function decodeEntities (input) {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in ENTITIES ? ENTITIES[name] : m))
}

function safeChar (code) {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return ''
  try { return String.fromCodePoint(code) } catch { return '' }
}

const CDATA_RE = /<!\[CDATA\[([\s\S]*?)\]\]>/g

function collapse (input) {
  return input.replace(/\s+/g, ' ').trim()
}

/**
 * Turn a raw XML value into readable plain text. The order is deliberate:
 *
 *   1. unwrap CDATA   — CDATA contents are already raw text, not escaped markup
 *   2. decode entities — turns &lt;b&gt; into a real <b> tag
 *   3. strip tags      — removes markup, including the tags step 2 just revealed
 *   4. decode again    — catches feeds that double-escape
 *   5. collapse whitespace
 *
 * Stripping before decoding leaves escaped HTML in summaries; unwrapping CDATA
 * before stripping means CDATA-wrapped titles survive instead of being eaten.
 */
export function toPlainText (input) {
  if (typeof input !== 'string') return ''
  const unwrapped = input.replace(CDATA_RE, '$1')
  const stripped = decodeEntities(unwrapped).replace(/<[^>]*>/g, ' ')
  return collapse(decodeEntities(stripped))
}

/** Readability aliases for the two call-site flavours. Same implementation. */
export const stripHtml = toPlainText
export const htmlToText = toPlainText


/** Pull the RAW inner text of the first <tag>…</tag> (no decoding). */
export function firstTag (xml, tag) {
  if (typeof xml !== 'string') return ''
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

/** Pull the inner text of the first <tag>…</tag>, CDATA-aware, decoded once. */
export function tagText (xml, tag) {
  return stripHtml(firstTag(xml, tag))
}

/* ------------------------------------------------------------------ */
/* parsers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse a Reddit listing (`hot.json`) into candidates.
 * Returns [] for anything that is not shaped like a listing.
 */
export function parseReddit (json, source) {
  const children = json?.data?.children
  if (!Array.isArray(children)) return []
  const out = []
  for (const c of children) {
    const d = c?.data
    if (!d || typeof d.title !== 'string') continue
    if (d.stickied || d.over_18) continue
    const title = decodeEntities(d.title).trim()
    if (!title) continue
    const created = Number(d.created_utc) * 1000
    out.push({
      title,
      summary: htmlToText(d.selftext || '').slice(0, 600) || null,
      url: d.url_overridden_by_dest && !/^https?:\/\/[^/]*redd\.?it/.test(d.url_overridden_by_dest)
        ? d.url_overridden_by_dest
        : `https://www.reddit.com${d.permalink || ''}`,
      source: source.name,
      category: source.category,
      publishedAt: Number.isFinite(created) && created > 0 ? created : null,
      score: Number(d.score) || 0,
      comments: Number(d.num_comments) || 0,
      flair: typeof d.link_flair_text === 'string' ? d.link_flair_text : null
    })
  }
  return out
}

/**
 * Dependency-free RSS 2.0 / Atom parser. Handles <item> and <entry>,
 * CDATA, <content:encoded>, and the several date formats feeds actually use.
 */
export function parseRss (xml, source) {
  if (typeof xml !== 'string' || xml.length < 40) return []
  const blocks = splitBlocks(xml)
  const out = []
  for (const block of blocks) {
    let title = stripHtml(firstTag(block, 'title') || firstTag(block, 'media:title'))
    if (!title) continue

    // <link> text is a bare URL — take it raw (decoding would corrupt & in query strings)
    let link = firstTag(block, 'link')
    if (!link) {
      // Atom: <link rel="alternate" href="..."/>
      const m = block.match(/<link[^>]*href=["']([^"']+)["']/i)
      link = m ? m[1] : ''
    }

    const rawDate =
      tagText(block, 'pubDate') ||
      tagText(block, 'published') ||
      tagText(block, 'updated') ||
      tagText(block, 'dc:date') ||
      tagText(block, 'date')

    const summary =
      htmlToText(firstTag(block, 'description')) ||
      htmlToText(firstTag(block, 'summary')) ||
      htmlToText(firstTag(block, 'content:encoded')) ||
      htmlToText(firstTag(block, 'content'))

    out.push({
      title,
      summary: summary ? summary.slice(0, 600) : null,
      url: link,
      source: source.name,
      category: source.category,
      publishedAt: parseDate(rawDate),
      score: 0,
      comments: 0,
      flair: null
    })
  }
  return out
}

function splitBlocks (xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi)
  if (items && items.length) return items
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi)
  if (entries && entries.length) return entries
  return []
}

/** Tolerant date parsing — feeds are filthy about this. */
export function parseDate (value) {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  let t = Date.parse(s)
  if (Number.isFinite(t)) return t
  // "Wed, 27 Aug 2026 18:04:03 +0000" variants that break Safari/some runtimes
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    t = Date.parse(`${m[2]} ${m[1]}, ${m[3]} ${m[4]}:${m[5]}:${m[6] || '00'} GMT`)
    if (Number.isFinite(t)) return t
  }
  return null
}

/* ------------------------------------------------------------------ */
/* fetching                                                            */
/* ------------------------------------------------------------------ */

export async function fetchText (url, { timeoutMs = 9000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'application/json, application/xml, text/xml, */*' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch every source in parallel and reduce to a de-duplicated, freshness-filtered
 * candidate list. Never throws — partial results beat no results.
 */
/**
 * Fetch every source in parallel and reduce to a de-duplicated, freshness-filtered
 * candidate list.
 *
 * Never throws — partial results always beat no results. Bounded by a hard
 * deadline so a slow or hostile feed cannot stall the whole request: with ~130
 * sources, some will hang, and the ones that answered are good enough.
 */
export async function gatherCandidates ({
  hours = 48,
  category = 'all',
  limitPerSource = 20,
  concurrency = 24,
  deadlineMs = Number(process.env.DRAMA_RADAR_DEADLINE_MS) || 20000,
  maxCandidates = 140,
  timeoutMs = 8000
} = {}) {
  const startedAt = Date.now()
  const cutoff = startedAt - hours * 3600 * 1000
  const sources = SOURCES.filter(s => category === 'all' || s.category === category)

  const results = []
  const diagnostics = []
  let cursor = 0
  let timedOut = false

  async function worker () {
    while (cursor < sources.length) {
      if (Date.now() - startedAt > deadlineMs) { timedOut = true; return }
      const source = sources[cursor++]
      try {
        const raw = await fetchText(source.url, { timeoutMs })
        const parsed = source.kind === 'reddit' ? parseReddit(JSON.parse(raw), source) : parseRss(raw, source)
        diagnostics.push({ source: source.name, ok: true, count: parsed.length, category: source.category })
        for (const p of parsed.slice(0, limitPerSource)) results.push(p)
      } catch (err) {
        diagnostics.push({ source: source.name, ok: false, error: String(err?.message || err).slice(0, 120), category: source.category })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker))

  // Freshness: keep in-window items. If a feed gave us no timestamp, keep it too
  // (better a maybe-fresh story than an empty list).
  const fresh = results.filter(c => !c.publishedAt || c.publishedAt >= cutoff)

  // De-dupe on normalised title so the same story from 4 feeds counts once,
  // but remember every source that carried it (that is a virality signal).
  const byKey = new Map()
  for (const c of fresh) {
    const key = normKey(c.title)
    if (key.length < 12) continue
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...c, alsoSeen: [] })
      continue
    }
    if (!existing.alsoSeen.includes(c.source)) existing.alsoSeen.push(c.source)
    existing.score = Math.max(existing.score, c.score)
    existing.comments = Math.max(existing.comments, c.comments)
    if (!existing.summary && c.summary) existing.summary = c.summary
    if (!existing.publishedAt && c.publishedAt) existing.publishedAt = c.publishedAt
  }

  const candidates = [...byKey.values()]
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, maxCandidates)
    .map(c => ({ ...c, ageHours: c.publishedAt ? Math.max(0, Math.round((Date.now() - c.publishedAt) / 3600000)) : null }))

  return {
    candidates,
    diagnostics,
    reachedSources: diagnostics.filter(d => d.ok).length,
    attemptedSources: sources.length,
    timedOut,
    elapsedMs: Date.now() - startedAt
  }
}

function normKey (title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Reddit score/comments matter; RSS items rank by recency. */
function rank (c) {
  const heat = c.score + c.comments * 2
  const recency = c.ageHours == null ? 0 : Math.max(0, 48 - c.ageHours) * 3
  return heat + recency
}
