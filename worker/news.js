// ═══════════════════════════════════════════
// AUSPEX · SERVER-SIDE NEWS SOURCES
// Fetches GDELT (keyless global firehose) + NewsAPI (keyed) from the
// worker, where there are no CORS limits, normalizes both to ONE shape,
// dedupes by normalized title, and returns a unified array.
// ═══════════════════════════════════════════

// Normalized article shape the frontend pipeline expects:
// { title, description, url, source, publishedAt, urlToImage, origin, sourcecountry? }

// --- GDELT: keyless, broad-but-serious global query -----------------
const GDELT_QUERY = encodeURIComponent(
  'sourcelang:english (conflict OR diplomacy OR economy OR election OR ' +
  'disaster OR military OR climate OR sanctions OR protest OR summit)'
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
    const key = a.title.trim().toLowerCase().slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
