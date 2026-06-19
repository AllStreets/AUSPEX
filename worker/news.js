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
  const res = await fetch(GDELT_URL, {
    headers: { 'User-Agent': 'AUSPEX/1.0 (news proxy)' },
  });
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
    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      data = await fetchGdeltOnce();
      if (data) break;
      await new Promise((r) => setTimeout(r, 6000)); // honor 5s spacing
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

// --- Unified fetch: both sources, normalized, deduped ---------------
export async function fetchAllNews() {
  const [gdelt, newsapi] = await Promise.all([fetchGdelt(), fetchNewsApi()]);
  const all = [...gdelt, ...newsapi];

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
      console.log(`[AUSPEX worker] news refreshed: ${articles.length} articles (gdelt ${g}, newsapi ${n})`);
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
