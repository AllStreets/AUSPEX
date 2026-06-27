import { normalizeEONETEvent } from '../../src/normalize.js';

// NASA EONET v3 — free, keyless, global multi-hazard tracker. It 503s
// intermittently (then 200s on retry), so retry within a short total budget.
// This is the resilient backbone of the disaster layer alongside USGS + GDACS.
const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60&limit=200';
const UA = 'AUSPEX/1.0 (planetary commons; +https://github.com/AllStreets/AUSPEX)';

export async function fetchEONETEvents() {
  const deadline = Date.now() + 7500; // hard cap so the snapshot fn stays prompt
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 4 && Date.now() < deadline; attempt++) {
    try {
      const budget = Math.min(4500, deadline - Date.now());
      if (budget < 600) break;
      const r = await fetch(EONET_URL, { signal: AbortSignal.timeout(budget), headers: { 'User-Agent': UA } });
      if (r.status === 503 || r.status === 429 || r.status >= 500) throw new Error(`EONET ${r.status}`);
      if (!r.ok) throw new Error(`EONET HTTP ${r.status}`);
      const d = await r.json();
      const events = (d.events || []).map(normalizeEONETEvent).filter(Boolean);
      if (events.length) return events;
      throw new Error('EONET empty');
    } catch (e) {
      lastErr = e.message;
      if (Date.now() < deadline) await new Promise((res) => setTimeout(res, 350 * (attempt + 1)));
    }
  }
  console.warn('[AUSPEX] EONET degrade:', lastErr);
  return [];
}
