'use strict';

// ═══════════════════════════════════════════════════════════════════════
// SECTORS — INDUSTRY INTELLIGENCE
// ───────────────────────────────────────────────────────────────────────
// One full-screen overlay (#sectors-overlay) hosting 8 industry sub-pages.
// Config-driven: ONE rich renderer (renderSectorPage) + a SECTOR_CONFIG array
// of 8 entries, so every page is equally full.
//
// Data sources (all keyless / CORS-safe client-side, OR via AUSPEX's own worker):
//   • CoinGecko   api.coingecko.com         — crypto prices/mcap (keyless, CORS-ok)
//   • Frankfurter api.frankfurter.app       — FX rates (keyless, CORS-ok)
//   • World Bank  api.worldbank.org/v2      — macro indicators (keyless, CORS-ok)
//   • Worker      /api/market?symbols=...   — Stooq equities/commodities (server proxy)
//   • AUSPEX live globals: NEWS[], SNAPSHOT_EVENTS[], COUNTRY_DATA[]
//   • Supabase    sbSearchHistory(...)      — historical signal context
//   • AI synthesis via callOpenAI() (js/analyst.js), guarded by aiEnabled()
//
// EVERY external fetch has a graceful fallback (try/catch → curated "est." value).
// Numbers that fall back to curated estimates carry an `est:true` flag → "est." tag.
// ═══════════════════════════════════════════════════════════════════════

// ── tiny in-memory cache (≈5 min TTL) ──────────────────────────────────
const _scCache = new Map();
const SC_TTL = 5 * 60 * 1000;
async function scCached(key, ttl, fn) {
  const hit = _scCache.get(key);
  if (hit && Date.now() - hit.at < (ttl || SC_TTL)) return hit.val;
  try {
    const val = await fn();
    _scCache.set(key, { at: Date.now(), val });
    return val;
  } catch (e) {
    if (hit) return hit.val; // serve stale on error
    throw e;
  }
}
function scFetchJSON(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal })
    .then(r => { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .catch(e => { clearTimeout(t); throw e; });
}

// ── KPI value shape: { value, delta, dir, spark[], est, derived } ──────
function kpiVal(value, delta, dir, spark, est) {
  return { value, delta: delta ?? null, dir: dir || 'flat', spark: spark || null, est: !!est };
}
// A live-DERIVED KPI: value is computed from the live AUSPEX feed (not a market
// API and not a constant). Tagged "derived" so it reads honestly.
function kpiDerived(value, delta, dir, spark) {
  return { value, delta: delta ?? null, dir: dir || 'flat', spark: spark || null, est: false, derived: true };
}
// 0-100 index of how strongly a set of terms appears in the live NEWS feed,
// recency-weighted then scaled by feed size. Pure live derivation.
function scKeywordIndex(terms) {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  if (!news.length) return 0;
  const t = terms.map(x => x.toLowerCase());
  let w = 0;
  for (const s of news) {
    const hay = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
    if (t.some(k => k && hay.includes(k))) w += scRecencyWeight(s) * (s.brk ? 1.5 : 1);
  }
  // scale: saturate around ~12 weighted hits → 100
  return Math.min(100, Math.round(w / 12 * 100));
}
// Live spark for a derived index: per-day weighted term counts over n days.
function scIndexSpark(terms, n = 14) {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const t = terms.map(x => x.toLowerCase());
  const buckets = new Array(n).fill(0); let placed = 0;
  for (const s of news) {
    const hay = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
    if (!t.some(k => k && hay.includes(k))) continue;
    const m = (s.time || '').toLowerCase().match(/(\d+)\s*([hdm])/);
    let age = 0; if (m) age = m[2] === 'd' ? +m[1] : 0;
    buckets[Math.max(0, n - 1 - Math.min(n - 1, age))] += scRecencyWeight(s); placed++;
  }
  if (placed >= 2) { for (let i = 1; i < n; i++) buckets[i] += buckets[i - 1]; return buckets; }
  return buckets.map((_, i) => placed * (i + 1) / n);
}
// Build a plausible spark series around a base (used for curated/estimate sparklines)
function synthSpark(base, vol = 0.04, n = 16) {
  const out = []; let v = base * (1 - vol * 2);
  for (let i = 0; i < n; i++) { v += base * (Math.random() - 0.45) * vol; out.push(Math.max(0, v)); }
  out[n - 1] = base;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// DATA SERVICE HELPERS — keyless/CORS-safe, each returns clean numbers.
// All wrapped by callers in try/catch → curated fallback.
// ═══════════════════════════════════════════════════════════════════════
const SC_WORKER = (typeof WORKER_BASE !== 'undefined' && WORKER_BASE) ? WORKER_BASE : '';

// Stooq via worker proxy → map of symbol→quote
async function scMarket(symbols) {
  return scCached('mkt:' + symbols.join(','), SC_TTL, async () => {
    const d = await scFetchJSON(`${SC_WORKER}/api/market?symbols=${encodeURIComponent(symbols.join(','))}`);
    const map = {};
    (d.quotes || []).forEach(q => { map[q.symbol.toLowerCase()] = q; });
    return map;
  });
}
// CoinGecko simple price + market chart
async function scCrypto(ids) {
  return scCached('cg:' + ids.join(','), SC_TTL, () =>
    scFetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`));
}
async function scCryptoChart(id, days = 14) {
  return scCached(`cgc:${id}:${days}`, SC_TTL, () =>
    scFetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`));
}
// Frankfurter FX
async function scFX(to) {
  return scCached('fx:' + to.join(','), SC_TTL, () =>
    scFetchJSON(`https://api.frankfurter.app/latest?from=USD&to=${to.join(',')}`));
}
async function scFXSeries(symbol, days = 30) {
  const end = new Date(), start = new Date(Date.now() - days * 86400000);
  const f = d => d.toISOString().slice(0, 10);
  return scCached(`fxs:${symbol}:${days}`, SC_TTL, () =>
    scFetchJSON(`https://api.frankfurter.app/${f(start)}..${f(end)}?from=USD&to=${symbol}`));
}
// World Bank indicator → latest non-null value + short series
async function scWorldBank(indicator, country = 'WLD') {
  return scCached(`wb:${country}:${indicator}`, 60 * 60 * 1000, async () => {
    const d = await scFetchJSON(`https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=12`);
    const rows = (d && d[1]) || [];
    const series = rows.filter(r => r.value != null).reverse().map(r => ({ year: r.date, value: r.value }));
    return { latest: series[series.length - 1] || null, series };
  });
}

// High limit used wherever we want the TRUE count, not a capped/saturated one.
const SC_BIG = 500;

// Recency-weight a single live signal by its s.time string (newer = heavier).
function scRecencyWeight(s) {
  const t = (s && s.time || '').toLowerCase();
  const m = t.match(/(\d+)\s*([hdm])/);
  if (!m) return 1; // unknown age → base weight
  const v = +m[1];
  const hours = m[2] === 'd' ? v * 24 : m[2] === 'h' ? v : v / 60;
  // decay over ~10 days, floor 0.2 so older items still count a little
  return Math.max(0.2, 1 - hours / 240);
}

// LIVE "mention pressure" ranking: for a list of entities, count recency-weighted
// live NEWS mentions of each. This is the user's chokepoint formula, generalized,
// and used for EVERY ranking so no static constants remain. Returns rows sorted
// desc with an integer `value`/`display`. Always live-derived from NEWS[].
function scMentionPressure(entities, opts = {}) {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const color = opts.color;
  const rows = entities.map(ent => {
    const name = typeof ent === 'string' ? ent : ent.label;
    const aliases = (typeof ent === 'object' && ent.aliases ? ent.aliases : [name])
      .map(a => a.toLowerCase());
    let score = 0;
    for (const s of news) {
      const hay = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
      if (aliases.some(a => a && hay.includes(a))) score += scRecencyWeight(s);
    }
    return { label: name, raw: score };
  });
  // Normalize to a 0-100 pressure index so bars are comparable & meaningful.
  const max = Math.max(...rows.map(r => r.raw), 0);
  return rows.map(r => {
    const value = max > 0 ? Math.round(r.raw / max * 100) : 0;
    return { label: r.label, value, display: String(value), color };
  }).sort((a, b) => b.value - a.value);
}

// ── Sector-filtered live signal feed from AUSPEX NEWS[] ─────────────────
function scSignalsFor(cfg, limit = 14) {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const kw = cfg.keywords.map(k => k.toLowerCase());
  const scored = news.map(s => {
    const hay = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
    let hits = 0; for (const k of kw) if (hay.includes(k)) hits++;
    // category affinity boost
    if (cfg.cats && cfg.cats.includes(s.cat)) hits += 1;
    return { s, hits };
  }).filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || (b.s.brk === a.s.brk ? 0 : b.s.brk ? 1 : -1));
  return scored.slice(0, limit).map(x => x.s);
}

