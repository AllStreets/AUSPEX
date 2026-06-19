'use strict';

// ═══════════════════════════════════════════
// RELIEF — HUMANITARIAN OPERATIONS BOARD
//   Counterpart to the Analyst Board. Keeps its OWN pin pool
//   (reliefAssets / _reliefGeoMap) — fully independent of the
//   Analyst pool — and shares callOpenAI and the live data
//   globals (NEWS, REGION_DATA, COUNTRY_DATA, CITY_DATA,
//   SNAPSHOT_EVENTS). Living Green theme.
//
//   Pass 1 tools: 01 Situation Report (AI),
//                 02 Response Council (AI, multi-role),
//                 03 Needs & Gaps Matrix (algorithmic).
// ═══════════════════════════════════════════

let _reliefActiveTool = null;
let _reliefFocus = null;          // resolved focus object (see reliefResolveFocus)

// ── Shell open / close ──────────────────────────────────────
function openRelief() {
  document.getElementById('relief-overlay').classList.add('on');
  reliefRefreshFocus();
}

function closeRelief() {
  document.getElementById('relief-overlay').classList.remove('on');
  reliefClearGlobe();
}

// ── Globe layer clearing ────────────────────────────────────
// RELIEF globe layers (displacement arcs, famine markers, access markers)
// are gated to their tool. Clear them on tool switch / overlay close so the
// globe never accumulates stale relief geometry. Re-uses the existing
// refresh pipelines — does not touch other layers.
function reliefClearGlobe() {
  let changed = false;
  if (typeof reliefArcs !== 'undefined' && reliefArcs.length) { reliefArcs = []; changed = true; }
  if (typeof reliefFamineMarkers !== 'undefined' && reliefFamineMarkers.length) { reliefFamineMarkers = []; changed = true; }
  if (typeof reliefAccessMarkers !== 'undefined' && reliefAccessMarkers.length) { reliefAccessMarkers = []; changed = true; }
  if (typeof reliefHealthMarkers !== 'undefined' && reliefHealthMarkers.length) { reliefHealthMarkers = []; changed = true; }
  if (!changed) return;
  if (typeof refreshArcs === 'function') refreshArcs();
  if (typeof updateAllGlobeElements === 'function') updateAllGlobeElements();
}

// ── RELIEF pin pool ─────────────────────────────────────────
// RELIEF owns reliefAssets / _reliefGeoMap (declared in config.js),
// entirely separate from the Analyst pool. Pinning here sets the RELIEF
// focus and never touches analystAssets / _analystGeoMap (and vice versa).

// Resolve a RELIEF-pinned id (geo key or story id) to a story-like object.
function _reliefResolveAsset(id) {
  // RELIEF-cached object (geo key OR a story/event we cached on pin).
  if (typeof _reliefGeoMap !== 'undefined' && _reliefGeoMap[id]) {
    const g = _reliefGeoMap[id];
    return g._geoType === 'story' ? (g._geoObj || g) : g;
  }
  if (typeof _resolveStory === 'function') {
    const s = _resolveStory(id);
    if (s) return s;
  }
  if (typeof NEWS !== 'undefined') { const s = NEWS.find(n => n.id === id); if (s) return s; }
  if (typeof SNAPSHOT_EVENTS !== 'undefined') { const e = SNAPSHOT_EVENTS.find(n => n.id === id); if (e) return e; }
  return null;
}

// Build the same geo key analyst.js builds, so a given object pins consistently.
function _reliefGeoKey(geoType, obj) {
  return `${geoType}:${obj.name || obj.iso2}:${(obj.lat || 0).toFixed(1)}`;
}

// Pin a geo asset (city / country / region / event-location) to the RELIEF pool.
// Mirrors pinGeoAsset's key-building and summary shape. Toggles off if already pinned.
function pinToRelief(geoType, obj) {
  if (!obj) return;
  const key = _reliefGeoKey(geoType, obj);
  if (reliefAssets.includes(key)) {
    // Toggle off
    reliefAssets = reliefAssets.filter(k => k !== key);
    delete _reliefGeoMap[key];
    _reliefAfterPinChange();
    return;
  }
  const typeColors = { city:'#E8D5A3', capital:'#E8D5A3', financial:'#FFD60A', military:'#FF6D00',
    naval:'#2979FF', port:'#00BCD4', conflict:'#FF2D55', energy:'#FF9F0A',
    diplomatic:'#30D158', country:'#B163E0', region:'#34D399', event:'#FB923C', base:'#FF6D00' };
  const color = typeColors[obj.icon_type] || typeColors[geoType] || '#34D399';

  let summary = '';
  if (geoType === 'city') {
    summary = `Strategic location in ${obj.country || 'unknown'}. Coordinates: ${(obj.lat||0).toFixed(2)}, ${(obj.lng||0).toFixed(2)}.`;
    if (obj.notes) summary += ` ${obj.notes}`;
  } else if (geoType === 'country') {
    const flags = [obj.conflict_active ? 'Active conflict' : '', obj.sanctions_subject ? 'Under sanctions' : ''].filter(Boolean);
    summary = `${flags.join(' · ') || 'Nation-state'}. ${obj.capital ? 'Capital: ' + obj.capital + '. ' : ''}`;
  } else if (geoType === 'region') {
    summary = `${(obj.threat_level || 'monitored').toUpperCase()} threat region. ${obj.description || obj.notes || ''}`;
  } else if (geoType === 'event') {
    summary = obj.brief || obj.title || 'Sensed event.';
  }

  _reliefGeoMap[key] = {
    id: key, _geoType: geoType, _geoObj: obj,
    title: obj.name || obj.title || 'Pinned location',
    summary, cat: 'geo', color,
    src: geoType === 'country' ? (obj.iso2 || 'CTRY') : geoType.toUpperCase(),
    time: 'CURRENT', region: obj.country || obj.name || obj.region || '',
    threat_level: obj.threat_level || null,
    lat: obj.lat, lng: obj.lng,
  };
  reliefAssets.push(key);
  _reliefAfterPinChange();
}

// Pin a NEWS / archive story OR a sensed event to the RELIEF pool (mirrors
// pinStory). Toggles off. If the object is not a plain NEWS story (e.g. a
// SNAPSHOT_EVENT or threat with coords), we cache the object so focus
// resolution always finds it without depending on the Analyst NEWS lookup.
function pinStoryToRelief(story) {
  const id = (story && typeof story === 'object') ? story.id : story;
  if (id == null) return;
  if (reliefAssets.includes(id)) {
    reliefAssets = reliefAssets.filter(k => k !== id);
    if (typeof _reliefGeoMap !== 'undefined' && _reliefGeoMap[id]) delete _reliefGeoMap[id];
    _reliefAfterPinChange();
    return;
  }
  // Cache full object when it carries its own coords/title (not resolvable via NEWS).
  if (story && typeof story === 'object' && (story.title || story.region) && typeof _reliefGeoMap !== 'undefined') {
    _reliefGeoMap[id] = {
      id, _geoType: 'story', _geoObj: story,
      title: story.title || story.region || 'Pinned event',
      summary: story.summary || story.brief || '',
      region: story.region || '', lat: story.lat, lng: story.lng,
      threat_level: story.threat_level || null,
    };
  }
  reliefAssets.push(id);
  _reliefAfterPinChange();
}

// After any RELIEF pin change: re-resolve focus and, if the overlay is open,
// refresh the context strip + the active tool. Never touches Analyst.
function _reliefAfterPinChange() {
  if (typeof reliefRefreshFocus === 'function') reliefRefreshFocus();
  const ov = document.getElementById('relief-overlay');
  if (ov && ov.classList.contains('on') && _reliefActiveTool && typeof reliefSelectTool === 'function') {
    reliefSelectTool(_reliefActiveTool);
  }
}

// Is a given object currently pinned to RELIEF?
function reliefIsGeoPinned(geoType, obj) {
  return obj ? reliefAssets.includes(_reliefGeoKey(geoType, obj)) : false;
}
function reliefIsStoryPinned(story) {
  const id = (story && typeof story === 'object') ? story.id : story;
  return id != null && reliefAssets.includes(id);
}

// ── Focus resolution ────────────────────────────────────────
// The current focus = the most recently pinned region / event / city / story
// in the RELIEF pin pool (reliefAssets / _reliefGeoMap) — independent of the
// Analyst pool. Falls back to Global when nothing is pinned to RELIEF.
function reliefResolveFocus() {
  const assets = (typeof reliefAssets !== 'undefined') ? reliefAssets : [];
  // Walk most-recent-first.
  for (let i = assets.length - 1; i >= 0; i--) {
    const id = assets[i];
    // Geo asset pinned via pinToRelief
    if (typeof id === 'string' && id.includes(':') && typeof _reliefGeoMap !== 'undefined' && _reliefGeoMap[id]) {
      const g = _reliefGeoMap[id];
      const o = g._geoObj || {};
      return {
        kind: g._geoType || 'geo',
        name: o.name || o.title || g.title || 'Pinned location',
        lat: o.lat, lng: o.lng,
        region: o.country || o.name || o.region || g.region || '',
        raw: o, asset: g,
      };
    }
    // Story (NEWS / archive) — use its region + coords
    const s = _reliefResolveAsset(id);
    if (s) {
      return {
        kind: 'story',
        name: s.region || s.title || 'Pinned event',
        lat: s.lat, lng: s.lng,
        region: s.region || '',
        raw: s, asset: s,
      };
    }
  }
  // No pin → Global
  return { kind: 'global', name: 'GLOBAL', lat: null, lng: null, region: '', raw: null, asset: null };
}

// ── Clear / change focus ────────────────────────────────────
// Empties the RELIEF pin pool, resets focus to Global, clears any RELIEF globe
// layers, and refreshes the context strip + the open tool. Analyst untouched.
function reliefClearFocus() {
  reliefAssets = [];
  _reliefGeoMap = {};
  if (typeof reliefClearGlobe === 'function') reliefClearGlobe();
  if (typeof reliefRefreshFocus === 'function') reliefRefreshFocus();
  const ov = document.getElementById('relief-overlay');
  if (ov && ov.classList.contains('on') && _reliefActiveTool && typeof reliefSelectTool === 'function') {
    reliefSelectTool(_reliefActiveTool);
  }
}

// Remove a single pinned focus by key/id (used by the × on the context strip).
function reliefRemoveFocus(id) {
  reliefAssets = reliefAssets.filter(k => String(k) !== String(id));
  if (typeof _reliefGeoMap !== 'undefined' && _reliefGeoMap[id]) delete _reliefGeoMap[id];
  _reliefAfterPinChange();
}

function reliefRefreshFocus() {
  _reliefFocus = reliefResolveFocus();
  const f = _reliefFocus;
  const isGlobal = f.kind === 'global';
  const nameEl = document.getElementById('rl-focus-name');
  if (nameEl) nameEl.textContent = (f.name || 'GLOBAL').toUpperCase();
  const ctxVal = document.getElementById('rl-ctx-val');
  if (ctxVal) {
    if (isGlobal) {
      ctxVal.textContent = 'GLOBAL — no region pinned';
    } else {
      // Show the pinned focus with a small × to remove it.
      const focusId = (f.asset && f.asset.id != null) ? f.asset.id : (reliefAssets.length ? reliefAssets[reliefAssets.length - 1] : '');
      ctxVal.innerHTML = `${(f.name || '').replace(/</g, '&lt;')}<button class="rl-ctx-clear" title="Remove this focus" onclick="reliefRemoveFocus('${String(focusId).replace(/'/g, "\\'")}')">&times;</button>`;
    }
  }
  const ctxMeta = document.getElementById('rl-ctx-meta');
  if (ctxMeta) {
    if (isGlobal) {
      ctxMeta.textContent = 'PIN A REGION TO GROUND TOOLS';
    } else {
      const bits = [];
      bits.push(f.kind.toUpperCase());
      if (typeof f.lat === 'number' && typeof f.lng === 'number') bits.push(`${f.lat.toFixed(1)}, ${f.lng.toFixed(1)}`);
      if (f.raw && f.raw.threat_level) bits.push(`THREAT ${String(f.raw.threat_level).toUpperCase()}`);
      if (reliefAssets.length > 1) bits.push(`${reliefAssets.length} PINNED`);
      ctxMeta.textContent = bits.join(' · ');
    }
  }
  // CLEAR FOCUS button — only meaningful when something is pinned.
  const clearBtn = document.getElementById('rl-clear-focus');
  if (clearBtn) clearBtn.style.display = reliefAssets.length ? 'inline-flex' : 'none';
}

// ── Tool selection ──────────────────────────────────────────
// All 10 tools are live.
const _RELIEF_BUILT = { sitrep: 1, council: 1, matrix: 1, displacement: 1, famine: 1, access: 1, recovery: 1, goodnews: 1, health: 1, protection: 1 };

function reliefSelectTool(tool) {
  if (!_RELIEF_BUILT[tool]) return;
  // Switching tools clears any RELIEF globe layer owned by the previous tool,
  // so arcs/markers never accumulate across tools.
  if (_reliefActiveTool !== tool) reliefClearGlobe();
  _reliefActiveTool = tool;
  document.querySelectorAll('.rl-tool').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  reliefRefreshFocus();
  if (tool === 'sitrep')       return reliefSituationReport();
  if (tool === 'council')      return reliefResponseCouncil();
  if (tool === 'matrix')       return reliefNeedsMatrix();
  if (tool === 'displacement') return reliefDisplacement();
  if (tool === 'famine')       return reliefFamine();
  if (tool === 'access')       return reliefAccess();
  if (tool === 'recovery')     return reliefRecovery();
  if (tool === 'goodnews')     return reliefGoodNews();
  if (tool === 'health')       return reliefHealth();
  if (tool === 'protection')   return reliefProtection();
}

function _rlWork() { return document.getElementById('rl-work-scroll'); }
function _rlStatus(html) { const e = document.getElementById('rl-status'); if (e) e.innerHTML = html; }

// ── Context building (shared by sitrep + council) ───────────
// Grounds AI tools in REAL live data: NEWS relevant to the focus,
// nearby SNAPSHOT_EVENTS, and the focus REGION/COUNTRY record.
function _haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Keyword tokens from the focus, used to match NEWS when no coords exist.
function _reliefFocusTokens(f) {
  const src = `${f.name || ''} ${f.region || ''}`.toLowerCase();
  return [...new Set(src.split(/[\s,\/]+/).filter(w => w.length > 3))];
}

// Score a story's relevance to the focus: token overlap + geo proximity + recency.
// Higher is better. Used to rank the (now deeper) relevant-news set.
function _reliefStoryRelevance(s, f, tokens, hasCoords, radiusKm) {
  const txt = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
  let score = 0;
  for (const t of tokens) { if (txt.includes(t)) score += 3; }
  if (hasCoords && typeof s.lat === 'number' && typeof s.lng === 'number') {
    const d = _haversineKm(f.lat, f.lng, s.lat, s.lng);
    if (d < radiusKm) score += Math.max(0, 4 * (1 - d / radiusKm));
  }
  // Recency nudge — fresher stories rank a little higher within equal relevance.
  const pub = s._pub || 0;
  if (pub) { const ageH = (Date.now() - pub) / 3600000; if (ageH < 72) score += Math.max(0, 1.5 * (1 - ageH / 72)); }
  if (s.brk) score += 0.5;
  return score;
}

