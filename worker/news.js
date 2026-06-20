// ═══════════════════════════════════════════
// AUSPEX · SERVER-SIDE NEWS SOURCES
// Fetches GDELT (keyless global firehose) + NewsAPI (keyed) from the
// worker, where there are no CORS limits, normalizes both to ONE shape,
// dedupes by normalized title, and returns a unified array.
// ═══════════════════════════════════════════

import { isJunk, isLowQualitySource } from '../src/newsjunk.js';

// Normalized article shape the frontend pipeline expects:
// { title, description, url, source, publishedAt, urlToImage, origin, sourcecountry? }

// --- GDELT: keyless, broad-but-serious global query -----------------
const GDELT_QUERY = encodeURIComponent(
  'sourcelang:english (conflict OR diplomacy OR economy OR election OR ' +
  'disaster OR military OR climate OR sanctions OR protest OR summit OR ' +
  'cure OR vaccine OR fusion OR quantum OR discovery OR breakthrough OR ' +
  '"record high" OR milestone OR launch OR "first ever" OR Nobel)'
);
const GDELT_URL =
  'https://api.gdeltproject.org/api/v2/doc/doc?query=' + GDELT_QUERY +
  '&mode=ArtList&format=json&maxrecords=75&timespan=24h&sort=DateDesc';

// GDELT seendate is `YYYYMMDDThhmmssZ` — convert to ISO 8601.
function gdeltDateToISO(s) {
  if (!s || s.length < 15) return new Date().toISOString();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const [, y, mo, d, h, mi, se] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

// GDELT throttles to ~1 request / 5s at the IP level and responds with a
// plaintext "Please limit requests..." body (HTTP 200) when tripped. Retry a
// couple of times with backoff so a transient throttle doesn't zero out GDELT.
async function fetchGdeltOnce() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  let res;
  try {
    res = await fetch(GDELT_URL, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'AUSPEX/1.0 (news proxy)' },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) { if (process.env.NEWS_DEBUG) console.log('[gdelt] http', res.status); return null; }
  const text = await res.text();
  if (!text || text.trimStart()[0] !== '{') {
    if (process.env.NEWS_DEBUG) console.log('[gdelt] non-json:', text.slice(0, 80));
    return null; // throttle/plaintext
  }
  try {
    return JSON.parse(text);
  } catch {
    if (process.env.NEWS_DEBUG) console.log('[gdelt] parse fail:', text.slice(0, 80));
    return null;
  }
}

async function fetchGdelt() {
  try {
    // RSS now carries the feed, so GDELT is a bonus source — keep its budget
    // tight (2 tries) so a throttled GDELT can't stall the serverless cold start.
    let data = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      data = await fetchGdeltOnce();
      if (data) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
    }
    if (!data) return [];
    const articles = Array.isArray(data && data.articles) ? data.articles : [];
    return articles.map((a) => ({
      title: a.title || '',
      description: '', // GDELT has no body
      url: a.url || '',
      source: a.domain || 'GDELT',
      publishedAt: gdeltDateToISO(a.seendate),
      urlToImage: a.socialimage || null,
      origin: 'gdelt',
      sourcecountry: a.sourcecountry || null,
    }));
  } catch {
    return [];
  }
}

// --- NewsAPI: keyed, skipped gracefully if no key -------------------
async function fetchNewsApiEndpoint(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AUSPEX/1.0 (news proxy)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const articles = Array.isArray(data && data.articles) ? data.articles : [];
    return articles.map((a) => ({
      title: a.title || '',
      description: a.description || '',
      url: a.url || '',
      source: (a.source && a.source.name) || 'Wire',
      publishedAt: a.publishedAt || new Date().toISOString(),
      urlToImage: a.urlToImage || null,
      origin: 'newsapi',
      sourcecountry: null,
    }));
  } catch {
    return [];
  }
}

async function fetchNewsApi() {
  const key = process.env.NEWS_API_KEY;
  if (!key) return []; // skip gracefully if absent
  try {
    const endpoints = [
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=100&apiKey=${key}`,
      `https://newsapi.org/v2/everything?q=(geopolitics OR conflict OR economy OR climate)&language=en&sortBy=publishedAt&pageSize=100&apiKey=${key}`,
    ];
    const results = await Promise.all(endpoints.map(fetchNewsApiEndpoint));
    return results.flat();
  } catch {
    return [];
  }
}

// --- RSS: keyless, reliable from any server (incl. Vercel) ----------
// GDELT rate-limits shared serverless IPs and NewsAPI's free tier is
// localhost-only, so on the public deploy both can return nothing. A spread
// of reputable global RSS feeds needs no key, isn't IP-throttled, and keeps
// the live feed flowing for every public visitor — perils AND breakthroughs,
// across multiple regions and editorial viewpoints.
const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
  { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  { url: 'https://feeds.npr.org/1004/rss.xml', source: 'NPR' },
  { url: 'https://rss.dw.com/rdf/rss-en-all', source: 'DW' },
  { url: 'https://www.france24.com/en/rss', source: 'France 24' },
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', source: 'UN News' },
  { url: 'https://reliefweb.int/updates/rss.xml', source: 'ReliefWeb' },
  { url: 'https://www.sciencedaily.com/rss/top/science.xml', source: 'ScienceDaily' },
  { url: 'https://feeds.arstechnica.com/arstechnica/science', source: 'Ars Technica' },
];

