import { normalizeGDACSItem } from '../../src/normalize.js';
const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Orange,Red&limit=50';
export async function fetchGDACSEvents() {
  try {
    const r = await fetch(GDACS_URL, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`GDACS HTTP ${r.status}`);
    const d = await r.json();
    const features = d.features ?? d.events ?? [];
    return features.map(normalizeGDACSItem);
  } catch (e) {
    console.warn('[AUSPEX worker] GDACS degrade:', e.message);
    return [];
  }
}
