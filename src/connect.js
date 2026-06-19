// src/connect.js — pure connection reasoner, no I/O, no globals.
//
// HONEST connections only: a link means two real events are close in SPACE and
// TIME. We never claim causation. Cross-sense links (disaster ↔ space ↔ news…)
// are the interesting ones, so we prefer them, but very-close same-sense pairs
// still qualify. Output is kept deliberately sparse to avoid a cluttered web.

const MAX_DISTANCE_KM = 700;   // great-circle proximity threshold
const MAX_TIME_MS = 48 * 3600 * 1000; // 48 hours
const PER_EVENT_CAP = 2;       // each event keeps at most its 2 strongest links
const GLOBAL_PAIR_CAP = 24;    // at most ~24 distinct linked pairs worldwide

// Great-circle distance between two lat/lng points, in kilometres.
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius, km
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function eventTime(e) {
  const t = Date.parse(e?.occurredAt);
  return Number.isFinite(t) ? t : null;
}

function placeable(e) {
  return (
    e &&
    typeof e.id === 'string' &&
    typeof e.lat === 'number' && !Number.isNaN(e.lat) &&
    typeof e.lng === 'number' && !Number.isNaN(e.lng) &&
    eventTime(e) != null
  );
}

// computeLinks(events, opts) — returns the SAME events array, with each event's
// `links` array populated with the ids of related events (capped & deduped).
export function computeLinks(events, opts = {}) {
  if (!Array.isArray(events)) return events;
  const maxKm = opts.maxDistanceKm ?? MAX_DISTANCE_KM;
  const maxMs = opts.maxTimeMs ?? MAX_TIME_MS;
  const perEventCap = opts.perEventCap ?? PER_EVENT_CAP;
  const globalCap = opts.globalPairCap ?? GLOBAL_PAIR_CAP;

  // Reset every event's links so the function is idempotent.
  for (const e of events) if (e && typeof e === 'object') e.links = [];

  const usable = events.filter(placeable);

  // Score all candidate pairs. Lower score = stronger (closer in space & time).
  // We normalise distance and time to [0,1] of their thresholds, then add a
  // small reward for cross-sense pairs so they sort ahead of equally-close
  // same-sense pairs.
  const candidates = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i];
      const b = usable[j];
      const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
      if (dist > maxKm) continue;
      const dt = Math.abs(eventTime(a) - eventTime(b));
      if (dt > maxMs) continue;
      const crossSense = a.sense !== b.sense;
      const closeness = dist / maxKm + dt / maxMs; // 0 = identical, 2 = at edges
      const score = closeness - (crossSense ? 0.5 : 0); // prefer cross-sense
      candidates.push({ a, b, score, crossSense });
    }
  }
  candidates.sort((p, q) => p.score - q.score);

  // Greedily accept the strongest pairs while respecting the per-event and
  // global caps. linkCount tracks how many links each id already holds.
  const linkCount = new Map();
  const pairs = [];
  for (const c of candidates) {
    if (pairs.length >= globalCap) break;
    const ca = linkCount.get(c.a.id) ?? 0;
    const cb = linkCount.get(c.b.id) ?? 0;
    if (ca >= perEventCap || cb >= perEventCap) continue;
    c.a.links.push(c.b.id);
    c.b.links.push(c.a.id);
    linkCount.set(c.a.id, ca + 1);
    linkCount.set(c.b.id, cb + 1);
    pairs.push(c);
  }

  return events;
}

// linkedPairs(events) — deduped unordered pairs for the frontend to draw arcs.
// Each {aId,bId} appears once (no reversed duplicates). Derived from the links
// already on the events, so call after computeLinks (or it returns []).
export function linkedPairs(events) {
  if (!Array.isArray(events)) return [];
  const byId = new Map();
  for (const e of events) if (e && typeof e.id === 'string') byId.set(e.id, e);
  const seen = new Set();
  const out = [];
  for (const a of events) {
    if (!a || !Array.isArray(a.links)) continue;
    for (const bId of a.links) {
      const b = byId.get(bId);
      if (!b) continue;
      const key = a.id < bId ? `${a.id}|${bId}` : `${bId}|${a.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        aId: a.id, bId: b.id,
        aLat: a.lat, aLng: a.lng,
        bLat: b.lat, bLng: b.lng,
      });
    }
  }
  return out;
}
