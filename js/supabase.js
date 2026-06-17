'use strict';

// ═══════════════════════════════════════════
// SUPABASE CLIENT — MERIDIAN PERSISTENCE LAYER
// ═══════════════════════════════════════════
const SUPA_URL = 'https://dszlmzwfopujyxdrxmhn.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzemxtendmb3B1anl4ZHJ4bWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU5ODUsImV4cCI6MjA5MjQ1MTk4NX0.jNjvyyCQqXyjQu_Eb8vzkAOycXiW8L0NzyKbzcl_xd4';

let _sb = null;
function getSB() {
  if (!_sb) {
    if (typeof window.supabase === 'undefined') {
      console.warn('[MERIDIAN] Supabase SDK not loaded');
      return null;
    }
    _sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  }
  return _sb;
}

// In-memory cache of historical stories loaded for analyst board
// Maps UUID string → story object (compatible with NEWS story shape)
const _histMap = {};

// ───────────────────────────────────────────
// STEP 2 — Archive live stories to Supabase
// Called automatically after each news fetch
// ───────────────────────────────────────────
async function sbArchiveStories(stories) {
  const sb = getSB();
  if (!sb) return;
  try {
    const rows = stories
      .filter(s => !s._hist) // skip stories that originated from Supabase (no round-trip)
      .map(s => ({
        title_key:    (s.title || '').toLowerCase().replace(/\s+/g,' ').trim().slice(0, 80),
        title:        s.title         || '',
        summary:      s.summary       || null,
        body:         s.body          || null,
        url:          s.url           || null,
        url_to_image: s.urlToImage    || null,
        src:          s.src           || null,
        cat:          s.cat           || null,
        region:       s.region        || null,
        lat:          s.lat           ?? null,
        lng:          s.lng           ?? null,
        brk:          s.brk           || false,
        pub_date:     s._pub ? new Date(s._pub).toISOString() : new Date().toISOString(),
      })).filter(r => r.title_key.length > 5 && r.lat != null && r.lng != null);

    const { error } = await sb.from('stories').upsert(rows, {
      onConflict: 'title_key',
      ignoreDuplicates: false,
    });
    if (error) console.warn('[MERIDIAN] Archive error:', error.message);
    else console.log(`[MERIDIAN] Archived ${rows.length} stories to Supabase`);
  } catch(e) {
    console.warn('[MERIDIAN] Supabase unavailable:', e.message);
  }
}

// ───────────────────────────────────────────
// STEP 3 — Historical story search for Analyst
// ───────────────────────────────────────────
async function sbSearchHistory({ query = '', cat = '', days = 90, limit = 30 } = {}) {
  const sb = getSB();
  if (!sb) return [];
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    let q = sb.from('stories')
      .select('*')
      .gte('pub_date', since)
      .order('pub_date', { ascending: false })
      .limit(limit);

    if (cat && cat !== 'all') q = q.eq('cat', cat);
    if (query.trim()) {
      q = q.ilike('title', `%${query.trim()}%`);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(normalizeHistStory);
  } catch(e) {
    console.warn('[MERIDIAN] History search error:', e.message);
    return [];
  }
}

// Fetch related historical stories for a set of current stories
// Used by synthesizeBrief to add historical context
async function sbFetchRelatedHistory(pinnedStories, limit = 10) {
  const sb = getSB();
  if (!sb || !pinnedStories.length) return [];
  try {
    // Extract top regions and categories from pinned stories
    const cats    = [...new Set(pinnedStories.map(s => s.cat).filter(Boolean))];
    const regions = [...new Set(pinnedStories.map(s => s.region).filter(Boolean))];
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since7  = new Date(Date.now() - 7  * 86400000).toISOString();

    // Fetch recent stories matching same categories from last 30 days
    let q = sb.from('stories')
      .select('id,title,summary,src,cat,region,pub_date,brk')
      .gte('pub_date', since30)
      .lt('pub_date', since7)   // exclude last 7 days (those are already in live feed)
      .in('cat', cats)
      .order('pub_date', { ascending: false })
      .limit(limit);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(normalizeHistStory);
  } catch(e) {
    console.warn('[MERIDIAN] Related history error:', e.message);
    return [];
  }
}

