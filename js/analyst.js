'use strict';

// ═══════════════════════════════════════════
// ANALYST MODE — D1 WARGAME, D2 RED TEAM, D3 CONSENSUS
//                DAILY BRIEF, MAP KEY, ARC MANAGEMENT
// ═══════════════════════════════════════════

// ── Historical Search (Supabase-backed) ──
let _histDebounceTimer = null;
function debounceHistSearch(val) {
  clearTimeout(_histDebounceTimer);
  _histDebounceTimer = setTimeout(() => runHistSearch(val), 400);
}

async function runHistSearch(query) {
  const resultsEl = document.getElementById('am-hist-results');
  const cat = document.getElementById('am-hist-cat')?.value || '';
  if (!resultsEl) return;
  if (!query.trim() && !cat) { resultsEl.style.display = 'none'; return; }
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<div class="am-hist-loading">SEARCHING ARCHIVE…</div>';

  // Supabase remote search
  const remote = await sbSearchHistory({ query, cat, days: 90, limit: 20 });

  // Local fallback — search live NEWS + localStorage accumulative cache
  const qLc = query.trim().toLowerCase();
  const catMatch = s => !cat || cat === 'all' || s.cat === cat;
  const titleMatch = s => !qLc || (s.title||'').toLowerCase().includes(qLc) || (s.summary||'').toLowerCase().includes(qLc);

  const liveMatches = (typeof NEWS !== 'undefined' ? NEWS : [])
    .filter(s => catMatch(s) && titleMatch(s))
    .slice(0, 15);

  // Also search localStorage accumulative cache
  let cacheMatches = [];
  try {
    const raw = localStorage.getItem(typeof NEWS_CACHE_KEY !== 'undefined' ? NEWS_CACHE_KEY : 'meridian_news_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      const cacheMap = parsed.map || {};
      cacheMatches = Object.values(cacheMap)
        .filter(s => catMatch(s) && titleMatch(s) && !liveMatches.some(l => l.title === s.title))
        .sort((a, b) => (b._pub||0) - (a._pub||0))
        .slice(0, 15);
    }
  } catch(e) {}

  // Merge: remote first (UUIDs), then local live, then cache — deduplicate by title
  const seen = new Set(remote.map(s => s.title));
  const localAll = [...liveMatches, ...cacheMatches].filter(s => !seen.has(s.title));

  const results = [...remote, ...localAll];

  if (!results.length) {
    resultsEl.innerHTML = '<div class="am-hist-loading">NO RESULTS FOUND</div>';
    return;
  }

  resultsEl.innerHTML = results.map(s => {
    const alreadyPinned = analystAssets.includes(s.id);
    const pinFn = s._hist ? `pinHistoricalStory('${s.id}')` : `pinStory(${s.id})`;
    return `<div class="am-hist-item${alreadyPinned?' pinned':''}">
      <div class="am-hist-meta"><span style="color:${s.color}">${(CATS[s.cat]?.label||s.cat)}</span><span>${s.time}${s._hist?' · ARCHIVE':''}</span></div>
      <div class="am-hist-title">${s.title}</div>
      <button class="am-hist-pin${alreadyPinned?' on':''}" onclick="${pinFn}">${alreadyPinned?'PINNED':'+ PIN'}</button>
    </div>`;
  }).join('');
}

function pinHistoricalStory(uuid) {
  const s = sbGetHistStory(uuid);
  if (!s) return;
  pinStory(uuid);
  // Refresh the search results to update pin states
  const input = document.getElementById('am-hist-input');
  if (input) runHistSearch(input.value);
}
function openAnalystMode() {
  document.getElementById('analyst-overlay').classList.add('on');
  renderAnalystBoard();
  // Defer canvas sizing until after layout is painted
  setTimeout(() => { resizeAnalystCanvas(); runAnalystGraph(); }, 60);
}

function closeAnalystMode() {
  document.getElementById('analyst-overlay').classList.remove('on');
  if (analystAnimId) { cancelAnimationFrame(analystAnimId); analystAnimId = null; }
}

function pinStory(storyId) {
  if (analystAssets.includes(storyId)) {
    // Already pinned — toggle off: remove from board
    unpinStory(storyId);
    document.querySelectorAll(`[data-pin-id="${storyId}"]`).forEach(btn => {
      btn.classList.remove('saved');
      btn.style.color = '';
    });
    return;
  }
  analystAssets.push(storyId);
  document.querySelectorAll(`[data-pin-id="${storyId}"]`).forEach(btn => {
    btn.classList.add('saved');
    btn.style.color = '#00D4FF';
  });
  renderAnalystBoard();
  if (document.getElementById('analyst-overlay').classList.contains('on')) runAnalystGraph();
  updateAnalystStatus();
}

function unpinStory(storyId) {
  analystAssets = analystAssets.filter(id => id !== storyId);
  renderAnalystBoard();
  if (document.getElementById('analyst-overlay').classList.contains('on')) runAnalystGraph();
  updateAnalystStatus();
}

// ── Geo Asset Pinning (cities, countries, military bases) ──────────────────
function _updateCtryNameColor(iso2, isPinned) {
  const el = document.getElementById(`ctry-nm-${iso2||''}`);
  if (el) el.style.color = isPinned ? '#FF2D55' : '#4A8CA8';
}

function _updateCityPinBtn(city, isPinned) {
  if (!city) return;
  const cur = window._cipCurrentCity;
  if (cur && cur.name === city.name) {
    const btn = document.getElementById('cip-pin-btn');
    if (btn) {
      btn.textContent = isPinned ? 'PINNED' : 'PIN';
      btn.style.color = isPinned ? '#00D4FF' : '';
      btn.style.borderColor = isPinned ? '#00D4FF66' : '';
    }
  }
}

function pinGeoAsset(geoType, obj) {
  const key = `${geoType}:${obj.name||obj.iso2}:${(obj.lat||0).toFixed(1)}`;
  if (analystAssets.includes(key)) {
    // Toggle off
    analystAssets = analystAssets.filter(k => k !== key);
    delete _analystGeoMap[key];
    if (geoType === 'country') _updateCtryNameColor(obj.iso2, false);
    if (geoType === 'city')    _updateCityPinBtn(obj, false);
    renderAnalystBoard();
    if (document.getElementById('analyst-overlay').classList.contains('on')) runAnalystGraph();
    updateAnalystStatus();
    return;
  }
  const typeColors = { city:'#E8D5A3', capital:'#E8D5A3', financial:'#FFD60A', military:'#FF6D00',
    naval:'#2979FF', port:'#00BCD4', conflict:'#FF2D55', energy:'#FF9F0A',
    diplomatic:'#30D158', country:'#B163E0', base:'#FF6D00' };
  const color = typeColors[obj.icon_type] || typeColors[geoType] || '#8A93C8';

  let assetCat = 'geo';
  if (geoType === 'country') assetCat = obj.nuclear_armed ? 'military' : obj.conflict_active ? 'military' : 'geo';
  if (obj.icon_type === 'military' || obj.icon_type === 'naval') assetCat = 'military';

  let summary = '';
  if (geoType === 'city') {
    const typeLbl = { capital:'Capital city', financial:'Financial hub', military:'Military installation', naval:'Naval base', port:'Port/maritime hub', conflict:'Active conflict zone', energy:'Energy infrastructure', diplomatic:'Diplomatic capital', city:'Major city' };
    summary = `${typeLbl[obj.icon_type]||'Strategic location'} in ${obj.country||'unknown'}. Coordinates: ${(obj.lat||0).toFixed(2)}°N ${(obj.lng||0).toFixed(2)}°E. Strategic tier: ${obj.strategic_tier||'—'}.`;
    if (obj.notes) summary += ` ${obj.notes}`;
  } else if (geoType === 'country') {
    const flags = [
      obj.nuclear_armed     ? '☢ Nuclear armed' : '',
      obj.un_p5             ? '★ UN Security Council P5' : '',
      obj.conflict_active   ? '▲ Active conflict' : '',
      obj.sanctions_subject ? '⊘ Under sanctions' : '',
      obj.nato_member       ? '◆ NATO member' : '',
    ].filter(Boolean);
    summary = `${flags.join(' · ') || 'No special designations'}. GDP: ${obj.gdp_billions ? '$'+obj.gdp_billions+'B' : '—'}. Military spend: ${obj.mil_spend_billions ? '$'+obj.mil_spend_billions+'B' : '—'}. Strategic tier: ${obj.strategic_tier||'—'}.`;
  }

  _analystGeoMap[key] = {
    id: key, _geoType: geoType, _geoObj: obj,
    title: geoType === 'country' ? `${obj.name} — Country Intelligence Profile` : `${obj.name} — ${(obj.icon_type||'city').replace(/^\w/, c=>c.toUpperCase())} Asset`,
    summary, cat: assetCat, color,
    src: geoType === 'country' ? (obj.iso2||'CTRY') : 'CITY',
    time: 'CURRENT', region: obj.country || obj.name,
  };
  analystAssets.push(key);
  if (geoType === 'country') _updateCtryNameColor(obj.iso2, true);
  if (geoType === 'city')    _updateCityPinBtn(obj, true);
  renderAnalystBoard();
  if (document.getElementById('analyst-overlay').classList.contains('on')) runAnalystGraph();
  updateAnalystStatus();
}

function clearAssets() {
  // Reset globe visuals before clearing the map
  Object.values(_analystGeoMap).forEach(asset => {
    if (asset._geoType === 'country' && asset._geoObj) _updateCtryNameColor(asset._geoObj.iso2, false);
    if (asset._geoType === 'city'    && asset._geoObj) _updateCityPinBtn(asset._geoObj, false);
  });
  analystAssets = [];
  _analystGeoMap = {};
  // Restore am-status with am-asset-count span FIRST (before updateAnalystStatus needs it)
  document.getElementById('am-status').innerHTML = 'SYSTEM READY · <span id="am-asset-count">0</span> ASSETS PINNED';
  // Clear the brief panel immediately and synchronously
  const briefScroll = document.getElementById('am-brief-scroll');
  if (briefScroll) {
    briefScroll.innerHTML = '<div class="am-brief-empty" id="am-brief-empty">PIN ASSETS AND CLICK SYNTHESIZE<br>TO GENERATE INTELLIGENCE BRIEF<button class="am-synth-btn" onclick="synthesizeBrief()">SYNTHESIZE NOW</button></div>';
    briefScroll.scrollTop = 0;
  }
  document.getElementById('am-brief-meta').textContent = '—';
  renderAnalystBoard();
  runAnalystGraph();
  updateAnalystStatus();
  // Un-highlight all feed pin buttons
  document.querySelectorAll('[data-pin-id]').forEach(btn => {
    btn.classList.remove('saved');
    btn.style.color = '';
  });
}

function updateAnalystStatus() {
  const cnt = document.getElementById('am-asset-count');
  if (cnt) cnt.textContent = analystAssets.length;
  const meta = document.getElementById('am-col-meta');
  if (meta) meta.textContent = analystAssets.length ? `${analystAssets.length} ASSETS` : 'PIN STORIES FROM FEED';
}

function _resolveStory(id) {
  if (typeof id === 'string' && id.includes(':') && _analystGeoMap[id]) return _analystGeoMap[id];
  return NEWS.find(s => s.id === id) || sbGetHistStory(id) || null;
}

