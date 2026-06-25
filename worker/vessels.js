// ═══════════════════════════════════════════
// AUSPEX · LIVE AIS VESSELS
// Real ship positions from aisstream.io (the only free, near-global live AIS
// feed). aisstream is WebSocket-only and CORS-blocks browsers, so the key
// (AISSTREAM_API_KEY) lives server-side: we open one short stream per refresh
// window, merge ship positions with static (name/type) data, drop any position
// that falls inland, and return a clean snapshot. Edge-cached by the caller so
// aisstream sees ~one connection per window no matter how many visitors watch.
//
// Vessel visuals/categories/land-avoidance are ported 1:1 from the Flexport
// dashboard's vessel implementation.
// ═══════════════════════════════════════════

// Prefer Node's built-in global WebSocket (Node 22+/Vercel Node 24); fall back
// to the `ws` package on older local runtimes. Both expose the browser-style
// onopen/onmessage API we use below.
async function getWS() {
  if (typeof globalThis.WebSocket !== 'undefined') return globalThis.WebSocket;
  const mod = await import('ws');
  return mod.default;
}

// ── Land-avoidance — ported from Flexport's isInland() bounding-box blocklist.
// Any AIS fix inside one of these interior-continent boxes is dropped, so a
// vessel never renders on land (AIS occasionally reports parked/inland/glitched
// positions). Allows all coast/port zones and open ocean.
const LAND_BLOCKS = [
  { latMin: -30, latMax: 15,  lngMin: 10,   lngMax: 40  }, // interior Africa (south)
  { latMin: 5,   latMax: 35,  lngMin: -10,  lngMax: 30  }, // interior Africa (Sahara)
  { latMin: -25, latMax: 5,   lngMin: -65,  lngMax: -40 }, // interior South America
  { latMin: 30,  latMax: 50,  lngMin: -110, lngMax: -80 }, // interior North America
  { latMin: -35, latMax: -20, lngMin: 125,  lngMax: 148 }, // interior Australia
  { latMin: 30,  latMax: 55,  lngMin: 55,   lngMax: 110 }, // interior Central Asia
  { latMin: 55,  latMax: 72,  lngMin: 60,   lngMax: 140 }, // interior Russia / Siberia
];
function isInland(lat, lng) {
  for (const b of LAND_BLOCKS) {
    if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) return true;
  }
  return false;
}

// AIS ship Type code → AUSPEX vessel category (the frontend maps these to the
// Flexport colours: tanker=orange, cargo=cyan, utility=violet, passenger=blue).
function vesselCategory(type) {
  const t = +type || 0;
  if (t >= 80 && t <= 89) return 'tanker';
  if (t >= 70 && t <= 79) return 'cargo';
  if (t >= 60 && t <= 69) return 'passenger';
  if (t >= 40 && t <= 49) return 'hsc';
  if (t === 52 || t === 31 || t === 32) return 'tug';
  if (t === 30 || (t >= 33 && t <= 37)) return 'fishing';
  return 'other';
}

// Static (name / type / callsign / destination) is broadcast far less often than
// position, so we keep a best-effort cache across warm invocations to enrich
// vessels that only sent a PositionReport this window.
const _staticCache = new Map(); // mmsi -> { name, type, callsign, destination, at }
const STATIC_TTL = 6 * 60 * 60 * 1000; // 6h

function _pruneStatic(now) {
  if (_staticCache.size < 60000) return;
  for (const [k, v] of _staticCache) if (now - v.at > STATIC_TTL) _staticCache.delete(k);
}

// Open one short aisstream window and return a deduped vessel snapshot.
export async function fetchVessels(limit = 2500, collectMs = 6000) {
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) { console.warn('[vessels] AISSTREAM_API_KEY not set'); return []; }

  const WS = await getWS();
  let _msgs = 0, _opened = false, _err = null, _closed = null;
  const positions = new Map(); // mmsi -> { lat, lng, sog, cog, heading }
  const now = Date.now();

  await new Promise((resolve) => {
    let done = false;
    let ws;
    const finish = () => {
      if (done) return; done = true;
      try { ws && ws.close(); } catch {}
      resolve();
    };
    const timer = setTimeout(finish, collectMs);

    try { ws = new WS('wss://stream.aisstream.io/v0/stream'); }
    catch { clearTimeout(timer); return finish(); }
    // aisstream sends binary frames; ask for ArrayBuffer so we can decode them
    // synchronously (undici's WebSocket would otherwise hand back a Blob).
    try { ws.binaryType = 'arraybuffer'; } catch {}

    ws.onopen = () => {
      _opened = true;
      try {
        ws.send(JSON.stringify({
          APIKey: key,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
        }));
      } catch { finish(); }
    };
    ws.onerror = (e) => { _err = (e && (e.message || e.error)) || 'err'; finish(); };
    ws.onclose = (e) => { _closed = (e && e.code) || 'closed'; clearTimeout(timer); finish(); };
    ws.onmessage = (ev) => {
      _msgs++;
      try {
        let data = ev.data;
        if (typeof data !== 'string') {
          if (data instanceof ArrayBuffer) data = new TextDecoder().decode(data);
          else if (data && typeof data.byteLength === 'number') data = new TextDecoder().decode(data); // Buffer / TypedArray
          else if (data && typeof data.toString === 'function') data = data.toString();
        }
        const msg = JSON.parse(data);
        const mmsi = msg.MetaData && msg.MetaData.MMSI;
        if (!mmsi) return;
        const pos = msg.Message && msg.Message.PositionReport;
        const stat = msg.Message && msg.Message.ShipStaticData;
        if (pos && pos.Latitude != null && pos.Longitude != null) {
          positions.set(mmsi, {
            lat: pos.Latitude, lng: pos.Longitude,
            sog: pos.Sog, cog: pos.Cog,
            heading: (pos.TrueHeading != null && pos.TrueHeading < 511) ? pos.TrueHeading : pos.Cog,
            name: (msg.MetaData.ShipName || '').trim() || undefined,
          });
        }
        if (stat) {
          _staticCache.set(mmsi, {
            name: (stat.Name || '').trim() || undefined,
            type: stat.Type,
            callsign: (stat.CallSign || '').trim() || undefined,
            destination: (stat.Destination || '').trim() || undefined,
            at: now,
          });
        }
      } catch {}
    };
  });

  _pruneStatic(now);
  console.log(`[vessels] opened=${_opened} msgs=${_msgs} positions=${positions.size} closed=${_closed} err=${_err || 'none'}`);

  const out = [];
  for (const [mmsi, p] of positions) {
    if (p.lat == null || p.lng == null) continue;
    if (isInland(p.lat, p.lng)) continue; // never on land
    const s = _staticCache.get(mmsi) || {};
    out.push({
      mmsi,
      name: s.name || p.name || null,
      lat: p.lat, lng: p.lng,
      sog: p.sog != null ? +p.sog : null,
      cog: p.cog != null ? +p.cog : null,
      heading: p.heading != null ? +p.heading : (p.cog != null ? +p.cog : 0),
      type: s.type != null ? s.type : null,
      category: vesselCategory(s.type),
      callsign: s.callsign || null,
      destination: s.destination || null,
      _type: 'vessel',
    });
    if (out.length >= limit) break;
  }
  return out;
}
