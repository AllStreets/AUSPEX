// ═══════════════════════════════════════════
// AUSPEX · SERVERLESS FLIGHTS (Vercel)
// Server-side proxy for live ADS-B (adsb.lol is keyless but sends no CORS
// headers, so the browser can't call it directly). Returns ~1000 real aircraft
// classified military / cargo / passenger. Edge-cached ~20s so adsb.lol sees
// roughly one request per window no matter how many visitors are watching.
// ═══════════════════════════════════════════
import { fetchFlights } from '../worker/flights.js';

export default async function handler(req, res) {
  try {
    const flights = await fetchFlights(1000);
    if (flights.length) {
      res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    } else {
      res.setHeader('Cache-Control', 's-maxage=10');
    }
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      source: flights.length ? 'live' : 'empty',
      count: flights.length,
      flights,
    });
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=10');
    res.status(200).json({ generatedAt: new Date().toISOString(), source: 'error', count: 0, flights: [] });
  }
}