function _buildAssetContext(pinned) {
  return pinned.map(s => {
    if (s._geoType === 'city') {
      const o = s._geoObj || {};
      return `[GEO/CITY] ${o.name||s.title}, ${o.country||''}` +
        ` — Type: ${(o.icon_type||'city').toUpperCase()}` +
        ` · Coords: ${(o.lat||0).toFixed(2)}, ${(o.lng||0).toFixed(2)}` +
        ` · Strategic tier: ${o.strategic_tier||'—'}` +
        (o.notes ? ` · ${o.notes}` : '');
    }
    if (s._geoType === 'country') {
      const o = s._geoObj || {};
      const attrs = [
        o.nuclear_armed     ? 'NUCLEAR ARMED' : '',
        o.un_p5             ? 'UN P5' : '',
        o.conflict_active   ? 'ACTIVE CONFLICT' : '',
        o.sanctions_subject ? 'SANCTIONED' : '',
        o.nato_member       ? 'NATO' : '',
      ].filter(Boolean).join(', ');
      return `[GEO/COUNTRY] ${o.name||s.title}` +
        ` — ${attrs||'Standard nation-state'}` +
        ` · GDP: ${o.gdp_billions ? '$'+o.gdp_billions+'B' : '—'}` +
        ` · Mil spend: ${o.mil_spend_billions ? '$'+o.mil_spend_billions+'B' : '—'}` +
        ` · Strategic tier: ${o.strategic_tier||'—'}`;
    }
    return `[${(CATS[s.cat]?.label||s.cat).toUpperCase()}] ${s.title}: ${s.summary||''}`;
  }).join('\n');
}

function renderAnalystBoard() {
  const scroll = document.getElementById('am-asset-scroll');
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  if (!pinned.length) {
    scroll.innerHTML = '<div class="am-asset-empty" id="am-asset-empty">DRAG STORIES FROM THE INTELLIGENCE FEED<br>OR CLICK THE PIN ICON ON ANY CARD</div>';
    return;
  }
  scroll.innerHTML = pinned.map(s => {
    const isGeo = typeof s.id === 'string' && s.id.includes(':');
    const rmFn  = isGeo ? `pinGeoAsset('${s._geoType||''}', _analystGeoMap['${s.id}']?._geoObj||{})` : `unpinStory(${s.id})`;
    const badge = isGeo
      ? `<span style="color:${s.color};opacity:.7;font-size:7px">${s._geoType?.toUpperCase()||'GEO'} ASSET</span>`
      : `${(CATS[s.cat]?.label||s.cat).toUpperCase()}${s.brk ? ' · <span style="color:var(--brk)">BREAKING</span>' : ''}${s._hist ? ' · <span style="color:#8A93C8;opacity:.6">ARCHIVE</span>' : ''}`;
    const traj = _computeTrajectory(s);
    const trajHtml = `<span class="am-traj am-traj-${traj.dir}" title="Activity trend: ${traj.label}">${traj.arrow}</span>`;
    const idStr = typeof s.id === 'string' ? `'${s.id}'` : s.id;
    return `
    <div class="am-card" style="--ac:${s.color}">
      <div class="am-card-cat" style="color:${s.color}">${badge}${trajHtml}</div>
      <div class="am-card-title">${s.title}</div>
      <div class="am-card-meta"><span>${s.src}</span><span>${s.time}</span><span>${s.region||''}</span><button class="am-card-tl" onclick="openNarrativeTimeline(${idStr})" title="Narrative Timeline">⏱</button></div>
      <button class="am-card-rm" onclick="${rmFn}">×</button>
    </div>`;
  }).join('');
}

function resizeAnalystCanvas() {
  const canvas = document.getElementById('am-canvas');
  if (!canvas) return;
  const parent = canvas.parentElement;
  const w = parent.offsetWidth, h = parent.offsetHeight;
  if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; }
}

function resetNetworkView() {
  _netZoom = 1; _netPanX = 0; _netPanY = 0;
}

function _initNetworkInteraction(canvas) {
  // Remove old listeners by replacing canvas event binds via stored handlers
  canvas.onwheel = e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    _netZoom = Math.max(0.3, Math.min(4, _netZoom * delta));
  };
  canvas.onmousedown = e => { _netDrag = { sx: e.clientX, sy: e.clientY, px: _netPanX, py: _netPanY }; };
  canvas.onmousemove = e => { if (_netDrag) { _netPanX = _netDrag.px + e.clientX - _netDrag.sx; _netPanY = _netDrag.py + e.clientY - _netDrag.sy; } };
  canvas.onmouseup = canvas.onmouseleave = () => { _netDrag = null; };
}

function runAnalystGraph() {
  if (analystAnimId) { cancelAnimationFrame(analystAnimId); analystAnimId = null; }
  const canvas = document.getElementById('am-canvas');
  const empty = document.getElementById('am-net-empty');
  const resetBtn = document.getElementById('am-net-reset');
  if (!canvas) return;

  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  if (!pinned.length) {
    if (empty) empty.style.display = 'flex';
    if (resetBtn) resetBtn.style.display = 'none';
    // Explicitly clear canvas so dots don't linger after board is cleared
    const ctx0 = canvas.getContext('2d');
    ctx0.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (empty) empty.style.display = 'none';
  if (resetBtn) resetBtn.style.display = '';

  // Ensure canvas has valid dimensions
  if (canvas.width < 10 || canvas.height < 10) resizeAnalystCanvas();
  const W = canvas.width || 400, H = canvas.height || 300;

  _netZoom = 1; _netPanX = 0; _netPanY = 0;
  _initNetworkInteraction(canvas);

  const nodes = pinned.map(s => ({
    id: s.id, label: s.title.slice(0, 22), color: s.color,
    x: W/2 + (Math.random()-.5)*W*.55, y: H/2 + (Math.random()-.5)*H*.55,
    vx: 0, vy: 0,
  }));

  const edges = [];
  for (let i = 0; i < pinned.length; i++) {
    for (let j = i+1; j < pinned.length; j++) {
      const ta = (pinned[i].title+' '+(pinned[i].summary||'')).toLowerCase();
      const tb = (pinned[j].title+' '+(pinned[j].summary||'')).toLowerCase();
      const shared = SHARED_ENTITIES.filter(e => ta.includes(e.toLowerCase()) && tb.includes(e.toLowerCase()));
      if (shared.length) edges.push({ i, j, strength: shared.length, label: shared[0] });
    }
  }

  const ctx = canvas.getContext('2d');
  let frame = 0;

  function loop() {
    // Force-directed simulation (in world-space, before zoom)
    for (const n of nodes) {
      n.vx *= 0.86; n.vy *= 0.86;
      n.vx += (W/2 - n.x) * 0.003; n.vy += (H/2 - n.y) * 0.003;
    }
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a+1; b < nodes.length; b++) {
        const dx = nodes[b].x-nodes[a].x, dy = nodes[b].y-nodes[a].y;
        const d = Math.sqrt(dx*dx+dy*dy)+0.1;
        const f = Math.min(5000/(d*d), 10);
        nodes[a].vx -= dx/d*f; nodes[a].vy -= dy/d*f;
        nodes[b].vx += dx/d*f; nodes[b].vy += dy/d*f;
      }
    }
    for (const e of edges) {
      const dx = nodes[e.j].x-nodes[e.i].x, dy = nodes[e.j].y-nodes[e.i].y;
      const d = Math.sqrt(dx*dx+dy*dy)+0.1, target = 140;
      const f = (d-target)*0.055;
      nodes[e.i].vx += dx/d*f; nodes[e.i].vy += dy/d*f;
      nodes[e.j].vx -= dx/d*f; nodes[e.j].vy -= dy/d*f;
    }
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(40, Math.min(W-40, n.x)); n.y = Math.max(40, Math.min(H-40, n.y));
    }

    // Render with zoom/pan transform
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W/2 + _netPanX, H/2 + _netPanY);
    ctx.scale(_netZoom, _netZoom);
    ctx.translate(-W/2, -H/2);

    // Grid
    ctx.strokeStyle = 'rgba(10,16,32,.9)'; ctx.lineWidth = .5;
    for (let x = 0; x < W; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Edges — cyan = same-domain connection, amber = cross-domain signal correlation
    let hasCross = false;
    for (const e of edges) {
      const pulse = 0.25 + Math.sin(frame*0.025 + e.i)*0.12;
      const isCross = pinned[e.i]?.cat !== pinned[e.j]?.cat;
      if (isCross) hasCross = true;
      ctx.beginPath(); ctx.moveTo(nodes[e.i].x, nodes[e.i].y); ctx.lineTo(nodes[e.j].x, nodes[e.j].y);
      ctx.strokeStyle = isCross ? `rgba(255,159,10,${pulse+0.1})` : `rgba(0,212,255,${pulse})`;
      ctx.lineWidth = 0.5 + e.strength*0.35; ctx.stroke();
      const mx = (nodes[e.i].x+nodes[e.j].x)/2, my = (nodes[e.i].y+nodes[e.j].y)/2;
      ctx.font = '7px "IBM Plex Mono"';
      ctx.fillStyle = isCross ? 'rgba(255,159,10,.85)' : 'rgba(0,160,200,.75)';
      ctx.textAlign = 'center';
      ctx.fillText(e.label.toUpperCase(), mx, my-5);
    }
    document.getElementById('am-net-meta').textContent =
      `${pinned.length} NODES · ${edges.length} CONNECTIONS${hasCross ? ' · CROSS-DOMAIN' : ''}`;

    // Nodes
    for (const n of nodes) {
      const glow = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,22);
      glow.addColorStop(0, n.color+'55'); glow.addColorStop(1,'transparent');
      ctx.beginPath(); ctx.arc(n.x,n.y,22,0,Math.PI*2); ctx.fillStyle=glow; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x,n.y,9,0,Math.PI*2); ctx.fillStyle=n.color; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=1.2; ctx.stroke();
      ctx.font='8px "IBM Plex Mono"'; ctx.fillStyle='rgba(160,180,220,.9)'; ctx.textAlign='center';
      ctx.fillText(n.label, n.x, n.y+22);
    }

    ctx.restore();
    frame++;
    analystAnimId = requestAnimationFrame(loop);
  }
  loop();
}