// Strip CDATA + tags and decode the handful of entities news feeds actually use.
function rssDecode(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function rssTag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? m[1] : '';
}

// RSS 2.0 <link>text</link>, Atom <link href="..."/>, RDF link variants.
function rssLink(block) {
  const plain = rssTag(block, 'link').trim();
  if (plain && /^https?:/i.test(plain)) return plain;
  const href = block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i);
  return href ? href[1] : '';
}

// First image we can find: enclosure, media:content, or media:thumbnail.
function rssImage(block) {
  const m =
    block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*type=["']image/i) ||
    block.match(/<media:content\b[^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function fetchRssFeed(feed) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let text;
    try {
      const res = await fetch(feed.url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AUSPEX/1.0; +https://github.com/AllStreets/AUSPEX)' },
      });
      if (!res.ok) { if (process.env.NEWS_DEBUG) console.log('[rss]', feed.source, 'http', res.status); return []; }
      text = await res.text();
    } finally {
      clearTimeout(timer);
    }
    // Both <item> (RSS/RDF) and <entry> (Atom).
    const blocks = text.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
    return blocks.map((block) => {
      const title = rssDecode(rssTag(block, 'title'));
      const url = rssLink(block).trim();
      const desc = rssDecode(rssTag(block, 'description') || rssTag(block, 'summary') || rssTag(block, 'content'));
      const dateRaw = rssTag(block, 'pubDate') || rssTag(block, 'published') || rssTag(block, 'updated') || rssTag(block, 'dc:date');
      const d = new Date(rssDecode(dateRaw));
      return {
        title,
        description: desc.slice(0, 400),
        url,
        source: feed.source,
        publishedAt: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
        urlToImage: rssImage(block),
        origin: 'rss',
        sourcecountry: null,
      };
    }).filter((a) => a.title && a.url);
  } catch {
    return [];
  }
}

async function fetchRss() {
  try {
    const results = await Promise.all(RSS_FEEDS.map(fetchRssFeed));
    return results.flat();
  } catch {
    return [];
  }
}

// --- Unified fetch: all sources, normalized, deduped ----------------
export async function fetchAllNews() {
  const [gdelt, newsapi, rss] = await Promise.all([fetchGdelt(), fetchNewsApi(), fetchRss()]);
  const all = [...gdelt, ...newsapi, ...rss];

  const seen = new Set();
  const out = [];
  for (const a of all) {
    if (!a.title || !a.url) continue;
    if (a.title === '[Removed]') continue;
    // Drop non-news / low-quality SOURCE domains (auction listings, package
    // registries, PR wires, tabloids) by domain, regardless of headline.
    if (isLowQualitySource(a.url, a.source)) continue;
    // Drop advertisements, PR/marketing fluff, and pop-culture/celebrity noise
    // before they ever reach the client. PRIORITY signals override junk so
    // legitimate geopolitics/economy/disaster/science/health is never dropped.
    if (isJunk(`${a.title} ${a.description || ''} ${a.source || ''}`)) continue;
    const key = a.title.trim().toLowerCase().slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

// ═══════════════════════════════════════════
// AUSPEX · NEWS CACHE
// Module-level cache of the unified feed so the worker server AND the poller
// (which derives breakthroughs from the news firehose) can both read the
// latest articles without a circular dependency or a double fetch.
// ═══════════════════════════════════════════
const NEWS_TTL_MS = 12 * 60 * 1000;
let _newsCache = { generatedAt: null, count: 0, articles: [] };
let _newsFetchedAt = 0;
let _newsInflight = null;

// Fetch the unified feed and store it in the module-level cache.
// Coalesces concurrent callers onto a single in-flight request.
export async function refreshNews() {
  if (_newsInflight) return _newsInflight;
  _newsInflight = (async () => {
    try {
      const articles = await fetchAllNews();
      if (articles.length) {
        _newsCache = {
          generatedAt: new Date().toISOString(),
          count: articles.length,
          articles,
        };
        _newsFetchedAt = Date.now();
      }
      const g = articles.filter((a) => a.origin === 'gdelt').length;
      const n = articles.filter((a) => a.origin === 'newsapi').length;
      const r = articles.filter((a) => a.origin === 'rss').length;
      console.log(`[AUSPEX worker] news refreshed: ${articles.length} articles (gdelt ${g}, newsapi ${n}, rss ${r})`);
    } catch (e) {
      console.warn('[AUSPEX worker] news refresh failed:', e && e.message);
    } finally {
      _newsInflight = null;
    }
    return _newsCache;
  })();
  return _newsInflight;
}

// The current cached articles array (possibly []). Never throws.
export function getCachedArticles() {
  return _newsCache.articles || [];
}

// The /news.json payload. Refreshes lazily if the cache is cold or expired.
export async function getNewsPayload() {
  if (!_newsCache.generatedAt || Date.now() - _newsFetchedAt > NEWS_TTL_MS) {
    await refreshNews();
  }
  return _newsCache;
}

export const NEWS_REFRESH_INTERVAL_MS = NEWS_TTL_MS;
