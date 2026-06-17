'use strict';

// ═══════════════════════════════════════════
// NEWS FETCH — JUNK FILTER + FETCH + CACHE
// ═══════════════════════════════════════════
const JUNK_RE = /\b(celebrity|kardashian|taylor swift|beyoncé|beyonce|oscar[s ]|grammy|box office|movie review|film review|album review|netflix series|hulu|disney\+|spotify playlist|tiktok|viral video|social media trend|influencer|reality tv|reality show|bachelor|bachelorette|america['']s got talent|dancing with the stars|the voice|american idol|survivor cast|big brother|drag race|met gala|golden globe|emmys|oscars ceremony|red carpet|celebrity couple|celebrity death|actor arrested|pop star)\b|\b(video game|game release|esport|fortnite|minecraft|roblox|playstation|xbox|nintendo|steam sale|gaming headset|twitch stream|call of duty|league of legends|overwatch|valorant|genshin|pokemon|zelda|mario|game review|gaming news|new game|rpg release|console launch|pc gaming|steam|street fighter|dlc character|dlc pack|dlc release|game dlc|fighting game|jrpg|mmorpg)\b|nintendo|buzzfeed|\b(product review|unboxing|best buy|deal of the day|prime day|amazon sale|iphone 1[0-9]|macbook air|samsung galaxy s|new phone release|smartwatch review|gadget roundup|wearable tech review|home theater|soundbar|headphones review|earbuds|laptop review|tablet review|5g phone|tech deal|best laptop|best phone)\b|\b(nba (game|trade|dunk|mvp|draft|coach)|nfl (game|draft|trade|touchdown|coach)|mlb (game|trade|batting)|nhl (game|trade|goal)|premier league (goal|match result|transfer)|la liga|bundesliga match|serie a match|cricket match|golf round|tennis match result|f1 race result|superbowl ad|super bowl commercial|march madness|ncaa bracket|fantasy football|fantasy sports|sports betting odds|nfl week|monday night football)\b|\b(recipe|restaurant review|best restaurants|food trend|fashion week|beauty routine|skincare routine|home decor trend|interior design|travel tips|hotel review|vacation guide|celebrity diet|weight loss|workout routine|fitness tips|meal prep|keto|intermittent fasting|abs workout|zodiac|horoscope|astrology|listicle|ranked|tier list|freakin|mind-blowing facts|cool facts|fun facts)\b/i;

// Convert the accumulated map to an array sorted newest-first
function _mapToSortedStories(map) {
  return Object.values(map).sort((a, b) => (b._pub || 0) - (a._pub || 0));
}

// Load all accumulated stories from localStorage (survives refresh cycles)
function _loadAccumCache() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return { ts: 0, map: {} };
    const parsed = JSON.parse(raw);
    // Support both old array format and new map format
    if (Array.isArray(parsed.stories)) {
      const map = {};
      parsed.stories.forEach(s => { map[s._key || s.title.slice(0,60)] = s; });
      return { ts: parsed.ts || 0, map };
    }
    return { ts: parsed.ts || 0, map: parsed.map || {} };
  } catch(e) { return { ts: 0, map: {} }; }
}

function _saveAccumCache(map) {
  try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), map })); } catch(e) {}
}

// Tracks which wave we're on — country endpoints run every other fetch
let _fetchWave = 0;

// Primary endpoints: run every refresh
const _PRIMARY_ENDPOINTS = [
  `https://newsapi.org/v2/top-headlines?language=en&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?category=science&language=en&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?category=general&language=en&pageSize=100&apiKey=${NEWS_API_KEY}`,
  // everything endpoint — geopolitical keyword sweeps (requires developer+ plan; silently skipped if 426'd)
  `https://newsapi.org/v2/everything?q=war+military+conflict+troops+nuclear+missile&language=en&sortBy=publishedAt&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/everything?q=sanctions+diplomacy+geopolitics+election+coup+treaty&language=en&sortBy=publishedAt&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/everything?q=Ukraine+Taiwan+NATO+Iran+Hamas+Hezbollah+China+Russia+Israel&language=en&sortBy=publishedAt&pageSize=100&apiKey=${NEWS_API_KEY}`,
];

// Country-specific endpoints: alternate every other refresh to conserve API quota
const _COUNTRY_ENDPOINTS = [
  `https://newsapi.org/v2/top-headlines?country=gb&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=de&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=fr&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=ru&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=cn&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=in&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=il&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=jp&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=au&pageSize=100&apiKey=${NEWS_API_KEY}`,
  `https://newsapi.org/v2/top-headlines?country=za&pageSize=100&apiKey=${NEWS_API_KEY}`,
];

