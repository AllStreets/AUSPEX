// ═══════════════════════════════════════════
// AUSPEX · LIVE ADS-B FLIGHTS
// Primary source: OpenSky /states/all — one request returns every tracked
// aircraft worldwide (~5,000+ airborne) with position, heading, altitude (m),
// speed (m/s) and origin country, already in the units the markers expect.
// Fallback: adsb.lol type fan-out (keyless) if OpenSky is unavailable/rate-
// limited. Each aircraft is classified military / cargo / passenger by callsign
// and ICAO hex block. Fetched server-side (neither API sends CORS headers) and
// edge-cached, so the upstream sees ~one request per cache window.
// ═══════════════════════════════════════════

// ── Classification ──────────────────────────────────────────────
const MIL_CALLSIGN = ['REACH', 'RCH', 'JAKE', 'DUKE', 'SPAR', 'MAGMA', 'IRON', 'VAPOR', 'PAT', 'SKILL', 'EVAC', 'COBRA', 'VIPER', 'RAPTOR', 'TALON', 'HAWK', 'EAGLE', 'GHOST', 'STORM', 'WOLF', 'NAVY', 'USAF', 'RRR', 'CFC', 'FAF', 'GAF', 'IAF', 'CHAOS', 'SLAM', 'HOBO', 'BLKCAT', 'QID', 'FORTE'];
// US military: AE0000–AFFFFF. UK military: 43C–43F. (Conservative — callsign is
// the stronger signal; these catch military with blank/anonymised callsigns.)
const MIL_ICAO = ['ae', 'af', '43c', '43d', '43e', '43f'];
const CARGO_CALLSIGN = ['UPS', 'FDX', 'GTI', 'CLX', 'NCA', 'ABX', 'ATN', 'PAC', 'BOX', 'CKS', 'GEC', 'DHL', 'BCS', 'TNT', 'CAO', 'YZR', 'RCF', 'MPH', 'CMB', 'GSS', 'BOX'];

function classify(callsign, icao) {
  const cs = (callsign || '').trim().toUpperCase();
  const ic = (icao || '').toLowerCase();
  if (MIL_CALLSIGN.some(p => cs.startsWith(p)) || MIL_ICAO.some(p => ic.startsWith(p))) return 'military';
  if (CARGO_CALLSIGN.some(p => cs.startsWith(p))) return 'cargo';
  return 'passenger';
}

// ── Primary: OpenSky /states/all ────────────────────────────────
async function fetchOpenSky(limit) {
  const headers = { 'User-Agent': 'AUSPEX/1.0 (planetary commons; +https://github.com/AllStreets/AUSPEX)' };
  // Optional registered credentials raise the rate limit; works anonymously too.
  const id = process.env.OPENSKY_ID, sec = process.env.OPENSKY_SEC;
  if (id && sec) headers.Authorization = 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let data;
  try {
    const r = await fetch('https://opensky-network.org/api/states/all', { signal: ctrl.signal, headers });
    if (!r.ok) return [];
    data = await r.json();
  } finally {
    clearTimeout(timer);
  }
  const states = Array.isArray(data && data.states) ? data.states : [];
  // Classify the WHOLE feed, then keep every military + cargo aircraft and fill
  // the rest with passenger up to the cap — so all three categories are visible
  // (military/cargo are rare; a blind first-N slice would bury them under pax).
  const mil = [], cargo = [], pax = [];
  for (const s of states) {
    const lng = s[5], lat = s[6], onGround = s[8], alt = s[7];
    if (lng == null || lat == null || onGround || (alt || 0) < 150) continue; // airborne only
    const callsign = (s[1] || '').trim();
    const f = {
      icao: s[0], callsign, country: s[2] || '',
      lat, lng,
      alt: +alt || 0,          // metres
      vel: +(s[9] || 0),       // m/s
      heading: +(s[10] || 0),  // degrees
      flightType: classify(callsign, s[0]),
      _type: 'flight',
    };
    (f.flightType === 'military' ? mil : f.flightType === 'cargo' ? cargo : pax).push(f);
  }
  return [...mil, ...cargo, ...pax].slice(0, limit);
}

// ── Fallback: adsb.lol type fan-out (keyless) ───────────────────
const ADSB_CARGO = ['B748', 'B77F', 'B744', 'MD11', 'IL76', 'C17'];
const ADSB_PAX = ['A320', 'A321', 'A319', 'A20N', 'B738', 'B739'];
const FEET_TO_M = 0.3048, KNOT_TO_MS = 0.514444;

async function fetchAdsbType(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    let data;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'AUSPEX/1.0 (+https://github.com/AllStreets/AUSPEX)' }, signal: ctrl.signal });
      if (!r.ok) return [];
      data = await r.json();
    } finally { clearTimeout(timer); }
    return Array.isArray(data && data.ac) ? data.ac : [];
  } catch { return []; }
}

async function fetchAdsbLol(limit) {
  const sources = [
    { url: 'https://api.adsb.lol/v2/mil', mil: true },
    ...ADSB_CARGO.map(t => ({ url: `https://api.adsb.lol/v2/type/${t}`, mil: false, cargo: true })),
    ...ADSB_PAX.map(t => ({ url: `https://api.adsb.lol/v2/type/${t}`, mil: false })),
  ];
  // Low concurrency — adsb.lol empties responses under burst.
  const results = [];
  for (let i = 0; i < sources.length; i += 2) {
    const batch = sources.slice(i, i + 2);
    results.push(...await Promise.all(batch.map(s => fetchAdsbType(s.url).then(ac => ({ ac, s })))));
    if (i + 2 < sources.length) await new Promise(r => setTimeout(r, 300));
  }
  const seen = new Map();
  for (const { ac, s } of results) {
    for (const a of ac) {
      if (!a || !a.hex || a.lat == null || a.lon == null) continue;
      if (typeof a.alt_baro !== 'number' || a.alt_baro < 500) continue;
      if (seen.has(a.hex)) continue;
      const ft = s.mil ? 'military' : s.cargo ? 'cargo' : classify(a.flight, a.hex);
      seen.set(a.hex, {
        icao: a.hex, callsign: (a.flight || '').trim(), country: a.r || '',
        lat: a.lat, lng: a.lon, alt: a.alt_baro * FEET_TO_M, vel: (a.gs || 0) * KNOT_TO_MS,
        heading: a.track || 0, flightType: ft, _type: 'flight',
      });
    }
  }
  return Array.from(seen.values()).slice(0, limit);
}

// Live aircraft — OpenSky first (bulk, fast), adsb.lol as fallback.
export async function fetchFlights(limit = 1000) {
  try {
    const os = await fetchOpenSky(limit);
    if (os.length >= 50) return os;
  } catch { /* fall through */ }
  try {
    return await fetchAdsbLol(limit);
  } catch {
    return [];
  }
}
