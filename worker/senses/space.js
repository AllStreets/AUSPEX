// ═══════════════════════════════════════════
// AUSPEX · SPACE SENSE — orbital launches as world PROGRESS
// The Space Devs Launch Library 2 (keyless, but rate-limited — fetch only at
// the poll cadence). Degrades to [] on any failure or rate-limit (HTTP 429).
// ═══════════════════════════════════════════
import { normalizeLaunch } from '../../src/normalize.js';

const LL2_URL =
  'https://ll.thespacedevs.com/2.2.0/launch/?limit=15&ordering=-net&mode=detailed';

export async function fetchSpaceEvents() {
  try {
    const r = await fetch(LL2_URL, {
      headers: { 'User-Agent': 'AUSPEX/1.0 (space sense)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      if (r.status === 429) console.warn('[AUSPEX worker] LL2 rate-limited (429); space degrade');
      else console.warn('[AUSPEX worker] LL2 HTTP', r.status);
      return [];
    }
    const d = await r.json();
    const launches = Array.isArray(d?.results) ? d.results : [];
    return launches.map(normalizeLaunch).filter(Boolean);
  } catch (e) {
    console.warn('[AUSPEX worker] space degrade:', e && e.message);
    return [];
  }
}