async function synthesizeBrief() {
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  if (!pinned.length) return;

  const briefEl = document.getElementById('am-brief-scroll');
  const cats = [...new Set(pinned.map(s => s.cat))];
  const regions = [...new Set(pinned.map(s => s.region).filter(Boolean))];
  const entities = SHARED_ENTITIES.filter(e => pinned.some(s =>
    (s.title+' '+(s.summary||'')).toLowerCase().includes(e.toLowerCase())
  ));
  const brkCount = pinned.filter(s => s.brk).length;
  const now = new Date().toLocaleString([], {dateStyle:'medium',timeStyle:'short'});

  // Show loading state while fetching historical context
  briefEl.innerHTML = `<div class="am-classify">TOP SECRET / NOFORN · ${now}</div><div style="padding:20px 16px;font-family:var(--f-mono);font-size:8px;color:var(--t3);letter-spacing:.12em">FETCHING HISTORICAL CONTEXT…</div>`;

  // Pull related historical stories from Supabase (non-blocking — 5s timeout)
  let histStories = [];
  try {
    histStories = await Promise.race([
      sbFetchRelatedHistory(pinned, 8),
      new Promise(res => setTimeout(() => res([]), 5000)),
    ]);
  } catch(e) {}

  const histBlock = histStories.length ? `
    <div class="am-brief-sec">
      <div class="am-brief-sh">HISTORICAL CONTEXT <span style="font-size:7px;opacity:.5">(LAST 30 DAYS)</span></div>
      ${histStories.map(s => `<p class="am-brief-p" style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #0a0c18;opacity:.75"><span style="color:${s.color};font-family:var(--f-mono);font-size:7px;letter-spacing:.1em">${(CATS[s.cat]?.label||s.cat)} · ${s.src} · ${s.time}</span><br>${s.title}</p>`).join('')}
    </div>` : '';

  briefEl.innerHTML = `
    <div class="am-classify">TOP SECRET / NOFORN · ${now}</div>
    <div class="am-brief-sec">
      <div class="am-brief-sh">EXECUTIVE SUMMARY</div>
      <p class="am-brief-p">Analysis of ${pinned.length} intelligence asset${pinned.length>1?'s':''} spanning ${cats.length} domain${cats.length>1?'s':''} and ${regions.length} operational region${regions.length>1?'s':''}. ${brkCount>0?`<strong style="color:#FF2D55">${brkCount} BREAKING</strong> development${brkCount>1?'s':''} flagged for immediate attention.`:''} Cross-domain analysis indicates ${entities.length > 4 ? 'elevated' : 'moderate'} global activity.${histStories.length ? ` <span style="color:#8A93C8;font-size:.9em">${histStories.length} related historical developments found.</span>` : ''}</p>
    </div>
    <div class="am-brief-sec">
      <div class="am-brief-sh">KEY ENTITIES</div>
      <div class="am-entities">${entities.map(e => `<span class="am-ent hi">${e}</span>`).join('')}${regions.map(r => `<span class="am-ent">${r}</span>`).join('')}</div>
    </div>
    <div class="am-brief-sec">
      <div class="am-brief-sh">ASSET SUMMARIES</div>
      ${pinned.map(s => `<p class="am-brief-p" style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #0a0c18"><span style="color:${s.color};font-family:var(--f-mono);font-size:7.5px;letter-spacing:.1em">${(CATS[s.cat]?.label||s.cat)} · ${s.src}${s._hist?' · ARCHIVE':''}</span><br>${s.summary||s.title}</p>`).join('')}
    </div>
    ${histBlock}
    <div class="am-brief-sec">
      <div class="am-brief-sh">DOMAINS</div>
      <div class="am-entities">${cats.map(c=>`<span class="am-ent hi" style="border-color:${CATS[c]?.color}44;color:${CATS[c]?.color}">${CATS[c]?.label||c}</span>`).join('')}</div>
    </div>`;
  document.getElementById('am-brief-meta').textContent = `${pinned.length} ASSETS · ${now}`;
  _postProcessBriefConfidence();
}

function exportBrief() {
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  const briefEl = document.getElementById('am-brief-scroll');
  const briefHTML = briefEl ? briefEl.innerHTML : '';
  const metaEl = document.getElementById('am-brief-meta');
  const metaTxt = metaEl ? metaEl.textContent : '';
  const now = new Date().toLocaleString();

  const assetRows = pinned.map(s => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f35;color:${s.color||'#8A93C8'};font-family:monospace;font-size:11px">${(CATS[s.cat]?.label||s.cat).toUpperCase()}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f35;font-size:12px;color:#c8d0f0">${s.title}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #1a1f35;font-family:monospace;font-size:10px;color:#5a6480">${s.src} · ${s.time}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>MERIDIAN BRIEF — ${now}</title>
<style>
  body{background:#030409;color:#c8d0f0;font-family:'IBM Plex Mono',monospace;margin:0;padding:0}
  .banner{background:#C1121F;padding:10px 24px;font-size:9px;font-weight:700;letter-spacing:.3em;color:#fff;text-align:center}
  .hdr{padding:24px 32px 16px;border-bottom:1px solid #1a1f35}
  .wordmark{font-size:11px;letter-spacing:.32em;color:#00D4FF;margin-bottom:6px}
  .title{font-size:22px;font-weight:800;letter-spacing:.1em;color:#f0f2ff;font-family:Georgia,serif;margin-bottom:4px}
  .meta{font-size:9px;color:#3C4470;letter-spacing:.12em}
  .section{padding:20px 32px}
  .sec-label{font-size:8px;letter-spacing:.22em;color:#3C4470;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #0d1020}
  table{width:100%;border-collapse:collapse}
  .brief-body{padding:0 32px 32px;font-size:12px;line-height:1.8;color:#8A93C8}
  .brief-body p{margin-bottom:10px}
</style></head><body>
<div class="banner">◆ MERIDIAN INTELLIGENCE SYSTEM — ${now}</div>
<div class="hdr">
  <div class="wordmark">◆ MERIDIAN INTELLIGENCE BRIEF</div>
  <div class="title">INTELLIGENCE BRIEF</div>
  <div class="meta">${metaTxt}</div>
</div>
${pinned.length ? `<div class="section"><div class="sec-label">INTELLIGENCE ASSETS (${pinned.length})</div><table>${assetRows}</table></div>` : ''}
<div class="section"><div class="sec-label">BRIEF</div></div>
<div class="brief-body">${briefHTML}</div>
</body></html>`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], {type:'text/html'}));
  a.download = `meridian-brief-${Date.now()}.html`;
  a.click();
}
// ═══════════════════════════════════════════
// API HELPERS
// (Keys declared in config.js — do not redeclare here)

async function callOpenAI(sys, user, maxTokens = 420) {
  if (!OPENAI_KEY || OPENAI_KEY.includes('YOUR_OPENAI')) throw new Error('API_KEY_MISSING');
  const ctrl = new AbortController();
  const timeoutMs = maxTokens > 800 ? 55000 : 30000;
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model:'gpt-5.4-mini', max_completion_tokens:maxTokens, temperature:0.7,
        messages:[{role:'system',content:sys},{role:'user',content:user}] }),
    });
    clearTimeout(t);
    const d = await res.json();
    if (d.error) throw new Error(d.error.message || 'OpenAI API error');
    return d.choices?.[0]?.message?.content || '';
  } catch(e) { clearTimeout(t); if (e.message==='API_KEY_MISSING') throw e; throw new Error(e.message||'API call failed'); }
}
// ═══════════════════════════════════════════
// D3 — MULTI-ANALYST CONSENSUS BOARD
// ═══════════════════════════════════════════
const ANALYST_PERSONAS = [
  { id:'military',   name:'MILITARY ANALYST',   color:'#FF9F0A', icon:'⚔', spec:'military strategy, force deployment, escalation ladders, weapons systems, order-of-battle analysis' },
  { id:'economic',   name:'ECONOMIC ANALYST',   color:'#FFD60A', icon:'$', spec:'financial markets, trade flows, sanctions impact, currency dynamics, commodity markets, economic coercion' },
  { id:'cyber',      name:'CYBER ANALYST',      color:'#0A84FF', icon:'⬡', spec:'information warfare, critical infrastructure vulnerabilities, state-actor TTPs, SIGINT, disinformation operations' },
  { id:'diplomatic', name:'DIPLOMATIC ANALYST', color:'#30D158', icon:'◎', spec:'geopolitical relationships, treaty obligations, diplomatic signaling, multilateral institutions, coalition dynamics' },
  { id:'energy',     name:'ENERGY ANALYST',     color:'#FF2D55', icon:'⚡', spec:'energy security, pipeline dependencies, oil and gas supply disruption, resource competition, commodity flows' },
];

