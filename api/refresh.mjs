// ═══════════════════════════════════════════
// AUSPEX · SCHEDULED REFRESH (Vercel / GitHub Actions cron)
// Keeps the story corpus fresh independent of visitor traffic: fetches the
// live RSS+GDELT feed server-side, geolocates + categorizes each story, and
// archives the fresh ones to Supabase (ON CONFLICT title_key DO NOTHING via the
// public anon-insert path — the same path visitors' browsers already use).
//
// Triggered a few times a day by .github/workflows/refresh.yml and once a day
// by the vercel.json cron. Safe to call any time; duplicates are ignored.
// ═══════════════════════════════════════════
import { fetchAllNews } from '../worker/news.js';
import { extractCoords, detectCat, COUNTRY_COORDS } from '../src/geolocate.js';

const SUPA_URL = process.env.SUPABASE_URL || 'https://rdsmaktxefqtfxogoauq.supabase.co';
// Publishable anon key (RLS-protected) — same one shipped in js/supabase.js.
const SUPA_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21ha3R4ZWZxdGZ4b2dvYXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzI4MDAsImV4cCI6MjA5NzMwODgwMH0.N5zfuFrVIMdrZ9adXmiUVaD2EhCu0j1Inqf2ru4bJc8';

const MAX_AGE_MS = 48 * 60 * 60 * 1000;

// Build archive rows from the unified feed: locate, categorize, dedupe shape.
function buildRows(articles) {
  const rows = [];
  const seen = new Set();
  for (const a of articles) {
    if (!a || !a.title) continue;
    const src = typeof a.source === 'string' ? a.source : (a.source?.name || '');
    const searchText = `${a.title} ${a.description || ''} ${src}`;

    const pubTime = a.publishedAt ? new Date(a.publishedAt).getTime() : Date.now();
    if (isNaN(pubTime) || Date.now() - pubTime > MAX_AGE_MS) continue;

    let coords = extractCoords(searchText);
    if (!coords && a.sourcecountry) coords = COUNTRY_COORDS[a.sourcecountry.toLowerCase()] || null;
    if (!coords) continue; // skip unlocatable stories — same rule as the client

    const title_key = a.title.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
    if (title_key.length <= 5 || seen.has(title_key)) continue;
    seen.add(title_key);

    const minsAgo = Math.floor((Date.now() - pubTime) / 60000);
    rows.push({
      title_key,
      title:        a.title.replace(/ - [^-]+$/, '').slice(0, 120),
      summary:      a.description || a.title,
      body:         a.description || null,
      url:          a.url || null,
      url_to_image: a.urlToImage || null,
      src:          (src || 'Wire').slice(0, 22),
      cat:          detectCat(searchText),
      region:       src || 'Global',
      // small jitter so co-located stories don't stack on the exact same pixel
      lat:          coords[0] + (Math.random() - 0.5) * 0.6,
      lng:          coords[1] + (Math.random() - 0.5) * 0.6,
      brk:          minsAgo < 25,
      pub_date:     new Date(pubTime).toISOString(),
    });
  }
  return rows;
}

async function archive(rows) {
  if (!rows.length) return 0;
  const url = `${SUPA_URL}/rest/v1/stories?on_conflict=title_key`;
  let sent = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        // ON CONFLICT (title_key) DO NOTHING — needs only the anon INSERT policy.
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`supabase ${res.status}: ${txt.slice(0, 160)}`);
    }
    sent += chunk.length;
  }
  return sent;
}

export default async function handler(req, res) {
  // Optional shared-secret gate. If CRON_SECRET is set, require it (Vercel cron
  // sends it automatically; the GitHub workflow forwards it too). If unset, the
  // endpoint is open — harmless, since it only triggers the same dedup'd archive
  // path any visitor's browser already performs.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  const startedAt = new Date().toISOString();
  try {
    const articles = await fetchAllNews();
    const rows = buildRows(articles);
    const archived = await archive(rows);
    res.status(200).json({
      ok: true,
      startedAt,
      fetched: articles.length,
      located: rows.length,
      archived,
    });
  } catch (e) {
    res.status(502).json({ ok: false, startedAt, error: String(e && e.message || e) });
  }
}