// Returns { news, events, links, regionRec, countryRec, history, tokens, radiusKm }
// ASYNC: pulls Supabase HISTORICAL context for the focus region so tools see how
// a situation developed over time, not just this minute. Callers await it.
async function reliefBuildContext(f) {
  f = f || _reliefFocus || reliefResolveFocus();
  const NEWS_ = (typeof NEWS !== 'undefined') ? NEWS : [];
  const EVENTS_ = (typeof SNAPSHOT_EVENTS !== 'undefined') ? SNAPSHOT_EVENTS : [];
  const REGIONS_ = (typeof REGION_DATA !== 'undefined') ? REGION_DATA : [];
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];
  const tokens = _reliefFocusTokens(f);
  const hasCoords = typeof f.lat === 'number' && typeof f.lng === 'number' && !isNaN(f.lat);
  const radiusKm = 1400;
  const NEWS_CAP = 30;     // deeper: up to ~30 focus-relevant stories

  // News relevant to the focus — ranked by relevance/recency, deeper cap.
  let news;
  if (f.kind === 'global') {
    news = [...NEWS_]
      .sort((a, b) => (b._pub || 0) - (a._pub || 0))
      .slice(0, NEWS_CAP);
  } else {
    const scored = NEWS_
      .map(s => ({ s, score: _reliefStoryRelevance(s, f, tokens, hasCoords, radiusKm) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    news = scored.map(x => x.s);
    if (news.length < 6) {
      // Broaden — keep relevance but ensure the model has material (most recent first)
      const have = new Set(news);
      const extra = [...NEWS_].filter(s => !have.has(s)).sort((a, b) => (b._pub || 0) - (a._pub || 0)).slice(0, 8 - news.length);
      news = [...news, ...extra];
    }
    news = news.slice(0, NEWS_CAP);
  }

  // Nearby snapshot events
  let events;
  if (f.kind === 'global') {
    events = [...EVENTS_].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)).slice(0, 14);
  } else if (hasCoords) {
    events = EVENTS_
      .map(e => ({ e, d: (typeof e.lat === 'number') ? _haversineKm(f.lat, f.lng, e.lat, e.lng) : Infinity }))
      .filter(x => x.d < radiusKm * 1.6)
      .sort((a, b) => a.d - b.d)
      .slice(0, 14)
      .map(x => ({ ...x.e, _distKm: Math.round(x.d) }));
  } else {
    events = EVENTS_.filter(e => {
      const txt = `${e.title || ''} ${e.brief || ''}`.toLowerCase();
      return tokens.some(t => txt.includes(t));
    }).slice(0, 14);
  }

  // Connection links among the in-context events (events carry `.links` = ids of
  // events connected in space & time by the worker). Surface the resolved pairs
  // so AI tools see how nearby events relate, not just isolated points.
  const links = [];
  try {
    const inCtx = new Map();
    events.forEach(e => { if (e && typeof e.id === 'string') inCtx.set(e.id, e); });
    const seenLink = new Set();
    for (const a of events) {
      if (!a || !Array.isArray(a.links)) continue;
      for (const bId of a.links) {
        const b = inCtx.get(bId) || EVENTS_.find(x => x && x.id === bId);
        if (!b) continue;
        const k = a.id < bId ? `${a.id}|${bId}` : `${bId}|${a.id}`;
        if (seenLink.has(k)) continue; seenLink.add(k);
        links.push({ a: a.title || a.brief || a.id, b: b.title || b.brief || bId });
      }
    }
  } catch (e) {}

  // Focus region / country record (full record: threat, conflict, sanctions, nuclear, pop, gdp)
  let regionRec = null;
  if (f.raw && f.raw.threat_level) regionRec = f.raw;     // focus already is a region
  if (!regionRec && hasCoords && REGIONS_.length) {
    regionRec = REGIONS_
      .map(r => ({ r, d: (typeof r.lat === 'number') ? _haversineKm(f.lat, f.lng, r.lat, r.lng) : Infinity }))
      .sort((a, b) => a.d - b.d)[0];
    regionRec = (regionRec && regionRec.d < 2000) ? regionRec.r : null;
  }
  if (!regionRec) {
    regionRec = REGIONS_.find(r => tokens.some(t => (r.name || '').toLowerCase().includes(t))) || null;
  }
  let countryRec = null;
  if (hasCoords && COUNTRIES_.length) {
    countryRec = COUNTRIES_
      .map(c => ({ c, d: (typeof c.lat === 'number') ? _haversineKm(f.lat, f.lng, c.lat, c.lng) : Infinity }))
      .sort((a, b) => a.d - b.d)[0];
    countryRec = (countryRec && countryRec.d < 1500) ? countryRec.c : null;
  }
  if (!countryRec) {
    countryRec = COUNTRIES_.find(c => tokens.some(t => (c.name || '').toLowerCase().includes(t))) || null;
  }

  // HISTORICAL context from Supabase (~2000-row stories table). Pull stories
  // related to the focus so tools see how the situation developed over time.
  // Best-effort: never blocks the tool — empty on any failure.
  let history = [];
  try {
    if (typeof sbSearchHistory === 'function') {
      // Seed query from the strongest focus token / region name.
      const query = (f.region || f.name || '').trim();
      const isGlobalLike = !query || /^global$/i.test(query);
      if (!isGlobalLike) {
        const remote = await sbSearchHistory({ query, days: 120, limit: 24 });
        // Drop anything already present in the live relevant-news set (by title).
        const liveTitles = new Set(news.map(s => (s.title || '').toLowerCase().slice(0, 70)));
        history = (remote || [])
          .filter(s => !liveTitles.has((s.title || '').toLowerCase().slice(0, 70)))
          .sort((a, b) => (b._pub || 0) - (a._pub || 0))
          .slice(0, 14);
      } else if (typeof sbFetchRelatedHistory === 'function' && news.length) {
        // Global focus — pull related history off the dominant categories in view.
        const remote = await sbFetchRelatedHistory(news.slice(0, 8), 14);
        history = (remote || []).slice(0, 14);
      }
    }
  } catch (e) { history = []; }

  return { news, events, links, regionRec, countryRec, history, tokens, radiusKm };
}

// Render context as a compact text block for the model. Grounds AI tools in the
// DEEPER context object: full region/country record, nearby events + their
// connection links, the relevant live-news set, and Supabase historical context.
function _reliefContextText(f, ctx) {
  const lines = [];
  lines.push(`OPERATIONAL FOCUS: ${f.name}${f.region && f.region !== f.name ? ' (' + f.region + ')' : ''}`);
  if (typeof f.lat === 'number') lines.push(`COORDINATES: ${f.lat.toFixed(2)}, ${f.lng.toFixed(2)}`);
  if (ctx.regionRec) {
    const r = ctx.regionRec;
    lines.push(`REGION RECORD: ${r.name || '—'} · threat level ${(r.threat_level || 'unknown').toUpperCase()}` +
      `${r.conflict_active ? ' · CONFLICT ACTIVE' : ''}${r.radius_km ? ' · zone radius ~' + r.radius_km + 'km' : ''}` +
      `${r.description ? ' · ' + r.description : (r.notes ? ' · ' + r.notes : '')}`);
  }
  if (ctx.countryRec) {
    const c = ctx.countryRec;
    const flags = [
      c.conflict_active   ? 'ACTIVE CONFLICT' : '',
      c.sanctions_subject ? 'UNDER SANCTIONS' : '',
      c.nuclear_armed     ? 'NUCLEAR ARMED'  : '',
      c.un_p5             ? 'UN P5'           : '',
      c.nato_member       ? 'NATO'            : '',
    ].filter(Boolean).join(', ');
    const stats = [
      c.population_millions != null ? `pop ~${c.population_millions}M (estimate)` : (c.population ? `pop ~${c.population} (estimate)` : ''),
      c.gdp_billions != null ? `GDP ~$${c.gdp_billions}B (estimate)` : '',
    ].filter(Boolean).join(' · ');
    lines.push(`COUNTRY RECORD: ${c.name}${flags ? ' (' + flags + ')' : ''}${stats ? ' · ' + stats : ''}`);
  }
  if (ctx.events && ctx.events.length) {
    lines.push('\nNEARBY SENSED EVENTS (live):');
    ctx.events.forEach(e => {
      lines.push(`- [${(e.type || e.sense || 'event').toUpperCase()}] ${e.title || ''} — ${e.brief || ''}` +
        `${typeof e.severity === 'number' ? ' (severity ' + Math.round(e.severity * 100) + '%)' : ''}` +
        `${e._distKm != null ? ' (~' + e._distKm + 'km)' : ''} [${e.confidence || 'unconfirmed'}]`);
    });
  }
  if (ctx.links && ctx.links.length) {
    lines.push('\nEVENT CONNECTIONS (sensed links in space & time):');
    ctx.links.slice(0, 10).forEach(l => lines.push(`- ${l.a} <-> ${l.b}`));
  }
  if (ctx.news && ctx.news.length) {
    lines.push('\nRELEVANT NEWS (live feed):');
    ctx.news.forEach(s => {
      lines.push(`- [${(s.cat || 'geo').toUpperCase()}] ${s.title}${s.summary ? ' — ' + s.summary : ''} (${s.src || 'src'})`);
    });
  }
  if (ctx.history && ctx.history.length) {
    lines.push('\nHISTORICAL CONTEXT (archive — how this developed over time):');
    ctx.history.forEach(s => {
      lines.push(`- [${(s.cat || 'geo').toUpperCase()}] ${s.title}${s.summary ? ' — ' + s.summary : ''} (${s.src || 'archive'}${s.time ? ', ' + s.time : ''})`);
    });
  }
  return lines.join('\n');
}

function _reliefSourceList(ctx) {
  const srcs = new Set();
  (ctx.news || []).forEach(s => { if (s.src) srcs.add(s.src); });
  (ctx.history || []).forEach(s => { if (s.src) srcs.add(s.src); });
  (ctx.events || []).forEach(e => (e.sources || []).forEach(src => { if (src && src.name) srcs.add(src.name); }));
  return [...srcs];
}

function _reliefNoFocusGuard() {
  // Tools operate on Global even with no pin; we surface a gentle hint instead of blocking.
  return _reliefFocus && _reliefFocus.kind === 'global';
}

function _reliefAIUnavailable(msg) {
  return `<div class="rl-error"><strong>AI UNAVAILABLE</strong>${msg || 'The model could not be reached. Check the OpenAI key or quota and try again. Algorithmic tools (Needs &amp; Gaps Matrix) still work offline.'}</div>`;
}