async function runConsensusBoard() {
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  if (!pinned.length) {
    const scroll = document.getElementById('am-brief-scroll');
    scroll.innerHTML = '<div class="am-brief-empty" style="display:flex"><div>PIN AT LEAST ONE STORY TO THE ASSET BOARD<br>THEN CLICK ◆ CONSENSUS</div></div>';
    return;
  }

  const context = _buildAssetContext(pinned);

  const scroll = document.getElementById('am-brief-scroll');

  // ── ROUND 1 SETUP ───────────────────────────
  document.getElementById('am-status').innerHTML = 'ROUND 1 · 5 SPECIALIST ANALYSTS ASSESSING IN PARALLEL…';
  scroll.innerHTML = `
    <div class="am-classify" style="margin-bottom:0">◆ AGENTIC CONSENSUS BOARD · ${new Date().toLocaleString()}</div>
    <div class="cb-stats">
      <div class="cb-stat"><div class="cb-stat-v" style="color:#3C4470">—%</div><div class="cb-stat-l">ESCALATION</div></div>
      <div class="cb-stat"><div class="cb-stat-v" style="color:#3C4470">—%</div><div class="cb-stat-l">AGREEMENT</div></div>
      <div class="cb-stat"><div class="cb-stat-v" style="color:#3C4470">—pt</div><div class="cb-stat-l">DIVERGENCE</div></div>
    </div>
    <div class="cb-round-hdr"><em>ROUND 1</em> — INDEPENDENT SPECIALIST ANALYSIS</div>
    <div class="cb-bar-wrap" id="cb-bar-wrap">
      ${ANALYST_PERSONAS.map(a => `
        <div class="cb-analyst cb-anim" style="--ac:${a.color}">
          <div class="cb-name"><span class="cb-icon">${a.icon}</span>${a.name}</div>
          <div class="cb-loading rt-loading-anim">ANALYZING…</div>
        </div>`).join('')}
    </div>
    <div id="cb-round2-zone"></div>
    <div id="cb-round3-zone"></div>`;

  // ── ROUND 1 CALLS ────────────────────────────
  const r1Promises = ANALYST_PERSONAS.map((a, i) =>
    callOpenAI(
      `You are a ${a.spec} analyst at a top-tier intelligence organization. Be direct, specific, analytical. Respond ONLY in JSON.`,
      `Review these intelligence assets from your domain perspective:\n\n${context}\n\nBased ONLY on the content above, respond with ONLY valid JSON (no extra text, no markdown):\n{"assessment":"2-3 sentence domain-specific analysis of these specific assets","escalation":INTEGER_0_TO_100,"keyFactor":"the single most critical variable you track in this situation","blindspot":"what the other analysts are likely missing that you can see","confidence":INTEGER_0_TO_100}\n\nEscalation scoring guide: 0-20=de-escalating, 21-40=stable, 41-60=moderate tension, 61-80=elevated risk, 81-100=crisis imminent. Base your score strictly on the evidence in the assets, not on persona defaults.`,
      220
    ).then(text => {
      try {
        const parsed = JSON.parse(text.match(/\{[\s\S]*?\}/)?.[0] || '{}');
        return { ...a, ...parsed, ok: true };
      } catch { return { ...a, assessment: 'Parse error.', escalation: 50, ok: false }; }
    }).catch(() => ({ ...a, assessment: 'API unavailable.', escalation: 50, ok: false }))
  );

  // Update each card as it resolves
  const analysts = await Promise.all(r1Promises.map(async (p, i) => {
    const result = await p;
    const wrap = document.getElementById('cb-bar-wrap');
    if (wrap) {
      const cards = wrap.querySelectorAll('.cb-analyst');
      if (cards[i]) {
        const esc = +(result.escalation) || 50;
        const col = esc > 65 ? '#FF2D55' : esc > 40 ? '#FF9F0A' : '#30D158';
        cards[i].innerHTML = `
          <div class="cb-name"><span class="cb-icon">${result.icon}</span>${result.name}</div>
          <div class="cb-track"><div class="cb-fill" style="width:${esc}%;background:${col}"></div><span class="cb-pct" style="color:${col}">${esc}%</span></div>
          <div class="cb-text">${result.assessment || ''}</div>
          ${result.keyFactor ? `<span class="cb-tag">KEY: ${result.keyFactor}</span>` : ''}
          ${result.blindspot ? `<span class="cb-tag cb-blind">BLIND SPOT: ${result.blindspot}</span>` : ''}`;
      }
    }
    return result;
  }));

  // Update aggregate stats
  const scores = analysts.map(a => +(a.escalation) || 50);
  const mean   = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const spread = Math.max(...scores) - Math.min(...scores);
  // Agreement: inverse of normalized std deviation (std dev of 0 → 100%, std dev of 25 → 0%)
  const stdDev = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length);
  const agr    = Math.max(0, Math.round(100 - stdDev * 2.5));
  const statEl = scroll.querySelector('.cb-stats');
  if (statEl) {
    const meanCol = mean > 65 ? '#FF2D55' : mean > 40 ? '#FF9F0A' : '#30D158';
    const agrCol  = agr < 40 ? '#FF9F0A' : '#30D158';
    statEl.innerHTML = `
      <div class="cb-stat"><div class="cb-stat-v" style="color:${meanCol}">${mean}%</div><div class="cb-stat-l">ESCALATION</div></div>
      <div class="cb-stat"><div class="cb-stat-v" style="color:${agrCol}">${agr}%</div><div class="cb-stat-l">AGREEMENT</div></div>
      <div class="cb-stat"><div class="cb-stat-v">${spread}pt</div><div class="cb-stat-l">DIVERGENCE</div></div>`;
  }

  // ── ROUND 2: CROSS-EXAMINATION ───────────────
  // Find most divergent pair (highest vs lowest escalation)
  const sorted = [...analysts].sort((a, b) => +(a.escalation) - +(b.escalation));
  const hawk = sorted[sorted.length - 1]; // highest escalation
  const dove = sorted[0];                 // lowest escalation

  document.getElementById('am-status').innerHTML = `ROUND 2 · CROSS-EXAMINATION: ${hawk.name} vs ${dove.name}`;
  const r2zone = document.getElementById('cb-round2-zone');
  r2zone.innerHTML = `
    <div class="cb-round-hdr"><em>ROUND 2</em> — CROSS-EXAMINATION · <span style="color:${hawk.color}">${hawk.icon} ${hawk.name}</span> <span style="opacity:.4">vs</span> <span style="color:${dove.color}">${dove.icon} ${dove.name}</span></div>
    <div class="cb-debate-section" id="cb-debate-msgs">
      <div class="cb-debate-msg attacker" style="--ac-a:${hawk.color}">
        <div class="cb-debate-who" style="color:${hawk.color}">${hawk.icon} ${hawk.name} · CHALLENGING</div>
        <div class="cb-debate-body rt-loading-anim">Formulating challenge…</div>
      </div>
    </div>`;

  // Hawk challenges dove's low-escalation assessment
  let hawkChallenge = '', doveRebuttal = '';
  try {
    hawkChallenge = await callOpenAI(
      `You are ${hawk.name}, a ${hawk.spec} analyst. You just read another analyst's assessment and strongly disagree with their low threat estimation. Be direct, specific, and pointed. 1-2 sentences maximum.`,
      `Your assessment: "${hawk.assessment}" (escalation: ${hawk.escalation}%)\n\nThe ${dove.name} says: "${dove.assessment}" (escalation: ${dove.escalation}%)\n\nWrite your pointed challenge to their analysis — what critical threat factor are they ignoring?`,
      120
    );
  } catch(e) { hawkChallenge = '[API error]'; }

  const debateMsgs = document.getElementById('cb-debate-msgs');
  if (debateMsgs) {
    const firstMsg = debateMsgs.querySelector('.cb-debate-body');
    if (firstMsg) firstMsg.textContent = hawkChallenge;
    firstMsg?.classList.remove('rt-loading-anim');

    // Add dove rebuttal placeholder
    debateMsgs.insertAdjacentHTML('beforeend', `
      <div class="cb-debate-msg defender" style="--ac-d:${dove.color}">
        <div class="cb-debate-who" style="color:${dove.color}">${dove.icon} ${dove.name} · REBUTTAL</div>
        <div class="cb-debate-body rt-loading-anim" id="cb-dove-rebuttal">Formulating rebuttal…</div>
      </div>`);
  }

  // Dove rebuts
  try {
    doveRebuttal = await callOpenAI(
      `You are ${dove.name}, a ${dove.spec} analyst. Respond to a pointed challenge from a more hawkish colleague. Defend your assessment with specific evidence they may be discounting. 1-2 sentences maximum.`,
      `Your assessment: "${dove.assessment}" (escalation: ${dove.escalation}%)\n\nThe ${hawk.name} challenges: "${hawkChallenge}"\n\nWrite your rebuttal — what stabilizing factors or alternative interpretation justifies your lower threat assessment?`,
      120
    );
  } catch(e) { doveRebuttal = '[API error]'; }

  const doveEl = document.getElementById('cb-dove-rebuttal');
  if (doveEl) { doveEl.textContent = doveRebuttal; doveEl.classList.remove('rt-loading-anim'); }

  // ── ROUND 3: SYNTHESIS BRIEF ─────────────────
  document.getElementById('am-status').innerHTML = 'ROUND 3 · SENIOR ANALYST SYNTHESIZING ALL PERSPECTIVES…';
  const r3zone = document.getElementById('cb-round3-zone');
  r3zone.innerHTML = `
    <div class="cb-round-hdr"><em>ROUND 3</em> — SENIOR ANALYST SYNTHESIS</div>
    <div class="cb-synthesis-section">
      <div class="cb-synthesis-card">
        <div class="cb-synthesis-hdr">◆ CONSOLIDATED INTELLIGENCE BRIEF</div>
        <div class="cb-synthesis-body rt-loading-anim" id="cb-synthesis-body">Synthesizing 5 specialist assessments and cross-examination findings…</div>
      </div>
    </div>`;

  const analystSummaries = analysts.map(a =>
    `${a.icon} ${a.name} (${a.escalation}% escalation): ${a.assessment} | KEY: ${a.keyFactor||'—'} | BLIND SPOT: ${a.blindspot||'—'}`
  ).join('\n');

  let synthesis = '';
  try {
    synthesis = await callOpenAI(
      `You are the Senior Intelligence Analyst synthesizing a panel of 5 specialist analysts who reviewed the same situation independently and then cross-examined each other. Write a consolidated brief in IC style — direct, unhedged, actionable. 3-4 short paragraphs.`,
      `INTELLIGENCE ASSETS REVIEWED:\n${context}\n\nSPECIALIST ASSESSMENTS:\n${analystSummaries}\n\nCROSS-EXAMINATION:\n${hawk.name} challenged: "${hawkChallenge}"\n${dove.name} rebutted: "${doveRebuttal}"\n\nWrite the consolidated brief covering: (1) key findings where analysts agree, (2) the most significant divergence and what it means for decision-makers, (3) the single highest-priority action indicator to watch, (4) overall threat trajectory.`,
      700
    );
  } catch(e) { synthesis = 'Synthesis unavailable — check API key.'; }

  const synthEl = document.getElementById('cb-synthesis-body');
  if (synthEl) {
    synthEl.classList.remove('rt-loading-anim');
    synthEl.innerHTML = synthesis.split('\n').filter(l => l.trim()).map(l => `<p style="margin-bottom:10px">${l}</p>`).join('');
  }

  document.getElementById('am-status').innerHTML = `◆ CONSENSUS COMPLETE · 3 ROUNDS · ${analysts.filter(a=>a.ok).length}/5 ANALYSTS · ${new Date().toLocaleString()}`;
  document.getElementById('am-brief-meta').textContent = `5 ANALYSTS + CROSS-EXAM + SYNTHESIS · ${new Date().toLocaleString()}`;
}
// ═══════════════════════════════════════════
// D2 — RED TEAM BRIEF GENERATOR
// ═══════════════════════════════════════════
function openRedTeamBrief() {
  closeAnalystMode();
  document.getElementById('redteam-modal').classList.add('on');
}

async function generateRedTeamBrief() {
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  if (!pinned.length) {
    document.getElementById('rt-status').textContent = 'PIN ASSETS TO ANALYST BOARD FIRST';
    return;
  }
  document.getElementById('rt-status').textContent = 'GENERATING ADVERSARIAL ASSESSMENT…';
  document.getElementById('rt-export-btn').style.display = 'none';
  document.getElementById('rt-content').innerHTML = '<div class="rt-loading rt-loading-anim">ADVERSARY PERSPECTIVE LOADING…</div>';

  const context = _buildAssetContext(pinned);

  try {
    const brief = await callOpenAI(
      'You are generating an adversarial intelligence assessment from a rival state actor perspective, analyzing Western/US vulnerabilities and opportunities. Use intelligence community style writing. Be credible and specific.',
      `Generate a structured intelligence assessment from an adversarial perspective for these developments:\n\n${context}\n\nFormat your response with these labeled sections (write 3-5 specific points under each section):\nSITUATION ASSESSMENT:\nIDENTIFIED VULNERABILITIES:\nEXPLOITATION VECTORS:\nSTRATEGIC OPPORTUNITY WINDOW:\nCOUNTERMEASURE GAPS:\nRECOMMENDED ACTIONS:`,
      2200
    );

    window._rtBriefText = brief;
    document.getElementById('rt-status').textContent = 'ADVERSARIAL BRIEF GENERATED';
    document.getElementById('rt-export-btn').style.display = '';

    const now = new Date().toLocaleString();
    document.getElementById('rt-content').innerHTML = `
      <div class="rt-classify">TOP SECRET // SI // NOFORN</div>
      <div class="rt-heading">ADVERSARIAL OPPORTUNITY ASSESSMENT</div>
      <div class="rt-date">PREPARED: ${now} &nbsp;·&nbsp; MERIDIAN INTELLIGENCE SYSTEM &nbsp;·&nbsp; NOT FOR DISTRIBUTION</div>
      <div>${brief.split('\n').filter(l => l.trim()).map(l => {
        if (/^[A-Z\s]+:$/.test(l.trim())) return `<div style="font-family:var(--f-mono);font-size:8.5px;letter-spacing:.2em;color:rgba(255,100,100,.8);margin:16px 24px 4px;padding-top:12px;border-top:1px solid rgba(255,23,68,.2)">${l.trim()}</div>`;
        return `<p class="rt-para">${l}</p>`;
      }).join('')}</div>
      <div class="rt-classify" style="margin-top:20px">TOP SECRET // SI // NOFORN</div>`;
  } catch(e) {
    document.getElementById('rt-status').textContent = 'GENERATION FAILED — CHECK API KEY';
    document.getElementById('rt-content').innerHTML = `<div class="rt-loading" style="color:rgba(255,45,85,.5)">ERROR: ${e.message}</div>`;
  }
}

function exportRedTeamPDF() {
  const now = new Date().toLocaleString();
  const bodyHtml = document.getElementById('rt-content').innerHTML || '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MERIDIAN RED TEAM BRIEF — ${now}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0a;color:#e8e8e8;font-family:'Courier New',monospace;font-size:11px;line-height:1.7}
  .rt-banner{background:#c1121f;color:#fff;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px 0;width:100%}
  .rt-body{max-width:860px;margin:0 auto;padding:40px 32px}
  .rt-heading{font-size:15px;font-weight:700;letter-spacing:.2em;color:#ff1744;text-align:center;margin:28px 0 6px}
  .rt-date{font-size:8px;letter-spacing:.12em;color:rgba(255,255,255,.4);text-align:center;margin-bottom:28px}
  .rt-classify{background:#c1121f;color:#fff;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px 0}
  .rt-para{font-size:10.5px;color:rgba(232,232,232,.9);line-height:1.75;margin:6px 0}
  h3,div[style]{color:rgba(255,100,100,.85) !important}
  hr{border:none;border-top:1px solid rgba(255,23,68,.25);margin:20px 0}
</style>
</head>
<body>
<div class="rt-banner">TOP SECRET // SI // NOFORN</div>
<div class="rt-body">
${bodyHtml}
</div>
<div class="rt-banner">TOP SECRET // SI // NOFORN</div>
</body>
</html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], {type:'text/html'}));
  a.download = `red-team-brief-${Date.now()}.html`;
  a.click();
}
function openWargame() {
  wargameActive = true;
  document.getElementById('wargame-overlay').classList.add('on');
  // Allow globe markers to trigger wargame — show picker if multiple stories at location
  if (G) {
    G.onPointClick(item => {
      if (!item || (item._type && item._type !== 'story')) return;
      const nearby = NEWS.filter(s => Math.abs(s.lat - item.lat) < 0.5 && Math.abs(s.lng - item.lng) < 0.5);
      if (nearby.length <= 1) generateWargameScenarios(nearby[0] || item);
      else openWargamePicker(nearby);
    });
  }
}