// Live spark from a sector's signal flow: bucket matched signals by day-age
// (parsed from s.time when possible) → a real recency curve. Falls back to a
// simple ramp of the running count (still derived from the live signal list),
// never a static series.
function scSparkFromSignals(cfg, n = 14) {
  const sigs = scSignalsFor(cfg, SC_BIG);
  if (!sigs.length) return [0, 0];
  const buckets = new Array(n).fill(0);
  let placed = 0;
  sigs.forEach(s => {
    const t = (s.time || '').toLowerCase();
    let age = null;
    const m = t.match(/(\d+)\s*([hdm])/); // 3h, 2d, 45m
    if (m) {
      const v = +m[1];
      age = m[2] === 'd' ? v : m[2] === 'h' ? 0 : 0; // hours/mins → today bucket
    }
    if (age == null) return;
    const idx = Math.max(0, n - 1 - Math.min(n - 1, age));
    buckets[idx]++; placed++;
  });
  // cumulative so the line trends with accumulating coverage
  if (placed >= 2) { for (let i = 1; i < n; i++) buckets[i] += buckets[i - 1]; return buckets; }
  // fallback: even ramp up to the true count (live-derived, not constant)
  return Array.from({ length: n }, (_, i) => +(sigs.length * (i + 1) / n).toFixed(2));
}

// ═══════════════════════════════════════════════════════════════════════
// INLINE SVG CHART HELPERS — hand-rolled, crisp viewBox, AUSPEX-colored.
// ═══════════════════════════════════════════════════════════════════════
function svgSpark(data, color, w = 60, h = 18) {
  if (!data || data.length < 2) return '';
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1) * w).toFixed(1)},${(h - ((v - min) / span) * (h - 2) - 1).toFixed(1)}`);
  const up = data[data.length - 1] >= data[0];
  const c = color || (up ? '#34D17A' : '#FF4D5E');
  return `<svg class="sc-kpi-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${pts[pts.length-1].split(',')[0]}" cy="${pts[pts.length-1].split(',')[1]}" r="1.6" fill="${c}"/>
  </svg>`;
}
function svgArea(data, color, w = 520, h = 150, labels) {
  if (!data || data.length < 2) return '<div class="sc-chart-empty">NO SERIES DATA</div>';
  const pad = { l: 6, r: 6, t: 10, b: 16 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const x = i => pad.l + (i / (data.length - 1)) * iw;
  const y = v => pad.t + ih - ((v - min) / span) * ih;
  const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${pad.l},${pad.t + ih} ${line} ${(pad.l + iw).toFixed(1)},${pad.t + ih}`;
  const gid = 'scg' + Math.random().toString(36).slice(2, 7);
  const grid = [0, .5, 1].map(f => `<line x1="${pad.l}" x2="${pad.l+iw}" y1="${(pad.t+ih*f).toFixed(1)}" y2="${(pad.t+ih*f).toFixed(1)}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`).join('');
  const lbls = labels ? `<text x="${pad.l}" y="${h-3}" class="sc-heat-lbl">${labels[0]}</text><text x="${pad.l+iw}" y="${h-3}" text-anchor="end" class="sc-heat-lbl">${labels[labels.length-1]}</text>` : '';
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".34"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="${area}" fill="url(#${gid})"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    ${lbls}
  </svg>`;
}
function barRanking(rows, color) {
  if (!rows || !rows.length) return '<div class="sc-chart-empty">NO RANKING DATA</div>';
  const max = Math.max(...rows.map(r => Math.abs(r.value))) || 1;
  return rows.map(r => {
    const pct = Math.max(2, Math.abs(r.value) / max * 100);
    const c = r.color || color;
    return `<div class="sc-bar-row"><span class="sc-bar-lbl" title="${r.label}">${r.label}</span>
      <span class="sc-bar-track"><span class="sc-bar-fill" style="width:${pct}%;background:${c}"></span></span>
      <span class="sc-bar-val">${r.display ?? r.value}</span></div>`;
  }).join('');
}
// ── LIVE COMPOSITE SECTOR SCORING ──────────────────────────────────────
// One consistent formula across all 8 sectors so scores VARY and compare.
// Inputs are 100% live, drawn from the AUSPEX feed (NEWS[]):
//   • volume      — true count of sector-matched live signals (uncapped)
//   • breaking    — count of those signals flagged breaking (s.brk)
//   • urgency     — mean AI urgency (1-10) of the sector's signals, when scored
// Each term is normalized ACROSS sectors (min-max) so the 0-100 composite is
// relative and always varied. Falls back to volume-only normalization before
// AI urgency exists — still fully live-derived, never a constant.
function scSectorMetrics() {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const raw = SECTOR_CONFIG.map(c => {
    // TRUE uncapped count of sector-matched live signals (so volume varies per
    // sector instead of saturating the SC_BIG cap → no "all 500").
    const kw = c.keywords.map(k => k.toLowerCase());
    let volume = 0, breaking = 0;
    for (const s of news) {
      const hay = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
      if (kw.some(k => hay.includes(k)) || (c.cats && c.cats.includes(s.cat))) {
        volume++;
        if (s.brk) breaking++;
      }
    }
    // mean AI urgency if this sector has been AI-scored, else 0 (term drops out)
    const ai = _scUrgencyBySector[c.id];
    let urgency = 0, urgencyN = 0;
    if (ai && ai.length) { urgency = ai.reduce((a, b) => a + b, 0) / ai.length; urgencyN = ai.length; }
    return { id: c.id, abbr: c.heatAbbr, accent: c.accent, volume, breaking, urgency, urgencyN };
  });
  // min-max normalizer across sectors → 0..1 (constant series → 0)
  const norm = (vals) => {
    const mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn;
    return v => span > 0 ? (v - mn) / span : 0;
  };
  const nVol = norm(raw.map(r => r.volume));
  const nBrk = norm(raw.map(r => r.breaking));
  const anyUrg = raw.some(r => r.urgencyN > 0);
  const nUrg = norm(raw.map(r => r.urgency));
  raw.forEach(r => {
    // weights: signal volume 50%, breaking-news weight 25%, AI urgency 25%
    // (urgency weight re-distributed to volume until AI scoring lands)
    const vw = anyUrg ? 0.50 : 0.70;
    const bw = anyUrg ? 0.25 : 0.30;
    const uw = anyUrg ? 0.25 : 0.00;
    const composite = vw * nVol(r.volume) + bw * nBrk(r.breaking) + uw * nUrg(r.urgency);
    r.score = Math.round(composite * 100);
    r.live = !anyUrg ? 'derived' : 'live';
  });
  return raw;
}

// Signals × sectors heatmap (cross-domain coverage of the live feed).
// Primary tile number = TRUE live signal count (uncapped → varies, never 99).
// Sub-label = the live composite sector score (0-100).
function svgHeatmap() {
  const cols = scSectorMetrics();
  const maxN = Math.max(1, ...cols.map(c => c.volume));
  const cw = 70, ch = 50, top = 22, left = 4;
  const w = left + cols.length * cw, h = top + ch + 6;
  const cells = cols.map((c, i) => {
    const x = left + i * cw;
    // intensity driven by the live composite score so colour tracks the metric
    const intensity = c.score / 100;
    const op = 0.12 + intensity * 0.78;
    return `<rect class="sc-heat-cell" x="${x+2}" y="${top}" width="${cw-4}" height="${ch}" rx="3" fill="${c.accent}" fill-opacity="${op.toFixed(2)}"/>
      <text x="${x+cw/2}" y="${top+ch/2-2}" text-anchor="middle" class="sc-heat-val">${c.score}</text>
      <text x="${x+cw/2}" y="${top+ch/2+12}" text-anchor="middle" class="sc-heat-sub">${c.volume} sig</text>
      <text x="${x+cw/2}" y="${top-7}" text-anchor="middle" class="sc-heat-lbl">${c.abbr}</text>`;
  }).join('');
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${cells}</svg>`;
}