// ═══════════════════════════════════════════
// TOOL 01 — SITUATION REPORT (AI)
// ═══════════════════════════════════════════
async function reliefSituationReport() {
  reliefRefreshFocus();
  const f = _reliefFocus;
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const globalHint = _reliefNoFocusGuard()
    ? '<div class="rl-mx-empty" style="margin-bottom:10px">No region pinned — reporting on a GLOBAL basis. Pin a region from the globe or Analyst feed for a focused sitrep.</div>' : '';

  _rlStatus('TOOL 01 · GENERATING HUMANITARIAN SITUATION REPORT…');
  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Situation Report</span><span class="rl-tool-sub">01 · HUMANITARIAN SITREP</span></div>
    ${globalHint}
    <div class="rl-classify">RELIEF SITREP · ${f.name.toUpperCase()} · ${now}</div>
    <div class="rl-brief"><div class="rl-loading rl-loading-anim">GROUNDING IN LIVE NEWS, SENSED EVENTS &amp; ARCHIVE HISTORY…</div></div>`;

  const ctx = await reliefBuildContext(f);
  const briefLoad = work.querySelector('.rl-brief .rl-loading');
  if (briefLoad) briefLoad.textContent = `GROUNDING IN ${ctx.news.length} NEWS ITEMS · ${ctx.events.length} SENSED EVENTS · ${ctx.history.length} ARCHIVE STORIES…`;
  const ctxText = _reliefContextText(f, ctx);
  const sources = _reliefSourceList(ctx);

  const sys = `You are a senior humanitarian situation analyst writing a relief sitrep for an operations cell (think OCHA / IFRC desk officer). You are honest and grounded: you ONLY use the supplied context, you NEVER invent precise figures, and you explicitly label any population, displacement, or casualty figure as an ESTIMATE with its basis. If the context is thin, say so plainly rather than fabricate. Write in clear operational prose. Output PLAIN TEXT using these exact section headers, each on its own line followed by content:
OVERVIEW:
AFFECTED & DISPLACED (ESTIMATE):
INFRASTRUCTURE & ACCESS:
URGENT NEEDS BY SECTOR:
RECOMMENDED RESPONSE:
CONFIDENCE & SOURCES:
Under URGENT NEEDS BY SECTOR, give one short line per sector that is actually relevant (Food, Water/WASH, Shelter, Health, Protection, Logistics). End CONFIDENCE & SOURCES with an honest confidence level (LOW/MODERATE/HIGH) and name the sources you relied on.`;

  const user = `Write a humanitarian situation report for the operational focus below. Ground every statement in this context; do not introduce outside facts. Label all figures as estimates.\n\n${ctxText}\n\nAvailable named sources: ${sources.length ? sources.join(', ') : 'live sensor feeds only'}.`;

  let text;
  try {
    text = await callOpenAI(sys, user, 1300);
  } catch (e) {
    _rlStatus('TOOL 01 · AI UNAVAILABLE');
    const brief = work.querySelector('.rl-brief');
    if (brief) brief.innerHTML = _reliefAIUnavailable(`The situation report could not be generated: ${e.message}.`);
    return;
  }
  if (!text || !text.trim()) {
    _rlStatus('TOOL 01 · NO CONTENT RETURNED');
    const brief = work.querySelector('.rl-brief');
    if (brief) brief.innerHTML = _reliefAIUnavailable('The model returned no content. Try again.');
    return;
  }

  window._reliefSitrepText = text;
  const briefEl = work.querySelector('.rl-brief');
  if (briefEl) briefEl.innerHTML = _reliefRenderSitrep(text);
  // Action bar (export)
  const hdr = work.querySelector('.rl-tool-hdr');
  if (hdr && !work.querySelector('.rl-actbar')) {
    const bar = document.createElement('div');
    bar.className = 'rl-actbar';
    bar.innerHTML = `<button class="rl-btn" onclick="reliefExportSitrep()">EXPORT HTML</button>
      <button class="rl-btn rl-btn-ghost" onclick="reliefSituationReport()">REGENERATE</button>`;
    hdr.insertAdjacentElement('afterend', bar);
  }
  _rlStatus(`TOOL 01 · SITREP READY · ${ctx.news.length} SOURCES · ${now}`);
}

const _RL_SECTOR_LBL = ['Food', 'Water/WASH', 'Shelter', 'Health', 'Protection', 'Logistics'];

function _reliefRenderSitrep(text) {
  // Split on the known ALL-CAPS section headers (ending in ":").
  const lines = text.split('\n');
  let html = '';
  let openSec = false;
  const flush = () => { if (openSec) { html += '</div>'; openSec = false; } };
  lines.forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (/^[A-Z][A-Z&/()\s]+:$/.test(line)) {
      flush();
      html += `<div class="rl-sec"><div class="rl-sec-hdr">${line.replace(/:$/, '')}</div>`;
      openSec = true;
      return;
    }
    // Mark estimate phrases
    let body = line
      .replace(/\(estimate[^)]*\)/gi, m => `<span class="rl-est">${m}</span>`)
      .replace(/\b(estimated|approximately|roughly|~)\b/gi, m => `<span class="rl-est">${m}</span>`);
    // Sector lines like "Food: ..." inside URGENT NEEDS
    const sectorMatch = body.match(/^([-•]\s*)?([A-Za-z/ ]{3,20}):\s*(.+)$/);
    if (sectorMatch && _RL_SECTOR_LBL.some(s => sectorMatch[2].toLowerCase().includes(s.toLowerCase().split('/')[0]))) {
      html += `<div class="rl-need"><span class="rl-need-lbl">${sectorMatch[2].trim()}</span><span class="rl-need-txt">${sectorMatch[3]}</span></div>`;
    } else {
      html += `<p class="rl-p">${body.replace(/^[-•]\s*/, '')}</p>`;
    }
  });
  flush();
  return html;
}

function reliefExportSitrep() {
  const text = window._reliefSitrepText || '';
  const f = _reliefFocus || reliefResolveFocus();
  const now = new Date().toLocaleString();
  const body = _reliefRenderSitrep(text);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>AUSPEX RELIEF SITREP — ${f.name} — ${now}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#05080a;color:#a8c4b6;font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.8}
.banner{background:#0d2b1e;border-top:1px solid #34D399;border-bottom:1px solid #34D399;color:#34D399;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px}
.body{max-width:820px;margin:0 auto;padding:36px 30px}
.wordmark{font-size:11px;letter-spacing:.3em;color:#34D399;text-align:center;margin:18px 0 4px}
.title{font-size:20px;font-weight:800;letter-spacing:.06em;color:#dffaee;text-align:center;font-family:Georgia,serif}
.meta{font-size:9px;letter-spacing:.12em;color:#4f7a66;text-align:center;margin:6px 0 26px}
.rl-sec{margin-bottom:20px}.rl-sec-hdr{font-size:9px;letter-spacing:.2em;color:#34D399;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid rgba(52,211,153,.18)}
.rl-p{font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#a8c4b6;margin-bottom:9px}
.rl-need{display:flex;gap:12px;margin-bottom:6px}.rl-need-lbl{color:#7e9a8d;width:130px;flex-shrink:0;font-size:10px}.rl-need-txt{font-family:Georgia,serif;color:#a8c4b6;font-size:12px}
.rl-est{color:#FACC15}</style></head>
<body><div class="banner">AUSPEX RELIEF — HUMANITARIAN OPERATIONS</div>
<div class="body"><div class="wordmark">RELIEF SITUATION REPORT</div><div class="title">${f.name}</div><div class="meta">GENERATED ${now} · GROUNDED IN LIVE AUSPEX SENSOR &amp; NEWS DATA · FIGURES ARE ESTIMATES</div>${body}</div>
<div class="banner">AUSPEX RELIEF — HUMANITARIAN OPERATIONS</div></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `relief-sitrep-${Date.now()}.html`;
  a.click();
}

// ═══════════════════════════════════════════
// TOOL 02 — RESPONSE COUNCIL (AI, multi-role)
// ═══════════════════════════════════════════
const RELIEF_ROLES = [
  { id: 'logistics',  name: 'LOGISTICS & ACCESS',       color: '#5AC8FA', spec: 'humanitarian logistics, supply corridors, transport, customs, last-mile access, and physical reach into the affected area' },
  { id: 'health',     name: 'HEALTH & MEDICAL',         color: '#34D399', spec: 'public health, trauma and emergency medical care, disease outbreak risk, vaccination, and health-system capacity' },
  { id: 'shelter',    name: 'SHELTER & CAMP COORD',      color: '#A78BFA', spec: 'emergency shelter, settlement and camp coordination & management (CCCM), site planning, and non-food items' },
  { id: 'wash',       name: 'FOOD / WATER / WASH',       color: '#FACC15', spec: 'food security, nutrition, safe water, sanitation and hygiene (WASH), and prevention of waterborne disease' },
  { id: 'protection', name: 'PROTECTION & RIGHTS',       color: '#FB923C', spec: 'protection of civilians, gender-based violence, child protection, legal status of displaced people, and human rights' },
];
const _RL_ROLE_ICON = {
  logistics:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  health:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  shelter:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  wash:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5S5 10 5 14a7 7 0 0 0 14 0c0-4-7-11.5-7-11.5z"/></svg>',
  protection: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
};

async function reliefResponseCouncil() {
  reliefRefreshFocus();
  const f = _reliefFocus;
  const ctx = await reliefBuildContext(f);
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const ctxText = _reliefContextText(f, ctx);
  const globalHint = _reliefNoFocusGuard()
    ? '<div class="rl-mx-empty" style="margin-bottom:10px">No region pinned — the council is convening on a GLOBAL basis. Pin a region for a crisis-specific plan.</div>' : '';

  _rlStatus('TOOL 02 · CONVENING 5-ROLE RESPONSE COUNCIL…');
  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Response Council</span><span class="rl-tool-sub">02 · MULTI-ROLE HUMANITARIAN PLANNING</span></div>
    ${globalHint}
    <div class="rl-classify">RESPONSE COUNCIL · ${f.name.toUpperCase()} · ${now}</div>
    <div class="rl-council" id="rl-council-cards">
      ${RELIEF_ROLES.map(r => `
        <div class="rl-role" id="rl-role-${r.id}" style="--rc:${r.color}">
          <div class="rl-role-hdr"><span class="rl-role-ico">${_RL_ROLE_ICON[r.id] || ''}</span>${r.name}</div>
          <div class="rl-role-body rl-loading-anim">Assessing…</div>
        </div>`).join('')}
    </div>
    <div class="rl-synth" id="rl-council-synth">
      <div class="rl-synth-hdr">COORDINATOR · PRIORITIZED JOINT RESPONSE</div>
      <div class="rl-synth-body rl-loading-anim" id="rl-synth-body">Awaiting role assessments…</div>
    </div>`;

  if (!OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI')) {
    _rlStatus('TOOL 02 · AI UNAVAILABLE');
    document.getElementById('rl-council-cards').innerHTML = _reliefAIUnavailable('The Response Council needs the OpenAI model. Configure a key to convene the council.');
    document.getElementById('rl-council-synth').style.display = 'none';
    return;
  }

  // ── 5 parallel role calls ──
  const rolePromises = RELIEF_ROLES.map(role =>
    callOpenAI(
      `You are the ${role.name} cluster lead in a humanitarian response. Your expertise: ${role.spec}. You are honest and grounded — use only the supplied context, label any figure as an estimate, and never invent precision. Respond ONLY with valid JSON.`,
      `Assess the crisis below STRICTLY from your cluster's perspective.\n\n${ctxText}\n\nRespond with ONLY this JSON (no markdown):\n{"assessment":"2-3 sentence cluster-specific read of the situation, grounded in the context","action":"the single most important action your cluster recommends now","severity":INTEGER_0_TO_100}\nSeverity = how acute the need is in YOUR sector (0 calm, 100 catastrophic). Base it on the evidence, not defaults.`,
      300
    ).then(txt => {
      try {
        const parsed = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] || '{}');
        return { ...role, ...parsed, ok: true };
      } catch { return { ...role, assessment: 'Response could not be parsed.', action: '—', severity: 50, ok: false }; }
    }).catch(e => ({ ...role, assessment: `Cluster assessment unavailable (${e.message}).`, action: '—', severity: 50, ok: false }))
  );

  const roles = await Promise.all(rolePromises.map(async (p, i) => {
    const r = await p;
    const card = document.getElementById(`rl-role-${RELIEF_ROLES[i].id}`);
    if (card) {
      const sev = Math.max(0, Math.min(100, +r.severity || 0));
      const sevCol = sev > 66 ? '#FF4D5E' : sev > 33 ? '#FB923C' : '#FACC15';
      card.innerHTML = `
        <div class="rl-role-hdr"><span class="rl-role-ico">${_RL_ROLE_ICON[r.id] || ''}</span>${r.name}
          <span style="margin-left:auto;font-size:8px;color:${sevCol}">${sev}</span></div>
        <div class="rl-role-body">${r.assessment || ''}</div>
        ${r.action && r.action !== '—' ? `<div class="rl-role-action"><b>ACTION ·</b> ${r.action}</div>` : ''}`;
    }
    return r;
  }));

  // ── Coordinator synthesis ──
  _rlStatus('TOOL 02 · COORDINATOR SYNTHESIZING JOINT RESPONSE…');
  const roleSummary = roles.map(r => `${r.name} (need ${r.severity}/100): ${r.assessment} | RECOMMENDED: ${r.action}`).join('\n');
  let synthesis;
  try {
    synthesis = await callOpenAI(
      `You are the Humanitarian Coordinator synthesizing five cluster leads into one prioritized joint response plan. Be decisive and operational, honest about uncertainty, and label figures as estimates. Write 3-4 short paragraphs in plain text: (1) the overall picture and most acute needs, (2) a prioritized sequence of actions across clusters for the first 72 hours, (3) the key access/coordination constraint, (4) what to monitor.`,
      `OPERATIONAL FOCUS: ${f.name}\n\nCONTEXT:\n${ctxText}\n\nCLUSTER ASSESSMENTS:\n${roleSummary}\n\nWrite the prioritized joint response plan.`,
      900
    );
  } catch (e) { synthesis = ''; }

  const synthEl = document.getElementById('rl-synth-body');
  if (synthEl) {
    synthEl.classList.remove('rl-loading-anim');
    if (synthesis && synthesis.trim()) {
      synthEl.innerHTML = synthesis.split('\n').filter(l => l.trim()).map(l => `<p>${l.trim()}</p>`).join('');
    } else {
      synthEl.innerHTML = '<p style="color:#FF8A93">Coordinator synthesis unavailable — role assessments above still stand.</p>';
    }
  }
  _rlStatus(`TOOL 02 · COUNCIL COMPLETE · ${roles.filter(r => r.ok).length}/5 CLUSTERS · ${now}`);
}

// ═══════════════════════════════════════════
// TOOL 03 — NEEDS & GAPS MATRIX (algorithmic)
// ═══════════════════════════════════════════
// Six sectors × {Severity, Coverage, Gap}. Scored from REAL signals:
// keyword counts in relevant NEWS, severity of nearby SNAPSHOT_EVENTS,
// and the focus region threat level. No randomness.
const _RL_MX_SECTORS = [
  { id: 'food',       label: 'Food',        kw: ['food', 'famine', 'hunger', 'starv', 'crop', 'harvest', 'nutrition', 'malnutrition'] },
  { id: 'wash',       label: 'Water/WASH',  kw: ['water', 'wash', 'sanitation', 'cholera', 'hygiene', 'drought', 'well', 'sewage'] },
  { id: 'shelter',    label: 'Shelter',     kw: ['shelter', 'displaced', 'refugee', 'camp', 'homeless', 'tent', 'housing', 'idp'] },
  { id: 'health',     label: 'Health',      kw: ['health', 'hospital', 'medical', 'disease', 'outbreak', 'wounded', 'injur', 'clinic', 'epidemic'] },
  { id: 'protection', label: 'Protection',  kw: ['protection', 'civilian', 'children', 'violence', 'abuse', 'detention', 'human rights', 'trafficking', 'gbv'] },
  { id: 'logistics',  label: 'Logistics',   kw: ['access', 'aid', 'corridor', 'convoy', 'blockade', 'siege', 'road', 'airport', 'port', 'supply', 'border'] },
];

