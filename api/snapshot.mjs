// ═══════════════════════════════════════════
// AUSPEX · SERVERLESS SNAPSHOT FUNCTION (Vercel)
// Reuses the worker's pure sense logic to build the live event snapshot at
// the edge — no separate worker host, no CORS, no rate-limit on the client.
//
// News-derived breakthroughs are OMITTED here: they need the worker's
// in-memory news cache, which doesn't exist in a stateless function. Space
// launches + disasters (USGS/GDACS) are enough to keep the globe alive.
// ═══════════════════════════════════════════
import { fetchUSGSEvents } from '../worker/senses/usgs.js';
import { fetchGDACSEvents } from '../worker/senses/gdacs.js';
import { fetchSpaceEvents } from '../worker/senses/space.js';
import { runReasoningPass } from '../worker/reason.js';
import { buildSnapshot } from '../worker/snapshot.js';
import { computeLinks } from '../src/connect.js';

// Wrap each sense so a single source failing → [] (never the whole response).
const safe = (fn) => fn().catch(() => []);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
  try {
    const [usgs, gdacs, space] = await Promise.all([
      safe(fetchUSGSEvents),
      safe(fetchGDACSEvents),
      safe(fetchSpaceEvents),
    ]);

    // Optional LLM reasoning pass (keyless degrade if AUSPEX_LLM_KEY unset).
    const events = await runReasoningPass(
      [...usgs, ...gdacs, ...space],
      process.env.AUSPEX_LLM_KEY ?? null,
    );

    // Draw honest space+time connections so the globe can render link arcs.
    computeLinks(events);

    const snapshot = buildSnapshot(events);
    res.status(200).json(snapshot);
  } catch (e) {
    // Last-resort: never 500 the globe — return an empty-but-valid snapshot.
    res.status(200).json({ generatedAt: new Date().toISOString(), version: 1, events: [] });
  }
}
