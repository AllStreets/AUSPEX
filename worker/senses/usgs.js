import { normalizeUSGSFeature } from '../../src/normalize.js';
const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';
export async function fetchUSGSEvents() {
  const r = await fetch(USGS_URL, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`USGS HTTP ${r.status}`);
  const d = await r.json();
  return d.features.map(normalizeUSGSFeature);
}