async function reliefNeedsMatrix() {
  reliefRefreshFocus();
  const f = _reliefFocus;
  const work = _rlWork();
  if (work && !work.querySelector('.rl-mx-grid')) {
    work.innerHTML = `<div class="rl-tool-hdr"><span class="rl-tool-title">Needs &amp; Gaps Matrix</span><span class="rl-tool-sub">03 · LIVE SIGNAL SCORING</span></div>
      <div class="rl-mx-empty rl-loading-anim">Scoring sectors from live news, sensed events, region threat &amp; archive history…</div>`;
  }
  const ctx = await reliefBuildContext(f);
  const now = new Date().toLocaleTimeString();

  // Region threat → base severity multiplier
  const threatMul = { critical: 1.0, high: 0.8, elevated: 0.55 };
  const baseThreat = ctx.regionRec ? (threatMul[ctx.regionRec.threat_level] || 0.4) : 0.3;

  // Combined live + archive news pool for sector scoring (history deepens the signal).
  const newsPool = [...(ctx.news || []), ...(ctx.history || [])];

  // Per-sector raw signals
  const rows = _RL_MX_SECTORS.map(sec => {
    // News signals: stories whose text hits this sector's keywords (live first, then archive)
    const newsHits = newsPool.filter(s => {
      const t = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
      return sec.kw.some(k => t.includes(k));
    });
    // Event signals: nearby sensed events touching this sector + their severity
    const eventHits = ctx.events.filter(e => {
      const t = `${e.title || ''} ${e.brief || ''} ${e.type || ''}`.toLowerCase();
      return sec.kw.some(k => t.includes(k)) || (sec.id === 'health' && /quake|flood|storm|cyclone/.test(t)) || (sec.id === 'shelter' && /flood|storm|cyclone|quake|fire/.test(t));
    });
    const eventSevSum = eventHits.reduce((a, e) => a + (e.severity ?? 0), 0);

    // SEVERITY 0-100: weighted blend of keyword density, event severity, region threat
    let severity = 0;
    severity += Math.min(newsHits.length, 6) * 9;          // up to 54 from news
    severity += Math.min(eventSevSum * 40, 30);            // up to 30 from sensed events
    severity += baseThreat * 26;                            // up to 26 from region threat
    severity = Math.round(Math.min(100, severity));

    // COVERAGE 0-100: presence of response/aid signals in the same news set.
    // Low coverage when severe but no response language is present.
    const coverWords = ['aid', 'relief', 'humanitarian', 'response', 'deliver', 'evacuat', 'rescue', 'corridor', 'assist', 'ngo', 'red cross', 'un '];
    const coverHits = newsPool.filter(s => {
      const t = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
      return sec.kw.some(k => t.includes(k)) && coverWords.some(c => t.includes(c));
    });
    let coverage = Math.round(Math.min(100, coverHits.length * 22 + (severity > 0 ? 8 : 0)));
    // No measured severity → coverage is not meaningful; keep low.
    if (severity === 0) coverage = 0;

    // GAP = severity not met by coverage.
    const gap = Math.max(0, Math.round(severity * (1 - coverage / 100)));

    return { ...sec, severity, coverage, gap, newsHits, eventHits };
  });

  window._reliefMatrixRows = rows;

  const cols = [
    { key: 'severity', label: 'Severity' },
    { key: 'coverage', label: 'Coverage', invert: true }, // high coverage = good = low warmth
    { key: 'gap', label: 'Gap' },
  ];

  // Warm severity ramp via theme vars.
  const ramp = v => v >= 67 ? 'var(--sev-high)' : v >= 34 ? 'var(--sev-mid)' : v > 0 ? 'var(--sev-low)' : 'rgba(80,110,95,.18)';
  // For coverage, invert: high coverage is reassuring (cool/green), low is warm.
  const rampCov = v => v === 0 ? 'rgba(80,110,95,.18)' : v >= 67 ? 'rgba(52,211,153,.55)' : v >= 34 ? 'var(--sev-low)' : 'var(--sev-mid)';
  const band = (v, invert) => {
    if (v === 0) return '—';
    if (invert) return v >= 67 ? 'GOOD' : v >= 34 ? 'PARTIAL' : 'THIN';
    return v >= 67 ? 'CRITICAL' : v >= 34 ? 'HIGH' : 'MODERATE';
  };

  let grid = '<div class="rl-mx-grid">';
  grid += '<div class="rl-mx-cell rl-mx-corner"></div>';
  cols.forEach(c => { grid += `<div class="rl-mx-cell rl-mx-colhdr">${c.label}</div>`; });
  rows.forEach(r => {
    grid += `<div class="rl-mx-cell rl-mx-rowhdr">${r.label}</div>`;
    cols.forEach(c => {
      const v = r[c.key];
      const bg = c.invert ? rampCov(v) : ramp(v);
      grid += `<div class="rl-mx-cell rl-mx-data" data-sector="${r.id}" data-col="${c.key}" style="background:${bg}" onclick="reliefMatrixCell('${r.id}','${c.key}')" title="${r.label} · ${c.label} = ${v}">
        <span class="rl-mx-band">${band(v, c.invert)}</span><span class="rl-mx-val">${v}</span></div>`;
    });
  });
  grid += '</div>';

  const globalHint = _reliefNoFocusGuard()
    ? '<div class="rl-mx-empty" style="margin-bottom:10px">No region pinned — scoring against the GLOBAL signal set. Pin a region for a sharper, area-specific matrix.</div>' : '';

  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Needs &amp; Gaps Matrix</span><span class="rl-tool-sub">03 · LIVE SIGNAL SCORING</span></div>
    ${globalHint}
    <div class="rl-actbar">
      <button class="rl-btn rl-btn-ghost" onclick="reliefNeedsMatrix()">RECALCULATE</button>
      <span class="rl-tool-sub" style="align-self:center">${ctx.news.length} news · ${ctx.events.length} events · region ${ctx.regionRec ? (ctx.regionRec.threat_level || '').toUpperCase() : 'n/a'} · ${now}</span>
    </div>
    <div class="rl-mx-wrap">
      ${grid}
      <div class="rl-mx-detail" id="rl-mx-detail">
        <div class="rl-mx-detail-hdr">SUPPORTING SIGNALS</div>
        <div class="rl-mx-detail-sub">Click any cell to see the live stories and sensed events that drove its score. Severity blends keyword density, nearby event severity, and region threat level. Coverage counts response/aid language; Gap = unmet severity.</div>
        <div class="rl-mx-empty">No cell selected.</div>
      </div>
    </div>`;
  _rlStatus(`TOOL 03 · MATRIX COMPUTED FROM LIVE DATA · ${now}`);
}

function reliefMatrixCell(sectorId, colKey) {
  const rows = window._reliefMatrixRows || [];
  const row = rows.find(r => r.id === sectorId);
  const detail = document.getElementById('rl-mx-detail');
  if (!row || !detail) return;
  document.querySelectorAll('.rl-mx-data').forEach(el => el.classList.toggle('sel', el.dataset.sector === sectorId && el.dataset.col === colKey));

  const colLabel = { severity: 'SEVERITY', coverage: 'COVERAGE', gap: 'GAP' }[colKey];
  const val = row[colKey];

  const newsSig = row.newsHits.map(s => `
    <div class="rl-sig">
      <div class="rl-sig-cat">${(s.cat || 'news').toUpperCase()} · ${s._hist ? 'ARCHIVE' : 'NEWS'}</div>
      <div class="rl-sig-title">${s.title}</div>
      <div class="rl-sig-meta">${s.src || ''}${s.time ? ' · ' + s.time : ''}</div>
    </div>`).join('');
  const eventSig = row.eventHits.map(e => `
    <div class="rl-sig">
      <div class="rl-sig-cat">${(e.type || e.sense || 'EVENT').toUpperCase()} · SENSED${typeof e.severity === 'number' ? ' · SEV ' + Math.round(e.severity * 100) + '%' : ''}</div>
      <div class="rl-sig-title">${e.title || e.brief || ''}</div>
      <div class="rl-sig-meta">${(e.sources || []).map(s => s.name).filter(Boolean).join(', ') || 'sensor feed'}${e._distKm != null ? ' · ~' + e._distKm + 'km' : ''} · ${e.confidence || 'unconfirmed'}</div>
    </div>`).join('');

  const empty = (!newsSig && !eventSig)
    ? '<div class="rl-mx-empty">No discrete stories or events drove this score directly — the value derives from the region threat level baseline.</div>'
    : '';

  detail.innerHTML = `
    <div class="rl-mx-detail-hdr">${row.label} · ${colLabel} = ${val}</div>
    <div class="rl-mx-detail-sub">${row.newsHits.length} news signal${row.newsHits.length === 1 ? '' : 's'} · ${row.eventHits.length} sensed event${row.eventHits.length === 1 ? '' : 's'} matched this sector. Severity ${row.severity} · Coverage ${row.coverage} · Gap ${row.gap}.</div>
    ${empty}${newsSig}${eventSig}`;
}

// ═══════════════════════════════════════════
// TOOL 04 — DISPLACEMENT TRACKER (data + globe arcs + AI)
// ═══════════════════════════════════════════
// Identifies active displacement situations from:
//   (a) REGION_DATA conflict zones (threat critical/high), and
//   (b) high-severity disaster perils in SNAPSHOT_EVENTS (severity >= 0.6,
//       peril polarity, disaster sense — NOT space launches).
// For each origin we estimate likely destination countries via a small
// hardcoded adjacency map for major conflict origins, falling back to the
// nearest COUNTRY_DATA capitals as a neighbour proxy. Displacement arcs are
// drawn origin -> destinations in a distinct amber-dashed RELIEF style and an
// AI one-paragraph narrative grounds each situation in the live context.

// Adjacency for major displacement-origin countries (push neighbours / common
// reception countries). Honest heuristic, labelled as estimate in the UI.
const _RL_ADJACENCY = {
  'Syria':        ['Turkey', 'Lebanon', 'Jordan', 'Iraq'],
  'Ukraine':      ['Poland', 'Russia', 'Germany', 'Romania'],
  'Afghanistan':  ['Pakistan', 'Iran'],
  'Yemen':        ['Saudi Arabia', 'Oman', 'Djibouti'],
  'Sudan':        ['Egypt', 'Chad', 'South Sudan', 'Ethiopia'],
  'South Sudan':  ['Uganda', 'Sudan', 'Ethiopia', 'Kenya'],
  'Somalia':      ['Ethiopia', 'Kenya', 'Yemen'],
  'Myanmar':      ['Bangladesh', 'Thailand', 'India'],
  'Iraq':         ['Turkey', 'Iran', 'Jordan', 'Syria'],
  'Nigeria':      ['Niger', 'Chad', 'Cameroon'],
  'Israel':       ['Egypt', 'Jordan'],
  'Iran':         ['Turkey', 'Iraq', 'Pakistan'],
  'Pakistan':     ['Iran', 'Afghanistan'],
  'Russia':       ['Kazakhstan', 'Georgia'],
};

// Map a REGION_DATA conflict zone / event to a representative origin country.
function _rlOriginCountry(name, lat, lng) {
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];
  const lower = (name || '').toLowerCase();
  // Direct name match against known origins
  const direct = Object.keys(_RL_ADJACENCY).find(c => lower.includes(c.toLowerCase()));
  if (direct) return COUNTRIES_.find(c => c.name === direct) || { name: direct, lat, lng };
  // Nearest country capital as proxy
  if (typeof lat === 'number' && COUNTRIES_.length) {
    let best = null, bestD = Infinity;
    for (const c of COUNTRIES_) {
      if (typeof c.lat !== 'number') continue;
      const d = _haversineKm(lat, lng, c.lat, c.lng);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && bestD < 1400) return best;
  }
  return { name: name || 'Origin', lat, lng };
}

// Destinations for an origin: adjacency list (resolved to COUNTRY_DATA coords
// where available) or, failing that, the nearest distinct capitals.
function _rlDestinations(origin) {
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];
  const byName = {};
  COUNTRIES_.forEach(c => { byName[c.name] = c; });
  const adj = _RL_ADJACENCY[origin.name];
  let dests = [];
  if (adj) {
    dests = adj.map(n => byName[n] || { name: n, lat: null, lng: null }).filter(d => typeof d.lat === 'number');
  }
  if (dests.length < 2 && typeof origin.lat === 'number') {
    // Nearest-capital fallback
    const near = COUNTRIES_
      .filter(c => typeof c.lat === 'number' && c.name !== origin.name)
      .map(c => ({ c, d: _haversineKm(origin.lat, origin.lng, c.lat, c.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map(x => x.c);
    near.forEach(c => { if (!dests.find(d => d.name === c.name)) dests.push(c); });
  }
  return dests.slice(0, 4);
}

// Build the situation list (no AI yet — pure data).
function _rlBuildDisplacements() {
  const REGIONS_ = (typeof REGION_DATA !== 'undefined') ? REGION_DATA : [];
  const EVENTS_ = (typeof SNAPSHOT_EVENTS !== 'undefined') ? SNAPSHOT_EVENTS : [];
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];
  const out = [];
  const seen = new Set();

  // (a) Active conflict countries (REGION_DATA gives zones; COUNTRY_DATA gives
  //     conflict_active origins which are the real displacement sources).
  COUNTRIES_.filter(c => c.conflict_active && typeof c.lat === 'number').forEach(c => {
    if (seen.has(c.name)) return;
    seen.add(c.name);
    const origin = c;
    const dests = _rlDestinations(origin);
    out.push({ origin, dests, cause: 'ARMED CONFLICT', kind: 'conflict', driver: c.name });
  });

  // (b) Critical/high conflict regions not already covered by a country
  REGIONS_.filter(r => (r.threat_level === 'critical' || r.threat_level === 'high') && typeof r.lat === 'number')
    .forEach(r => {
      const origin = _rlOriginCountry(r.name, r.lat, r.lng);
      if (seen.has(origin.name)) return;
      seen.add(origin.name);
      const dests = _rlDestinations({ ...origin, lat: origin.lat ?? r.lat, lng: origin.lng ?? r.lng });
      if (!dests.length) return;
      out.push({ origin: { ...origin, lat: origin.lat ?? r.lat, lng: origin.lng ?? r.lng }, dests, cause: 'CONFLICT ZONE', kind: 'region', driver: r.name });
    });

  // (c) High-severity disaster perils (severity >= 0.6, disaster sense, peril)
  EVENTS_.filter(e => e.sense === 'disaster' && e.polarity === 'peril' && (e.severity ?? 0) >= 0.6 && typeof e.lat === 'number')
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, 6)
    .forEach(e => {
      const origin = _rlOriginCountry(e.title, e.lat, e.lng);
      const key = `${e.type}:${origin.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      const dests = _rlDestinations({ ...origin, lat: origin.lat ?? e.lat, lng: origin.lng ?? e.lng });
      if (!dests.length) return;
      out.push({
        origin: { ...origin, name: origin.name || e.title, lat: origin.lat ?? e.lat, lng: origin.lng ?? e.lng },
        dests, cause: (e.type || 'disaster').toUpperCase(), kind: 'disaster', driver: e.title, event: e,
      });
    });

  return out.slice(0, 10); // cap for an uncluttered globe
}

const _RL_DISP_ARC = { c1: '#FB923Ccc', c2: '#FACC1533' };

function _rlRenderDisplacementArcs(situations) {
  const arcs = [];
  let cap = 24; // cap total arcs
  for (const sit of situations) {
    if (cap <= 0) break;
    const o = sit.origin;
    if (typeof o.lat !== 'number') continue;
    for (const d of sit.dests) {
      if (cap <= 0) break;
      if (typeof d.lat !== 'number') continue;
      arcs.push({ slat: o.lat, slng: o.lng, elat: d.lat, elng: d.lng, c1: _RL_DISP_ARC.c1, c2: _RL_DISP_ARC.c2, _relief: true });
      cap--;
    }
  }
  reliefArcs = arcs;
  if (typeof refreshArcs === 'function') refreshArcs();
  return arcs.length;
}