async function fetchNews() {
  _fetchWave++;
  // Check cache — serve immediately then refresh in background if stale
  try {
    const { ts, map } = _loadAccumCache();
    const stories = _mapToSortedStories(map);
    if (stories.length >= 5) {
      applyLiveNews(stories);
      if (Date.now() - ts < NEWS_CACHE_TTL) {
        scheduleRefresh(ts + NEWS_CACHE_TTL - Date.now());
        return;
      }
    }
  } catch(e) {}

  // Flash refresh indicator
  const ind = document.getElementById('refresh-ind');
  const lbl = document.getElementById('refresh-lbl');
  if (ind) { ind.classList.add('refreshing'); lbl.textContent = 'FETCHING'; }

  try {
    // Full sweep on odd waves (initial + every other refresh); primary only on even waves
    const endpoints = (_fetchWave % 2 === 1)
      ? [..._PRIMARY_ENDPOINTS, ..._COUNTRY_ENDPOINTS]
      : _PRIMARY_ENDPOINTS;

    const results = await Promise.allSettled(endpoints.map(url =>
      fetch(url).then(r => r.json())
    ));

    const seen = new Set();
    const raw = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.articles) {
        for (const a of r.value.articles) {
          if (!a.title || a.title === '[Removed]') continue;
          const key = a.title.slice(0,60);
          if (seen.has(key)) continue;
          seen.add(key);
          raw.push(a);
        }
      }
    }

    if (raw.length < 5) throw new Error('Insufficient API results');

    let id = 100;
    const stories = [];
    for (const a of raw) {
      const searchText = `${a.title} ${a.description||''} ${a.source?.name||''} ${a.content||''}`;

      // Age filter — drop articles older than 48 hours
      const pubTime = a.publishedAt ? new Date(a.publishedAt).getTime() : Date.now();
      if (Date.now() - pubTime > NEWS_MAX_AGE_MS) continue;

      // Relevance filter — drop pop culture/gaming/consumer noise
      // BUT always pass through if it has geopolitical/military/crisis signals
      const PRIORITY_RE = /\b(war|warfare|military|troops|missile|drone strike|airstrike|nuclear|nato|sanction|election|coup|protest|invasion|ceasefire|parliament|president|prime minister|secretary of state|foreign minister|geopolit|diplomacy|terrorism|insurgency|conflict|crisis|threat|intelligence|espionage|submarine|aircraft carrier|destroyer|battalion|casualt|offensive|siege|blockade|escalat|deescalat|treaty|bilateral|summit|security council|un resolution|iaea|pentagon|kremlin|white house|state department)\b/i;
      if (JUNK_RE.test(searchText) && !PRIORITY_RE.test(searchText)) continue;

      const coords = extractCoords(searchText);
      if (!coords) continue; // skip unlocatable stories

      const cat = detectCat(searchText);
      const pub = a.publishedAt ? new Date(a.publishedAt) : new Date();
      const minsAgo = Math.floor((Date.now() - pub.getTime()) / 60000);
      const timeStr = minsAgo < 2 ? 'just now'
        : minsAgo < 60 ? `${minsAgo} min ago`
        : minsAgo < 120 ? '1 hr ago'
        : `${Math.floor(minsAgo/60)} hr ago`;

      stories.push({
        id: id++,
        lat: coords[0] + (Math.random() - 0.5) * 0.6,
        lng: coords[1] + (Math.random() - 0.5) * 0.6,
        cat,
        src: (a.source?.name || 'Wire').slice(0, 22),
        time: timeStr,
        brk: minsAgo < 25,
        region: a.source?.name || 'Global',
        title: a.title.replace(/ - [^-]+$/, '').slice(0, 120),
        summary: a.description || a.title,
        body: a.content ? a.content.replace(/\[\+\d+ chars\]/, '').trim() : (a.description || ''),
        url: a.url || null,
        urlToImage: a.urlToImage || null,
        _pub: pub.getTime(),
      });
    }

    console.info(`[MERIDIAN] Fetch wave ${_fetchWave}: ${raw.length} raw → ${stories.length} passed (junk/age/coords filters)`);
    if (stories.length < 5) throw new Error('Too few locatable stories');

    // Merge new stories into accumulative cache — stories persist until cap is hit
    // No age eviction here: old stories are kept so the dataset grows over sessions
    const { map: existing } = _loadAccumCache();
    stories.forEach(s => {
      const key = s.title.slice(0, 60);
      s._key = key;
      existing[key] = s; // overwrite same story with fresher version if re-fetched
    });
    // Cap at 8000 entries (~4MB) — oldest trimmed only when over limit
    const entries = Object.entries(existing);
    if (entries.length > 8000) {
      entries.sort((a, b) => (b[1]._pub || 0) - (a[1]._pub || 0));
      entries.slice(8000).forEach(([k]) => delete existing[k]);
    }
    _saveAccumCache(existing);

    const merged = _mapToSortedStories(existing);
    applyLiveNews(merged);
    scheduleRefresh(NEWS_CACHE_TTL);
  } catch(err) {
    console.error('[MERIDIAN] NewsAPI fetch failed:', err.message || err);
    console.info('[MERIDIAN] If you see CORS errors, run: python3 -m http.server 8765 and open http://localhost:8765');
    const lbl2 = document.getElementById('refresh-lbl');
    if (lbl2) lbl2.textContent = 'SEEDED';
    const ind2 = document.getElementById('refresh-ind');
    if (ind2) ind2.classList.remove('refreshing');
    scheduleRefresh(NEWS_CACHE_TTL);
  }
}

