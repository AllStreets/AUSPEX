import express from 'express';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pollAll } from './poller.js';
import { refreshNews, getNewsPayload, NEWS_REFRESH_INTERVAL_MS } from './news.js';
import { fetchFlights } from './flights.js';
import { fetchVessels } from './vessels.js';

// Load server-side secrets (NEWS_API_KEY) from worker/.env if present.
// Node 20.12+ API; the try means it's fine if the file is absent.
try { process.loadEnvFile(new URL('./.env', import.meta.url)); } catch {}

const SNAPSHOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../snapshot.json');
const app = express();

// JSON body parsing — needed by the POST /api/ai proxy (SECTORS + Analyst/RELIEF
// in production). Limit kept modest; AI prompts are small.
app.use(express.json({ limit: '512kb' }));

// ── News proxy cache ──────────────────────────────────────────────
// The unified feed (GDELT + NewsAPI) lives in worker/news.js so the poller
// can read it to derive breakthroughs. We just drive refresh + serve here.

// CORS — allow the local dev frontend plus a configurable production origin.
// ALLOWED_ORIGIN (e.g. https://auspex.example.com) is echoed back when the
// request's Origin matches; localhost:8800 always works for local dev.
const DEV_ORIGIN = 'http://localhost:8800';
const ALLOWED_ORIGINS = new Set([DEV_ORIGIN]);
if (process.env.ALLOWED_ORIGIN) ALLOWED_ORIGINS.add(process.env.ALLOWED_ORIGIN);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Echo the request origin when allowed; otherwise fall back to the dev origin.
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGINS.has(origin) ? origin : DEV_ORIGIN);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>AUSPEX · snapshot worker</title>
<style>html,body{margin:0;height:100%}body{background:#04060d;color:#cfe0f5;display:flex;flex-direction:column;
align-items:center;justify-content:center;gap:14px;font:14px/1.6 ui-monospace,SFMono-Regular,monospace;text-align:center}
.k{letter-spacing:.34em;color:#7fe9ff;font-size:12px}.d{opacity:.62;font-size:12px}a{color:#7fe9ff;text-decoration:none;border-bottom:1px solid rgba(127,233,255,.3)}</style>
</head><body>
<div class="k">AUSPEX · SNAPSHOT WORKER</div>
<div>This is the data service, not the instrument.</div>
<div class="d">The app lives at <a href="http://localhost:8800">localhost:8800</a></div>
<div class="d">Live event feed: <a href="/snapshot.json">/snapshot.json</a></div>
</body></html>`);
});

app.get('/snapshot.json', (req, res) => {
  if (existsSync(SNAPSHOT_PATH)) return res.sendFile(SNAPSHOT_PATH);
  res.json({ generatedAt: new Date().toISOString(), version: 1, events: [] });
});

// Unified, CORS-clean news feed (GDELT + NewsAPI). 12-minute in-memory cache.
app.get('/news.json', async (req, res) => {
  res.json(await getNewsPayload());
});

// Live ADS-B flights (adsb.lol). 20s in-memory cache so adsb.lol isn't hammered.
let _flightsCache = { at: 0, payload: null };
app.get('/flights.json', async (req, res) => {
  if (!_flightsCache.payload || Date.now() - _flightsCache.at > 20000) {
    try {
      const flights = await fetchFlights(1000);
      _flightsCache = { at: Date.now(), payload: { generatedAt: new Date().toISOString(), source: flights.length ? 'live' : 'empty', count: flights.length, flights } };
    } catch (e) {
      _flightsCache = { at: Date.now(), payload: { generatedAt: new Date().toISOString(), source: 'error', count: 0, flights: [] } };
    }
  }
  res.json(_flightsCache.payload);
});

// Live AIS vessels (aisstream.io). 30s in-memory cache so we open ~one stream
// window per cache window. Needs AISSTREAM_API_KEY in worker/.env.
let _vesselsCache = { at: 0, payload: null };
app.get('/vessels.json', async (req, res) => {
  if (!_vesselsCache.payload || Date.now() - _vesselsCache.at > 30000) {
    try {
      const vessels = await fetchVessels(2500);
      _vesselsCache = { at: Date.now(), payload: { generatedAt: new Date().toISOString(), source: vessels.length ? 'live' : 'empty', count: vessels.length, vessels } };
    } catch (e) {
      _vesselsCache = { at: Date.now(), payload: { generatedAt: new Date().toISOString(), source: 'error', count: 0, vessels: [] } };
    }
  }
  res.json(_vesselsCache.payload);
});

// ── AI proxy ──────────────────────────────────────────────────────
// callOpenAI() in the frontend POSTs here when no client key is present
// (production). The real key lives in process.env.AUSPEX_LLM_KEY and never
// reaches the browser. Body: {system,user,maxTokens,model}. Returns {content}.
app.post('/api/ai', async (req, res) => {
  const key = process.env.AUSPEX_LLM_KEY;
  if (!key) return res.status(503).json({ error: 'AI key not configured (AUSPEX_LLM_KEY)' });
  const { system = '', user = '', maxTokens = 420, model = 'gpt-5.4-mini' } = req.body || {};
  if (!user) return res.status(400).json({ error: 'Missing user prompt' });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 58000);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model, max_completion_tokens: Math.min(+maxTokens || 420, 4000), temperature: 0.7,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    clearTimeout(t);
    const d = await r.json();
    if (d.error) return res.status(502).json({ error: d.error.message || 'OpenAI error' });
    res.json({ content: d.choices?.[0]?.message?.content || '' });
  } catch (e) {
    res.status(502).json({ error: e.message || 'AI proxy failed' });
  }
});

// ── Market proxy (Stooq) ──────────────────────────────────────────
// Equities / commodities / indices have no keyless CORS-safe API, so we fetch
// Stooq's CSV server-side and return JSON. GET /api/market?symbols=spy.us,cl.f
// Returns { quotes: [{symbol,date,time,open,high,low,close,volume,change,pct}], source }.
// 5-minute in-memory cache keyed by the (sorted) symbol set.
const _marketCache = new Map(); // key -> { at, payload }
const MARKET_TTL = 5 * 60 * 1000;
app.get('/api/market', async (req, res) => {
  const raw = String(req.query.symbols || '').trim();
  if (!raw) return res.status(400).json({ error: 'Missing symbols' });
  const symbols = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 25);
  const key = symbols.slice().sort().join(',');
  const cached = _marketCache.get(key);
  if (cached && Date.now() - cached.at < MARKET_TTL) return res.json(cached.payload);
  try {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbols.join(','))}&f=sd2t2ohlcv&h&e=csv`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 AUSPEX' } });
    clearTimeout(t);
    const csv = await r.text();
    const lines = csv.trim().split('\n');
    const quotes = lines.slice(1).map(line => {
      const c = line.split(',');
      const o = +c[3], cl = +c[6];
      const open = isFinite(o) ? o : null, close = isFinite(cl) ? cl : null;
      const change = (open != null && close != null) ? +(close - open).toFixed(4) : null;
      const pct = (open != null && close != null && open !== 0) ? +(((close - open) / open) * 100).toFixed(2) : null;
      return {
        symbol: c[0], date: c[1], time: c[2],
        open, high: +c[4] || null, low: +c[5] || null, close, volume: +c[7] || null,
        change, pct,
      };
    }).filter(q => q.symbol && q.symbol.toLowerCase() !== 'n/d');
    const payload = { source: quotes.length ? 'stooq' : 'empty', generatedAt: new Date().toISOString(), quotes };
    _marketCache.set(key, { at: Date.now(), payload });
    res.json(payload);
  } catch (e) {
    res.json({ source: 'error', error: e.message, quotes: [] });
  }
});

app.listen(8801, () => console.log('[AUSPEX worker] listening on :8801'));

pollAll();
setInterval(pollAll, 3 * 60 * 1000);

// Warm the news cache on boot, then keep it fresh every 12 minutes.
refreshNews();
setInterval(refreshNews, NEWS_REFRESH_INTERVAL_MS);