async function reliefDisplacement() {
  reliefRefreshFocus();
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const situations = _rlBuildDisplacements();
  const arcCount = _rlRenderDisplacementArcs(situations);

  _rlStatus(`TOOL 04 · DISPLACEMENT TRACKER · ${situations.length} SITUATIONS · ${arcCount} ARCS ON GLOBE`);

  if (!situations.length) {
    work.innerHTML = `
      <div class="rl-tool-hdr"><span class="rl-tool-title">Displacement Tracker</span><span class="rl-tool-sub">04 · POPULATION MOVEMENT</span></div>
      <div class="rl-mx-empty">No active displacement situations resolved from current conflict zones or high-severity disaster events. The globe arc layer is clear.</div>`;
    return;
  }

  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Displacement Tracker</span><span class="rl-tool-sub">04 · POPULATION MOVEMENT</span></div>
    <div class="rl-actbar">
      <span class="rl-tool-sub" style="align-self:center">${situations.length} situations · ${arcCount} displacement arcs drawn on the globe (amber) · destinations are an estimate from an adjacency heuristic · ${now}</span>
    </div>
    <div class="rl-disp" id="rl-disp-list">
      ${situations.map((s, i) => `
        <div class="rl-disp-row" id="rl-disp-${i}">
          <div class="rl-disp-hd">
            <span class="rl-disp-origin">${s.origin.name}</span>
            <span class="rl-disp-cause">${s.cause}</span>
          </div>
          <div class="rl-disp-dest">LIKELY DESTINATIONS (ESTIMATE): ${s.dests.map(d => `<b>${d.name}</b>`).join(', ')}</div>
          <div class="rl-disp-narr rl-loading-anim" id="rl-disp-narr-${i}">Generating grounded narrative…</div>
        </div>`).join('')}
    </div>`;

  // AI narratives — one short paragraph per situation, grounded. Graceful if no AI.
  const aiOff = (typeof OPENAI_KEY === 'undefined') || !OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI');
  for (let i = 0; i < situations.length; i++) {
    const s = situations[i];
    const el = document.getElementById(`rl-disp-narr-${i}`);
    if (!el) continue;
    if (aiOff) { el.classList.remove('rl-loading-anim'); el.innerHTML = '<span style="color:#FF8A93">AI unavailable — data and globe arcs still rendered.</span>'; continue; }
    const f = { name: s.origin.name, region: s.origin.name, lat: s.origin.lat, lng: s.origin.lng, kind: s.kind, raw: s.event || null };
    const ctx = await reliefBuildContext(f);
    const ctxText = _reliefContextText(f, ctx);
    try {
      const txt = await callOpenAI(
        'You are a humanitarian displacement analyst (think UNHCR desk). You are honest and grounded: use only the supplied context, never invent precise figures, and label any population/displacement number as an ESTIMATE. Write ONE tight paragraph (3-4 sentences) of plain text — no headers.',
        `Write a one-paragraph displacement narrative for this origin.\n\nORIGIN: ${s.origin.name}\nCAUSE: ${s.cause} (driver: ${s.driver})\nESTIMATED LIKELY DESTINATIONS (adjacency heuristic): ${s.dests.map(d => d.name).join(', ')}\n\nGROUNDING CONTEXT:\n${ctxText}\n\nCover: what is driving the movement, the plausible direction/destinations (as estimates), and the principal protection concern. If context is thin, say so.`,
        260
      );
      el.classList.remove('rl-loading-anim');
      el.textContent = (txt && txt.trim()) ? txt.trim() : 'No narrative returned.';
    } catch (e) {
      el.classList.remove('rl-loading-anim');
      el.innerHTML = `<span style="color:#FF8A93">AI unavailable for this situation (${e.message}). Data and arcs still stand.</span>`;
    }
  }
  _rlStatus(`TOOL 04 · DISPLACEMENT TRACKER READY · ${situations.length} SITUATIONS · ${arcCount} ARCS · ${now}`);
}

// ═══════════════════════════════════════════
// TOOL 05 — FAMINE & FOOD-SECURITY WATCH (data + globe markers + AI)
// ═══════════════════════════════════════════
// Classifies food-security risk on an IPC-style 1-5 scale for at-risk areas,
// driven ONLY by real signals:
//   - drought-type disaster events (SNAPSHOT_EVENTS type 'drought'),
//   - active conflict regions/countries (REGION_DATA / COUNTRY_DATA), and
//   - food-insecurity keyword signals in NEWS.
// No random scoring. Renders a ranked list + distinct globe markers.
const _RL_FOOD_KW = ['famine', 'hunger', 'starv', 'drought', 'crop failure', 'crop fail', 'food crisis', 'food insecurity', 'malnutrition', 'malnourish', 'harvest fail', 'food shortage'];

function _rlClassifyFamine() {
  const REGIONS_ = (typeof REGION_DATA !== 'undefined') ? REGION_DATA : [];
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];
  const EVENTS_ = (typeof SNAPSHOT_EVENTS !== 'undefined') ? SNAPSHOT_EVENTS : [];
  const NEWS_ = (typeof NEWS !== 'undefined') ? NEWS : [];

  // Candidate areas: conflict countries + critical/high regions + drought-event areas.
  const areas = [];
  const pushArea = (name, lat, lng, base) => {
    if (typeof lat !== 'number') return;
    let a = areas.find(x => x.name === name);
    if (!a) { a = { name, lat, lng, score: 0, drivers: new Set() }; areas.push(a); }
    a.score += base;
  };

  COUNTRIES_.filter(c => c.conflict_active && typeof c.lat === 'number').forEach(c => {
    pushArea(c.name, c.lat, c.lng, 1.4);
    areas.find(a => a.name === c.name)?.drivers.add('Active conflict');
  });
  REGIONS_.filter(r => (r.threat_level === 'critical' || r.threat_level === 'high') && typeof r.lat === 'number').forEach(r => {
    pushArea(r.name, r.lat, r.lng, 0.9);
    areas.find(a => a.name === r.name)?.drivers.add('Regional instability');
  });

  // Drought events — strong food-security driver. Attribute to nearest area or add new.
  EVENTS_.filter(e => e.type === 'drought' && typeof e.lat === 'number').forEach(e => {
    let near = null, nd = Infinity;
    for (const a of areas) { const d = _haversineKm(e.lat, e.lng, a.lat, a.lng); if (d < nd) { nd = d; near = a; } }
    if (near && nd < 900) { near.score += 1.6 + (e.severity ?? 0); near.drivers.add('Drought'); }
    else { const nm = e.brief && e.brief.length < 40 ? e.brief : (e.title || 'Drought zone'); pushArea(nm, e.lat, e.lng, 1.6 + (e.severity ?? 0)); areas.find(a => a.name === nm)?.drivers.add('Drought'); }
  });

  // News food-insecurity signals — keyword match attributed to area by region/name.
  areas.forEach(a => {
    const toks = a.name.toLowerCase().split(/[\s,\/]+/).filter(w => w.length > 3);
    const hits = NEWS_.filter(s => {
      const t = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
      return _RL_FOOD_KW.some(k => t.includes(k)) && toks.some(tk => t.includes(tk));
    });
    a.newsHits = hits;
    if (hits.length) { a.score += Math.min(hits.length, 5) * 0.5; a.drivers.add('Food-insecurity news signals'); }
  });

  // Map composite score -> IPC phase 1-5. Thresholds tuned to the real signal range.
  areas.forEach(a => {
    const s = a.score;
    a.phase = s >= 4.0 ? 5 : s >= 2.8 ? 4 : s >= 1.8 ? 3 : s >= 0.9 ? 2 : 1;
    a.drivers = [...a.drivers];
  });

  return areas
    .filter(a => a.phase >= 2)            // only surface stressed-and-above
    .sort((a, b) => b.score - a.score || b.phase - a.phase)
    .slice(0, 10);
}

const _RL_IPC_LBL = { 1: 'MINIMAL', 2: 'STRESSED', 3: 'CRISIS', 4: 'EMERGENCY', 5: 'FAMINE' };
const _RL_IPC_COL = { 1: '#34D399', 2: '#FACC15', 3: '#FB923C', 4: '#FF4D5E', 5: '#7F1D1D' };

async function reliefFamine() {
  reliefRefreshFocus();
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const areas = _rlClassifyFamine();

  // Globe markers — gated to this tool.
  reliefFamineMarkers = areas.map(a => ({ lat: a.lat, lng: a.lng, name: a.name, phase: a.phase, _relief_famine: true }));
  if (typeof updateAllGlobeElements === 'function') updateAllGlobeElements();

  _rlStatus(`TOOL 05 · FAMINE WATCH · ${areas.length} AT-RISK AREAS · ${reliefFamineMarkers.length} MARKERS`);

  if (!areas.length) {
    work.innerHTML = `
      <div class="rl-tool-hdr"><span class="rl-tool-title">Famine &amp; Food-Security Watch</span><span class="rl-tool-sub">05 · IPC-STYLE RISK</span></div>
      <div class="rl-mx-empty">No areas currently classify at IPC Phase 2 (Stressed) or above from live drought events, conflict zones, and food-insecurity news signals.</div>`;
    return;
  }

  const legend = [2, 3, 4, 5].map(p => `<span class="rl-legend-item"><span class="rl-legend-swatch" style="background:${_RL_IPC_COL[p]}"></span>PHASE ${p} ${_RL_IPC_LBL[p]}</span>`).join('');

  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Famine &amp; Food-Security Watch</span><span class="rl-tool-sub">05 · IPC-STYLE RISK · LIVE SIGNALS</span></div>
    <div class="rl-actbar"><span class="rl-tool-sub" style="align-self:center">${areas.length} at-risk areas from drought events + conflict zones + food-insecurity news · markers on globe · phases are an indicative classification, not official IPC · ${now}</span></div>
    <div class="rl-legend">${legend}</div>
    <div class="rl-fam" id="rl-fam-list">
      ${areas.map((a, i) => `
        <div class="rl-fam-row">
          <div class="rl-fam-phase" style="background:${_RL_IPC_COL[a.phase]};${a.phase === 5 ? 'color:#ffd9d9' : ''}">
            <span class="rl-fam-phase-n">${a.phase}</span><span class="rl-fam-phase-l">${_RL_IPC_LBL[a.phase]}</span>
          </div>
          <div>
            <div class="rl-fam-area">${a.name}</div>
            <div class="rl-fam-drivers">${a.drivers.map(d => `<span class="rl-fam-driver">${d}</span>`).join('')}</div>
            <div class="rl-fam-expl rl-loading-anim" id="rl-fam-expl-${i}">Explaining drivers…</div>
          </div>
        </div>`).join('')}
    </div>`;

  // AI driver-explanation for the TOP areas only (cost + clutter control).
  const aiOff = (typeof OPENAI_KEY === 'undefined') || !OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI');
  const topN = Math.min(areas.length, 4);
  for (let i = 0; i < areas.length; i++) {
    const el = document.getElementById(`rl-fam-expl-${i}`);
    if (!el) continue;
    if (i >= topN) { el.classList.remove('rl-loading-anim'); el.textContent = `Drivers: ${areas[i].drivers.join(', ')}.`; continue; }
    if (aiOff) { el.classList.remove('rl-loading-anim'); el.innerHTML = `<span style="color:#FF8A93">AI unavailable</span> — drivers: ${areas[i].drivers.join(', ')}.`; continue; }
    const a = areas[i];
    const f = { name: a.name, region: a.name, lat: a.lat, lng: a.lng, kind: 'famine', raw: null };
    const ctx = await reliefBuildContext(f);
    const ctxText = _reliefContextText(f, ctx);
    try {
      const txt = await callOpenAI(
        'You are a food-security analyst (think FEWS NET / IPC). Honest and grounded — use only supplied context, label any figure as an estimate, and do not overstate. Write 2 short sentences of plain text explaining the food-security drivers. No headers.',
        `Explain the food-security risk drivers for ${a.name}.\nINDICATIVE PHASE: ${a.phase} (${_RL_IPC_LBL[a.phase]}).\nDETECTED DRIVERS: ${a.drivers.join(', ')}.\n\nGROUNDING CONTEXT:\n${ctxText}\n\nBe concise and grounded; if context is thin, say the classification rests mainly on the detected drivers.`,
        180
      );
      el.classList.remove('rl-loading-anim');
      el.textContent = (txt && txt.trim()) ? txt.trim() : `Drivers: ${a.drivers.join(', ')}.`;
    } catch (e) {
      el.classList.remove('rl-loading-anim');
      el.innerHTML = `<span style="color:#FF8A93">AI unavailable</span> — drivers: ${a.drivers.join(', ')}.`;
    }
  }
  _rlStatus(`TOOL 05 · FAMINE WATCH READY · ${areas.length} AREAS · ${reliefFamineMarkers.length} MARKERS · ${now}`);
}

// ═══════════════════════════════════════════
// TOOL 06 — ACCESS & BLACKOUT (repurpose SILENCE; data + globe)
// ═══════════════════════════════════════════
// Reframes information-blackout / silence detection as HUMANITARIAN ACCESS.
// Combines _silenceAnomalies (computed via detectSilenceAnomalies) with active
// conflict regions to classify zones: Open / Constrained / Sealed.
function _rlClassifyAccess() {
  const REGIONS_ = (typeof REGION_DATA !== 'undefined') ? REGION_DATA : [];
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];
  // Ensure silence anomalies are computed (call its compute path if available).
  let anomalies = (typeof _silenceAnomalies !== 'undefined' && _silenceAnomalies.length) ? _silenceAnomalies : [];
  if (!anomalies.length && typeof detectSilenceAnomalies === 'function') {
    try { if (typeof updateSilenceBaseline === 'function') updateSilenceBaseline(); anomalies = detectSilenceAnomalies() || []; } catch (e) {}
  }

  const zones = [];
  const seen = new Set();

  // Silence/blackout zones -> Sealed (HIGH) or Constrained (ELEVATED).
  anomalies.forEach(a => {
    if (typeof a.lat !== 'number') return;
    const status = a.severity === 'HIGH' ? 'sealed' : 'constrained';
    const name = a.region || 'Unknown zone';
    if (seen.has(name)) return; seen.add(name);
    zones.push({ name, lat: a.lat, lng: a.lng, status, why: `Information blackout — ${a.reason || 'no coverage detected'}. Aid access cannot be confirmed.` });
  });

  // Active conflict regions -> Sealed if critical, Constrained if high.
  REGIONS_.filter(r => (r.threat_level === 'critical' || r.threat_level === 'high') && typeof r.lat === 'number').forEach(r => {
    if (seen.has(r.name)) return; seen.add(r.name);
    const status = r.threat_level === 'critical' ? 'sealed' : 'constrained';
    zones.push({ name: r.name, lat: r.lat, lng: r.lng, status, why: `${r.threat_level === 'critical' ? 'Critical' : 'High'} conflict zone${r.description ? ' — ' + r.description : ''}. Movement is contested; access is ${status === 'sealed' ? 'frequently denied' : 'constrained'}.` });
  });

  // Active conflict countries not already covered -> Constrained (operating but limited).
  COUNTRIES_.filter(c => c.conflict_active && typeof c.lat === 'number').forEach(c => {
    if (seen.has(c.name)) return; seen.add(c.name);
    zones.push({ name: c.name, lat: c.lat, lng: c.lng, status: 'constrained', why: 'Active armed conflict — humanitarian access negotiated and intermittent across front lines.' });
  });

  // Order: sealed first, then constrained.
  const rank = { sealed: 0, constrained: 1, open: 2 };
  return zones.sort((a, b) => rank[a.status] - rank[b.status]).slice(0, 14);
}