function openWargamePicker(stories) {
  G.controls().autoRotate = false;
  G.pointOfView({ lat: stories[0].lat, lng: stories[0].lng, altitude: 1.55 }, 900);
  document.getElementById('pk-loc').textContent = (stories[0].region || 'LOCATION').toUpperCase();
  document.getElementById('pk-count').textContent = `${stories.length} STORIES · SELECT WARGAME TARGET`;
  document.getElementById('pk-list').innerHTML = stories.map(s => `
    <div class="pk-item" data-id="${s.id}">
      <div class="pk-accent" style="background:${s.color}"></div>
      <div class="pk-info">
        <div class="pk-cat" style="color:${s.color}">${CATS[s.cat]?.label||s.cat.toUpperCase()}${s.brk?` · <span style="color:var(--brk)">BREAKING</span>`:''}</div>
        <div class="pk-title">${s.title}</div>
        <div class="pk-src">${s.src} · ${s.time}</div>
        <div style="margin-top:5px;font-family:var(--f-mono);font-size:8px;letter-spacing:.14em;color:#FF9F0A">⚔ RUN WARGAME</div>
      </div>
      <span class="pk-arrow">›</span>
    </div>`).join('');
  document.getElementById('pk-list').querySelectorAll('.pk-item').forEach(el => {
    const s = NEWS.find(n => n.id === +el.dataset.id);
    el.addEventListener('click', () => { closePicker(); generateWargameScenarios(s); });
  });
  document.getElementById('art-bd').classList.add('on');
  document.getElementById('picker').classList.add('on');
}
async function openDailyBrief() {
  const now = new Date();
  document.getElementById('bm-date').textContent = now.toUTCString().toUpperCase().replace('GMT','UTC');
  document.getElementById('bm-body').innerHTML = '<div class="bm-loading">ASSEMBLING BRIEF…</div>';
  document.getElementById('bm-meta').textContent = '';
  _briefContent = '';
  document.getElementById('brief-bd').classList.add('on');
  document.getElementById('brief-modal').classList.add('on');

  const top = NEWS.slice(0, 14);
  const sys = `You are a senior intelligence analyst writing a daily situation report. Write in clear, authoritative analytical prose. Format with HTML: use <h3> for exactly three section headers (EXECUTIVE SUMMARY, KEY DEVELOPMENTS, STRATEGIC IMPLICATIONS), use <p> for paragraphs. Do not use classification markings, "TOP SECRET", or document stamps. Be direct and substantive.`;
  const user = `Today is ${now.toDateString()}. Write a daily situation report covering the most significant geopolitical, military, economic, and technology developments based on these current stories:\n\n${top.map(s=>`[${s.cat.toUpperCase()}] ${s.title} (${s.src})${s.summary?' — '+s.summary:''}`).join('\n')}`;

  try {
    const brief = await callOpenAI(sys, user, 2500);
    _briefContent = brief;
    document.getElementById('bm-body').innerHTML = brief;
    document.getElementById('bm-meta').textContent = `${top.length} SOURCES · GENERATED ${now.toLocaleTimeString()}`;
  } catch(e) {
    document.getElementById('bm-body').innerHTML = `<p class="bm-error">ERROR: ${e.message}</p>`;
  }
}

function closeDailyBrief() {
  document.getElementById('brief-bd').classList.remove('on');
  document.getElementById('brief-modal').classList.remove('on');
}

function exportDailyBrief() {
  const body = document.getElementById('bm-body').innerHTML;
  const date = new Date().toDateString();
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Meridian Daily Brief — ${date}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,'Times New Roman',serif;max-width:740px;margin:60px auto;padding:0 28px;background:#fafaf8;color:#1c1c2e;line-height:1.75}.masthead{border-bottom:2px solid #1c1c2e;padding-bottom:14px;margin-bottom:28px}.org{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;color:#666;margin-bottom:6px;text-transform:uppercase}h1{font-size:22px;font-weight:normal;letter-spacing:.04em;margin-bottom:4px}.dateline{font-family:'Courier New',monospace;font-size:10px;color:#888;letter-spacing:.1em}h3{font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#555;margin:28px 0 10px;padding-bottom:5px;border-bottom:1px solid #e0e0d8}p{margin-bottom:15px;font-size:14.5px}.footer{margin-top:40px;padding-top:12px;border-top:1px solid #e0e0d8;font-family:'Courier New',monospace;font-size:9px;color:#aaa;letter-spacing:.1em}</style></head><body><div class="masthead"><div class="org">Meridian Intelligence Network</div><h1>Daily Situation Report</h1><div class="dateline">${date}</div></div>${body}<div class="footer">Generated by MERIDIAN · ${date}</div></body></html>`;
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = `meridian-brief-${new Date().toISOString().slice(0,10)}.html`;
  a.click();
}
function toggleMapKey() {
  _mapKeyOpen = !_mapKeyOpen;
  if (_mapKeyOpen) buildMapKey();
  document.getElementById('mapkey-drop').classList.toggle('on', _mapKeyOpen);
  document.getElementById('cmd-mapkey-btn').classList.toggle('on', _mapKeyOpen);
}

function buildMapKey() {
  const rows = [
    { s:'STORY MARKERS — SHAPE BY CATEGORY' },
    { shape:'diamond',  color:'#FF2D55', lbl:'GEO — Geopolitical event (diamond)' },
    { shape:'hex',      color:'#0A84FF', lbl:'TECH — Technology (hexagon)' },
    { shape:'triangle', color:'#FF9F0A', lbl:'MIL — Military / conflict (triangle)' },
    { shape:'square',   color:'#FFD60A', lbl:'FIN — Finance / economics (square)' },
    { shape:'star',     color:'#30D158', lbl:'CLM — Climate / environment (star)' },
    { s:'ANIMATED EFFECTS' },
    { dot:'var(--brk)', lbl:'Breaking news — double pulse ring' },
    { dash:'rgba(255,255,255,.35)', lbl:'Story arc — color = category (GEO red, TECH blue, etc.)' },
    { dash:'#FF6D00', lbl:'Cascade predictor arc — orange' },
    { s:'ARC COLORS — match story marker shape' },
    { shape:'diamond',  color:'#FF2D55', lbl:'Red — Geopolitical / conflict story link' },
    { shape:'hex',      color:'#0A84FF', lbl:'Blue — Technology / cyber story link' },
    { shape:'triangle', color:'#FF9F0A', lbl:'Amber — Military story link' },
    { shape:'square',   color:'#FFD60A', lbl:'Yellow — Finance / economics story link' },
    { shape:'star',     color:'#30D158', lbl:'Green — Climate story link' },
    { s:'COUNTRY BORDER LAYER' },
    { dash:'rgba(100,180,255,0.6)', lbl:'Ice blue border — country at peace (legal boundary)' },
    { dash:'#FF2D55', lbl:'Red border — country in active armed conflict' },
    { dash:'rgba(255,45,85,0.9)', lbl:'Red dash — active front line / contact line' },
    { dash:'#FF9F0A', lbl:'Amber-black dash — disputed border / frozen DMZ' },
    { s:'CITY ICONS' },
    { cityType:'capital',    color:'#E8D5A3', lbl:'Capital city' },
    { cityType:'financial',  color:'#FFD60A', lbl:'Financial centre' },
    { cityType:'military',   color:'#FF6D00', lbl:'Military base / installation' },
    { cityType:'naval',      color:'#2979FF', lbl:'Naval base' },
    { cityType:'port',       color:'#00BCD4', lbl:'Port / maritime hub' },
    { cityType:'conflict',   color:'#FF2D55', lbl:'Active conflict zone city' },
    { cityType:'energy',     color:'#FF9F0A', lbl:'Energy / resource hub' },
    { cityType:'diplomatic', color:'#30D158', lbl:'Diplomatic capital / embassy hub' },
    { cityType:'city',       color:'#6674CC', lbl:'Major city' },
    { s:'COUNTRY LAYER' },
    { ctry:'☢', color:'#FF9F0A', lbl:'Nuclear-armed state' },
    { ctry:'▲', color:'#FF2D55', lbl:'Active conflict in-country' },
    { ctry:'⊘', color:'#2979FF', lbl:'Under international sanctions' },
    { ctry:'★', color:'#B7950B', lbl:'UN Security Council P5 member' },
    { s:'THREAT / REGION RINGS' },
    { ring:'#FF2D55', lbl:'CRITICAL — expanding pulse rings, radius scaled to zone size' },
    { ring:'#FF9F0A', lbl:'HIGH — expanding pulse rings, radius scaled to zone size' },
    { ring:'#B7950B', lbl:'ELEVATED — expanding pulse rings, radius scaled to zone size' },
    { s:'FLIGHT ICONS' },
    { plane:'#0A84FF', lbl:'Passenger aircraft' },
    { plane:'#A78BFA', lbl:'Cargo freighter' },
    { plane:'#30D158', lbl:'Military / surveillance' },
    { s:'ANALYST TOOLS' },
    { dash:'rgba(0,212,255,.7)',  lbl:'Entity network edge — same-domain connection' },
    { dash:'rgba(255,159,10,.7)', lbl:'Entity network edge — cross-domain signal correlation' },
    { dot:'#30D158', lbl:'Trajectory ▲ — escalating regional activity (card badge)' },
    { dot:'#FF9F0A', lbl:'Trajectory — — active / stable regional activity (card badge)' },
    { dot:'#566573', lbl:'Trajectory ▽ — quiet / de-escalating (card badge)' },
    { dot:'#BF5AF2', lbl:'Dead Reckoning ON — country glow = projected momentum' },
    { dash:'rgba(255,45,85,.6)',  lbl:'Dead Reckoning: escalating country (red glow on name)' },
    { dash:'rgba(255,159,10,.5)', lbl:'Dead Reckoning: active country (amber glow on name)' },
    { dash:'rgba(48,209,88,.4)',  lbl:'Dead Reckoning: stable country (green glow on name)' },
    { dot:'#00D4FF', lbl:'Arc click → ARC TRACE — pins both stories to analyst board' },
    { s:'GLOBE CONTROLS' },
    { ctrl:'reset',  lbl:'Reset view — returns globe to default Eurasian perspective' },
    { ctrl:'spin',   lbl:'Spin toggle — illuminated when auto-rotation is active' },
    { ctrl:'arrows', lbl:'← → arrow keys — rotate globe along equator' },
    { ctrl:'zoom',   lbl:'↑ ↓ arrow keys — zoom in / out' },
  ];
  const shapeClip = { diamond:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', triangle:'polygon(50% 0%,100% 100%,0% 100%)', square:'none', hex:'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)', star:'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' };
  document.getElementById('mk-list').innerHTML = rows.map(r => {
    if (r.s)        return `<div class="mk-section">${r.s}</div>`;
    if (r.dot)      return `<div class="mk-row"><div class="mk-dot" style="background:${r.dot}"></div><span class="mk-lbl">${r.lbl}</span></div>`;
    if (r.dash)     return `<div class="mk-row"><div class="mk-dash" style="background:${r.dash}"></div><span class="mk-lbl">${r.lbl}</span></div>`;
    if (r.shape)    return `<div class="mk-row"><div class="mk-dot" style="background:${r.color};clip-path:${shapeClip[r.shape]||'none'};border-radius:${r.shape==='square'?'1px':'0'}"></div><span class="mk-lbl">${r.lbl}</span></div>`;
    if (r.ring)     return `<div class="mk-row"><div class="mk-ring-demo" style="--rc:${r.ring}"><div class="mk-ring-r mk-ring-r1"></div><div class="mk-ring-r mk-ring-r2"></div><div class="mk-ring-core"></div></div><span class="mk-lbl">${r.lbl}</span></div>`;
    if (r.plane)    return `<div class="mk-row"><div class="mk-plane-ico" style="color:${r.plane};filter:drop-shadow(0 0 3px ${r.plane}88)">${typeof PLANE_SVG !== 'undefined' ? PLANE_SVG : '✈'}</div><span class="mk-lbl">${r.lbl}</span></div>`;
    if (r.cityType) {
      const svg = (typeof _CITY_ICONS !== 'undefined' && _CITY_ICONS[r.cityType]) || '';
      return `<div class="mk-row"><div class="mk-city-ico" style="color:${r.color};filter:drop-shadow(0 0 3px ${r.color}66)">${svg}</div><span class="mk-lbl">${r.lbl}</span></div>`;
    }
    if (r.ctry)     return `<div class="mk-row"><div class="mk-ico-lbl" style="color:${r.color}">${r.ctry}</div><span class="mk-lbl">${r.lbl}</span></div>`;
    if (r.ctrl) {
      const icons = {
        reset:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
        spin:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
        arrows: `<span style="font-size:9px;letter-spacing:1px">← →</span>`,
        zoom:   `<span style="font-size:9px;letter-spacing:1px">↑ ↓</span>`,
      };
      return `<div class="mk-row"><div class="mk-ctrl-ico" style="color:rgba(100,180,255,.8)">${icons[r.ctrl]||''}</div><span class="mk-lbl">${r.lbl}</span></div>`;
    }
    return '';
  }).join('');
}

