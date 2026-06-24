// ═══════════════════════════════════════════
// AUSPEX · SERVERLESS VESSELS (Vercel)
// Server-side proxy for live AIS (aisstream.io is WebSocket-only and CORS-blocks
// browsers, so the key never leaves the server). Opens a short stream window,
// merges + land-filters, and returns a snapshot. Edge-cached ~30s so aisstream
// sees roughly one connection per window no matter how many visitors watch.
// Needs AISSTREAM_API_KEY in the Vercel project env.
// ═══════════════════════════════════════════
import { fetchVessels } from '../worker/vessels.js';

export const maxDuration = 10; // Node 24 global WebSocket; collect window < this

export default async function handler(req, res) {
  try {
    const vessels = await fetchVessels(2500, 6500);
    if (vessels.length) {
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    } else {
      res.setHeader('Cache-Control', 's-maxage=10');
    }
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      source: vessels.length ? 'live' : 'empty',
      count: vessels.length,
      vessels,
    });
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=10');
    res.status(200).json({ generatedAt: new Date().toISOString(), source: 'error', count: 0, vessels: [] });
  }
}