// ───────────────────────────────────────────
// Bootstrap: load last N days of stories from server into local cache
// Called once on startup — grows the local pool as the DB accumulates
// ───────────────────────────────────────────
async function sbFetchRecentStories(limit = 600, days = 30) {
  const sb = getSB();
  if (!sb) return [];
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await sb
      .from('stories')
      .select('*')
      .gte('pub_date', since)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('pub_date', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeHistStory);
  } catch(e) {
    console.warn('[MERIDIAN] sbFetchRecentStories error:', e.message);
    return [];
  }
}

// Normalize a Supabase story row into a shape compatible with NEWS stories
function normalizeHistStory(row) {
  const stored = _histMap[row.id];
  if (stored) return stored;
  const s = {
    id:      row.id,           // UUID string — won't clash with integer NEWS ids
    title:   row.title   || '',
    summary: row.summary || '',
    body:    row.body    || '',
    url:     row.url     || null,
    src:     row.src     || 'Archive',
    cat:     row.cat     || 'geo',
    region:  row.region  || '',
    lat:     row.lat     || 0,
    lng:     row.lng     || 0,
    brk:     row.brk     || false,
    color:   (typeof CATS !== 'undefined' && CATS[row.cat]) ? CATS[row.cat].color : '#8A93C8',
    time:    row.pub_date ? _relativeTime(new Date(row.pub_date)) : '',
    _pub:    row.pub_date ? new Date(row.pub_date).getTime() : 0,
    _hist:   true,   // flag: this is a historical story from Supabase
  };
  _histMap[row.id] = s;
  return s;
}

function _relativeTime(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60)    return `${mins}m ago`;
  if (mins < 1440)  return `${Math.floor(mins/60)}h ago`;
  return `${Math.floor(mins/1440)}d ago`;
}

// Lookup a historical story by id (UUID string)
function sbGetHistStory(id) {
  return _histMap[id] || null;
}

// ───────────────────────────────────────────
// STEP 4 — Map data: cities, regions
// ───────────────────────────────────────────
let _citiesCache    = null;
let _regionsCache   = null;
let _countriesCache = null;

// Clears the countries cache so next sbFetchCountries() fetches fresh from Supabase
function sbClearCountriesCache() { _countriesCache = null; }

async function sbFetchCities(maxTier = 2) {
  if (_citiesCache) return _citiesCache;
  const sb = getSB();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('cities')
      .select('*')
      .lte('strategic_tier', maxTier)
      .order('strategic_tier', { ascending: true });
    if (error) throw error;
    _citiesCache = data || [];
    return _citiesCache;
  } catch(e) {
    console.warn('[MERIDIAN] Cities fetch error:', e.message);
    return [];
  }
}

async function sbFetchCountries() {
  if (_countriesCache) return _countriesCache;
  const sb = getSB();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('countries')
      .select('iso2,iso3,name,continent,lat,lng,nuclear_armed,conflict_active,sanctions_subject,un_p5,nato_member,strategic_tier,gdp_billions,mil_spend_billions')
      .order('strategic_tier', { ascending: true });
    if (error) throw error;
    _countriesCache = data || [];
    return _countriesCache;
  } catch(e) {
    console.warn('[MERIDIAN] Countries fetch error:', e.message);
    return [];
  }
}

async function sbFetchRegions() {
  if (_regionsCache) return _regionsCache;
  const sb = getSB();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('regions')
      .select('*')
      .eq('active', true)
      .order('threat_level', { ascending: true });
    if (error) throw error;
    _regionsCache = data || [];
    return _regionsCache;
  } catch(e) {
    console.warn('[MERIDIAN] Regions fetch error:', e.message);
    return [];
  }
}