function openWargameFromAnalyst() {
  closeAnalystMode();
  openWargame();
}
function closeWargame() {
  wargameActive = false;
  wargameArcs = [];
  document.getElementById('wargame-overlay').classList.remove('on');
  // Restore normal globe click handler
  if (G) {
    G.onPointClick(item => {
      if (item._type === 'earthquake') showEqInfo(item);
      else handleLocationClick(item);
    }).onPointHover(item => { document.body.style.cursor = item ? 'pointer' : ''; });
  }
  refreshArcs();
}

function resetWargameArcs() {
  wargameArcs = [];
  refreshArcs();
  document.getElementById('wg-scenarios').innerHTML = '<div class="wg-loading">ARCS CLEARED · CLICK A GLOBE MARKER TO GENERATE NEW SCENARIOS</div>';
  document.getElementById('wg-title').textContent = 'No story selected';
  document.getElementById('wg-region').textContent = '';
  document.getElementById('wg-status').textContent = 'CLICK ANY GLOBE MARKER TO GENERATE 72-HOUR SCENARIO';
}

async function generateWargameScenarios(story) {
  document.getElementById('wg-title').textContent = story.title.slice(0,75) + (story.title.length>75?'…':'');
  document.getElementById('wg-region').textContent = story.region || '';
  document.getElementById('wg-status').textContent = 'GENERATING SCENARIO MATRIX…';
  document.getElementById('wg-scenarios').innerHTML = '<div class="wg-loading rt-loading-anim">RUNNING SCENARIO MODELS…<br>PROBABILITY MATRIX LOADING…</div>';

  try {
    const text = await callOpenAI(
      'You are a strategic scenario planner at an intelligence agency. Generate exactly 3 plausible 72-hour scenarios. Respond ONLY in valid JSON.',
      `Story: ${story.title}\nSummary: ${story.summary||''}\nRegion: ${story.region||'Unknown'}\n\nRespond with ONLY this JSON (no markdown):\n{"scenarios":[{"title":"...","probability":35,"path":"escalation","hours":48,"description":"2 sentences describing what happens.","dstLat":0.0,"dstLng":0.0,"indicators":["Watch indicator 1","Watch indicator 2"]},{"title":"...","probability":40,"path":"de-escalation","hours":72,"description":"...","dstLat":0.0,"dstLng":0.0,"indicators":["...","..."]},{"title":"...","probability":25,"path":"lateral","hours":24,"description":"...","dstLat":0.0,"dstLng":0.0,"indicators":["...","..."]}]}`,
      650
    );

    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    const scenarios = json.scenarios || [];
    if (!scenarios.length) throw new Error('No scenarios returned');

    const pathColors = { escalation:'#FF2D55', 'de-escalation':'#30D158', lateral:'#FF9F0A' };
    document.getElementById('wg-scenarios').innerHTML = scenarios.map((s,i) => {
      const col = pathColors[s.path] || '#0A84FF';
      return `<div class="wg-scenario" style="--sc:${col};animation-delay:${i*0.12}s">
        <div class="wg-prob">${s.probability}%</div>
        <div class="wg-path">${(s.path||'SCENARIO').toUpperCase()}</div>
        <div class="wg-s-title">${s.title||''}</div>
        <div class="wg-s-desc">${s.description||''}</div>
        <span class="wg-t-lbl">+${s.hours||48}h PROJECTION</span>
        <div class="wg-indicators">${(s.indicators||[]).map(ind=>`<span class="wg-ind">${ind}</span>`).join('')}</div>
      </div>`;
    }).join('');

    document.getElementById('wg-status').textContent = `3 SCENARIOS GENERATED · ARCS RENDERED ON GLOBE`;

    // Render arcs on globe
    wargameArcs = scenarios.map(s => {
      const col = pathColors[s.path] || '#0A84FF';
      const dLat = s.dstLat && s.dstLat !== 0 ? s.dstLat : story.lat + (Math.random()-.5)*25;
      const dLng = s.dstLng && s.dstLng !== 0 ? s.dstLng : story.lng + (Math.random()-.5)*35;
      return { slat:story.lat, slng:story.lng, elat:dLat, elng:dLng,
        c1:col+'cc', c2:col+'18', _wargame:true, _prob:s.probability };
    });
    refreshArcs();
  } catch(e) {
    document.getElementById('wg-scenarios').innerHTML = `<div class="wg-loading" style="color:rgba(255,45,85,.5)">SCENARIO GENERATION FAILED<br>${e.message}</div>`;
    document.getElementById('wg-status').textContent = 'ERROR — CHECK API KEY';
  }
}
function refreshArcs() {
  if (!G) return;
  const base = computeMeaningfulArcs(NEWS);
  const all  = [...base, ...divergeArcs, ...cascadeArcsArr, ...wargameArcs];
  G.arcsData(all)
    .arcStartLat('slat').arcStartLng('slng').arcEndLat('elat').arcEndLng('elng')
    .arcColor(d => [d.c1, d.c2])
    .arcDashLength(d => d._wargame ? 0.6 : d._diverge ? 1.0 : d._cascade ? 0.7 : 0.4)
    .arcDashGap(d => d._wargame ? 0.12 : 0.18)
    .arcDashAnimateTime(d => d._wargame ? 1800 : d._diverge ? 5000 : d._cascade ? 4500 : 2400)
    .arcStroke(d => d._diverge ? 0.9 : d._wargame ? (d._prob/30) : d._cascade ? 0.5 : 0.3)
    .arcAltitudeAutoScale(d => d._diverge ? 0.5 : d._cascade ? 0.4 : 0.3)
    .onArcClick(arc => { if (arc._s1id != null || arc._s2id != null) traceArc(arc); });
}