function reliefAccess() {
  reliefRefreshFocus();
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const zones = _rlClassifyAccess();

  // Globe markers — gated to this tool.
  reliefAccessMarkers = zones.map(z => ({ lat: z.lat, lng: z.lng, name: z.name, status: z.status, _relief_access: true }));
  if (typeof updateAllGlobeElements === 'function') updateAllGlobeElements();

  _rlStatus(`TOOL 06 · ACCESS & BLACKOUT · ${zones.length} ZONES · ${reliefAccessMarkers.length} MARKERS`);

  if (!zones.length) {
    work.innerHTML = `
      <div class="rl-tool-hdr"><span class="rl-tool-title">Access &amp; Blackout</span><span class="rl-tool-sub">06 · HUMANITARIAN ACCESS</span></div>
      <div class="rl-mx-empty">No constrained or sealed access zones detected from silence anomalies or active conflict regions. Where there is no signal of obstruction, access is presumed open — but absence of evidence is not evidence of access.</div>`;
    return;
  }

  const counts = zones.reduce((m, z) => (m[z.status] = (m[z.status] || 0) + 1, m), {});
  const legend = `
    <span class="rl-legend-item"><span class="rl-legend-swatch" style="background:#34D399"></span>OPEN</span>
    <span class="rl-legend-item"><span class="rl-legend-swatch" style="background:#FB923C"></span>CONSTRAINED (${counts.constrained || 0})</span>
    <span class="rl-legend-item"><span class="rl-legend-swatch" style="background:#FF4D5E"></span>SEALED (${counts.sealed || 0})</span>`;

  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Access &amp; Blackout</span><span class="rl-tool-sub">06 · HUMANITARIAN ACCESS · BLACKOUT + CONFLICT</span></div>
    <div class="rl-actbar"><span class="rl-tool-sub" style="align-self:center">${zones.length} zones classified from information-blackout anomalies + active conflict regions · markers on globe · honest framing: sealed/constrained reflects obstruction signals, not a guarantee · ${now}</span></div>
    <div class="rl-legend">${legend}</div>
    <div class="rl-acc" id="rl-acc-list">
      ${zones.map(z => `
        <div class="rl-acc-row">
          <div class="rl-acc-badge rl-acc-${z.status}">${z.status.toUpperCase()}</div>
          <div>
            <div class="rl-acc-zone">${z.name}</div>
            <div class="rl-acc-why">${z.why}</div>
          </div>
        </div>`).join('')}
    </div>`;
  _rlStatus(`TOOL 06 · ACCESS & BLACKOUT READY · ${zones.length} ZONES · ${reliefAccessMarkers.length} MARKERS · ${now}`);
}

// ═══════════════════════════════════════════
// TOOL 07 — RECOVERY TIMELINE (AI)
// ═══════════════════════════════════════════
// Mirrors the analyst Narrative Timeline, oriented to recovery &
// reconstruction. For the current focus crisis it builds context with
// reliefBuildContext() and asks the model for an honest, phased recovery
// assessment: Relief -> Stabilization -> Recovery -> Reconstruction, what is
// rebuilt vs outstanding, milestones (timeframes labelled estimates), and
// risks to recovery — grounded in the live news/region context. Renders as a
// clean phased timeline; exportable to HTML like the sitrep.
const _RL_REC_PHASES = [
  { id: 'relief',         label: 'Relief',         color: '#FF4D5E', sub: 'LIFE-SAVING' },
  { id: 'stabilization',  label: 'Stabilization',  color: '#FB923C', sub: 'STABILIZING' },
  { id: 'recovery',       label: 'Recovery',       color: '#FACC15', sub: 'RESTORING' },
  { id: 'reconstruction', label: 'Reconstruction', color: '#34D399', sub: 'REBUILDING' },
];

async function reliefRecovery() {
  reliefRefreshFocus();
  const f = _reliefFocus;
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const globalHint = _reliefNoFocusGuard()
    ? '<div class="rl-mx-empty" style="margin-bottom:10px">No region pinned — assessing recovery on a GLOBAL basis. Pin a crisis region (e.g. a conflict zone or disaster area) for a focused recovery timeline.</div>' : '';

  _rlStatus('TOOL 07 · BUILDING RECOVERY & RECONSTRUCTION TIMELINE…');
  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Recovery Timeline</span><span class="rl-tool-sub">07 · RECOVERY & RECONSTRUCTION ASSESSMENT</span></div>
    ${globalHint}
    <div class="rl-classify">RECOVERY TIMELINE · ${f.name.toUpperCase()} · ${now}</div>
    <div class="rl-rec" id="rl-rec-body"><div class="rl-loading rl-loading-anim">PHASING RECOVERY FROM LIVE NEWS, SENSED EVENTS &amp; ARCHIVE HISTORY…</div></div>`;

  const ctx = await reliefBuildContext(f);
  const recLoad = document.querySelector('#rl-rec-body .rl-loading');
  if (recLoad) recLoad.textContent = `PHASING RECOVERY FROM ${ctx.news.length} NEWS ITEMS · ${ctx.events.length} SENSED EVENTS · ${ctx.history.length} ARCHIVE STORIES…`;

  if (typeof OPENAI_KEY === 'undefined' || !OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI')) {
    _rlStatus('TOOL 07 · AI UNAVAILABLE');
    const b = document.getElementById('rl-rec-body');
    if (b) b.innerHTML = _reliefAIUnavailable('The Recovery Timeline needs the OpenAI model. Configure a key to generate the phased assessment.');
    return;
  }

  const ctxText = _reliefContextText(f, ctx);
  const sources = _reliefSourceList(ctx);

  const sys = `You are a senior recovery & reconstruction analyst on a humanitarian operations cell (think OCHA early-recovery / World Bank reconstruction desk). You are honest and grounded: you ONLY use the supplied context, you NEVER invent precise figures or dates, and you label EVERY timeframe and figure as an ESTIMATE. If the context is thin, say so plainly rather than fabricate. You assess recovery across four phases — Relief, Stabilization, Recovery, Reconstruction. Output STRICT JSON only (no markdown), exactly:
{"summary":"2-3 sentence honest overview of where this crisis sits on the recovery path","phases":[{"phase":"Relief|Stabilization|Recovery|Reconstruction","status":"underway|partial|outstanding|not-started","rebuilt":"what is being restored / done in this phase (or '-' if none yet)","outstanding":"what remains outstanding in this phase","timeframe":"a rough ESTIMATE timeframe label e.g. 'weeks (estimate)' / 'in progress' / '2-5 years (estimate)' / 'not yet begun'","milestones":["short milestone string (estimate)", "..."]}],"risks":["a concrete risk to recovery grounded in the context","..."],"confidence":"LOW|MODERATE|HIGH"}
Provide all four phases in order. Keep every field grounded in the context; mark uncertainty.`;

  const user = `Assess recovery & reconstruction for the operational focus below. Ground every statement in this context; do not introduce outside facts. Label all timeframes and figures as estimates.\n\n${ctxText}\n\nAvailable named sources: ${sources.length ? sources.join(', ') : 'live sensor feeds only'}.`;

  let raw;
  try {
    raw = await callOpenAI(sys, user, 1400);
  } catch (e) {
    _rlStatus('TOOL 07 · AI UNAVAILABLE');
    const b = document.getElementById('rl-rec-body');
    if (b) b.innerHTML = _reliefAIUnavailable(`The recovery timeline could not be generated: ${e.message}.`);
    return;
  }

  let data;
  try { data = JSON.parse((raw || '').match(/\{[\s\S]*\}/)?.[0] || '{}'); }
  catch { data = null; }
  if (!data || !Array.isArray(data.phases) || !data.phases.length) {
    _rlStatus('TOOL 07 · NO CONTENT RETURNED');
    const b = document.getElementById('rl-rec-body');
    if (b) b.innerHTML = _reliefAIUnavailable('The model returned no usable recovery assessment. Try again.');
    return;
  }

  window._reliefRecoveryData = { focus: f, data, now };
  const body = document.getElementById('rl-rec-body');
  if (body) body.innerHTML = _reliefRenderRecovery(data);

  // Action bar (export / regenerate)
  const hdr = work.querySelector('.rl-tool-hdr');
  if (hdr && !work.querySelector('.rl-actbar')) {
    const bar = document.createElement('div');
    bar.className = 'rl-actbar';
    bar.innerHTML = `<button class="rl-btn" onclick="reliefExportRecovery()">EXPORT HTML</button>
      <button class="rl-btn rl-btn-ghost" onclick="reliefRecovery()">REGENERATE</button>`;
    hdr.insertAdjacentElement('afterend', bar);
  }
  _rlStatus(`TOOL 07 · RECOVERY TIMELINE READY · CONFIDENCE ${(data.confidence || 'n/a').toUpperCase()} · ${now}`);
}

function _reliefRecPhaseMeta(name) {
  const key = String(name || '').toLowerCase();
  return _RL_REC_PHASES.find(p => key.includes(p.id) || key.includes(p.label.toLowerCase())) || _RL_REC_PHASES[0];
}

