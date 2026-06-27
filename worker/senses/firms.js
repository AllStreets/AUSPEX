// NASA FIRMS — VIIRS active-fire satellite detections. The ONLY truly global,
// high-resolution fire source (Africa, Australia, Siberia, Amazonia — the real
// fire regions, which US-only EONET and alert-only GDACS miss).
//
// Raw FIRMS returns tens of thousands of fire pixels/day — that would bury the
// globe. So we CLUSTER pixels into a coarse grid, aggregate radiative power per
// cluster, then keep a globally BALANCED, bounded set (round-robin across
// continents) so every fire region shows without any one dominating.
//
// Keyless degrade: no FIRMS_MAP_KEY → returns [] (the rest of the globe is fine).
const SOURCE = 'VIIRS_SNPP_NRT';
const UA = 'AUSPEX/1.0 (planetary commons; +https://github.com/AllStreets/AUSPEX)';
const CELL = 3;          // grid cell size in degrees (~330 km) — coarse on purpose
const MIN_FRP = 8;       // MW — ignore faint thermal anomalies / small ag burns
const PER_REGION = 7;    // max fire clusters per continent (fair global share)
const TOTAL_CAP = 40;    // hard ceiling on fire markers overall

// Coarse continent bucket for fair global distribution.
function regionOf(lat, lng) {
  if (lat >= -37 && lat <= 37 && lng >= -18 && lng <= 52) return 'africa';
  if (lat >= -50 && lat <= -10 && lng >= 110 && lng <= 180) return 'oceania';
  if (lat > 5 && lng >= 45 && lng <= 150) return 'asia';
  if (lat >= 12 && lng >= -170 && lng <= -50) return 'namerica';
  if (lat < 12 && lng >= -90 && lng <= -30) return 'samerica';
  if (lat > 37 && lng >= -12 && lng <= 60) return 'europe';
  return 'other';
}

// Parse FIRMS CSV by header name (robust to column reordering).
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map((h) => h.trim());
  const ix = (n) => head.indexOf(n);
  const iLat = ix('latitude'), iLng = ix('longitude'), iFrp = ix('frp');
  const iConf = ix('confidence'), iDate = ix('acq_date'), iTime = ix('acq_time');
  if (iLat < 0 || iLng < 0) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const lat = +c[iLat], lng = +c[iLng], frp = iFrp >= 0 ? +c[iFrp] : 0;
    const conf = iConf >= 0 ? (c[iConf] || '').trim() : 'n';
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (conf === 'l' || conf === 'low') continue;          // drop low-confidence
    if (Number.isFinite(frp) && frp < MIN_FRP) continue;   // drop faint heat
    rows.push({ lat, lng, frp: Number.isFinite(frp) ? frp : 0, date: c[iDate], time: c[iTime] });
  }
  return rows;
}

// FRP (total radiative power) → calm severity. Fires stay green/orange and never
// scream red — big complexes are notable, not alarming. Caps at orange.
function frpSeverity(sumFRP) {
  const s = 0.3 + Math.log10(sumFRP + 1) * 0.07;
  return Math.max(0.3, Math.min(0.62, s));
}

function acqISO(date, time) {
  if (!date) return new Date().toISOString();
  const t = String(time || '0').padStart(4, '0');
  return `${date}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z`;
}

function cluster(rows) {
  const cells = new Map();
  for (const r of rows) {
    const cy = Math.floor(r.lat / CELL), cx = Math.floor(r.lng / CELL);
    const key = `${cy}:${cx}`;
    let cell = cells.get(key);
    if (!cell) { cell = { sumFRP: 0, n: 0, wLat: 0, wLng: 0, latest: '' }; cells.set(key, cell); }
    const w = Math.max(r.frp, 1); // FRP-weighted centroid (anchor on the hot core)
    cell.sumFRP += r.frp; cell.n += 1; cell.wLat += r.lat * w; cell.wLng += r.lng * w;
    cell.tw = (cell.tw || 0) + w;
    const iso = acqISO(r.date, r.time);
    if (iso > cell.latest) cell.latest = iso;
  }
  const out = [];
  for (const [key, c] of cells) {
    const lat = c.wLat / c.tw, lng = c.wLng / c.tw;
    out.push({ key, lat, lng, sumFRP: c.sumFRP, n: c.n, latest: c.latest, region: regionOf(lat, lng) });
  }
  return out;
}

// Keep the strongest clusters but ROUND-ROBIN across continents so Africa's huge
// fire load can't claim every slot — every region with fire is represented.
function balance(clusters) {
  const byRegion = new Map();
  for (const c of clusters.sort((a, b) => b.sumFRP - a.sumFRP)) {
    if (!byRegion.has(c.region)) byRegion.set(c.region, []);
    byRegion.get(c.region).push(c);
  }
  const picked = [];
  for (let round = 0; round < PER_REGION && picked.length < TOTAL_CAP; round++) {
    for (const list of byRegion.values()) {
      if (list[round]) { picked.push(list[round]); if (picked.length >= TOTAL_CAP) break; }
    }
  }
  return picked;
}

function toEvent(c) {
  const severity = frpSeverity(c.sumFRP);
  return {
    id: `firms:${c.key}`,
    sense: 'disaster', type: 'fire', polarity: 'peril',
    title: 'Active fire cluster',
    lat: c.lat, lng: c.lng,
    metric: { label: 'detections', value: c.n, band: severity > 0.55 ? 'orange' : 'green' },
    severity, confidence: 'confirmed',
    occurredAt: c.latest || new Date().toISOString(),
    brief: `Active wildfire cluster — ${c.n} VIIRS detection${c.n === 1 ? '' : 's'} in the last 24h, ${Math.round(c.sumFRP)} MW total radiative power.`,
    sources: [{ name: 'NASA FIRMS (VIIRS)', url: 'https://firms.modaps.eosdis.nasa.gov/map/' }],
    links: [], icon: 'fire',
  };
}

export async function fetchFIRMSEvents() {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return []; // keyless degrade — no fire layer, rest of globe unaffected
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${SOURCE}/world/1`;
  const deadline = Date.now() + 9000;
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
    try {
      const budget = Math.min(7000, deadline - Date.now());
      if (budget < 800) break;
      const r = await fetch(url, { signal: AbortSignal.timeout(budget), headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`FIRMS HTTP ${r.status}`);
      const text = await r.text();
      // FIRMS returns an error string (not CSV) for a bad/over-quota key.
      if (/invalid|error|exceed/i.test(text.slice(0, 120)) && !text.includes('latitude')) {
        throw new Error(`FIRMS key/quota: ${text.slice(0, 80)}`);
      }
      const events = balance(cluster(parseCSV(text))).map(toEvent);
      return events; // may be [] legitimately (quiet fire day) — don't retry that
    } catch (e) {
      lastErr = e.message;
      if (Date.now() < deadline) await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
    }
  }
  console.warn('[AUSPEX] FIRMS degrade:', lastErr);
  return [];
}