// ═══════════════════════════════════════════
// TOOLS DROPDOWN
// ═══════════════════════════════════════════
let _toolsMenuOpen = false;
function toggleToolsMenu() {
  _toolsMenuOpen = !_toolsMenuOpen;
  const menu = document.getElementById('am-tools-menu');
  const btn  = document.getElementById('am-tools-btn');
  if (menu) menu.classList.toggle('on', _toolsMenuOpen);
  if (btn)  btn.classList.toggle('on', _toolsMenuOpen);
  if (_toolsMenuOpen) {
    const closeHandler = e => {
      if (!e.target.closest('#am-tools-wrap')) {
        _toolsMenuOpen = false;
        menu?.classList.remove('on');
        btn?.classList.remove('on');
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }
}

// ═══════════════════════════════════════════
// THREAT TRAJECTORY — badge on asset cards
// ═══════════════════════════════════════════
function _computeTrajectory(s) {
  const region = (s.region || s.title || '').toLowerCase();
  const relatedCount = NEWS.filter(n => {
    if (n.id === s.id) return false;
    const text = (n.title + ' ' + (n.summary||'')).toLowerCase();
    return region.split(/[\s,]+/).filter(w => w.length > 4).some(w => text.includes(w));
  }).length;
  if (relatedCount >= 4) return { dir:'up',   arrow:'▲', label:'Escalating — high regional activity' };
  if (relatedCount >= 2) return { dir:'mid',  arrow:'—', label:'Active — moderate regional activity' };
  return                        { dir:'down', arrow:'▽', label:'Quiet — low regional activity' };
}

// ═══════════════════════════════════════════
// CONFIDENCE CALIBRATION — brief output
// ═══════════════════════════════════════════
function _postProcessBriefConfidence() {
  const scroll = document.getElementById('am-brief-scroll');
  if (!scroll) return;
  const paras = scroll.querySelectorAll('.am-brief-p');
  paras.forEach(p => {
    const text = p.textContent.toLowerCase();
    const corroborating = NEWS.filter(s => {
      const st = (s.title + ' ' + (s.summary||'')).toLowerCase();
      const words = text.split(/\s+/).filter(w => w.length > 5);
      return words.filter(w => st.includes(w)).length >= 3;
    }).length;
    const conf = corroborating >= 4 ? 'H' : corroborating >= 2 ? 'M' : 'L';
    const col  = conf === 'H' ? '#30D158' : conf === 'M' ? '#FF9F0A' : '#566573';
    if (!p.querySelector('.am-conf')) {
      const badge = document.createElement('span');
      badge.className = 'am-conf';
      badge.style.cssText = `color:${col};border-color:${col}33`;
      badge.title = `Confidence ${conf === 'H' ? 'HIGH' : conf === 'M' ? 'MEDIUM' : 'LOW'} — ${corroborating} corroborating sources`;
      badge.textContent = conf;
      p.prepend(badge);
    }
  });
}

// ═══════════════════════════════════════════
// WATCHLIST FLASH ALERT
// ═══════════════════════════════════════════
function _checkWatchlistAlerts() {
  if (typeof watchlist === 'undefined' || !watchlist?.length) return;
  if (!document.getElementById('analyst-overlay')?.classList.contains('on')) return;
  const hits = NEWS.filter(s => watchlist.includes(s.id));
  if (!hits.length) return;
  const statusEl = document.getElementById('am-status');
  if (!statusEl) return;
  const origHtml = statusEl.innerHTML;
  statusEl.innerHTML = `<span class="am-flash-alert">⚡ WATCHLIST — ${hits.length} MONITORED STOR${hits.length > 1 ? 'IES' : 'Y'} IN LIVE FEED</span>`;
  setTimeout(() => { statusEl.innerHTML = origHtml; }, 6000);
}

// ═══════════════════════════════════════════
// ARC TRACE MODE
// ═══════════════════════════════════════════
function traceArc(arc) {
  const s1 = NEWS.find(s => s.id === arc._s1id);
  const s2 = NEWS.find(s => s.id === arc._s2id);
  if (!s1 && !s2) return;
  openAnalystMode();
  if (s1 && !analystAssets.includes(s1.id)) { analystAssets.push(s1.id); }
  if (s2 && !analystAssets.includes(s2.id)) { analystAssets.push(s2.id); }
  renderAnalystBoard();
  runAnalystGraph();
  updateAnalystStatus();
  const shared = arc.label ? arc.label.toUpperCase() : 'ENTITY LINK';
  const statusEl = document.getElementById('am-status');
  if (statusEl) {
    statusEl.innerHTML = `<span style="color:#FF9F0A;letter-spacing:.1em">◈ ARC TRACE — LINKED BY: ${shared}</span>`;
    setTimeout(() => updateAnalystStatus(), 4000);
  }
}

// ═══════════════════════════════════════════
// ADVERSARY PLAYBOOK
// ═══════════════════════════════════════════
async function generatePlaybook() {
  document.getElementById('playbook-modal').classList.add('on');
  const pbContent = document.getElementById('pb-content');
  const pbStatus  = document.getElementById('pb-status');
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);

  if (!pinned.length) {
    pbStatus.textContent = 'PIN ASSETS TO ANALYST BOARD FIRST';
    pbContent.innerHTML = '<div class="pb-loading">NO ASSETS PINNED</div>';
    return;
  }

  pbStatus.textContent = 'GENERATING ADVERSARY PLAYBOOK…';
  pbContent.innerHTML = '<div class="pb-loading pb-loading-anim">ANALYZING ADVERSARY PATTERNS…</div>';
  document.getElementById('pb-export-btn').style.display = 'none';

  const actors = [...new Set(pinned.map(s => s._geoObj?.name || s.region || '').filter(Boolean))];
  const context = pinned.map(s => `[${(s.cat||'geo').toUpperCase()}] ${s.title}${s.summary ? ' — ' + s.summary : ''}`).join('\n');
  const sys = `You are a senior intelligence officer writing a classified Adversary Playbook — an actor-centric strategic assessment. Write in terse, authoritative intelligence prose. Use ALL-CAPS section headers followed by colons. No disclaimers. No hedging. Write as if for cleared decision-makers.`;
  const user = `Generate an ADVERSARY PLAYBOOK for these pinned intelligence assets.\n\nACTORS: ${actors.length ? actors.join(', ') : 'Unknown'}\n\nCURRENT INTELLIGENCE:\n${context}\n\nSections:\nBEHAVIORAL PATTERNS:\nSTRATEGIC INTERESTS:\nPREDICTED MOVES (30/60/90 DAY):\nPRESSURE POINTS:\nCOUNTER-STRATEGY:\nRED FLAGS:`;

  try {
    const brief = await callOpenAI(sys, user, 1600);
    window._pbBriefText = brief;
    document.getElementById('pb-export-btn').style.display = '';
    pbStatus.textContent = 'PLAYBOOK GENERATED';
    const now = new Date().toLocaleString();
    pbContent.innerHTML = `
      <div class="pb-classify">TOP SECRET // HCS-P // REL TO FVEY</div>
      <div class="pb-heading">ADVERSARY PLAYBOOK</div>
      <div class="pb-date">PREPARED: ${now} · MERIDIAN INTELLIGENCE SYSTEM · NOT FOR DISTRIBUTION</div>
      <div>${brief.split('\n').filter(l => l.trim()).map(l => {
        if (/^[A-Z][A-Z\s\-\/]+:/.test(l.trim())) return `<div class="pb-sec-hdr">${l.trim()}</div>`;
        return `<p class="pb-para">${l}</p>`;
      }).join('')}</div>
      <div class="pb-classify" style="margin-top:20px">TOP SECRET // HCS-P // REL TO FVEY</div>`;
  } catch(e) {
    pbStatus.textContent = 'GENERATION FAILED — CHECK API KEY';
    pbContent.innerHTML = `<div class="pb-loading" style="color:rgba(48,209,88,.4)">ERROR: ${e.message}</div>`;
  }
}

function exportPlaybook() {
  const now = new Date().toLocaleString();
  const bodyHtml = document.getElementById('pb-content')?.innerHTML || '';
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>ADVERSARY PLAYBOOK — ${now}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0303;color:#e8e8e8;font-family:'Courier New',monospace;font-size:11px;line-height:1.7}.pb-banner{background:#3d0a0a;border-top:1px solid #FF3B30;border-bottom:1px solid #FF3B30;color:#FF3B30;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px}.pb-body{max-width:860px;margin:0 auto;padding:40px 32px}.pb-heading{font-size:15px;font-weight:700;letter-spacing:.2em;color:#FF3B30;text-align:center;margin:28px 0 6px}.pb-date{font-size:8px;letter-spacing:.12em;color:rgba(255,255,255,.4);text-align:center;margin-bottom:28px}.pb-classify{background:#3d0a0a;border:1px solid rgba(255,59,48,.4);color:#FF3B30;font-family:'Courier New',monospace;font-size:9px;font-weight:700;letter-spacing:.25em;text-align:center;padding:10px}.pb-sec-hdr{font-size:8.5px;letter-spacing:.2em;color:rgba(255,59,48,.85);margin:16px 0 4px;padding-top:12px;border-top:1px solid rgba(255,59,48,.2)}.pb-para{font-size:10.5px;color:rgba(232,232,232,.9);line-height:1.75;margin:5px 0}</style>
</head><body><div class="pb-banner">TOP SECRET // HCS-P // REL TO FVEY</div><div class="pb-body">${bodyHtml}</div><div class="pb-banner">TOP SECRET // HCS-P // REL TO FVEY</div></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], {type:'text/html'}));
  a.download = `adversary-playbook-${Date.now()}.html`;
  a.click();
}

// ═══════════════════════════════════════════
// CROSS-DOMAIN ESCALATION MATRIX
// ═══════════════════════════════════════════
function openEscalationMatrix() {
  const bd = document.getElementById('matrix-bd');
  document.getElementById('matrix-modal').classList.add('on');
  if (bd) bd.classList.add('on');
  buildEscalationMatrix();
  const ts = document.getElementById('mx-calc-ts');
  if (ts) ts.textContent = `LAST RUN: ${new Date().toLocaleTimeString()}`;
}

function recalculateMatrix() {
  const btn = document.getElementById('mx-recalc-btn');
  if (btn) { btn.textContent = 'CALCULATING…'; btn.disabled = true; }
  // Brief delay so the button state is visibly shown before the synchronous rebuild
  setTimeout(() => {
    buildEscalationMatrix();
    const ts = document.getElementById('mx-calc-ts');
    if (ts) ts.textContent = `LAST RUN: ${new Date().toLocaleTimeString()}`;
    if (btn) { btn.textContent = 'RECALCULATE'; btn.disabled = false; }
  }, 80);
}

function buildEscalationMatrix() {
  const cats   = ['geo','tech','military','finance','climate'];
  const labels = { geo:'GEO', tech:'TECH', military:'MIL', finance:'FIN', climate:'CLM' };
  const colors = { geo:'#FF2D55', tech:'#0A84FF', military:'#FF9F0A', finance:'#FFD60A', climate:'#30D158' };
  const kw     = { geo:'war|conflict|diplomacy|election|sanction|geopolit', tech:'cyber|tech|ai|chip|hack|data', military:'military|troops|missile|weapon|navy|army', finance:'bank|market|economy|trade|dollar|sanction|oil', climate:'climate|carbon|flood|drought|wildfire|emission' };
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);

  if (!pinned.length) {
    document.getElementById('mx-content').innerHTML = '<div style="padding:24px;text-align:center;color:var(--t3);font-family:var(--f-mono);font-size:9px;letter-spacing:.12em">PIN ASSETS TO ANALYST BOARD TO COMPUTE MATRIX</div>';
    document.getElementById('mx-story-panel').innerHTML = '';
    return;
  }

  // Score each domain pair: pinned coverage + live NEWS cross-references
  const scores = {};
  const storyMap = {};   // stores matching stories per cell for picker
  for (const r of cats) {
    scores[r] = {};
    storyMap[r] = {};
    for (const c of cats) {
      const rPinned = pinned.filter(s => s.cat === r).length;
      const cPinned = pinned.filter(s => s.cat === c).length;
      let score = r === c ? rPinned * 2 : (rPinned > 0 && cPinned > 0 ? 3 : 0);
      const matching = NEWS.filter(s => new RegExp(kw[r],'i').test(s.title+' '+(s.summary||'')) && (r === c || new RegExp(kw[c],'i').test(s.title+' '+(s.summary||''))));
      score += Math.min(matching.length, 6);
      scores[r][c] = score;
      storyMap[r][c] = matching.slice(0, 20);
    }
  }

  // Store for click handlers
  window._mxStoryMap = storyMap;

  const max = Math.max(...cats.flatMap(r => cats.map(c => scores[r][c])), 1);
  const riskColor = v => { const r = v/max; return r > 0.7 ? 'rgba(255,45,85,.82)' : r > 0.4 ? 'rgba(255,159,10,.72)' : r > 0.15 ? 'rgba(183,149,11,.45)' : 'rgba(80,90,120,.22)'; };
  const riskLbl   = v => { const r = v/max; return r > 0.7 ? 'CRIT' : r > 0.4 ? 'HIGH' : r > 0.15 ? 'ELEV' : 'LOW'; };

  let html = '<div class="mx-grid">';
  html += '<div class="mx-cell mx-corner"></div>';
  for (const c of cats) html += `<div class="mx-cell mx-hdr" style="color:${colors[c]}">${labels[c]}</div>`;
  for (const r of cats) {
    html += `<div class="mx-cell mx-hdr" style="color:${colors[r]}">${labels[r]}</div>`;
    for (const c of cats) {
      const s = scores[r][c];
      html += `<div class="mx-cell mx-data${r===c?' mx-diag':''}" style="background:${riskColor(s)};cursor:pointer" onclick="showMatrixStories('${r}','${c}')" title="Click to view ${labels[r]}×${labels[c]} stories"><div class="mx-risk">${riskLbl(s)}</div><div class="mx-score">${s}</div></div>`;
    }
  }
  html += '</div>';
  document.getElementById('mx-content').innerHTML = html;
  document.getElementById('mx-story-panel').innerHTML = '<div style="padding:8px 0 2px;font-family:var(--f-mono);font-size:7px;letter-spacing:.12em;color:var(--t3)">CLICK ANY CELL TO VIEW RELEVANT STORIES</div>';
}

function showMatrixStories(row, col) {
  const sm = window._mxStoryMap;
  if (!sm || !sm[row] || !sm[row][col]) return;
  const stories = sm[row][col];
  const cats   = ['geo','tech','military','finance','climate'];
  const labels = { geo:'GEO', tech:'TECH', military:'MIL', finance:'FIN', climate:'CLM' };
  const colors = { geo:'#FF2D55', tech:'#0A84FF', military:'#FF9F0A', finance:'#FFD60A', climate:'#30D158' };
  const panel = document.getElementById('mx-story-panel');
  if (!panel) return;

  const header = `<div class="mx-sp-hdr"><span style="color:${colors[row]}">${labels[row]}</span> <span style="opacity:.4">×</span> <span style="color:${colors[col]}">${labels[col]}</span> — ${stories.length} RELEVANT STOR${stories.length===1?'Y':'IES'}</div>`;
  if (!stories.length) {
    panel.innerHTML = header + '<div class="mx-sp-empty">NO STORIES MATCHED THIS DOMAIN PAIR</div>';
    return;
  }
  const items = stories.map(s => `
    <div class="mx-sp-item" onclick="pinStory(${s.id});closeMatrixStoryPanel()">
      <span class="mx-sp-cat" style="color:${colors[s.cat]||'#7B61FF'}">${(s.cat||'').toUpperCase().slice(0,3)}</span>
      <span class="mx-sp-title">${s.title.slice(0,90)}</span>
      <span class="mx-sp-src">${s.src||''}</span>
    </div>`).join('');
  panel.innerHTML = header + `<div class="mx-sp-list">${items}</div>`;
}

function closeMatrixStoryPanel() {
  const p = document.getElementById('mx-story-panel');
  if (p) p.innerHTML = '<div style="padding:8px 0 2px;font-family:var(--f-mono);font-size:7px;letter-spacing:.12em;color:var(--t3)">CLICK ANY CELL TO VIEW RELEVANT STORIES</div>';
}

// ═══════════════════════════════════════════
// DEAD RECKONING
// ═══════════════════════════════════════════
let deadReckoningOn = false;
const _drScores = {};

function toggleDeadReckoning() {
  deadReckoningOn = !deadReckoningOn;
  document.getElementById('dr-tools-btn')?.classList.toggle('on', deadReckoningOn);
  toggleToolsMenu(); // close tools menu
  if (deadReckoningOn) {
    _computeDeadReckoning();
    _applyDeadReckoningGlows();  // globe glows (if visible)
    _renderDeadReckoningBoard(); // show in analyst panel
  } else {
    _clearDeadReckoningGlows();
    const scroll = document.getElementById('am-brief-scroll');
    const drEl = scroll?.querySelector('.dr-board');
    if (drEl) drEl.remove();
  }
}

function _computeDeadReckoning() {
  const counts = {};
  if (typeof _WORLD_COUNTRIES === 'undefined') return;
  // Build name→iso lookup
  const nameToIso = {};
  _WORLD_COUNTRIES.forEach(c => {
    if (c.name) nameToIso[c.name.toLowerCase()] = c.iso2;
    if (c.iso2) nameToIso[c.iso2.toLowerCase()] = c.iso2;
  });
  NEWS.forEach(s => {
    const text = (s.title + ' ' + (s.summary||'')).toLowerCase();
    Object.entries(nameToIso).forEach(([name, iso]) => {
      if (name.length > 3 && text.includes(name)) counts[iso] = (counts[iso]||0) + 1;
    });
  });
  const max = Math.max(...Object.values(counts), 1);
  Object.entries(counts).forEach(([iso, n]) => {
    const ratio = n / max;
    _drScores[iso] = ratio > 0.5 ? 'escalating' : ratio > 0.2 ? 'active' : 'stable';
  });
}

function _applyDeadReckoningGlows() {
  document.querySelectorAll('.ctry-marker[data-iso]').forEach(el => {
    const trend = _drScores[el.dataset.iso];
    if (trend) el.setAttribute('data-dr', trend);
  });
}

