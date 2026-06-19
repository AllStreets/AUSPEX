'use strict';

// ═══════════════════════════════════════════
// RELIEF — HUMANITARIAN OPERATIONS BOARD
//   Counterpart to the Analyst Board. Shares the pin pool
//   (analystAssets / _analystGeoMap), callOpenAI, and the
//   live data globals (NEWS, REGION_DATA, COUNTRY_DATA,
//   CITY_DATA, SNAPSHOT_EVENTS). Living Green theme.
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
  if (!changed) return;
  if (typeof refreshArcs === 'function') refreshArcs();
  if (typeof updateAllGlobeElements === 'function') updateAllGlobeElements();
}

// ── Focus resolution ────────────────────────────────────────
// The current focus = the most recently pinned region / event / city
// in the shared pin pool. Geo assets resolve through _analystGeoMap
// (the analyst.js pin pool) exactly as analyst.js does. We also fold
// in any pinned SNAPSHOT_EVENT or NEWS story that carries coordinates.
function reliefResolveFocus() {
  const assets = (typeof analystAssets !== 'undefined') ? analystAssets : [];
  // Walk most-recent-first.
  for (let i = assets.length - 1; i >= 0; i--) {
    const id = assets[i];
    // Geo asset (city / country) pinned via pinGeoAsset
    if (typeof id === 'string' && id.includes(':') && typeof _analystGeoMap !== 'undefined' && _analystGeoMap[id]) {
      const g = _analystGeoMap[id];
      const o = g._geoObj || {};
      return {
        kind: g._geoType || 'geo',
        name: o.name || g.title || 'Pinned location',
        lat: o.lat, lng: o.lng,
        region: o.country || o.name || g.region || '',
        raw: o, asset: g,
      };
    }
    // Story (NEWS / archive) — use its region + coords
    const s = (typeof _resolveStory === 'function') ? _resolveStory(id) : null;
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

function reliefRefreshFocus() {
  _reliefFocus = reliefResolveFocus();
  const f = _reliefFocus;
  const isGlobal = f.kind === 'global';
  const nameEl = document.getElementById('rl-focus-name');
  if (nameEl) nameEl.textContent = (f.name || 'GLOBAL').toUpperCase();
  const ctxVal = document.getElementById('rl-ctx-val');
  if (ctxVal) ctxVal.textContent = isGlobal ? 'GLOBAL — no region pinned' : `${f.name}`;
  const ctxMeta = document.getElementById('rl-ctx-meta');
  if (ctxMeta) {
    if (isGlobal) {
      ctxMeta.textContent = 'PIN A REGION TO GROUND TOOLS';
    } else {
      const bits = [];
      bits.push(f.kind.toUpperCase());
      if (typeof f.lat === 'number' && typeof f.lng === 'number') bits.push(`${f.lat.toFixed(1)}, ${f.lng.toFixed(1)}`);
      if (f.raw && f.raw.threat_level) bits.push(`THREAT ${String(f.raw.threat_level).toUpperCase()}`);
      ctxMeta.textContent = bits.join(' · ');
    }
  }
}

// ── Tool selection ──────────────────────────────────────────
const _RELIEF_BUILT = { sitrep: 1, council: 1, matrix: 1, displacement: 1, famine: 1, access: 1 };

function reliefSelectTool(tool) {
  if (!_RELIEF_BUILT[tool]) return; // 7-8 are coming
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

// Returns { news:[], events:[], regionRec, tokens, radiusKm }
function reliefBuildContext(f) {
  f = f || _reliefFocus || reliefResolveFocus();
  const NEWS_ = (typeof NEWS !== 'undefined') ? NEWS : [];
  const EVENTS_ = (typeof SNAPSHOT_EVENTS !== 'undefined') ? SNAPSHOT_EVENTS : [];
  const REGIONS_ = (typeof REGION_DATA !== 'undefined') ? REGION_DATA : [];
  const COUNTRIES_ = (typeof COUNTRY_DATA !== 'undefined') ? COUNTRY_DATA : [];
  const tokens = _reliefFocusTokens(f);
  const hasCoords = typeof f.lat === 'number' && typeof f.lng === 'number' && !isNaN(f.lat);
  const radiusKm = 1400;

  // News relevant to the focus
  let news;
  if (f.kind === 'global') {
    news = NEWS_.slice(0, 16);
  } else {
    const tokMatch = s => {
      const txt = `${s.title || ''} ${s.summary || ''} ${s.region || ''}`.toLowerCase();
      return tokens.some(t => txt.includes(t));
    };
    const geoMatch = s => hasCoords && typeof s.lat === 'number' && typeof s.lng === 'number'
      && _haversineKm(f.lat, f.lng, s.lat, s.lng) < radiusKm;
    news = NEWS_.filter(s => tokMatch(s) || geoMatch(s));
    if (news.length < 4) {
      // Broaden — keep relevance but ensure the model has material
      const extra = NEWS_.filter(s => !news.includes(s)).slice(0, 8 - news.length);
      news = [...news, ...extra];
    }
    news = news.slice(0, 16);
  }

  // Nearby snapshot events
  let events;
  if (f.kind === 'global') {
    events = [...EVENTS_].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)).slice(0, 12);
  } else if (hasCoords) {
    events = EVENTS_
      .map(e => ({ e, d: (typeof e.lat === 'number') ? _haversineKm(f.lat, f.lng, e.lat, e.lng) : Infinity }))
      .filter(x => x.d < radiusKm * 1.6)
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map(x => ({ ...x.e, _distKm: Math.round(x.d) }));
  } else {
    events = EVENTS_.filter(e => {
      const txt = `${e.title || ''} ${e.brief || ''}`.toLowerCase();
      return tokens.some(t => txt.includes(t));
    }).slice(0, 12);
  }

  // Focus region / country record
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

  return { news, events, regionRec, countryRec, tokens, radiusKm };
}

// Render context as a compact text block for the model.
function _reliefContextText(f, ctx) {
  const lines = [];
  lines.push(`OPERATIONAL FOCUS: ${f.name}${f.region && f.region !== f.name ? ' (' + f.region + ')' : ''}`);
  if (typeof f.lat === 'number') lines.push(`COORDINATES: ${f.lat.toFixed(2)}, ${f.lng.toFixed(2)}`);
  if (ctx.regionRec) {
    const r = ctx.regionRec;
    lines.push(`REGION RECORD: ${r.name || '—'} · threat level ${(r.threat_level || 'unknown').toUpperCase()}${r.radius_km ? ' · zone radius ~' + r.radius_km + 'km' : ''}${r.notes ? ' · ' + r.notes : ''}`);
  }
  if (ctx.countryRec) {
    const c = ctx.countryRec;
    const flags = [c.conflict_active ? 'ACTIVE CONFLICT' : '', c.sanctions_subject ? 'UNDER SANCTIONS' : ''].filter(Boolean).join(', ');
    lines.push(`COUNTRY: ${c.name}${flags ? ' (' + flags + ')' : ''}`);
  }
  if (ctx.events.length) {
    lines.push('\nNEARBY SENSED EVENTS (live):');
    ctx.events.forEach(e => {
      lines.push(`- [${(e.type || e.sense || 'event').toUpperCase()}] ${e.title || ''} — ${e.brief || ''}` +
        `${typeof e.severity === 'number' ? ' (severity ' + Math.round(e.severity * 100) + '%)' : ''}` +
        `${e._distKm != null ? ' (~' + e._distKm + 'km)' : ''} [${e.confidence || 'unconfirmed'}]`);
    });
  }
  if (ctx.news.length) {
    lines.push('\nRELEVANT NEWS (live feed):');
    ctx.news.forEach(s => {
      lines.push(`- [${(s.cat || 'geo').toUpperCase()}] ${s.title}${s.summary ? ' — ' + s.summary : ''} (${s.src || 'src'})`);
    });
  }
  return lines.join('\n');
}

function _reliefSourceList(ctx) {
  const srcs = new Set();
  ctx.news.forEach(s => { if (s.src) srcs.add(s.src); });
  ctx.events.forEach(e => (e.sources || []).forEach(src => { if (src && src.name) srcs.add(src.name); }));
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
  const ctx = reliefBuildContext(f);
  const work = _rlWork();
  const now = new Date().toLocaleString();
  const globalHint = _reliefNoFocusGuard()
    ? '<div class="rl-mx-empty" style="margin-bottom:10px">No region pinned — reporting on a GLOBAL basis. Pin a region from the globe or Analyst feed for a focused sitrep.</div>' : '';

  _rlStatus('TOOL 01 · GENERATING HUMANITARIAN SITUATION REPORT…');
  work.innerHTML = `
    <div class="rl-tool-hdr"><span class="rl-tool-title">Situation Report</span><span class="rl-tool-sub">01 · HUMANITARIAN SITREP</span></div>
    ${globalHint}
    <div class="rl-classify">RELIEF SITREP · ${f.name.toUpperCase()} · ${now}</div>
    <div class="rl-brief"><div class="rl-loading rl-loading-anim">GROUNDING IN ${ctx.news.length} NEWS ITEMS · ${ctx.events.length} SENSED EVENTS…</div></div>`;

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
  const ctx = reliefBuildContext(f);
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

function reliefNeedsMatrix() {
  reliefRefreshFocus();
  const f = _reliefFocus;
  const ctx = reliefBuildContext(f);
  const work = _rlWork();
  const now = new Date().toLocaleTimeString();

  // Region threat → base severity multiplier
  const threatMul = { critical: 1.0, high: 0.8, elevated: 0.55 };
  const baseThreat = ctx.regionRec ? (threatMul[ctx.regionRec.threat_level] || 0.4) : 0.3;

  // Per-sector raw signals
  const rows = _RL_MX_SECTORS.map(sec => {
    // News signals: stories whose text hits this sector's keywords
    const newsHits = ctx.news.filter(s => {
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
    const coverHits = ctx.news.filter(s => {
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
      <div class="rl-sig-cat">${(s.cat || 'news').toUpperCase()} · NEWS</div>
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
    const ctx = reliefBuildContext(f);
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
    const ctx = reliefBuildContext(f);
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

// Expose globals (browser-global pattern, matching analyst.js).
if (typeof window !== 'undefined') {
  window.openRelief = openRelief;
  window.closeRelief = closeRelief;
  window.reliefClearGlobe = reliefClearGlobe;
  window.reliefSelectTool = reliefSelectTool;
  window.reliefSituationReport = reliefSituationReport;
  window.reliefExportSitrep = reliefExportSitrep;
  window.reliefResponseCouncil = reliefResponseCouncil;
  window.reliefNeedsMatrix = reliefNeedsMatrix;
  window.reliefMatrixCell = reliefMatrixCell;
  window.reliefDisplacement = reliefDisplacement;
  window.reliefFamine = reliefFamine;
  window.reliefAccess = reliefAccess;
}