function applyLiveNews(stories) {
  applyColors(stories);
  NEWS = stories;
  const ind = document.getElementById('refresh-ind');
  const lbl = document.getElementById('refresh-lbl');
  if (ind) {
    ind.classList.add('refreshing');
    lbl.textContent = 'UPDATED';
    setTimeout(() => { ind.classList.remove('refreshing'); lbl.textContent = 'LIVE'; }, 2500);
  }

  // Update counts
  const counts = {all:0,geo:0,military:0,finance:0,climate:0,tech:0};
  stories.forEach(s => { counts.all++; counts[s.cat] = (counts[s.cat]||0) + 1; });
  Object.entries(counts).forEach(([k,v]) => {
    const el = document.getElementById(`cn-${k}`);
    if (el) el.textContent = v;
  });
  document.getElementById('story-count').textContent = counts.all;
  if (typeof _checkWatchlistAlerts === 'function') _checkWatchlistAlerts();

  // Archive locally (scrubber) + persist to Supabase
  archiveCurrentStories();
  sbArchiveStories(NEWS);
  renderSentiment(NEWS);
  const filtered = activeCat === 'all' ? NEWS : NEWS.filter(s => s.cat === activeCat);
  updateAllGlobeElements();
  applyMeaningfulArcs(filtered);
  renderFeed(filtered);
  initTicker();
}

// ═══════════════════════════════════════════
// SUPABASE BOOTSTRAP — seed local cache from server DB on load
// As the server accumulates stories across sessions, the local pool grows
// ═══════════════════════════════════════════
async function bootstrapFromSupabase() {
  try {
    const stories = await sbFetchRecentStories(600, 30);
    if (!stories.length) return;

    const { map: existing } = _loadAccumCache();
    let added = 0;
    stories.forEach(s => {
      if (!s.lat || !s.lng) return; // skip stories with no coordinates
      const key = s.title.slice(0, 60);
      if (!existing[key]) {
        s._key = key;
        existing[key] = s;
        added++;
      }
    });

    if (added > 0) {
      // Keep within localStorage limit
      const entries = Object.entries(existing);
      if (entries.length > 4000) {
        entries.sort((a, b) => (b[1]._pub || 0) - (a[1]._pub || 0));
        entries.slice(4000).forEach(([k]) => delete existing[k]);
      }
      _saveAccumCache(existing);
      const merged = _mapToSortedStories(existing);
      applyLiveNews(merged);
      console.log(`[MERIDIAN] Bootstrap: +${added} stories from server (pool now ${merged.length})`);
    }
  } catch(e) {
    console.warn('[MERIDIAN] Bootstrap error:', e.message);
  }
}

function scheduleRefresh(delayMs) {
  nextRefreshAt = Date.now() + delayMs;
  if (refreshCountdownInt) clearInterval(refreshCountdownInt);
  refreshCountdownInt = setInterval(() => {
    const rem = Math.max(0, nextRefreshAt - Date.now());
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    const lbl = document.getElementById('refresh-lbl');
    if (lbl && document.getElementById('refresh-ind') && !document.getElementById('refresh-ind').classList.contains('refreshing')) {
      lbl.textContent = `${m}:${String(s).padStart(2,'0')}`;
    }
    if (rem <= 0) {
      clearInterval(refreshCountdownInt);
      fetchNews();
    }
  }, 1000);
}