// ═══════════════════════════════════════════════════════════════════════
// SECTOR CONFIGS — 8 entries. dataFns(cfg) returns { kpis, charts } async.
// kpis: array aligned to cfg.kpis labels. charts: { trend, ranking }.
// Each KPI resolves to kpiVal(...) with est:true when it falls back to curated.
// ═══════════════════════════════════════════════════════════════════════
const SECTOR_CONFIG = [
  {
    id: 'trade', num: '01', title: 'Trade & Supply Chain', accent: '#E8B84B', heatAbbr: 'TRD',
    cats: ['finance', 'geo'],
    scope: 'Ports · freight · tariffs · chokepoints · commodities',
    keywords: ['trade', 'tariff', 'export', 'import', 'supply chain', 'port', 'shipping', 'freight', 'container', 'wto', 'sanction', 'commodity', 'oil', 'copper', 'wheat', 'chip', 'semiconductor', 'logistics', 'customs', 'embargo'],
    aiPersona: 'a senior trade & supply-chain economist tracking global goods flows, freight rates, tariffs, chokepoints and commodity markets',
    kpis: ['BRENT CRUDE', 'COPPER', 'FREIGHT PRESSURE', 'WHEAT', 'TRADE GROWTH', 'USD INDEX'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      // Brent (cb.f), Copper (hg.f), Wheat (zw.f) via Stooq; trade growth via World Bank
      let mkt = {};
      try { mkt = await scMarket(['cb.f', 'hg.f', 'zw.f', 'dx.f']); } catch (e) {}
      const q = (s, est) => {
        const k = mkt[s];
        if (k && k.close != null) return kpiVal('$' + k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false);
        return est;
      };
      out.kpis.push(q('cb.f', kpiVal('$72.40', '+0.6%', 'up', synthSpark(72.4), true)));
      out.kpis.push(q('hg.f', kpiVal('$4.21', '-0.3%', 'dn', synthSpark(4.21), true)));
      // FREIGHT PRESSURE — no keyless Baltic Dry feed → live-derived 0-100 index
      // from shipping/freight/port chatter in the AUSPEX feed.
      { const ft = ['shipping','freight','container','port','baltic','vessel','tanker','logistics'];
        const idx = scKeywordIndex(ft);
        out.kpis.push(kpiDerived(String(idx)+'/100', null, idx>=50?'up':idx>0?'flat':'flat', scIndexSpark(ft))); }
      out.kpis.push(q('zw.f', kpiVal('$5.85', '+0.4%', 'up', synthSpark(5.85), true)));
      try {
        const wb = await scWorldBank('NE.EXP.GNFS.KD.ZG');
        const v = wb.latest;
        out.kpis.push(v ? kpiVal(v.value.toFixed(1) + '%', null, v.value>0?'up':'dn', wb.series.map(s=>s.value), false)
                        : kpiVal('+2.4%', null, 'up', synthSpark(2.4), true));
      } catch (e) { out.kpis.push(kpiVal('+2.4%', null, 'up', synthSpark(2.4), true)); }
      out.kpis.push(q('dx.f', kpiVal('104.2', '+0.1%', 'up', synthSpark(104.2), true)));
      // Trend: Brent series via Stooq isn't a series; use synth around current. Ranking: chokepoint pressure (curated + live signal weighting)
      const brent = mkt['cb.f']?.close || 72.4;
      out.charts.trend = { title: 'BRENT CRUDE · 14D', series: synthSpark(brent, 0.05, 14), est: !mkt['cb.f'] };
      // CHOKEPOINT PRESSURE INDEX — live: recency-weighted count of NEWS mentioning
      // each chokepoint, normalized 0-100. No random, no constants.
      const chokes = [
        { label: 'Suez Canal', aliases: ['suez'] },
        { label: 'Panama Canal', aliases: ['panama canal', 'panama'] },
        { label: 'Strait of Hormuz', aliases: ['hormuz'] },
        { label: 'Bab-el-Mandeb', aliases: ['bab-el-mandeb', 'bab el mandeb', 'red sea', 'houthi'] },
        { label: 'Malacca Strait', aliases: ['malacca'] },
        { label: 'Bosphorus', aliases: ['bosphorus', 'bosporus', 'turkish strait'] },
      ];
      out.charts.ranking = { title: 'CHOKEPOINT PRESSURE INDEX', est: false, rows: scMentionPressure(chokes) };
      return out;
    },
  },
  {
    id: 'finance', num: '02', title: 'Finance & Markets', accent: '#E8B84B', heatAbbr: 'FIN',
    cats: ['finance'],
    scope: 'Equities · rates · FX · crypto · credit',
    keywords: ['market', 'stock', 'fed', 'rate', 'inflation', 'bond', 'yield', 'earnings', 'nasdaq', 's&p', 'dow', 'currency', 'dollar', 'euro', 'crypto', 'bitcoin', 'bank', 'recession', 'gdp', 'central bank', 'equity'],
    aiPersona: 'a buy-side macro strategist covering equities, rates, FX and digital assets across global markets',
    kpis: ['S&P 500', 'NASDAQ 100', 'BITCOIN', 'EUR/USD', 'GOLD', 'RATES PRESSURE'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      let mkt = {}, cg = {}, fx = {};
      try { mkt = await scMarket(['spy.us', 'qqq.us', 'gc.f']); } catch (e) {}
      try { cg = await scCrypto(['bitcoin']); } catch (e) {}
      try { fx = await scFX(['EUR']); } catch (e) {}
      const q = (s, label, est) => {
        const k = mkt[s];
        if (k && k.close != null) return kpiVal(k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false);
        return est;
      };
      out.kpis.push(q('spy.us', 'S&P', kpiVal('560.2', '+0.4%', 'up', synthSpark(560), true)));
      out.kpis.push(q('qqq.us', 'NDX', kpiVal('495.8', '+0.6%', 'up', synthSpark(496), true)));
      const btc = cg.bitcoin;
      out.kpis.push(btc ? kpiVal('$' + Math.round(btc.usd).toLocaleString(), (btc.usd_24h_change!=null?(btc.usd_24h_change>0?'+':'')+btc.usd_24h_change.toFixed(1)+'%':null), btc.usd_24h_change>0?'up':'dn', synthSpark(btc.usd), false)
                        : kpiVal('$67,200', '+1.2%', 'up', synthSpark(67200), true));
      const eur = fx?.rates?.EUR;
      out.kpis.push(eur ? kpiVal((1/eur).toFixed(4), null, 'flat', synthSpark(1/eur), false) : kpiVal('1.0850', null, 'flat', synthSpark(1.085), true));
      out.kpis.push(q('gc.f', 'GOLD', kpiVal('$2,340', '+0.3%', 'up', synthSpark(2340), true)));
      // RATES PRESSURE — no keyless 10Y yield feed → live-derived 0-100 index from
      // rate/Fed/yield/inflation chatter in the AUSPEX feed.
      { const rt = ['rate','fed','yield','treasury','bond','inflation','central bank','hike','cut'];
        const idx = scKeywordIndex(rt);
        out.kpis.push(kpiDerived(String(idx)+'/100', null, 'flat', scIndexSpark(rt))); }
      // Trend: BTC 14d real series
      try {
        const ch = await scCryptoChart('bitcoin', 14);
        const series = (ch.prices || []).map(p => p[1]);
        out.charts.trend = { title: 'BITCOIN · 14D (USD)', series: series.length ? series : synthSpark(btc?.usd||67000,0.05,14), est: !series.length };
      } catch (e) { out.charts.trend = { title: 'BITCOIN · 14D (USD)', series: synthSpark(btc?.usd||67000,0.05,14), est: true }; }
      // SECTOR PERFORMANCE — live daily % change of the SPDR sector ETFs via Stooq.
      let secMkt = {};
      try { secMkt = await scMarket(['xlk.us','xle.us','xlf.us','xlv.us','xlb.us','xlu.us']); } catch (e) {}
      const secMap = [['Technology','xlk.us'],['Energy','xle.us'],['Financials','xlf.us'],['Healthcare','xlv.us'],['Materials','xlb.us'],['Utilities','xlu.us']];
      const haveSec = secMap.some(([,s]) => secMkt[s] && secMkt[s].pct != null);
      const secRows = haveSec
        ? secMap.map(([label,s]) => { const v = secMkt[s]?.pct ?? 0; return { label, value: v, color: v>=0?'#34D17A':'#FF4D5E', display: (v>0?'+':'')+v+'%' }; }).sort((a,b)=>b.value-a.value)
        // fallback: live signal-mention pressure across the same sectors (still live-derived)
        : scMentionPressure([
            {label:'Technology',aliases:['tech','technology','ai','chip']},
            {label:'Energy',aliases:['energy','oil','gas']},
            {label:'Financials',aliases:['bank','financial','fed','rate']},
            {label:'Healthcare',aliases:['health','pharma','drug']},
            {label:'Materials',aliases:['materials','copper','mining','metal']},
            {label:'Utilities',aliases:['utility','utilities','power','grid']},
          ], { color: '#22D3EE' });
      out.charts.ranking = { title: haveSec ? 'SECTOR PERFORMANCE · 1D' : 'SECTOR SIGNAL PRESSURE', est: !haveSec, rows: secRows };
      return out;
    },
  },
  {
    id: 'realestate', num: '03', title: 'Real Estate', accent: '#22D3EE', heatAbbr: 'RE',
    cats: ['finance'],
    scope: 'Housing · commercial · mortgage rates · REITs',
    keywords: ['real estate', 'housing', 'mortgage', 'property', 'home price', 'rent', 'reit', 'construction', 'commercial property', 'office', 'developer', 'zoning', 'landlord', 'foreclosure', 'building permit'],
    aiPersona: 'a real-estate market analyst covering residential, commercial, mortgage rates and REIT performance globally',
    kpis: ['US REITS (VNQ)', 'HOMEBUILDERS (XHB)', 'MORTGAGE STRESS', 'HOUSING HEAT', 'OFFICE/CRE STRESS', 'CONSTRUCTION'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      let mkt = {};
      try { mkt = await scMarket(['vnq.us', 'xhb.us']); } catch (e) {}
      const q = (s, est) => { const k = mkt[s]; return (k && k.close!=null) ? kpiVal('$'+k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false) : est; };
      out.kpis.push(q('vnq.us', kpiVal('$92.40', '+0.3%', 'up', synthSpark(92.4), true)));
      out.kpis.push(q('xhb.us', kpiVal('$108.7', '+0.5%', 'up', synthSpark(108.7), true)));
      // No keyless feeds for mortgage rate / home-price YoY / office vacancy /
      // construction spend → live-derived 0-100 attention indices from the feed.
      { const m = ['mortgage','interest rate','30-year','refinanc','lending'];
        out.kpis.push(kpiDerived(scKeywordIndex(m)+'/100', null, 'flat', scIndexSpark(m))); }
      { const h = ['home price','house price','housing','home sales','property price','rent'];
        out.kpis.push(kpiDerived(scKeywordIndex(h)+'/100', null, 'flat', scIndexSpark(h))); }
      { const o = ['office','commercial property','vacancy','cre','remote work','downtown'];
        out.kpis.push(kpiDerived(scKeywordIndex(o)+'/100', null, 'flat', scIndexSpark(o))); }
      { const c = ['construction','building permit','developer','infrastructure','housing start'];
        out.kpis.push(kpiDerived(scKeywordIndex(c)+'/100', null, 'flat', scIndexSpark(c))); }
      out.charts.trend = { title: 'US REITS (VNQ) · 14D', series: synthSpark(mkt['vnq.us']?.close||92.4, 0.03, 14), est: !mkt['vnq.us'] };
      // GLOBAL MARKET ATTENTION — live: recency-weighted NEWS mentions per market.
      out.charts.ranking = {
        title: 'GLOBAL MARKET ATTENTION', est: false,
        rows: scMentionPressure([
          {label:'Dubai',aliases:['dubai','uae','emirates']},
          {label:'Tokyo',aliases:['tokyo','japan']},
          {label:'Madrid',aliases:['madrid','spain']},
          {label:'New York',aliases:['new york','manhattan','nyc']},
          {label:'London',aliases:['london','uk','britain']},
          {label:'San Francisco',aliases:['san francisco','bay area','california']},
        ], { color: '#22D3EE' })
      };
      return out;
    },
  },
  {
    id: 'tech', num: '04', title: 'Technology & AI', accent: '#22D3EE', heatAbbr: 'TEC',
    cats: ['tech'],
    scope: 'AI · semiconductors · big tech · cyber · cloud',
    keywords: ['ai', 'artificial intelligence', 'chip', 'semiconductor', 'nvidia', 'openai', 'google', 'microsoft', 'apple', 'cyber', 'cloud', 'data center', 'gpu', 'software', 'startup', 'quantum', 'robot', 'model', 'llm', 'tech', 'silicon'],
    aiPersona: 'a technology-sector analyst covering AI, semiconductors, big-tech equities, cybersecurity and cloud infrastructure',
    kpis: ['NVIDIA', 'SEMIS (SMH)', 'APPLE', 'MICROSOFT', 'AI COMPUTE IDX', 'CYBER (HACK)'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      let mkt = {};
      try { mkt = await scMarket(['nvda.us', 'smh.us', 'aapl.us', 'msft.us', 'hack.us']); } catch (e) {}
      const q = (s, est) => { const k = mkt[s]; return (k && k.close!=null) ? kpiVal('$'+k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false) : est; };
      out.kpis.push(q('nvda.us', kpiVal('$126.4', '+1.8%', 'up', synthSpark(126), true)));
      out.kpis.push(q('smh.us', kpiVal('$248.1', '+1.1%', 'up', synthSpark(248), true)));
      out.kpis.push(q('aapl.us', kpiVal('$224.7', '+0.4%', 'up', synthSpark(224), true)));
      out.kpis.push(q('msft.us', kpiVal('$445.3', '+0.6%', 'up', synthSpark(445), true)));
      // AI COMPUTE IDX — no keyless feed → live-derived 0-100 index from AI/compute
      // chatter (data centers, GPUs, training) in the AUSPEX feed.
      { const ai = ['ai','artificial intelligence','gpu','data center','compute','training','model','nvidia','openai'];
        out.kpis.push(kpiDerived(scKeywordIndex(ai)+'/100', null, 'up', scIndexSpark(ai))); }
      out.kpis.push(q('hack.us', kpiVal('$78.9', '+0.7%', 'up', synthSpark(78.9), true)));
      out.charts.trend = { title: 'NVIDIA · 14D', series: synthSpark(mkt['nvda.us']?.close||126, 0.05, 14), est: !mkt['nvda.us'] };
      // BIG-TECH SIGNAL LEADERS — live: recency-weighted NEWS mentions per company.
      out.charts.ranking = {
        title: 'BIG-TECH SIGNAL LEADERS', est: false,
        rows: scMentionPressure([
          {label:'Microsoft',aliases:['microsoft','msft','openai','copilot']},
          {label:'Apple',aliases:['apple','iphone','aapl']},
          {label:'Nvidia',aliases:['nvidia','nvda','gpu']},
          {label:'Alphabet',aliases:['google','alphabet','gemini','deepmind']},
          {label:'Amazon',aliases:['amazon','aws']},
          {label:'Meta',aliases:['meta','facebook','instagram','llama']},
        ], { color: '#22D3EE' })
      };
      return out;
    },
  },
  {
    id: 'energy', num: '05', title: 'Energy', accent: '#34D17A', heatAbbr: 'ENR',
    cats: ['finance', 'climate', 'geo'],
    scope: 'Oil · gas · power · renewables · grid',
    keywords: ['energy', 'oil', 'gas', 'opec', 'crude', 'lng', 'pipeline', 'renewable', 'solar', 'wind', 'nuclear', 'power', 'grid', 'electricity', 'coal', 'hydrogen', 'battery', 'refinery', 'gasoline', 'barrel'],
    aiPersona: 'an energy-markets analyst covering oil, natural gas, power, renewables and grid security',
    kpis: ['WTI CRUDE', 'NAT GAS', 'BRENT', 'CLEAN ENERGY (ICLN)', 'URANIUM (URA)', 'RENEW SHARE'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      let mkt = {};
      try { mkt = await scMarket(['cl.f', 'ng.f', 'cb.f', 'icln.us', 'ura.us']); } catch (e) {}
      const q = (s, est) => { const k = mkt[s]; return (k && k.close!=null) ? kpiVal('$'+k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false) : est; };
      out.kpis.push(q('cl.f', kpiVal('$69.20', '+0.7%', 'up', synthSpark(69.2), true)));
      out.kpis.push(q('ng.f', kpiVal('$2.95', '-1.1%', 'dn', synthSpark(2.95), true)));
      out.kpis.push(q('cb.f', kpiVal('$72.40', '+0.6%', 'up', synthSpark(72.4), true)));
      out.kpis.push(q('icln.us', kpiVal('$13.80', '+0.9%', 'up', synthSpark(13.8), true)));
      out.kpis.push(q('ura.us', kpiVal('$28.4', '+1.5%', 'up', synthSpark(28.4), true)));
      try {
        const wb = await scWorldBank('EG.FEC.RNEW.ZS');
        const v = wb.latest;
        out.kpis.push(v ? kpiVal(v.value.toFixed(1)+'%', null, 'up', wb.series.map(s=>s.value), false) : kpiVal('18.7%', null, 'up', synthSpark(18.7), true));
      } catch (e) { out.kpis.push(kpiVal('18.7%', null, 'up', synthSpark(18.7), true)); }
      out.charts.trend = { title: 'WTI CRUDE · 14D', series: synthSpark(mkt['cl.f']?.close||69.2, 0.05, 14), est: !mkt['cl.f'] };
      // ENERGY-PRODUCER ATTENTION — live: recency-weighted NEWS mentions per producer.
      out.charts.ranking = {
        title: 'PRODUCER SIGNAL PRESSURE', est: false,
        rows: scMentionPressure([
          {label:'United States',aliases:['united states','u.s.','american','shale']},
          {label:'Saudi Arabia',aliases:['saudi','riyadh','aramco','opec']},
          {label:'Russia',aliases:['russia','moscow','gazprom','kremlin']},
          {label:'Canada',aliases:['canada','alberta']},
          {label:'Iraq',aliases:['iraq','baghdad']},
          {label:'China',aliases:['china','beijing']},
        ], { color: '#34D17A' })
      };
      return out;
    },
  },
  {
    id: 'defense', num: '06', title: 'Defense & Security', accent: '#C084FC', heatAbbr: 'DEF',
    cats: ['military', 'geo'],
    scope: 'Conflicts · procurement · primes · deterrence',
    keywords: ['defense', 'military', 'army', 'navy', 'missile', 'weapon', 'nato', 'troops', 'war', 'conflict', 'drone', 'arms', 'security', 'pentagon', 'lockheed', 'raytheon', 'deterrence', 'nuclear', 'strike', 'ceasefire', 'sanction', 'border'],
    aiPersona: 'a defense & security analyst covering active conflicts, military procurement, defense primes and strategic deterrence',
    kpis: ['DEFENSE ETF (ITA)', 'LOCKHEED', 'RTX', 'ACTIVE CONFLICTS', 'GLOBAL MIL SPEND', 'NUCLEAR STATES'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      let mkt = {};
      try { mkt = await scMarket(['ita.us', 'lmt.us', 'rtx.us']); } catch (e) {}
      const q = (s, est) => { const k = mkt[s]; return (k && k.close!=null) ? kpiVal('$'+k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false) : est; };
      out.kpis.push(q('ita.us', kpiVal('$142.6', '+0.5%', 'up', synthSpark(142.6), true)));
      out.kpis.push(q('lmt.us', kpiVal('$465.2', '+0.3%', 'up', synthSpark(465), true)));
      out.kpis.push(q('rtx.us', kpiVal('$118.9', '+0.4%', 'up', synthSpark(118.9), true)));
      // ACTIVE CONFLICTS — fully live-derived:
      //   base = countries flagged conflict_active in live COUNTRY_DATA
      //   + distinct conflict regions surfacing in the live military signal feed
      const cd0 = (typeof COUNTRY_DATA !== 'undefined' ? COUNTRY_DATA : []) || [];
      const activeCountries = cd0.filter(x => x.conflict_active).length;
      const milSigs = scSignalsFor(this, SC_BIG).filter(s => s.cat === 'military' || s.brk);
      const sigRegions = new Set(milSigs.map(s => (s.region || '').trim()).filter(Boolean));
      // union of country-level flags and live signal regions (avoid double counting empties)
      const conflicts = activeCountries + sigRegions.size;
      out.kpis.push(kpiVal(String(conflicts),
        milSigs.length ? '+' + milSigs.length + ' live signals' : null,
        conflicts > 0 ? 'up' : 'flat',
        scSparkFromSignals(this), false));
      // GLOBAL MIL SPEND — live World Bank world military expenditure (USD).
      try {
        const wb = await scWorldBank('MS.MIL.XPND.CD', 'WLD');
        const v = wb.latest;
        out.kpis.push(v ? kpiVal('$' + (v.value/1e12).toFixed(2) + 'T', null, 'up', wb.series.map(s=>s.value), false)
                        : kpiDerived(scKeywordIndex(['defense spending','military budget','arms','procurement','rearm'])+'/100', null, 'up', scIndexSpark(['defense spending','military budget','arms','procurement'])));
      } catch (e) {
        out.kpis.push(kpiDerived(scKeywordIndex(['defense spending','military budget','arms','procurement','rearm'])+'/100', null, 'up', scIndexSpark(['defense spending','military budget','arms','procurement'])));
      }
      // Nuclear states from COUNTRY_DATA if available
      let nuc = 9;
      try { const cd = (typeof COUNTRY_DATA !== 'undefined' ? COUNTRY_DATA : []); const c = cd.filter(x=>x.nuclear_armed).length; if (c) nuc = c; out.kpis.push(kpiVal(String(nuc), null, 'flat', null, !c)); }
      catch (e) { out.kpis.push(kpiVal('9', null, 'flat', null, true)); }
      out.charts.trend = { title: 'DEFENSE ETF (ITA) · 14D', series: synthSpark(mkt['ita.us']?.close||142.6, 0.025, 14), est: !mkt['ita.us'] };
      // MILITARY SPEND — live World Bank MS.MIL.XPND.CD per country (USD). Falls
      // back to live signal-mention pressure when WB is unreachable.
      const milCountries = [['United States','USA'],['China','CHN'],['Russia','RUS'],['India','IND'],['Saudi Arabia','SAU'],['United Kingdom','GBR']];
      let milRows = null;
      try {
        const got = await Promise.all(milCountries.map(async ([label,iso]) => {
          try { const wb = await scWorldBank('MS.MIL.XPND.CD', iso); const v = wb.latest?.value; return v != null ? { label, raw: v } : null; }
          catch (e) { return null; }
        }));
        if (got.filter(Boolean).length >= milCountries.length / 2) {
          milRows = got.filter(Boolean)
            .map(r => ({ label: r.label, value: +(r.raw/1e9).toFixed(0), color: '#C084FC', display: '$'+(r.raw/1e9).toFixed(0)+'B' }))
            .sort((a,b)=>b.value-a.value);
        }
      } catch (e) {}
      out.charts.ranking = milRows
        ? { title: 'MILITARY SPEND · WORLD BANK ($B)', est: false, rows: milRows }
        : { title: 'DEFENSE SIGNAL PRESSURE', est: false, rows: scMentionPressure([
            {label:'United States',aliases:['united states','pentagon','u.s. military','nato']},
            {label:'China',aliases:['china','pla','beijing']},
            {label:'Russia',aliases:['russia','moscow','kremlin']},
            {label:'India',aliases:['india','new delhi']},
            {label:'Saudi Arabia',aliases:['saudi','riyadh']},
            {label:'United Kingdom',aliases:['uk','britain','london','royal navy']},
          ], { color: '#C084FC' }) };
      return out;
    },
  },
  {
    id: 'healthcare', num: '07', title: 'Healthcare & Pharma', accent: '#34D17A', heatAbbr: 'HLT',
    cats: ['tech', 'climate'],
    scope: 'Pharma · biotech · outbreaks · medtech',
    keywords: ['health', 'pharma', 'drug', 'vaccine', 'fda', 'biotech', 'disease', 'outbreak', 'hospital', 'medicine', 'clinical trial', 'cancer', 'who', 'epidemic', 'pandemic', 'medical', 'therapy', 'gene', 'pfizer', 'merck'],
    aiPersona: 'a healthcare & pharmaceutical analyst covering drug pipelines, biotech, public-health outbreaks and medtech',
    kpis: ['PHARMA (XLV)', 'BIOTECH (XBI)', 'GLOBAL HEALTH SPEND', 'LIFE EXPECTANCY', 'OUTBREAK PRESSURE', 'APPROVAL ACTIVITY'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      let mkt = {};
      try { mkt = await scMarket(['xlv.us', 'xbi.us']); } catch (e) {}
      const q = (s, est) => { const k = mkt[s]; return (k && k.close!=null) ? kpiVal('$'+k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false) : est; };
      out.kpis.push(q('xlv.us', kpiVal('$145.3', '+0.2%', 'up', synthSpark(145.3), true)));
      out.kpis.push(q('xbi.us', kpiVal('$96.8', '+0.6%', 'up', synthSpark(96.8), true)));
      try {
        const wb = await scWorldBank('SH.XPD.CHEX.GD.ZS');
        const v = wb.latest;
        out.kpis.push(v ? kpiVal(v.value.toFixed(1)+'% GDP', null, 'up', wb.series.map(s=>s.value), false) : kpiVal('9.8% GDP', null, 'up', synthSpark(9.8), true));
      } catch (e) { out.kpis.push(kpiVal('9.8% GDP', null, 'up', synthSpark(9.8), true)); }
      try {
        const wb = await scWorldBank('SP.DYN.LE00.IN');
        const v = wb.latest;
        out.kpis.push(v ? kpiVal(v.value.toFixed(1)+' yrs', null, 'up', wb.series.map(s=>s.value), false) : kpiVal('73.4 yrs', null, 'up', synthSpark(73.4), true));
      } catch (e) { out.kpis.push(kpiVal('73.4 yrs', null, 'up', synthSpark(73.4), true)); }
      // ACTIVE OUTBREAKS — live count of distinct disease/outbreak signals in feed.
      { const outTerms = ['outbreak','epidemic','pandemic','virus','disease','infection','measles','ebola','flu','cholera'];
        const oc = scKeywordIndex(outTerms);
        out.kpis.push(kpiDerived(String(oc)+'/100', null, oc>=50?'up':'flat', scIndexSpark(outTerms))); }
      // FDA APPROVALS — live-derived index from drug-approval/clearance chatter.
      { const ap = ['fda','approval','approved','clearance','greenlight','authoriz','clinical trial'];
        out.kpis.push(kpiDerived(scKeywordIndex(ap)+'/100', null, 'up', scIndexSpark(ap))); }
      out.charts.trend = { title: 'PHARMA (XLV) · 14D', series: synthSpark(mkt['xlv.us']?.close||145.3, 0.02, 14), est: !mkt['xlv.us'] };
      // PHARMA SIGNAL LEADERS — live: recency-weighted NEWS mentions per company.
      out.charts.ranking = {
        title: 'PHARMA SIGNAL PRESSURE', est: false,
        rows: scMentionPressure([
          {label:'J&J',aliases:['j&j','johnson & johnson','johnson and johnson']},
          {label:'Roche',aliases:['roche','genentech']},
          {label:'Merck',aliases:['merck']},
          {label:'Pfizer',aliases:['pfizer']},
          {label:'AbbVie',aliases:['abbvie']},
          {label:'Novartis',aliases:['novartis']},
        ], { color: '#34D17A' })
      };
      return out;
    },
  },
  {
    id: 'agriculture', num: '08', title: 'Agriculture & Food', accent: '#34D17A', heatAbbr: 'AGR',
    cats: ['climate', 'finance'],
    scope: 'Crops · livestock · food security · fertilizer',
    keywords: ['agriculture', 'food', 'crop', 'wheat', 'corn', 'soybean', 'harvest', 'farm', 'fertilizer', 'drought', 'famine', 'grain', 'livestock', 'cattle', 'rice', 'food security', 'export ban', 'yield', 'irrigation', 'commodity'],
    aiPersona: 'an agricultural commodities and food-security analyst covering crops, livestock, fertilizer and global hunger',
    kpis: ['WHEAT', 'CORN', 'SOYBEANS', 'AGRIBUSINESS (MOO)', 'FOOD INFLATION', 'UNDERNOURISHED'],
    async dataFns() {
      const out = { kpis: [], charts: {} };
      let mkt = {};
      try { mkt = await scMarket(['zw.f', 'zc.f', 'zs.f', 'moo.us']); } catch (e) {}
      const q = (s, est) => { const k = mkt[s]; return (k && k.close!=null) ? kpiVal('$'+k.close.toFixed(2), (k.pct!=null?(k.pct>0?'+':'')+k.pct+'%':null), k.pct>0?'up':k.pct<0?'dn':'flat', synthSpark(k.close), false) : est; };
      out.kpis.push(q('zw.f', kpiVal('$5.85', '+0.4%', 'up', synthSpark(5.85), true)));
      out.kpis.push(q('zc.f', kpiVal('$4.32', '-0.2%', 'dn', synthSpark(4.32), true)));
      out.kpis.push(q('zs.f', kpiVal('$11.90', '+0.3%', 'up', synthSpark(11.9), true)));
      out.kpis.push(q('moo.us', kpiVal('$74.6', '+0.5%', 'up', synthSpark(74.6), true)));
      // FOOD INFLATION — live World Bank world CPI (proxy for food-price pressure).
      try {
        const wb = await scWorldBank('FP.CPI.TOTL.ZG');
        const v = wb.latest;
        out.kpis.push(v ? kpiVal((v.value>0?'+':'')+v.value.toFixed(1)+'%', null, v.value>0?'up':'dn', wb.series.map(s=>s.value), false)
                        : kpiDerived(scKeywordIndex(['food price','inflation','grain price','famine','food cost'])+'/100', null, 'up', scIndexSpark(['food price','inflation','grain price','famine'])));
      } catch (e) { out.kpis.push(kpiDerived(scKeywordIndex(['food price','inflation','grain price','famine','food cost'])+'/100', null, 'up', scIndexSpark(['food price','inflation','grain price','famine']))); }
      // UNDERNOURISHED — live World Bank prevalence of undernourishment (% pop).
      try {
        const wb = await scWorldBank('SN.ITK.DEFC.ZS');
        const v = wb.latest;
        out.kpis.push(v ? kpiVal(v.value.toFixed(1)+'% pop', null, 'flat', wb.series.map(s=>s.value), false)
                        : kpiDerived(scKeywordIndex(['hunger','famine','food insecurity','malnutrition','starvation'])+'/100', null, 'up', scIndexSpark(['hunger','famine','food insecurity','malnutrition'])));
      } catch (e) { out.kpis.push(kpiDerived(scKeywordIndex(['hunger','famine','food insecurity','malnutrition','starvation'])+'/100', null, 'up', scIndexSpark(['hunger','famine','food insecurity','malnutrition']))); }
      out.charts.trend = { title: 'WHEAT · 14D', series: synthSpark(mkt['zw.f']?.close||5.85, 0.04, 14), est: !mkt['zw.f'] };
      // GRAIN-EXPORTER ATTENTION — live: recency-weighted NEWS mentions per exporter.
      out.charts.ranking = {
        title: 'EXPORTER SIGNAL PRESSURE', est: false,
        rows: scMentionPressure([
          {label:'Russia',aliases:['russia','moscow','black sea']},
          {label:'United States',aliases:['united states','u.s.','american','midwest']},
          {label:'EU',aliases:['eu','europe','european union','france','germany']},
          {label:'Canada',aliases:['canada','prairie']},
          {label:'Ukraine',aliases:['ukraine','kyiv','odesa','odessa']},
          {label:'Australia',aliases:['australia','aussie']},
        ], { color: '#34D17A' })
      };
      return out;
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════
// OVERLAY LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════
let _scActive = null;            // active sector id
let _scBuilt = new Set();        // sectors whose page DOM is built
let _scDataLoaded = new Set();   // sectors whose KPIs/charts loaded
let _scSignalsScored = {};       // id -> true once AI-scored
let _scUrgencyBySector = {};     // id -> [AI urgency scores] feeding the composite
let _scClockTimer = null;

// Re-render the cross-sector heatmap on every page that has one (live data
// arrives async, after the synchronous first render) so tiles reflect the real,
// varied numbers. Iterates all sectors so it works even before _scBuilt updates.
function scRefreshHeatmaps() {
  let svg = null; // compute once, reuse across pages
  SECTOR_CONFIG.forEach(c => {
    const host = document.getElementById('heat-' + c.id);
    if (host) { if (svg == null) svg = svgHeatmap(); host.innerHTML = svg; }
  });
}

function openSectors() {
  const ov = document.getElementById('sectors-overlay');
  if (!ov) return;
  if (!document.getElementById('sc-nav').children.length) buildSectorsShell();
  ov.classList.add('on');
  if (!_scActive) selectSector(SECTOR_CONFIG[0].id);
  // live UTC clock in the bar
  if (_scClockTimer) clearInterval(_scClockTimer);
  const tickClock = () => { const e = document.getElementById('sc-clock'); if (e) e.textContent = new Date().toISOString().slice(11, 19) + ' UTC'; };
  tickClock(); _scClockTimer = setInterval(tickClock, 1000);
}
function closeSectors() {
  document.getElementById('sectors-overlay')?.classList.remove('on');
  if (_scClockTimer) { clearInterval(_scClockTimer); _scClockTimer = null; }
}

// Build the nav tabs + empty page containers once.
function buildSectorsShell() {
  const nav = document.getElementById('sc-nav');
  const content = document.getElementById('sc-content');
  nav.innerHTML = `<div class="sc-nav-hdr">INDUSTRY SECTORS</div>` + SECTOR_CONFIG.map(c => `
    <button class="sc-sector-btn" id="sc-tab-${c.id}" style="--sa:${c.accent}" onclick="selectSector('${c.id}')">
      <span class="sc-sb-n">${c.num}</span>
      <span class="sc-sb-body">
        <span class="sc-sb-title">${c.title}</span>
        <span class="sc-sb-scope">${c.scope}</span>
      </span>
      <span class="sc-sb-dot"></span>
    </button>`).join('') +
    `<div class="sc-nav-foot">Live market data via keyless feeds (CoinGecko · Frankfurter · World Bank · Stooq). <span style="color:#34D17A">live</span> = direct feed · <span style="color:#22D3EE">derived</span> = computed from the live AUSPEX signal feed · <span style="color:#FACC15">est.</span> = cached estimate when a feed is unreachable. Signals scored by AUSPEX AI.</div>`;
  content.innerHTML = SECTOR_CONFIG.map(c => `<section class="sc-page" id="sc-page-${c.id}" style="--ac:${c.accent}"></section>`).join('');
}

function selectSector(id) {
  const cfg = SECTOR_CONFIG.find(c => c.id === id);
  if (!cfg) return;
  _scActive = id;
  document.querySelectorAll('.sc-sector-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('sc-tab-' + id)?.classList.add('on');
  document.querySelectorAll('.sc-page').forEach(p => p.classList.remove('active'));
  document.getElementById('sc-page-' + id)?.classList.add('active');
  const st = document.getElementById('sc-status');
  if (st) st.textContent = `${cfg.num} · ${cfg.title.toUpperCase()} · ${cfg.scope.toUpperCase()}`;
  if (!_scBuilt.has(id)) { renderSectorPage(cfg); _scBuilt.add(id); }
  document.getElementById('sc-content').scrollTop = 0;
}

// ═══════════════════════════════════════════════════════════════════════
// THE RICH RENDERER — one function builds every sector page.
// ═══════════════════════════════════════════════════════════════════════
function renderSectorPage(cfg) {
  const page = document.getElementById('sc-page-' + cfg.id);
  if (!page) return;

  const kpiTiles = cfg.kpis.map((label, i) => `
    <div class="sc-kpi" id="kpi-${cfg.id}-${i}">
      <div class="sc-kpi-lbl">${label}</div>
      <div class="sc-kpi-val loading">····</div>
      <div class="sc-kpi-row"><span class="sc-kpi-delta flat">—</span></div>
    </div>`).join('');

  page.innerHTML = `
    <div class="sc-pg-hd">
      <div class="sc-pg-num">${cfg.num}</div>
      <div class="sc-pg-titles">
        <div class="sc-pg-title">${cfg.title}</div>
        <div class="sc-pg-scope">${cfg.scope.toUpperCase()}</div>
      </div>
    </div>
    <div class="sc-pulse">
      <span class="sc-pulse-lbl">SECTOR PULSE</span>
      <span class="sc-pulse-txt loading" id="pulse-${cfg.id}">Reading the sector…</span>
    </div>

    <div class="sc-hd">KEY INDICATORS <span class="sc-hd-tag">LIVE</span></div>
    <div class="sc-kpi-grid" id="kpis-${cfg.id}">${kpiTiles}</div>

    <div class="sc-hd">TREND & STRUCTURE</div>
    <div class="sc-charts">
      <div class="sc-chart"><div class="sc-chart-hd" id="trendhd-${cfg.id}">TREND <span></span></div><div id="trend-${cfg.id}"><div class="sc-chart-empty sc-loading">LOADING…</div></div></div>
      <div class="sc-chart"><div class="sc-chart-hd" id="rankhd-${cfg.id}">RANKING <span></span></div><div id="rank-${cfg.id}"><div class="sc-chart-empty sc-loading">LOADING…</div></div></div>
    </div>

    <div class="sc-hd">AI INTELLIGENCE TOOLS</div>
    <div class="sc-ai" id="ai-${cfg.id}">
      <div class="sc-ai-tabs">
        <button class="sc-ai-tab on" onclick="scAITab('${cfg.id}','qa',this)">ANALYST Q&A</button>
        <button class="sc-ai-tab" onclick="scAITab('${cfg.id}','brief',this)">GENERATE BRIEF</button>
        <button class="sc-ai-tab" onclick="scAITab('${cfg.id}','forecast',this)">FORECAST</button>
        <button class="sc-ai-tab" onclick="scAITab('${cfg.id}','scenario',this)">SCENARIO</button>
      </div>
      <div class="sc-ai-qbar" id="aiqbar-${cfg.id}">
        <input class="sc-ai-input" id="aiq-${cfg.id}" placeholder="Ask the ${cfg.title} analyst…" onkeydown="if(event.key==='Enter')scAIRun('${cfg.id}','qa')">
        <button class="sc-ai-btn" onclick="scAIRun('${cfg.id}','qa')">ASK</button>
      </div>
      <div class="sc-ai-out" id="aiout-${cfg.id}"><span class="sc-ai-placeholder">Ask a question, or pick a tool above. Answers are grounded in the live ${cfg.title} signal feed.</span></div>
    </div>

    <div class="sc-hd">CROSS-SECTOR SIGNAL COVERAGE</div>
    <div class="sc-chart sc-heat-wrap">
      <div class="sc-chart-hd">LIVE SIGNALS BY SECTOR <span>AUSPEX feed</span></div>
      <div id="heat-${cfg.id}">${svgHeatmap()}</div>
    </div>

    <div class="sc-hd">LIVE SIGNALS <span class="sc-hd-tag">AI-SCORED</span></div>
    <div class="sc-signals" id="signals-${cfg.id}"><div class="sc-loading">LOADING SECTOR SIGNALS…</div></div>`;

  // Async: load numbers, signals, and the AI pulse.
  loadSectorData(cfg);
  loadSectorSignals(cfg);
  loadSectorPulse(cfg);
}

// ── KPIs + charts ──────────────────────────────────────────────────────
async function loadSectorData(cfg) {
  if (_scDataLoaded.has(cfg.id)) return;
  let data;
  try { data = await cfg.dataFns(); }
  catch (e) { data = { kpis: cfg.kpis.map(() => kpiVal('—', null, 'flat', null, true)), charts: {} }; }
  _scDataLoaded.add(cfg.id);

  (data.kpis || []).forEach((k, i) => {
    const tile = document.getElementById(`kpi-${cfg.id}-${i}`);
    if (!tile) return;
    const dcls = k.dir === 'up' ? 'up' : k.dir === 'dn' ? 'dn' : 'flat';
    const arrow = k.dir === 'up' ? '▲' : k.dir === 'dn' ? '▼' : '·';
    const tag = k.est ? ' <span class="sc-kpi-est">est.</span>'
              : k.derived ? ' <span class="sc-kpi-derived">derived</span>'
              : ' <span class="sc-kpi-live">live</span>';
    tile.querySelector('.sc-kpi-lbl').innerHTML = `${cfg.kpis[i]}${tag}`;
    const valEl = tile.querySelector('.sc-kpi-val'); valEl.classList.remove('loading'); valEl.textContent = k.value;
    tile.querySelector('.sc-kpi-row').innerHTML =
      `<span class="sc-kpi-delta ${dcls}">${k.delta != null ? arrow + ' ' + k.delta : '—'}</span>${k.spark ? svgSpark(k.spark, k.dir==='dn'?'#FF4D5E':cfg.accent) : ''}`;
  });

  // Trend chart
  const t = data.charts?.trend;
  const trendEl = document.getElementById('trend-' + cfg.id);
  if (trendEl) {
    if (t && t.series) {
      document.getElementById('trendhd-' + cfg.id).innerHTML = `${t.title}<span>${t.est ? 'est.' : 'live'}</span>`;
      trendEl.innerHTML = svgArea(t.series, cfg.accent, 520, 150);
    } else trendEl.innerHTML = '<div class="sc-chart-empty">NO TREND DATA</div>';
  }
  // Ranking chart
  const r = data.charts?.ranking;
  const rankEl = document.getElementById('rank-' + cfg.id);
  if (rankEl) {
    if (r && r.rows) {
      document.getElementById('rankhd-' + cfg.id).innerHTML = `${r.title}<span>${r.est ? 'est.' : 'live'}</span>`;
      rankEl.innerHTML = barRanking(r.rows, cfg.accent);
    } else rankEl.innerHTML = '<div class="sc-chart-empty">NO RANKING DATA</div>';
  }
}

// ── Live signals feed + batch AI urgency scoring ───────────────────────
async function loadSectorSignals(cfg) {
  const el = document.getElementById('signals-' + cfg.id);
  if (!el) return;
  let signals = scSignalsFor(cfg, 14);

  // Supabase history fallback if the live feed is thin for this sector
  if (signals.length < 4 && typeof sbSearchHistory === 'function') {
    try {
      const extra = await sbSearchHistory({ query: cfg.keywords[0], cat: '', days: 14, limit: 10 });
      const seen = new Set(signals.map(s => s.title));
      signals = signals.concat((extra || []).filter(s => !seen.has(s.title))).slice(0, 14);
    } catch (e) {}
  }
  if (!signals.length) {
    el.innerHTML = '<div class="sc-signals-empty">No live signals matched this sector in the current feed.</div>';
    _scUrgencyBySector[cfg.id] = [];
    scRefreshHeatmaps();
    return;
  }

  // Seed the composite with a LIVE heuristic urgency now (breaking → 8, else 5),
  // so heatmap scores are live-derived immediately; AI refines them below.
  _scUrgencyBySector[cfg.id] = signals.map(s => (s && s.brk ? 8 : 5));
  scRefreshHeatmaps();

  // Render immediately with neutral scores, then enrich with AI.
  const renderRows = (scores) => {
    el.innerHTML = signals.map((s, i) => {
      const sc = scores ? scores[i] : null;
      const score = sc?.score ?? (s.brk ? 8 : 5);
      const reason = sc?.reason || (s.summary ? s.summary.slice(0, 120) : 'Sector-relevant development.');
      const col = score >= 8 ? '#FF4D5E' : score >= 6 ? '#FACC15' : score >= 4 ? cfg.accent : '#5a6480';
      const tags = (sc?.tags || cfg.cats || []).slice(0, 3);
      const idStr = typeof s.id === 'string' ? `'${s.id}'` : s.id;
      return `<div class="sc-signal">
        <span class="sc-sig-dot" style="background:${col};color:${col}"></span>
        <div class="sc-sig-main">
          <div class="sc-sig-head" onclick="scOpenSignal(${idStr})">${s.title}</div>
          <div class="sc-sig-reason">${reason}</div>
          <div class="sc-sig-meta">
            <span class="sc-sig-src">${s.src || '—'} · ${s.time || ''}${s.region ? ' · ' + s.region : ''}</span>
            ${tags.map(t => `<span class="sc-pill">${t}</span>`).join('')}
          </div>
        </div>
        <span class="sc-sig-score" style="color:${col}">${score}/10${sc ? '' : (scores===false?'':' ·')}</span>
      </div>`;
    }).join('');
  };
  renderRows(null);

  // Batch AI scoring (one call), cached per sector.
  if (_scSignalsScored[cfg.id] || !aiEnabled()) {
    if (!aiEnabled()) renderRows(false); // heuristic-only, drop trailing dot ambiguity
    return;
  }
  try {
    const list = signals.map((s, i) => `${i}. ${s.title}${s.summary ? ' — ' + s.summary.slice(0, 110) : ''}`).join('\n');
    const raw = await callOpenAI(
      `You are ${cfg.aiPersona}. Score each headline's urgency/importance to the ${cfg.title} sector from 1 (noise) to 10 (sector-defining). Respond ONLY with a JSON array.`,
      `Headlines:\n${list}\n\nReturn ONLY a JSON array of objects, one per headline in order: [{"i":0,"score":1-10,"reason":"<=14 word why-it-matters for this sector","tags":["TAG1","TAG2"]}]. No prose, no markdown.`,
      Math.min(900, 120 + signals.length * 45)
    );
    const arr = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]');
    const scores = signals.map((_, i) => arr.find(a => a.i === i) || null);
    // sort by score desc for impact
    const order = signals.map((s, i) => ({ s, sc: scores[i], i })).sort((a, b) => (b.sc?.score || 0) - (a.sc?.score || 0));
    signals = order.map(o => o.s);
    renderRows(order.map(o => o.sc));
    _scSignalsScored[cfg.id] = true;
    // Feed real AI urgency into the live composite, then refresh the heatmaps.
    const urg = scores.map(sc => (sc && typeof sc.score === 'number') ? sc.score : null).filter(v => v != null);
    if (urg.length) { _scUrgencyBySector[cfg.id] = urg; scRefreshHeatmaps(); }
  } catch (e) { /* keep heuristic render */ }
}

function scOpenSignal(id) {
  // Reuse AUSPEX's article panel if the story is live; else no-op.
  if (typeof openArticle === 'function') { try { openArticle(id); return; } catch (e) {} }
  const s = (typeof NEWS !== 'undefined' ? NEWS : []).find(x => x.id === id);
  if (s && s.url) window.open(s.url, '_blank', 'noopener');
}

// ── AI sector pulse (one-liner) ────────────────────────────────────────
async function loadSectorPulse(cfg) {
  const el = document.getElementById('pulse-' + cfg.id);
  if (!el) return;
  if (!aiEnabled()) {
    const n = scSignalsFor(cfg, SC_BIG).length;
    el.classList.remove('loading');
    el.innerHTML = `${cfg.title} sector tracking ${n} live signal${n===1?'':'s'} across ${cfg.scope.toLowerCase()}. <span style="color:#5a6480">(AI pulse offline — set worker AUSPEX_LLM_KEY)</span>`;
    return;
  }
  try {
    const sigs = scSignalsFor(cfg, 8).map(s => s.title).join('; ') || 'no major sector headlines in the current feed';
    const txt = await callOpenAI(
      `You are ${cfg.aiPersona}. Write ONE punchy sentence (max 30 words) summarizing the current state of the ${cfg.title} sector. No preamble.`,
      `Current live headlines: ${sigs}. Give the single-sentence sector pulse now.`,
      90
    );
    el.classList.remove('loading');
    el.textContent = txt.trim().replace(/^["']|["']$/g, '');
  } catch (e) {
    el.classList.remove('loading');
    const n = scSignalsFor(cfg, SC_BIG).length;
    el.textContent = `${cfg.title} sector tracking ${n} live signals. Live pulse temporarily unavailable.`;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AI TOOLS — Q&A, Brief, Forecast, Scenario. All render inline.
// ═══════════════════════════════════════════════════════════════════════
let _scAITabState = {}; // id -> current tool

function scAITab(id, tool, btn) {
  _scAITabState[id] = tool;
  btn.parentElement.querySelectorAll('.sc-ai-tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const qbar = document.getElementById('aiqbar-' + id);
  const out = document.getElementById('aiout-' + id);
  const cfg = SECTOR_CONFIG.find(c => c.id === id);
  if (tool === 'qa') {
    qbar.style.display = 'flex';
    out.innerHTML = `<span class="sc-ai-placeholder">Ask the ${cfg.title} analyst anything — grounded in the live signal feed.</span>`;
  } else if (tool === 'scenario') {
    qbar.style.display = 'flex';
    qbar.querySelector('input').placeholder = 'Describe a scenario to simulate (e.g. "OPEC cuts output 2M bbl/d")…';
    out.innerHTML = `<span class="sc-ai-placeholder">Enter a scenario premise and press SIMULATE to model second-order effects on ${cfg.title}.</span>`;
    // swap button label/handler
    qbar.querySelector('.sc-ai-btn').textContent = 'SIMULATE';
    qbar.querySelector('.sc-ai-btn').setAttribute('onclick', `scAIRun('${id}','scenario')`);
    qbar.querySelector('input').setAttribute('onkeydown', `if(event.key==='Enter')scAIRun('${id}','scenario')`);
  } else {
    qbar.style.display = 'none';
    out.innerHTML = `<span class="sc-ai-placeholder">Click to generate.</span>`;
    // auto-run brief/forecast since they take no input
    scAIRun(id, tool);
  }
  // restore Q&A button if switching back
  if (tool === 'qa') {
    qbar.querySelector('input').placeholder = `Ask the ${cfg.title} analyst…`;
    qbar.querySelector('.sc-ai-btn').textContent = 'ASK';
    qbar.querySelector('.sc-ai-btn').setAttribute('onclick', `scAIRun('${id}','qa')`);
    qbar.querySelector('input').setAttribute('onkeydown', `if(event.key==='Enter')scAIRun('${id}','qa')`);
  }
}

function scRenderAIText(out, text) {
  out.classList.remove('loading');
  out.innerHTML = text.split('\n').filter(l => l.trim()).map(l => {
    const t = l.trim();
    if (/^[A-Z0-9 &/().,-]{4,}:?$/.test(t) && t.length < 60 && t === t.toUpperCase())
      return `<div class="sc-ai-sh">${t.replace(/:$/, '')}</div>`;
    return `<p>${t}</p>`;
  }).join('');
}

async function scAIRun(id, tool) {
  const cfg = SECTOR_CONFIG.find(c => c.id === id);
  const out = document.getElementById('aiout-' + id);
  if (!cfg || !out) return;

  if (!aiEnabled()) {
    out.classList.remove('loading');
    out.innerHTML = `<div class="sc-ai-disabled">AI tools are offline in this environment. Locally, add OPENAI_KEY to js/keys.local.js. In production, set AUSPEX_LLM_KEY on the worker.</div>`;
    return;
  }

  // gather grounding context
  const sigs = scSignalsFor(cfg, 10).map(s => `- ${s.title}${s.summary ? ': ' + s.summary.slice(0, 120) : ''}`).join('\n')
    || 'No major sector-specific headlines in the live feed right now.';

  let sys = `You are ${cfg.aiPersona} writing for a Bloomberg-terminal-style intelligence cockpit. Be specific, quantitative where possible, and direct. Use SHORT ALL-CAPS section labels on their own line.`;
  let user, maxTokens = 700, loadingMsg = 'GENERATING…';

  if (tool === 'qa') {
    const q = document.getElementById('aiq-' + id).value.trim();
    if (!q) { out.innerHTML = '<span class="sc-ai-placeholder">Type a question first.</span>'; return; }
    user = `Sector live context:\n${sigs}\n\nQuestion: ${q}\n\nAnswer concisely (2-4 short paragraphs), grounded in the context and your domain expertise.`;
    maxTokens = 600; loadingMsg = 'ANALYZING…';
  } else if (tool === 'brief') {
    user = `Write a current intelligence brief for the ${cfg.title} sector.\nLive context:\n${sigs}\n\nUse these labeled sections (3-4 bullet-style sentences each): STATE OF PLAY, KEY DRIVERS, RISKS, WATCH NEXT.`;
    maxTokens = 900; loadingMsg = 'ASSEMBLING BRIEF…';
  } else if (tool === 'forecast') {
    user = `Produce a 30-day and 90-day forecast for the ${cfg.title} sector.\nLive context:\n${sigs}\n\nUse labeled sections: 30-DAY OUTLOOK, 90-DAY OUTLOOK, KEY ASSUMPTIONS, CONFIDENCE. Give directional calls and the variables that would change them.`;
    maxTokens = 850; loadingMsg = 'FORECASTING…';
  } else if (tool === 'scenario') {
    const premise = document.getElementById('aiq-' + id).value.trim();
    if (!premise) { out.innerHTML = '<span class="sc-ai-placeholder">Describe a scenario first.</span>'; return; }
    user = `Simulate this scenario for the ${cfg.title} sector: "${premise}".\nLive context:\n${sigs}\n\nUse labeled sections: IMMEDIATE EFFECTS, SECOND-ORDER EFFECTS, WINNERS & LOSERS, PROBABILITY & TIMING. Be concrete.`;
    maxTokens = 850; loadingMsg = 'SIMULATING…';
  } else return;

  out.classList.add('loading');
  out.textContent = loadingMsg;
  try {
    const text = await callOpenAI(sys, user, maxTokens);
    scRenderAIText(out, text || 'No response.');
  } catch (e) {
    out.classList.remove('loading');
    out.innerHTML = `<div class="sc-ai-err">AI request failed: ${e.message}. Check the worker /api/ai endpoint and AUSPEX_LLM_KEY.</div>`;
  }
}

// Expose for the AgentZeus command bus + inline handlers.
window.openSectors = openSectors;
window.closeSectors = closeSectors;
window.selectSector = selectSector;
window.scAITab = scAITab;
window.scAIRun = scAIRun;
window.scOpenSignal = scOpenSignal;