function _clearDeadReckoningGlows() {
  document.querySelectorAll('.ctry-marker[data-dr]').forEach(el => el.removeAttribute('data-dr'));
}

function _renderDeadReckoningBoard() {
  const scroll = document.getElementById('am-brief-scroll');
  if (!scroll) return;
  // Remove existing DR board if any
  scroll.querySelector('.dr-board')?.remove();

  const cats = ['geo','tech','military','finance','climate'];
  const kw   = { geo:'war|conflict|diplomacy|election|sanction|geopolit|nato', tech:'cyber|tech|ai|chip|hack|data|semiconductor', military:'military|troops|missile|weapon|navy|army|combat|airstrike|drone', finance:'market|stock|economy|trade|dollar|sanction|oil|tariff|bank', climate:'climate|carbon|flood|drought|wildfire|emission|arctic' };

  // Count NEWS mentions per country
  const counts = {};
  const nameToCountry = {};
  _WORLD_COUNTRIES.forEach(c => {
    if (c.name) nameToCountry[c.name.toLowerCase()] = c;
    if (c.iso2) nameToCountry[c.iso2.toLowerCase()] = c;
  });
  NEWS.forEach(s => {
    const text = (s.title + ' ' + (s.summary||'')).toLowerCase();
    Object.entries(nameToCountry).forEach(([name, c]) => {
      if (name.length > 3 && text.includes(name)) {
        const key = c.iso2 || c.name;
        counts[key] = (counts[key] || { n:0, name:c.name, iso2:c.iso2 });
        counts[key].n++;
      }
    });
  });

  const ranked = Object.values(counts).sort((a,b) => b.n - a.n).slice(0, 15);
  const maxN = ranked[0]?.n || 1;

  // Domain breakdown per top country
  const domainHtml = (name) => cats.map(cat => {
    const cnt = NEWS.filter(s => new RegExp(kw[cat],'i').test(s.title+' '+(s.summary||'')) && (s.title+' '+(s.summary||'')).toLowerCase().includes(name.toLowerCase())).length;
    const colors = { geo:'#FF2D55', tech:'#0A84FF', military:'#FF9F0A', finance:'#FFD60A', climate:'#30D158' };
    const lbl = { geo:'GEO', tech:'TEC', military:'MIL', finance:'FIN', climate:'CLM' };
    return cnt > 0 ? `<span class="dr-domain" style="color:${colors[cat]}">${lbl[cat]}:${cnt}</span>` : '';
  }).join('');

  const rows = ranked.map(c => {
    const pct = Math.round((c.n / maxN) * 100);
    const col = pct > 65 ? '#FF2D55' : pct > 35 ? '#FF9F0A' : '#2ECC71';
    const tier = pct > 65 ? 'ESCALATING' : pct > 35 ? 'ACTIVE' : 'STABLE';
    return `<div class="dr-row">
      <div class="dr-country">${c.name.toUpperCase()}</div>
      <div class="dr-bar-wrap"><div class="dr-bar" style="width:${pct}%;background:${col}"></div></div>
      <div class="dr-stats"><span class="dr-tier" style="color:${col}">${tier}</span><span class="dr-n">${c.n}</span></div>
      <div class="dr-domains">${domainHtml(c.name)}</div>
    </div>`;
  }).join('');

  const now = new Date().toLocaleTimeString();
  const el = document.createElement('div');
  el.className = 'dr-board';
  el.innerHTML = `
    <div class="dr-hdr">◎ DEAD RECKONING · NEWS MENTION HEAT · ${now}</div>
    <div class="dr-sub">Ranked by news signal density across live feed — click country to filter globe</div>
    <div class="dr-rows">${rows}</div>`;
  // Insert before any existing content or at top
  scroll.prepend(el);
}

// ═══════════════════════════════════════════
// NARRATIVE TIMELINE
// ═══════════════════════════════════════════
function openNarrativeTimeline(assetId) {
  document.getElementById('timeline-modal').classList.add('on');
  document.getElementById('timeline-bd')?.classList.add('on');
  _buildTimeline(assetId);
}

function _buildTimeline(assetId) {
  const tlContent = document.getElementById('tl-content');
  const tlStatus  = document.getElementById('tl-status');
  if (!tlContent) return;

  // Resolve the focal asset (if given)
  const focal = assetId != null ? _resolveStory(assetId) : null;
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  const subjects = focal ? [focal] : pinned;

  if (!subjects.length) {
    tlContent.innerHTML = '<div class="tl-empty">PIN ASSETS TO ANALYST BOARD TO VIEW TIMELINE</div>';
    tlStatus.textContent = '—';
    return;
  }

  // Keywords from all subject titles + regions
  const keywords = [...new Set(subjects.flatMap(s => {
    const words = (s.title + ' ' + (s.region||'')).toLowerCase().split(/[\s,]+/).filter(w => w.length > 4);
    return words;
  }))].slice(0, 20);

  // Gather related stories from NEWS + localStorage cache
  let pool = [...NEWS];
  try {
    const raw = localStorage.getItem(typeof NEWS_CACHE_KEY !== 'undefined' ? NEWS_CACHE_KEY : 'meridian_news_v3');
    if (raw) {
      const cacheMap = JSON.parse(raw).map || {};
      Object.values(cacheMap).forEach(s => { if (!pool.some(p => p.title === s.title)) pool.push(s); });
    }
  } catch(e) {}

  const related = pool.filter(s => {
    if (subjects.some(sub => sub.id === s.id)) return true;
    const text = (s.title + ' ' + (s.summary||'')).toLowerCase();
    return keywords.filter(k => text.includes(k)).length >= 2;
  }).sort((a, b) => (b._pub||0) - (a._pub||0)).slice(0, 60);

  tlStatus.textContent = `${related.length} EVENTS · ${focal ? focal.title.slice(0,40) : subjects.length + ' ASSETS'}`;

  if (!related.length) {
    tlContent.innerHTML = '<div class="tl-empty">NO RELATED EVENTS FOUND IN ARCHIVE</div>';
    return;
  }

  // Group by day
  const byDay = {};
  related.forEach(s => {
    const d = s._pub ? new Date(s._pub).toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'}) : 'UNDATED';
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(s);
  });

  tlContent.innerHTML = Object.entries(byDay).map(([day, stories]) => `
    <div class="tl-day">
      <div class="tl-day-lbl">${day.toUpperCase()}</div>
      ${stories.map(s => `
        <div class="tl-item">
          <div class="tl-dot" style="background:${s.color||'#566573'}"></div>
          <div class="tl-item-body">
            <div class="tl-item-cat" style="color:${s.color||'#566573'}">${(CATS[s.cat]?.label||s.cat||'').toUpperCase()}${s.brk ? ' · <span style="color:var(--brk)">BREAKING</span>' : ''}</div>
            <div class="tl-item-title">${s.title}</div>
            <div class="tl-item-meta">${s.src||''} · ${s.time||''}</div>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

// ═══════════════════════════════════════════
// SAVED BOARDS
// ═══════════════════════════════════════════
const _SB_KEY = 'MERIDIAN_SAVED_BOARDS';

function _loadSavedBoards() {
  try { return JSON.parse(localStorage.getItem(_SB_KEY) || '[]'); } catch { return []; }
}

function _writeSavedBoards(boards) {
  try { localStorage.setItem(_SB_KEY, JSON.stringify(boards)); } catch {}
}

function _generateBoardTitle(stories) {
  if (!stories.length) return 'UNTITLED BOARD';
  const regions = [...new Set(stories.map(s => s.region || s.src).filter(Boolean))].slice(0, 3);
  const cats    = [...new Set(stories.map(s => (CATS[s.cat]?.label || s.cat || '').toUpperCase()).filter(Boolean))].slice(0, 2);
  if (regions.length) return regions.join(' · ');
  if (cats.length)    return cats.join(' + ') + ' ANALYSIS';
  return stories[0].title.slice(0, 40).toUpperCase();
}

function saveAnalystBoard() {
  const pinned = analystAssets.map(id => _resolveStory(id)).filter(Boolean);
  if (!pinned.length) {
    const s = document.getElementById('am-status');
    if (s) { const orig = s.innerHTML; s.innerHTML = 'NO ASSETS PINNED — NOTHING TO SAVE'; setTimeout(() => s.innerHTML = orig, 2500); }
    return;
  }
  const boards = _loadSavedBoards();
  const board = {
    id:        Date.now(),
    title:     _generateBoardTitle(pinned),
    savedAt:   new Date().toISOString(),
    assetIds:  [...analystAssets],
    stories:   pinned.map(s => ({
      id: s.id, title: s.title, summary: s.summary || '', body: s.body || '',
      url: s.url || null, src: s.src || '', cat: s.cat || 'geo',
      region: s.region || '', lat: s.lat || 0, lng: s.lng || 0,
      brk: s.brk || false, color: s.color || '', time: s.time || '',
      _pub: s._pub || 0, _hist: true, _key: s._key || s.title.slice(0,60),
    })),
  };
  boards.unshift(board);
  if (boards.length > 50) boards.splice(50); // cap at 50 saved boards
  _writeSavedBoards(boards);
  const s = document.getElementById('am-status');
  if (s) { const orig = s.innerHTML; s.innerHTML = `BOARD SAVED · "${board.title}"`;  setTimeout(() => s.innerHTML = orig, 3000); }
}

function openSavedBoards() {
  document.getElementById('sb-modal').classList.add('on');
  document.getElementById('sb-bd').classList.add('on');
  _renderSavedBoardsList();
}

function closeSavedBoards() {
  document.getElementById('sb-modal').classList.remove('on');
  document.getElementById('sb-bd').classList.remove('on');
}

function _renderSavedBoardsList() {
  const boards = _loadSavedBoards();
  const body   = document.getElementById('sb-body');
  if (!boards.length) {
    body.innerHTML = '<div class="sb-empty">NO SAVED BOARDS YET<br>PIN ASSETS AND USE ⊙ SAVE BOARD</div>';
    return;
  }
  body.innerHTML = boards.map(b => {
    const date = new Date(b.savedAt).toLocaleString();
    const previews = (b.stories || []).slice(0, 3).map(s =>
      `<div class="sb-story-preview">· ${s.title.slice(0,70)}</div>`).join('');
    return `<div class="sb-item" onclick="loadSavedBoard(${b.id})">
      <div class="sb-item-info">
        <div class="sb-item-title">${b.title}</div>
        <div class="sb-item-meta">${date} · ${(b.stories||[]).length} ASSETS</div>
        <div class="sb-item-stories">${previews}</div>
      </div>
      <button class="sb-item-del" onclick="event.stopPropagation();deleteSavedBoard(${b.id})">✕ DELETE</button>
    </div>`;
  }).join('');
}

function loadSavedBoard(boardId) {
  const boards = _loadSavedBoards();
  const board  = boards.find(b => b.id === boardId);
  if (!board) return;

  // For each stored story: try to find in live NEWS first (by title), then in _histMap, then inject
  const restored = [];
  for (const stored of (board.stories || [])) {
    // Check live NEWS by title match
    const live = NEWS.find(n => n.title.slice(0,60) === stored.title.slice(0,60));
    if (live) { restored.push(live.id); continue; }
    // Check _histMap by UUID id
    if (typeof stored.id === 'string' && _histMap[stored.id]) { restored.push(stored.id); continue; }
    // Inject the stored story into _histMap so it can be resolved
    const key = 'saved_' + (stored._key || stored.title.slice(0,60));
    const injected = { ...stored, id: key, _hist: true };
    _histMap[key] = injected;
    restored.push(key);
  }

  analystAssets.length = 0;
  restored.forEach(id => { if (!analystAssets.includes(id)) analystAssets.push(id); });
  closeSavedBoards();
  openAnalystMode();
}

function deleteSavedBoard(boardId) {
  const boards = _loadSavedBoards().filter(b => b.id !== boardId);
  _writeSavedBoards(boards);
  _renderSavedBoardsList();
}
