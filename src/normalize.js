// src/normalize.js — pure, no I/O, no globals
import { quakeMagnitudeToSeverity, severityToBand } from './severity.js';
export function normalizeUSGSFeature(f) {
  const mag = f.properties.mag ?? 0;
  const severity = quakeMagnitudeToSeverity(mag);
  const depth = f.geometry.coordinates[2];
  return {
    id: `usgs:${f.id}`, sense: 'disaster', type: 'earthquake', polarity: 'peril',
    title: `M${mag.toFixed(1)} earthquake`,
    lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
    metric: { label: 'magnitude', value: mag, band: severityToBand(severity) },
    severity, confidence: 'confirmed',
    occurredAt: new Date(f.properties.time).toISOString(),
    brief: `Magnitude ${mag.toFixed(1)} earthquake. Depth ${Math.round(depth)} km. ${f.properties.place}.`,
    sources: [{ name: 'USGS', url: `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}/executive` }],
    links: [], icon: 'earthquake',
  };
}
export function normalizeGDACSItem(item) {
  const p = item.properties ?? {};
  const severity = Math.min(1, Math.max(0, (p.alertscore ?? 0) / 100));
  const typeMap = { EQ: 'earthquake', TC: 'cyclone', FL: 'flood', VO: 'volcano', DR: 'drought', WF: 'fire' };
  const type = typeMap[p.eventtype] ?? 'disaster';
  const coords = item.geometry?.coordinates ?? [0, 0];
  return {
    id: `gdacs:${p.eventid ?? `${type}-${coords[0]}-${coords[1]}`}`,
    sense: 'disaster', type, polarity: 'peril',
    title: p.name ?? 'GDACS event',
    lat: coords[1] ?? 0, lng: coords[0] ?? 0,
    metric: { label: 'alert', value: p.alertscore ?? 0, band: severity > 0.66 ? 'red' : severity > 0.33 ? 'orange' : 'green' },
    severity, confidence: 'confirmed',
    occurredAt: p.fromdate ?? new Date().toISOString(),
    brief: p.description ?? p.name ?? '',
    sources: [{ name: 'GDACS', url: p.url?.report ?? 'https://gdacs.org' }],
    links: [], icon: type,
  };
}
// Pure mapping: a Launch Library 2 (The Space Devs) launch → snapshot event.
// Returns null when the launch lacks a numeric pad lat/lng (unplaceable).
export function normalizeLaunch(launch) {
  if (!launch || !launch.id) return null;
  const lat = Number(launch.pad?.latitude);
  const lng = Number(launch.pad?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const provider = launch.launch_service_provider?.name || '';
  const rocket = launch.rocket?.configuration?.name || launch.rocket?.configuration?.full_name || '';
  const brief =
    launch.mission?.description ||
    [provider, rocket].filter(Boolean).join(' · ') ||
    launch.name || 'Orbital launch';
  return {
    id: `space:${launch.id}`,
    sense: 'space', type: 'launch', polarity: 'breakthrough',
    title: launch.name || 'Orbital launch',
    lat, lng,
    metric: { label: 'launch', value: provider, band: 'milestone' },
    severity: 0.6, confidence: 'confirmed',
    occurredAt: launch.net ? new Date(launch.net).toISOString() : new Date().toISOString(),
    brief,
    sources: [{ name: 'The Space Devs', url: launch.url || 'https://thespacedevs.com' }],
    links: [], icon: 'launch',
  };
}

// NASA EONET — global, keyless multi-hazard tracker (wildfires, severe storms /
// cyclones, volcanoes, floods, drought, …). Robust fallback so the disaster layer
// never collapses to earthquakes-only when GDACS is slow/down.
const EONET_TYPE = {
  wildfires: 'fire', severeStorms: 'cyclone', volcanoes: 'volcano',
  floods: 'flood', drought: 'drought', earthquakes: 'earthquake',
  landslides: 'disaster', dustHaze: 'disaster', tempExtremes: 'drought',
};
const EONET_SKIP = new Set(['seaLakeIce', 'snow', 'watercolor', 'manmade']);
const EONET_SEV = { cyclone: 0.72, volcano: 0.70, flood: 0.66, earthquake: 0.60, fire: 0.56, drought: 0.50, disaster: 0.50 };

export function normalizeEONETEvent(e) {
  if (!e) return null;
  const cat = e.categories && e.categories[0];
  const catId = cat && cat.id;
  if (!catId || EONET_SKIP.has(catId)) return null;
  const type = EONET_TYPE[catId] || 'disaster';
  const geoms = e.geometry || e.geometries || [];
  const g = geoms[geoms.length - 1];
  if (!g || !g.coordinates) return null;
  let lng, lat;
  if (g.type === 'Point') { lng = g.coordinates[0]; lat = g.coordinates[1]; }
  else { // Polygon/MultiPolygon → centroid of the first ring
    let ring = g.coordinates[0];
    while (Array.isArray(ring) && Array.isArray(ring[0]) && Array.isArray(ring[0][0])) ring = ring[0];
    if (!Array.isArray(ring) || !ring.length) return null;
    let sx = 0, sy = 0, n = 0;
    for (const p of ring) { if (Array.isArray(p) && p.length >= 2) { sx += p[0]; sy += p[1]; n++; } }
    if (!n) return null;
    lng = sx / n; lat = sy / n;
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const severity = EONET_SEV[type] ?? 0.5;
  const src = (e.sources && e.sources[0] && e.sources[0].url) || e.link || 'https://eonet.gsfc.nasa.gov';
  return {
    id: `eonet:${e.id}`,
    sense: 'disaster', type, polarity: 'peril',
    title: e.title || (cat.title || 'Natural event'),
    lat, lng,
    metric: { label: 'status', value: cat.title || '', band: severity > 0.66 ? 'red' : severity > 0.33 ? 'orange' : 'green' },
    severity, confidence: 'confirmed',
    occurredAt: g.date || new Date().toISOString(),
    brief: `${cat.title || 'Natural event'} — ${e.title || ''}`.trim(),
    sources: [{ name: 'NASA EONET', url: src }],
    links: [], icon: type,
  };
}

export function validateSnapshotEvent(e) {
  return (
    typeof e.id === 'string' && e.id.length > 0 &&
    typeof e.lat === 'number' && !Number.isNaN(e.lat) &&
    typeof e.lng === 'number' && !Number.isNaN(e.lng) &&
    typeof e.severity === 'number' && e.severity >= 0 && e.severity <= 1 &&
    (e.confidence === 'confirmed' || e.confidence === 'unconfirmed') &&
    typeof e.brief === 'string'
  );
}
