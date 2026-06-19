// ═══════════════════════════════════════════
// AUSPEX · BREAKTHROUGHS SENSE — the world's PROGRESS, derived from the
// unified news firehose. Keyword-tags genuinely positive/progress stories
// (medical, science/physics, space, financial, tech), excludes anything that
// also reads as a peril, places each via a coarse country→latlng map, and
// emits low-confidence breakthrough snapshot events. Hard space events come
// from senses/space.js; this catches the news mentions.
// ═══════════════════════════════════════════

// Breakthrough signal patterns, in priority order. First match wins the sense.
const BUCKETS = [
  { sense: 'medical', re: /\b(cure|vaccine|breakthrough treatment|clinical trial success|fda approv|drug approv|remission|gene therapy|transplant first)\b/i },
  { sense: 'physics', re: /\b(fusion|quantum|breakthrough|discovery|first[- ]ever|nobel|particle|telescope reveals|fossil|new species|milestone)\b/i },
  { sense: 'space', re: /\b(landing|orbit achieved|docking|launch success|rover|spacewalk)\b/i },
  { sense: 'financial', re: /\b(record high|all-time high|ipo|surges to record|breakthrough deal)\b/i },
  { sense: 'tech', re: /\b(unveils|launches new|breakthrough chip|AI model|first commercial)\b/i },
];

// If a title also reads as a peril, it is NOT a breakthrough.
const PERIL_RE = /\b(war|death|dead|attack|crisis|killed|crash|collapse|scandal|kills|dies|deadly|massacre|bomb|shooting|outbreak)\b/i;

// Coarse country → [lat, lng] centroid map (≈30 major countries). GDELT
// sourcecountry uses these names; titles that we can't place are skipped.
const COUNTRY_LATLNG = {
  'United States': [38.0, -97.0], 'USA': [38.0, -97.0], 'United Kingdom': [54.0, -2.0],
  'Canada': [56.1, -106.3], 'France': [46.2, 2.2], 'Germany': [51.2, 10.4],
  'Italy': [41.9, 12.6], 'Spain': [40.4, -3.7], 'Portugal': [39.4, -8.2],
  'Netherlands': [52.1, 5.3], 'Belgium': [50.5, 4.5], 'Switzerland': [46.8, 8.2],
  'Russia': [61.5, 105.3], 'China': [35.9, 104.2], 'Japan': [36.2, 138.3],
  'South Korea': [35.9, 127.8], 'India': [20.6, 78.9], 'Pakistan': [30.4, 69.3],
  'Australia': [-25.3, 133.8], 'Brazil': [-14.2, -51.9], 'Argentina': [-38.4, -63.6],
  'Mexico': [23.6, -102.5], 'South Africa': [-30.6, 22.9], 'Nigeria': [9.1, 8.7],
  'Egypt': [26.8, 30.8], 'Israel': [31.0, 34.9], 'Saudi Arabia': [23.9, 45.1],
  'Turkey': [38.96, 35.2], 'Iran': [32.4, 53.7], 'Ukraine': [48.4, 31.2],
  'Poland': [51.9, 19.1], 'Sweden': [60.1, 18.6], 'Norway': [60.5, 8.5],
  'Indonesia': [-0.8, 113.9], 'Singapore': [1.35, 103.8], 'New Zealand': [-40.9, 174.9],
};

// FNV-1a 32-bit hash → stable hex id from a url.
function hashUrl(url) {
  let h = 0x811c9dc5;
  const s = String(url || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const MAX_BREAKTHROUGHS = 25;

export function deriveBreakthroughs(articles) {
  if (!Array.isArray(articles) || !articles.length) return [];
  const out = [];
  const seen = new Set();
  for (const a of articles) {
    if (out.length >= MAX_BREAKTHROUGHS) break;
    const title = a && a.title ? String(a.title) : '';
    if (!title || !a.url) continue;
    if (PERIL_RE.test(title)) continue; // never mis-tag bad news

    const bucket = BUCKETS.find((b) => b.re.test(title));
    if (!bucket) continue;

    // Locate: prefer existing coords from the news pipeline, else country map.
    let lat = Number(a.lat), lng = Number(a.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const c = a.sourcecountry && COUNTRY_LATLNG[a.sourcecountry];
      if (!c) continue; // unplaceable → skip
      [lat, lng] = c;
    }

    const id = `brk:${hashUrl(a.url)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      sense: bucket.sense, type: bucket.sense, polarity: 'breakthrough',
      title,
      lat, lng,
      metric: { label: 'progress', value: bucket.sense, band: 'milestone' },
      severity: 0.5, confidence: 'unconfirmed',
      occurredAt: a.publishedAt || new Date().toISOString(),
      brief: a.description || title,
      sources: [{ name: a.source || 'News', url: a.url }],
      links: [], icon: bucket.sense,
    });
  }
  return out;
}
