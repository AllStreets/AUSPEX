import { normalizeGDACSItem } from '../../src/normalize.js';

// GDACS (UN/EC Global Disaster Alert & Coordination System) — the authoritative
// free, keyless, GLOBAL multi-hazard feed: cyclones, floods, droughts, volcanoes,
// wildfires, quakes. It's how AUSPEX covers Africa / Asia / Oceania, which the
// US-skewed EONET wildfire feed and USGS-only quakes miss.
//
// The JSON API (geteventlist/SEARCH|MAP) is reliably SLOW (10-12s) and times out;
// the GeoRSS feed returns the same events in ~1.5s. So we read the RSS and shape
// each item to match normalizeGDACSItem's expected {properties, geometry}.
const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml';
const UA = 'AUSPEX/1.0 (planetary commons; +https://github.com/AllStreets/AUSPEX)';

// Pull the inner text of <tag>…</tag> (namespaced ok), entity-decoded, or null.
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

// GeoRSS → the {properties, geometry} shape normalizeGDACSItem already understands.
function parseRSS(xml) {
  const items = xml.split('<item>').slice(1);
  const out = [];
  for (const raw of items) {
    const block = raw.split('</item>')[0];
    const alert = tag(block, 'gdacs:alertlevel');
    // Include Green too — it's how the map gets global breadth (floods, smaller
    // cyclones across Africa/Asia/Oceania). Green renders calm-green; Orange/Red
    // carry the colour. Skip only unrated items.
    if (alert !== 'Green' && alert !== 'Orange' && alert !== 'Red') continue;
    const lat = Number(tag(block, 'geo:lat'));
    const lng = Number(tag(block, 'geo:long'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      properties: {
        eventtype: tag(block, 'gdacs:eventtype'),
        alertlevel: alert,
        alertscore: Number(tag(block, 'gdacs:alertscore')) || 0,
        name: tag(block, 'gdacs:eventname') || tag(block, 'title') || 'GDACS event',
        eventid: tag(block, 'gdacs:eventid'),
        fromdate: tag(block, 'gdacs:fromdate'),
        description: tag(block, 'description') || '',
        url: { report: tag(block, 'link') || 'https://gdacs.org' },
      },
      geometry: { coordinates: [lng, lat] },
    });
  }
  return out;
}

// Wildfires are by far the highest-volume GDACS type (often 140+, concentrated
// in fire-season regions like Africa/Australia). Uncapped they dominate the map
// the way US EONET fires did. Cap to a global, severity-ranked set so fires stay
// present everywhere without becoming a firehose; all other hazards uncapped.
const FIRE_CAP = 24;
function capFires(events) {
  const fires = events.filter((e) => e.type === 'fire').sort((a, b) => b.severity - a.severity);
  if (fires.length <= FIRE_CAP) return events;
  const keep = new Set(fires.slice(0, FIRE_CAP));
  return events.filter((e) => e.type !== 'fire' || keep.has(e));
}

export async function fetchGDACSEvents() {
  const deadline = Date.now() + 6000;
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
    try {
      const budget = Math.min(4000, deadline - Date.now());
      if (budget < 600) break;
      const r = await fetch(GDACS_RSS, { signal: AbortSignal.timeout(budget), headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`GDACS HTTP ${r.status}`);
      const xml = await r.text();
      const events = capFires(parseRSS(xml).map(normalizeGDACSItem).filter(Boolean));
      if (events.length) return events;
      throw new Error('GDACS empty');
    } catch (e) {
      lastErr = e.message;
      if (Date.now() < deadline) await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
    }
  }
  console.warn('[AUSPEX worker] GDACS degrade:', lastErr);
  return [];
}