function _reliefRenderRecovery(data) {
  const statusLbl = { 'underway': 'UNDERWAY', 'partial': 'PARTIAL', 'outstanding': 'OUTSTANDING', 'not-started': 'NOT STARTED' };
  // Phases follow the canonical order even if the model reorders them.
  const ordered = _RL_REC_PHASES.map(meta => {
    const match = (data.phases || []).find(p => _reliefRecPhaseMeta(p.phase).id === meta.id);
    return { meta, p: match };
  }).filter(x => x.p);
  const rows = (ordered.length ? ordered : (data.phases || []).map(p => ({ meta: _reliefRecPhaseMeta(p.phase), p })));

  let html = '';
  if (data.summary) html += `<div class="rl-rec-summary">${data.summary}</div>`;
  html += '<div class="rl-rec-line">';
  rows.forEach(({ meta, p }) => {
    const st = String(p.status || '').toLowerCase();
    const mil = (p.milestones || []).filter(Boolean);
    html += `
      <div class="rl-rec-node" style="--pc:${meta.color}">
        <div class="rl-rec-dot"></div>
        <div class="rl-rec-card">
          <div class="rl-rec-card-hdr">
            <span class="rl-rec-phase">${meta.label}</span>
            <span class="rl-rec-status">${statusLbl[st] || (p.status || '').toUpperCase()}</span>
          </div>
          <div class="rl-rec-time">${_reliefMarkEst(p.timeframe || 'timeframe unknown (estimate)')}</div>
          <div class="rl-rec-grid">
            <div class="rl-rec-col"><span class="rl-rec-col-lbl">RESTORED / DONE</span><span class="rl-rec-col-txt">${_reliefMarkEst(p.rebuilt || '-')}</span></div>
            <div class="rl-rec-col"><span class="rl-rec-col-lbl">OUTSTANDING</span><span class="rl-rec-col-txt">${_reliefMarkEst(p.outstanding || '-')}</span></div>
          </div>
          ${mil.length ? `<div class="rl-rec-miles">${mil.map(m => `<span class="rl-rec-mile">${_reliefMarkEst(m)}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
  });
  html += '</div>';

  const risks = (data.risks || []).filter(Boolean);
  if (risks.length) {
    html += `<div class="rl-rec-risks"><div class="rl-sec-hdr">RISKS TO RECOVERY</div>${risks.map(r => `<div class="rl-rec-risk">${_reliefMarkEst(r)}</div>`).join('')}</div>`;
  }
  if (data.confidence) {
    html += `<div class="rl-rec-conf">CONFIDENCE · <b>${String(data.confidence).toUpperCase()}</b> — timeframes and figures are estimates grounded in available context, not official reconstruction data.</div>`;
  }
  return html;
}

function _reliefMarkEst(s) {
  return String(s == null ? '' : s)
    .replace(/\(estimate[^)]*\)/gi, m => `<span class="rl-est">${m}</span>`)
    .replace(/\b(estimated|approximately|roughly|~)\b/gi, m => `<span class="rl-est">${m}</span>`);
}

function reliefExportRecovery() {
  const pack = window._reliefRecoveryData;
  if (!pack) return;
  const { focus: f, data, now } = pack;
  const body = _reliefRenderRecovery(data);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>AUSPEX RELIEF RECOVERY TIMELINE — ${f.name} — ${now}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#05080a;color:#a8c4b6;font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.8}
.banner{background:#0d2b1e;border-top:1px solid #34D399;border-bottom:1px solid #34D399;color:#34D399;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px}
.body{max-width:880px;margin:0 auto;padding:36px 30px}
.wordmark{font-size:11px;letter-spacing:.3em;color:#34D399;text-align:center;margin:18px 0 4px}
.title{font-size:20px;font-weight:800;letter-spacing:.06em;color:#dffaee;text-align:center;font-family:Georgia,serif}
.meta{font-size:9px;letter-spacing:.12em;color:#4f7a66;text-align:center;margin:6px 0 26px}
.rl-rec-summary{font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#dffaee;border-left:3px solid #34D399;padding:8px 0 8px 16px;margin-bottom:24px}
.rl-rec-line{display:flex;flex-direction:column;gap:0}
.rl-rec-node{position:relative;padding:0 0 22px 26px;border-left:2px solid #1c3a2c;margin-left:6px}
.rl-rec-node:last-child{border-left-color:transparent}
.rl-rec-dot{position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--pc);box-shadow:0 0 8px var(--pc)}
.rl-rec-card-hdr{display:flex;align-items:baseline;gap:10px;margin-bottom:5px}
.rl-rec-phase{font-size:15px;font-weight:800;letter-spacing:.04em;color:var(--pc);font-family:Georgia,serif}
.rl-rec-status{font-size:8px;letter-spacing:.14em;color:#7e9a8d;border:1px solid #1c3a2c;padding:2px 6px;border-radius:2px}
.rl-rec-time{font-size:9px;letter-spacing:.1em;color:#7e9a8d;margin-bottom:9px}
.rl-rec-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:8px}
.rl-rec-col-lbl{display:block;font-size:7.5px;letter-spacing:.14em;color:#4f7a66;margin-bottom:3px}
.rl-rec-col-txt{font-family:Georgia,serif;font-size:12px;color:#a8c4b6}
.rl-rec-miles{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.rl-rec-mile{font-size:9px;letter-spacing:.04em;color:#bfe9d6;background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.16);padding:3px 8px;border-radius:2px}
.rl-rec-risks{margin-top:24px}
.rl-sec-hdr{font-size:9px;letter-spacing:.2em;color:#34D399;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid rgba(52,211,153,.18)}
.rl-rec-risk{font-family:Georgia,serif;font-size:12px;color:#ffb4ba;padding:5px 0 5px 14px;border-left:2px solid #FF4D5E;margin-bottom:7px}
.rl-rec-conf{margin-top:22px;font-size:9px;letter-spacing:.08em;color:#7e9a8d;border-top:1px solid #1c3a2c;padding-top:12px}
.rl-rec-conf b{color:#34D399}
.rl-est{color:#FACC15}</style></head>
<body><div class="banner">AUSPEX RELIEF — HUMANITARIAN OPERATIONS</div>
<div class="body"><div class="wordmark">RECOVERY & RECONSTRUCTION TIMELINE</div><div class="title">${f.name}</div><div class="meta">GENERATED ${now} · GROUNDED IN LIVE AUSPEX SENSOR &amp; NEWS DATA · TIMEFRAMES ARE ESTIMATES</div>${body}</div>
<div class="banner">AUSPEX RELIEF — HUMANITARIAN OPERATIONS</div></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `relief-recovery-${Date.now()}.html`;
  a.click();
}

// ═══════════════════════════════════════════
// TOOL 08 — GOOD NEWS (data; the progress feed)
// ═══════════════════════════════════════════
// The deliberate counter-weight to a doom feed. Pure data — surfaces:
//   (a) SNAPSHOT_EVENTS with polarity==='breakthrough' (space/science/medical/
//       physics/financial/tech), and
//   (b) NEWS items matching progress keywords AND not matching disaster/conflict
//       keywords (so a "peace deal" survives but a "ceasefire collapses amid
//       deaths" does not).
// Curated into an uplifting feed grouped by kind. Optional one-line AI "why this
// matters" on the top items, graceful if no key.
const _RL_GN_PROGRESS = [
  'breakthrough', 'cure', 'vaccine', 'discovery', 'milestone', 'record', 'first-ever',
  'first ever', 'restored', 'peace deal', 'peace agreement', 'rescued', 'rescue',
  'recovery', 'recovered', 'approved', 'nobel', 'landmark', 'historic deal', 'ceasefire agreed',
  'reunited', 'eradicated', 'remission', 'wildlife returns', 'reopened', 'treaty signed',
  'aid reaches', 'released hostages', 'freed', 'restoration', 'reforest',
];
// If an item also reads as disaster/conflict/death, it is NOT good news.
const _RL_GN_NEGATIVE = [
  'kill', 'dead', 'death', 'died', 'casualt', 'massacre', 'strike kills', 'airstrike',
  'shelling', 'bombard', 'attack', 'assault', 'invasion', 'war crime', 'genocide',
  'famine', 'starv', 'collapse', 'crisis deepens', 'outbreak', 'epidemic', 'quake kills',
  'flood kills', 'wounded', 'injur', 'hostage crisis', 'massive blast', 'explosion kills',
  'shooting', 'gunmen', 'terror', 'abduct', 'atrocit', 'displaced', 'refugee crisis',
];

// Map a breakthrough sense / news category to one of three display groups.
const _RL_GN_GROUPS = [
  { id: 'science', label: 'Science & Space', icon: 'science', color: '#5AC8FA',
    senses: ['space', 'science', 'physics', 'tech'], newsCats: ['tech', 'space', 'science'] },
  { id: 'medical', label: 'Medical', icon: 'medical', color: '#34D399',
    senses: ['medical'], newsCats: ['health'] },
  { id: 'progress', label: 'Progress & Peace', icon: 'financial', color: '#FACC15',
    senses: ['financial'], newsCats: ['geo', 'econ', 'cyber'] },
];

function _rlGoodNewsGroupFor(item) {
  if (item._kind === 'event') {
    const s = String(item.sense || item.type || '').toLowerCase();
    const g = _RL_GN_GROUPS.find(grp => grp.senses.includes(s));
    return g ? g.id : 'science';
  }
  // News: classify by keyword first (medical/science cues win), else category.
  const txt = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
  if (/\b(cure|vaccine|remission|clinical trial|drug|patient|therapy|disease|surgery|transplant)\b/.test(txt)) return 'medical';
  if (/\b(discovery|telescope|fusion|quantum|space|orbit|rover|launch|nobel|fossil|particle|ai model|chip|spacecraft|satellite)\b/.test(txt)) return 'science';
  const cat = String(item.cat || '').toLowerCase();
  const g = _RL_GN_GROUPS.find(grp => grp.newsCats.includes(cat));
  return g ? g.id : 'progress';
}

function _rlBuildGoodNews() {
  const EVENTS_ = (typeof SNAPSHOT_EVENTS !== 'undefined') ? SNAPSHOT_EVENTS : [];
  const NEWS_ = (typeof NEWS !== 'undefined') ? NEWS : [];
  const items = [];
  const seenTitle = new Set();
  const key = t => String(t || '').trim().toLowerCase().slice(0, 70);

  // (a) Breakthrough-polarity sensed events.
  EVENTS_.filter(e => e.polarity === 'breakthrough').forEach(e => {
    const k = key(e.title);
    if (!e.title || seenTitle.has(k)) return; seenTitle.add(k);
    const src = (e.sources && e.sources[0]) || null;
    items.push({
      _kind: 'event',
      sense: e.sense || e.type, icon: e.icon || e.sense || e.type,
      title: e.title, brief: e.brief || e.title,
      srcName: src ? src.name : 'AUSPEX sense', url: src ? src.url : null,
      confidence: e.confidence || null, _ts: e.occurredAt ? Date.parse(e.occurredAt) : 0,
    });
  });

  // (b) Positive/progress news — must hit a progress keyword and NOT a negative one.
  NEWS_.forEach(s => {
    const txt = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
    if (!_RL_GN_PROGRESS.some(k => txt.includes(k))) return;
    if (_RL_GN_NEGATIVE.some(k => txt.includes(k))) return;
    const k = key(s.title);
    if (!s.title || seenTitle.has(k)) return; seenTitle.add(k);
    items.push({
      _kind: 'news',
      cat: s.cat, icon: null,
      title: s.title, brief: s.summary || s.title,
      srcName: s.src || 'Wire', url: s.url || null, region: s.region || '',
      confidence: null, _ts: s._pub || 0,
    });
  });

  // Group + sort (most recent / breakthrough first within each group).
  const grouped = _RL_GN_GROUPS.map(g => ({
    ...g,
    items: items
      .filter(it => _rlGoodNewsGroupFor(it) === g.id)
      .sort((a, b) => (b._ts || 0) - (a._ts || 0))
      .slice(0, 10),
  }));
  return { grouped, total: items.length };
}

// Resolve an icon glyph for a good-news item.
function _rlGoodNewsIcon(item, group) {
  const ic = (typeof AUSPEX_EVENT_ICONS !== 'undefined') ? AUSPEX_EVENT_ICONS : null;
  if (!ic) return '';
  if (item._kind === 'event' && item.icon && ic[item.icon]) return ic[item.icon];
  return ic[group.icon] || ic.default;
}

async function reliefGoodNews() {
  reliefRefreshFocus();
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const { grouped, total } = _rlBuildGoodNews();
  const shown = grouped.filter(g => g.items.length);

  _rlStatus(`TOOL 08 · GOOD NEWS · ${total} POSITIVE SIGNALS CURATED`);

  if (!shown.length) {
    work.innerHTML = `
      <div class="rl-tool-hdr"><span class="rl-tool-title">Good News</span><span class="rl-tool-sub">08 · THE PROGRESS FEED</span></div>
      <div class="rl-mx-empty">No breakthrough-polarity events or qualifying progress stories are in the live feed right now. The progress feed only surfaces genuinely positive signals — it stays empty rather than manufacture good news.</div>`;
    return;
  }

  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Good News</span><span class="rl-tool-sub">08 · THE PROGRESS FEED · HUMANITY'S WINS</span></div>
    <div class="rl-actbar">
      <button class="rl-btn rl-btn-ghost" onclick="reliefGoodNews()">REFRESH</button>
      <span class="rl-tool-sub" style="align-self:center">${total} positive signals from breakthrough events + progress news · the deliberate counter-weight to a doom feed · genuinely positive, honestly sourced · ${now}</span>
    </div>
    <div class="rl-gn">
      ${shown.map(g => `
        <section class="rl-gn-group" style="--gc:${g.color}">
          <div class="rl-gn-group-hdr"><span class="rl-gn-group-ico">${(typeof AUSPEX_EVENT_ICONS !== 'undefined' && AUSPEX_EVENT_ICONS[g.icon]) || ''}</span>${g.label}<span class="rl-gn-group-n">${g.items.length}</span></div>
          <div class="rl-gn-list">
            ${g.items.map((it, i) => {
              const safeTitle = (it.title || '').replace(/</g, '&lt;');
              const safeBrief = (it.brief || '').replace(/</g, '&lt;');
              return `
              <article class="rl-gn-item" id="rl-gn-${g.id}-${i}">
                <span class="rl-gn-ico">${_rlGoodNewsIcon(it, g)}</span>
                <div class="rl-gn-body">
                  <div class="rl-gn-title">${safeTitle}</div>
                  <div class="rl-gn-brief">${safeBrief}</div>
                  <div class="rl-gn-matters" id="rl-gn-matters-${g.id}-${i}"></div>
                  <div class="rl-gn-meta">
                    <span class="rl-gn-kind">${it._kind === 'event' ? 'SENSED BREAKTHROUGH' : 'PROGRESS NEWS'}${it.confidence ? ' · ' + it.confidence.toUpperCase() : ''}</span>
                    ${it.url ? `<a class="rl-gn-src" href="${it.url}" target="_blank" rel="noopener">${it.srcName || 'source'} &#8599;</a>` : `<span class="rl-gn-src rl-gn-src-plain">${it.srcName || 'source'}</span>`}
                  </div>
                </div>
              </article>`;
            }).join('')}
          </div>
        </section>`).join('')}
    </div>`;

  // Optional AI "why this matters" — one line on the single top item of each
  // group. Graceful (and silent) if no key. Pure data tool works without it.
  const aiOff = (typeof OPENAI_KEY === 'undefined') || !OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI');
  if (aiOff) { _rlStatus(`TOOL 08 · GOOD NEWS READY · ${total} POSITIVE SIGNALS · ${shown.length} CATEGORIES · ${now}`); return; }
  for (const g of shown) {
    const it = g.items[0];
    const el = document.getElementById(`rl-gn-matters-${g.id}-0`);
    if (!it || !el) continue;
    try {
      const txt = await callOpenAI(
        'You explain why a piece of good news genuinely matters for humanity, in ONE honest sentence. No hype, no invented facts, no figures unless given. Plain text, one sentence, under 30 words.',
        `Good news item:\nTITLE: ${it.title}\nBRIEF: ${it.brief}\n\nWrite one honest sentence on why this matters.`,
        90
      );
      if (txt && txt.trim()) {
        el.innerHTML = `<span class="rl-gn-matters-lbl">WHY IT MATTERS</span> ${txt.trim().replace(/</g, '&lt;')}`;
      }
    } catch (e) { /* silent — pure-data tool stands on its own */ }
  }
  _rlStatus(`TOOL 08 · GOOD NEWS READY · ${total} POSITIVE SIGNALS · ${shown.length} CATEGORIES · ${now}`);
}

// ═══════════════════════════════════════════
// TOOL 09 — HEALTH & OUTBREAK WATCH (data + globe markers + AI)
// ═══════════════════════════════════════════
// Detects disease / health-emergency signals for the focus or globally from
// REAL data only:
//   - NEWS matching outbreak/epidemic/disease keywords (cholera, measles, ebola,
//     dengue, polio, malnutrition, contaminated water, …),
//   - health-relevant SNAPSHOT_EVENTS (medical sense / outbreak-type), and
//   - health-stressing regions (active conflict / critical-high threat — system
//     collapse and displacement drive outbreaks).
// Ranks affected areas with a severity PHASE (1-4), names drivers, renders
// distinct health markers on the globe (gated to this tool), and asks the model
// for a short honest explanation per top area. Complements Famine Watch.
const _RL_HEALTH_KW = [
  'outbreak', 'epidemic', 'pandemic', 'cholera', 'measles', 'ebola', 'marburg',
  'dengue', 'malaria', 'polio', 'mpox', 'monkeypox', 'diphtheria', 'typhoid',
  'meningitis', 'yellow fever', 'lassa', 'avian flu', 'bird flu', 'h5n1',
  'contaminated water', 'waterborne', 'disease', 'infection', 'virus', 'cases surge',
  'malnutrition', 'malnourish', 'famine deaths', 'hospital overwhelmed', 'vaccine shortage',
];
// Keywords that, with a health keyword, lift the severity (active, deadly spread).
const _RL_HEALTH_ACUTE = ['deaths', 'dead', 'killed', 'surge', 'spreading', 'overwhelmed', 'declared', 'emergency', 'thousands', 'children'];
const _RL_HEALTH_PHASE_LBL = { 1: 'WATCH', 2: 'CONCERN', 3: 'OUTBREAK', 4: 'EMERGENCY' };
const _RL_HEALTH_PHASE_COL = { 1: '#34D399', 2: '#FACC15', 3: '#FB923C', 4: '#FF4D5E' };
// Composite health score → 1-4 phase. Mirrors src/relief-signals.js (tested).
function _rlHealthScoreToPhase(score) {
  const s = Number(score) || 0;
  return s >= 3.2 ? 4 : s >= 2.0 ? 3 : s >= 1.0 ? 2 : 1;
}

// Map a disease keyword found in text → a short disease label for display.
function _rlHealthDisease(txt) {
  const named = ['cholera', 'measles', 'ebola', 'marburg', 'dengue', 'malaria', 'polio', 'mpox',
    'monkeypox', 'diphtheria', 'typhoid', 'meningitis', 'yellow fever', 'lassa', 'avian flu',
    'bird flu', 'h5n1', 'malnutrition'];
  const hit = named.find(d => txt.includes(d));
  if (hit) return hit.replace('h5n1', 'avian flu (H5N1)');
  if (txt.includes('waterborne') || txt.includes('contaminated water')) return 'waterborne disease';
  if (/outbreak|epidemic|pandemic/.test(txt)) return 'disease outbreak';
  return 'health emergency';
}

// Build ranked health-signal areas from live data. Pure data — no randomness.
function _rlBuildHealth(f) {
  const NEWS_ = (typeof NEWS !== 'undefined') ? NEWS : [];
  const EVENTS_ = (typeof SNAPSHOT_EVENTS !== 'undefined') ? SNAPSHOT_EVENTS : [];
  const REGIONS_ = (typeof REGION_DATA !== 'undefined') ? REGION_DATA : [];
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];

  const focused = f && f.kind !== 'global';
  const tokens = focused ? _reliefFocusTokens(f) : [];
  const hasCoords = focused && typeof f.lat === 'number' && !isNaN(f.lat);
  const radiusKm = 1600;

  const areas = [];
  const findArea = name => areas.find(a => a.name.toLowerCase() === name.toLowerCase());
  const pushArea = (name, lat, lng) => {
    if (!name) return null;
    let a = findArea(name);
    if (!a) { a = { name, lat, lng, score: 0, diseases: new Set(), drivers: new Set(), newsHits: [], eventHits: [] }; areas.push(a); }
    if (a.lat == null && typeof lat === 'number') { a.lat = lat; a.lng = lng; }
    return a;
  };

  // (1) NEWS health signals — attribute to the story's region (or focus when no region).
  NEWS_.forEach(s => {
    const txt = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
    const kw = _RL_HEALTH_KW.find(k => txt.includes(k));
    if (!kw) return;
    // If focus is set, only keep stories relevant to it.
    if (focused) {
      const rel = tokens.some(t => `${txt} ${(s.region || '').toLowerCase()}`.includes(t))
        || (hasCoords && typeof s.lat === 'number' && _haversineKm(f.lat, f.lng, s.lat, s.lng) < radiusKm);
      if (!rel) return;
    }
    const areaName = s.region || (focused ? f.name : 'Global signal');
    const a = pushArea(areaName, s.lat, s.lng);
    if (!a) return;
    a.newsHits.push(s);
    a.diseases.add(_rlHealthDisease(txt));
    a.drivers.add('Disease/health news signals');
    let pts = 1.0;
    if (_RL_HEALTH_ACUTE.some(k => txt.includes(k))) pts += 0.8;
    if (s.brk) pts += 0.4;
    a.score += pts;
  });

  // (2) Health-relevant sensed events (medical sense, or outbreak/disease-type).
  EVENTS_.forEach(e => {
    const txt = `${e.title || ''} ${e.brief || ''} ${e.type || ''} ${e.sense || ''}`.toLowerCase();
    const isHealth = e.sense === 'medical' || /outbreak|disease|epidemic|cholera|measles|ebola|dengue|polio/.test(txt);
    if (!isHealth) return;
    if (focused && hasCoords && typeof e.lat === 'number' && _haversineKm(f.lat, f.lng, e.lat, e.lng) > radiusKm) return;
    const areaName = e.title && e.title.length < 42 ? e.title : (focused ? f.name : 'Sensed health event');
    const a = pushArea(areaName, e.lat, e.lng);
    if (!a) return;
    a.eventHits.push(e);
    a.diseases.add(_rlHealthDisease(txt));
    a.drivers.add('Sensed health event');
    a.score += 0.8 + (e.severity ?? 0);
  });

  // (3) Health-stressing regions/countries — conflict & collapse drive outbreaks.
  //     Only adds weight to areas already flagged, or seeds a low-level watch when
  //     a focus region is itself in conflict.
  const stressNames = new Set();
  COUNTRIES_.filter(c => c.conflict_active && typeof c.lat === 'number').forEach(c => stressNames.add(c.name.toLowerCase()));
  REGIONS_.filter(r => (r.threat_level === 'critical' || r.threat_level === 'high') && typeof r.lat === 'number').forEach(r => stressNames.add((r.name || '').toLowerCase()));
  areas.forEach(a => {
    if (stressNames.has(a.name.toLowerCase())) { a.score += 0.7; a.drivers.add('Conflict-driven health-system stress'); }
  });
  // Seed the focus region if it is itself in conflict and surfaced no news (honest low watch).
  if (focused && hasCoords && !findArea(f.name)) {
    const inConflict = COUNTRIES_.some(c => c.conflict_active && tokens.some(t => (c.name || '').toLowerCase().includes(t)))
      || REGIONS_.some(r => (r.threat_level === 'critical' || r.threat_level === 'high') && tokens.some(t => (r.name || '').toLowerCase().includes(t)));
    if (inConflict) {
      const a = pushArea(f.name, f.lat, f.lng);
      if (a) { a.score += 0.7; a.drivers.add('Conflict-driven health-system stress'); }
    }
  }

  // Composite score → phase 1-4. Thresholds mirror src/relief-signals.js
  // (healthScoreToPhase) — the tested source of truth.
  areas.forEach(a => {
    a.phase = _rlHealthScoreToPhase(a.score);
    a.diseases = [...a.diseases];
    a.drivers = [...a.drivers];
  });

  return areas
    .filter(a => a.score > 0 && typeof a.lat === 'number')
    .sort((a, b) => b.score - a.score || b.phase - a.phase)
    .slice(0, 12);
}

async function reliefHealth() {
  reliefRefreshFocus();
  const f = _reliefFocus;
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const areas = _rlBuildHealth(f);

  // Globe markers — gated to this tool (cleared on switch via reliefClearGlobe).
  reliefHealthMarkers = areas.map(a => ({ lat: a.lat, lng: a.lng, name: a.name, phase: a.phase, _relief_health: true }));
  if (typeof updateAllGlobeElements === 'function') updateAllGlobeElements();

  _rlStatus(`TOOL 09 · HEALTH & OUTBREAK WATCH · ${areas.length} AREAS · ${reliefHealthMarkers.length} MARKERS`);

  const globalHint = _reliefNoFocusGuard()
    ? '<div class="rl-mx-empty" style="margin-bottom:10px">No region pinned — scanning GLOBAL health signals. Pin a region to focus on local outbreak risk.</div>' : '';

  if (!areas.length) {
    work.innerHTML = `
      <div class="rl-tool-hdr"><span class="rl-tool-title">Health &amp; Outbreak Watch</span><span class="rl-tool-sub">09 · DISEASE &amp; HEALTH-EMERGENCY SIGNALS</span></div>
      ${globalHint}
      <div class="rl-mx-empty">No disease or health-emergency signals detected in the live news, sensed events, or health-stressed regions for this focus right now. Absence of a signal is not a guarantee of health security.</div>`;
    return;
  }

  const legend = [1, 2, 3, 4].map(p => `<span class="rl-legend-item"><span class="rl-legend-swatch" style="background:${_RL_HEALTH_PHASE_COL[p]}"></span>${_RL_HEALTH_PHASE_LBL[p]}</span>`).join('');

  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Health &amp; Outbreak Watch</span><span class="rl-tool-sub">09 · DISEASE &amp; HEALTH-EMERGENCY SIGNALS · LIVE</span></div>
    ${globalHint}
    <div class="rl-actbar"><span class="rl-tool-sub" style="align-self:center">${areas.length} areas from disease/outbreak news + health events + conflict-driven health stress · markers on globe · phases are an indicative signal classification, not a clinical assessment · ${now}</span></div>
    <div class="rl-legend">${legend}</div>
    <div class="rl-fam" id="rl-health-list">
      ${areas.map((a, i) => `
        <div class="rl-fam-row">
          <div class="rl-fam-phase" style="background:${_RL_HEALTH_PHASE_COL[a.phase]};${a.phase >= 3 ? 'color:#fff' : ''}">
            <span class="rl-fam-phase-n">${a.phase}</span><span class="rl-fam-phase-l">${_RL_HEALTH_PHASE_LBL[a.phase]}</span>
          </div>
          <div>
            <div class="rl-fam-area">${(a.name || '').replace(/</g, '&lt;')}${a.diseases.length ? ` <span class="rl-health-dz">${a.diseases.slice(0, 3).join(' · ').replace(/</g, '&lt;')}</span>` : ''}</div>
            <div class="rl-fam-drivers">${a.drivers.map(d => `<span class="rl-fam-driver">${d}</span>`).join('')}</div>
            <div class="rl-fam-expl rl-loading-anim" id="rl-health-expl-${i}">Assessing health signal…</div>
          </div>
        </div>`).join('')}
    </div>`;

  // AI explanation for the TOP areas only (cost + clutter control). Graceful w/o AI.
  const aiOff = (typeof OPENAI_KEY === 'undefined') || !OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI');
  const topN = Math.min(areas.length, 4);
  for (let i = 0; i < areas.length; i++) {
    const el = document.getElementById(`rl-health-expl-${i}`);
    if (!el) continue;
    const a = areas[i];
    const summary = `Signals: ${a.diseases.join(', ') || 'health stress'}. Drivers: ${a.drivers.join(', ')}.`;
    if (i >= topN) { el.classList.remove('rl-loading-anim'); el.textContent = summary; continue; }
    if (aiOff) { el.classList.remove('rl-loading-anim'); el.innerHTML = `<span style="color:#FF8A93">AI unavailable</span> — ${summary}`; continue; }
    const fa = { name: a.name, region: a.name, lat: a.lat, lng: a.lng, kind: 'health', raw: null };
    const ctx = await reliefBuildContext(fa);
    const ctxText = _reliefContextText(fa, ctx);
    try {
      const txt = await callOpenAI(
        'You are a public-health emergency analyst (think WHO / epidemiology desk). You are honest and grounded: use ONLY the supplied context, never invent case numbers, and label any figure as an ESTIMATE. Do not sensationalise. Write 2 short sentences of plain text on the health signal and what is driving it. No headers.',
        `Assess the health/outbreak signal for ${a.name}.\nINDICATIVE PHASE: ${a.phase} (${_RL_HEALTH_PHASE_LBL[a.phase]}).\nDETECTED SIGNALS: ${a.diseases.join(', ') || 'general health stress'}.\nDRIVERS: ${a.drivers.join(', ')}.\n\nGROUNDING CONTEXT:\n${ctxText}\n\nBe concise and grounded; if the context is thin, say the classification rests mainly on the detected signals.`,
        180
      );
      el.classList.remove('rl-loading-anim');
      el.textContent = (txt && txt.trim()) ? txt.trim() : summary;
    } catch (e) {
      el.classList.remove('rl-loading-anim');
      el.innerHTML = `<span style="color:#FF8A93">AI unavailable</span> — ${summary}`;
    }
  }
  _rlStatus(`TOOL 09 · HEALTH & OUTBREAK WATCH READY · ${areas.length} AREAS · ${reliefHealthMarkers.length} MARKERS · ${now}`);
}

// ═══════════════════════════════════════════
// TOOL 10 — CIVILIAN PROTECTION (data + AI)
// ═══════════════════════════════════════════
// Surfaces civilian-harm / protection signals for the focus or globally from
// REAL data only:
//   - NEWS matching protection keywords (civilian casualties, attack on hospital/
//     school, displacement, detention, human rights, war crime, siege, blockade
//     of aid, …), and
//   - active-conflict regions/countries (the structural backdrop to civilian harm).
// Produces a ranked list of protection concerns, each with an honest AI
// assessment — grounded, sourced, no sensationalism. No globe layer (analytic).
// Taxonomy mirrors src/relief-signals.js PROTECTION_SIGNALS (the tested source).
const _RL_PROT_SIGNALS = [
  { id: 'casualties',   label: 'Civilian casualties',       kw: ['civilian casualt', 'civilians killed', 'civilian deaths', 'civilians dead', 'killed civilians'] },
  { id: 'health_ed',    label: 'Attacks on hospitals/schools', kw: ['hospital hit', 'attack on hospital', 'hospital struck', 'school hit', 'attack on school', 'clinic struck', 'medical facility'] },
  { id: 'siege',        label: 'Siege / blockade of aid',   kw: ['siege', 'blockade', 'aid blocked', 'starvation as weapon', 'besieged', 'aid denied', 'humanitarian blockade'] },
  { id: 'displacement', label: 'Forced displacement',       kw: ['forcibly displaced', 'mass displacement', 'fled', 'forced to flee', 'expelled', 'ethnic cleansing'] },
  { id: 'detention',    label: 'Detention / disappearance', kw: ['detained', 'detention', 'disappear', 'abduct', 'arbitrary arrest', 'hostage'] },
  { id: 'rights',       label: 'Human-rights violations',   kw: ['human rights', 'war crime', 'atrocit', 'torture', 'extrajudicial', 'crimes against humanity', 'genocide'] },
  { id: 'gbv_child',    label: 'GBV / child protection',    kw: ['gender-based violence', 'sexual violence', 'rape as', 'child soldier', 'children recruited', 'trafficking'] },
];

// Build ranked protection concerns from live data. Pure data — no randomness.
function _rlBuildProtection(f) {
  const NEWS_ = (typeof NEWS !== 'undefined') ? NEWS : [];
  const REGIONS_ = (typeof REGION_DATA !== 'undefined') ? REGION_DATA : [];
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];

  const focused = f && f.kind !== 'global';
  const tokens = focused ? _reliefFocusTokens(f) : [];
  const hasCoords = focused && typeof f.lat === 'number' && !isNaN(f.lat);
  const radiusKm = 1600;

  // Candidate news = protection-relevant, optionally filtered to focus.
  const relevant = NEWS_.filter(s => {
    if (!focused) return true;
    const txt = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
    return tokens.some(t => txt.includes(t))
      || (hasCoords && typeof s.lat === 'number' && _haversineKm(f.lat, f.lng, s.lat, s.lng) < radiusKm);
  });

  const concerns = _RL_PROT_SIGNALS.map(sig => {
    const hits = relevant.filter(s => {
      const t = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
      return sig.kw.some(k => t.includes(k));
    });
    return { ...sig, hits, score: hits.length };
  }).filter(c => c.score > 0);

  // Structural backdrop: count active-conflict areas relevant to the focus.
  let conflictAreas = [];
  const relName = name => !focused || tokens.some(t => (name || '').toLowerCase().includes(t));
  COUNTRIES_.filter(c => c.conflict_active).forEach(c => { if (relName(c.name)) conflictAreas.push(c.name); });
  REGIONS_.filter(r => (r.threat_level === 'critical' || r.threat_level === 'high')).forEach(r => { if (relName(r.name)) conflictAreas.push(r.name); });
  conflictAreas = [...new Set(conflictAreas)];

  return {
    concerns: concerns.sort((a, b) => b.score - a.score).slice(0, 8),
    conflictAreas: conflictAreas.slice(0, 10),
    totalSignals: concerns.reduce((n, c) => n + c.score, 0),
  };
}

async function reliefProtection() {
  reliefRefreshFocus();
  const f = _reliefFocus;
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const { concerns, conflictAreas, totalSignals } = _rlBuildProtection(f);

  _rlStatus(`TOOL 10 · CIVILIAN PROTECTION · ${concerns.length} CONCERN TYPES · ${totalSignals} SIGNALS`);

  const globalHint = _reliefNoFocusGuard()
    ? '<div class="rl-mx-empty" style="margin-bottom:10px">No region pinned — scanning GLOBAL civilian-protection signals. Pin a region to focus on a specific crisis.</div>' : '';

  if (!concerns.length && !conflictAreas.length) {
    work.innerHTML = `
      <div class="rl-tool-hdr"><span class="rl-tool-title">Civilian Protection</span><span class="rl-tool-sub">10 · CIVILIAN-HARM &amp; PROTECTION SIGNALS</span></div>
      ${globalHint}
      <div class="rl-mx-empty">No civilian-protection signals surfaced in the live news or active-conflict records for this focus right now. This reflects the current feed, not a verified absence of harm.</div>`;
    return;
  }

  const backdrop = conflictAreas.length
    ? `<div class="rl-prot-backdrop"><span class="rl-prot-backdrop-lbl">ACTIVE-CONFLICT BACKDROP</span> ${conflictAreas.map(n => `<span class="rl-prot-area">${(n || '').replace(/</g, '&lt;')}</span>`).join('')}</div>`
    : '';

  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Civilian Protection</span><span class="rl-tool-sub">10 · CIVILIAN-HARM &amp; PROTECTION SIGNALS · LIVE</span></div>
    ${globalHint}
    <div class="rl-actbar"><span class="rl-tool-sub" style="align-self:center">${concerns.length} concern types · ${totalSignals} protection signals from live news + ${conflictAreas.length} active-conflict areas · grounded, sourced, no sensationalism · ${now}</span></div>
    ${backdrop}
    <div class="rl-prot" id="rl-prot-list">
      ${concerns.map((c, i) => `
        <div class="rl-prot-row" id="rl-prot-${i}">
          <div class="rl-prot-hd">
            <span class="rl-prot-concern">${c.label}</span>
            <span class="rl-prot-count">${c.score} SIGNAL${c.score === 1 ? '' : 'S'}</span>
          </div>
          <div class="rl-prot-stories">
            ${c.hits.slice(0, 4).map(s => `<div class="rl-prot-story">${(s.title || '').replace(/</g, '&lt;')} <span class="rl-prot-src">${s.src || 'src'}${s._hist ? ' · ARCHIVE' : ''}</span></div>`).join('')}
          </div>
          <div class="rl-prot-assess rl-loading-anim" id="rl-prot-assess-${i}">Assessing protection concern…</div>
        </div>`).join('')}
    </div>`;

  // AI honest assessment for the TOP concerns. Graceful w/o AI.
  const aiOff = (typeof OPENAI_KEY === 'undefined') || !OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI');
  const ctx = await reliefBuildContext(f);
  const ctxText = _reliefContextText(f, ctx);
  const topN = Math.min(concerns.length, 4);
  for (let i = 0; i < concerns.length; i++) {
    const el = document.getElementById(`rl-prot-assess-${i}`);
    if (!el) continue;
    const c = concerns[i];
    const fallback = `Grounded in ${c.score} live ${c.score === 1 ? 'story' : 'stories'}. See cited sources above.`;
    if (i >= topN) { el.classList.remove('rl-loading-anim'); el.textContent = fallback; continue; }
    if (aiOff) { el.classList.remove('rl-loading-anim'); el.innerHTML = `<span style="color:#FF8A93">AI unavailable</span> — ${fallback}`; continue; }
    const storyLines = c.hits.slice(0, 5).map(s => `- ${s.title}${s.summary ? ': ' + s.summary : ''} (${s.src || 'src'})`).join('\n');
    try {
      const txt = await callOpenAI(
        'You are a protection-of-civilians analyst (think OHCHR / ICRC desk). You are rigorously honest and grounded: use ONLY the supplied stories and context, never invent figures or allegations, attribute claims to their source, and never sensationalise. If reports are unverified, say so. Write 2-3 sentences of measured plain text. No headers.',
        `Assess this civilian-protection concern for the focus "${f.name}".\nCONCERN: ${c.label}\n\nREPORTED SIGNALS:\n${storyLines}\n\nWIDER CONTEXT:\n${ctxText}\n\nGive a measured, sourced assessment: what is being reported, how confident the picture is, and the principal protection implication. Do not overstate.`,
        220
      );
      el.classList.remove('rl-loading-anim');
      el.textContent = (txt && txt.trim()) ? txt.trim() : fallback;
    } catch (e) {
      el.classList.remove('rl-loading-anim');
      el.innerHTML = `<span style="color:#FF8A93">AI unavailable</span> — ${fallback}`;
    }
  }
  _rlStatus(`TOOL 10 · CIVILIAN PROTECTION READY · ${concerns.length} CONCERNS · ${totalSignals} SIGNALS · ${now}`);
}

// Expose globals (browser-global pattern, matching analyst.js).
if (typeof window !== 'undefined') {
  window.openRelief = openRelief;
  window.closeRelief = closeRelief;
  window.reliefClearGlobe = reliefClearGlobe;
  window.pinToRelief = pinToRelief;
  window.pinStoryToRelief = pinStoryToRelief;
  window.reliefIsGeoPinned = reliefIsGeoPinned;
  window.reliefIsStoryPinned = reliefIsStoryPinned;
  window.reliefClearFocus = reliefClearFocus;
  window.reliefRemoveFocus = reliefRemoveFocus;
  window.reliefRefreshFocus = reliefRefreshFocus;
  window.reliefSelectTool = reliefSelectTool;
  window.reliefSituationReport = reliefSituationReport;
  window.reliefExportSitrep = reliefExportSitrep;
  window.reliefResponseCouncil = reliefResponseCouncil;
  window.reliefNeedsMatrix = reliefNeedsMatrix;
  window.reliefMatrixCell = reliefMatrixCell;
  window.reliefDisplacement = reliefDisplacement;
  window.reliefFamine = reliefFamine;
  window.reliefAccess = reliefAccess;
  window.reliefRecovery = reliefRecovery;
  window.reliefExportRecovery = reliefExportRecovery;
  window.reliefGoodNews = reliefGoodNews;
  window.reliefHealth = reliefHealth;
  window.reliefProtection = reliefProtection;
}
