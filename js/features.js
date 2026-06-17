'use strict';

// ═══════════════════════════════════════════
// FEATURES — F2 LIVE BROADCAST, F3 WEBCAM
//             DRAGGABLE PANELS
// (F1 SATELLITE removed — see js/removed_features.js)
// ═══════════════════════════════════════════
function _selectBroadcaster(story) {
  if (!story) return BROADCASTER_DEFAULT;
  const regionLc = (story.region || '').toLowerCase();
  const cat = story.cat || 'geo';
  let best = BROADCASTER_DEFAULT, bestScore = -1;
  BROADCASTERS.forEach(b => {
    let score = 0;
    if (b.cats.includes(cat)) score += 2;
    b.regions.forEach(r => { if (regionLc.includes(r) || r.includes(regionLc.split(',')[0])) score += 4; });
    if (score > bestScore) { bestScore = score; best = b.id; }
  });
  return best;
}

function _buildBroadcasterTabs(activeId) {
  const tabs = document.getElementById('lnp-tabs');
  tabs.innerHTML = BROADCASTERS.map(b =>
    `<button class="lnp-tab${b.id === activeId ? ' on' : ''}"
       style="--tc:${b.color}"
       onclick="switchBroadcaster('${b.id}')">${b.name}</button>`
  ).join('');
}

function switchBroadcaster(id) {
  _lnpCurrentId = id;
  const b = BROADCASTERS.find(x => x.id === id) || BROADCASTERS[0];
  _buildBroadcasterTabs(id);

  const errOverlay = document.getElementById('lnp-error');
  errOverlay.classList.remove('on');
  document.getElementById('lnp-error-msg').innerHTML = 'VIDEO UNAVAILABLE<br>STREAM MAY HAVE MOVED OR ENDED';
  const iframe = document.getElementById('lnp-iframe');

  // External link always uses the channel's /live page (works even if embedding is disabled)
  const ytLiveUrl = `https://www.youtube.com/@${b.handle}/live`;
  document.getElementById('lnp-ext-link').href = ytLiveUrl;
  document.getElementById('lnp-yt-fallback').href = ytLiveUrl;

  if (!b.channelId) {
    // No channel ID known — show error immediately with external link
    iframe.src = 'about:blank';
    errOverlay.classList.add('on');
    document.getElementById('lnp-error-msg').textContent = 'CHANNEL ID NOT CONFIGURED\nCLICK BELOW TO WATCH LIVE';
    document.getElementById('lnp-station-name').textContent = b.name + ' · ' + b.desc;
    return;
  }

  // live_stream?channel=CHANNEL_ID always loads whatever is currently live on the channel
  // This is the correct YouTube approach — no stale video ID issues
  const embedSrc = `https://www.youtube-nocookie.com/embed/live_stream?channel=${b.channelId}&autoplay=1&mute=0&rel=0&modestbranding=1`;
  iframe.src = embedSrc;

  document.getElementById('lnp-station-name').textContent = b.name + ' · ' + b.desc;

  // Listen for YouTube postMessage errors — fire when embedding is disabled or no live stream
  iframe._ytErrHandler && window.removeEventListener('message', iframe._ytErrHandler);
  iframe._ytErrHandler = (e) => {
    if (typeof e.data !== 'object' && typeof e.data !== 'string') return;
    let code;
    try { code = typeof e.data === 'string' ? JSON.parse(e.data)?.info : e.data?.info; } catch(ex) {}
    if ([2, 100, 101, 150, 153].includes(code)) {
      errOverlay.classList.add('on');
    }
  };
  window.addEventListener('message', iframe._ytErrHandler);
}

function openLiveNews(story) {
  _lnpContextStory = story || null;
  _lnpActive = true;
  document.getElementById('lc-livenews').classList.add('on');
  document.getElementById('live-news-panel').classList.add('on');

  const bestId = _selectBroadcaster(story);
  _lnpCurrentId = bestId;

  const loc = story ? (story.region || 'GLOBAL FEED').toUpperCase() : 'GLOBAL FEED';
  document.getElementById('lnp-loc').textContent = loc;

  // Build tabs then load the selected broadcaster
  setTimeout(() => switchBroadcaster(bestId), 60);

  _makePanelDraggable(document.getElementById('live-news-panel'), document.getElementById('lnp-drag-handle'));
  makeResizable(document.getElementById('live-news-panel'));

  // Show broadcaster city markers on the globe
  if (G) updateAllGlobeElements();
}

function closeLiveNews() {
  _lnpActive = false;
  document.getElementById('lc-livenews').classList.remove('on');
  document.getElementById('live-news-panel').classList.remove('on');
  // Stop video to free resources
  const iframe = document.getElementById('lnp-iframe');
  if (iframe._ytErrHandler) window.removeEventListener('message', iframe._ytErrHandler);
  iframe.src = 'about:blank';
  // Remove broadcaster city markers from globe
  if (G) updateAllGlobeElements();
}

function toggleLiveNews() {
  if (_lnpActive) {
    closeLiveNews();
  } else {
    openLiveNews(null);
  }
}
function toggleWebcamPanel() {
  _webcamPanelEnabled = !_webcamPanelEnabled;
  document.getElementById('lc-webcams').classList.toggle('on', _webcamPanelEnabled);
  if (!_webcamPanelEnabled) {
    closeWebcamPanel();
  } else {
    // Always start fresh — user must click a story to load cameras
    _showWebcamHint();
  }
}

function _showWebcamHint() {
  const panel = document.getElementById('webcam-panel');
  document.getElementById('wcp-loading').style.display = 'none';
  document.getElementById('wcp-empty').style.display = 'none';
  const _hintGrid = document.getElementById('wcp-grid');
  _hintGrid.style.display = 'block';
  _hintGrid.innerHTML =
    '<div style="padding:18px;font-family:var(--f-mono);font-size:8px;letter-spacing:.12em;color:var(--t3);text-align:center;line-height:1.9">◉ CLICK ANY STORY OR CITY<br>TO SCAN NEARBY LIVE CAMERAS</div>';
  document.getElementById('wcp-loc').textContent = 'READY';
  panel.classList.add('on');
  _webcamVisible = true;
  // Init drag now that panel is visible (getBoundingClientRect works correctly)
  _makePanelDraggable(panel, panel.querySelector('.wcp-hdr'));
}

function closeWebcamPanel() {
  _webcamVisible = false;
  _webcamPanelEnabled = false;
  _currentWebcams = [];
  document.getElementById('webcam-panel').classList.remove('on');
  document.getElementById('lc-webcams').classList.remove('on');
  document.getElementById('wcp-grid').innerHTML = '';
  document.getElementById('wcp-grid').style.display = 'none';
  document.getElementById('wcp-loading').style.display = 'none';
  document.getElementById('wcp-empty').style.display = 'none';
  document.getElementById('wcp-loc').textContent = 'READY';
  closeWebcamLightbox();
}

async function loadWebcams(story) {
  if (!story || story.lat == null || !_webcamPanelEnabled) return;

  const panel = document.getElementById('webcam-panel');
  const grid = document.getElementById('wcp-grid');
  const loading = document.getElementById('wcp-loading');
  const empty = document.getElementById('wcp-empty');
  const player = document.getElementById('wcp-player');

  panel.classList.add('on');
  _webcamVisible = true;
  document.getElementById('wcp-loc').textContent = (story.region || 'NEARBY').toUpperCase();

  // Reset state
  grid.innerHTML = '';
  grid.style.display = 'none';
  empty.style.display = 'none';
  player.classList.remove('on');
  loading.style.display = 'flex';

  if (WINDY_KEY === 'YOUR_WINDY_KEY_HERE') {
    loading.style.display = 'none';
    empty.style.display = 'flex';
    empty.textContent = 'ADD WINDY API KEY\nTO ENABLE CAMERAS';
    return;
  }

  try {
    // Windy Webcams API v3 (v2 was deprecated and returns 404)
    const url = `https://api.windy.com/webcams/api/v3/webcams?nearby=${story.lat.toFixed(4)},${story.lng.toFixed(4)},50&include=images,player,location&limit=9`;
    const resp = await fetch(url, { headers: { 'x-windy-api-key': WINDY_KEY } });
    if (!resp.ok) throw new Error(`${resp.status}`);
    const data = await resp.json();
    const webcams = data.webcams || [];
    _currentWebcams = webcams;
    loading.style.display = 'none';

    if (webcams.length === 0) {
      empty.style.display = 'flex';
      empty.textContent = 'NO CAMERAS FOUND\nWITHIN 50 KM';
      return;
    }

    grid.style.display = 'grid';
    grid.innerHTML = webcams.slice(0, 9).map((cam, i) => {
      const thumb = cam.images?.daylight?.preview || cam.images?.current?.preview || '';
      const city = cam.location?.city || cam.location?.country || 'CAMERA';
      return `
        <div class="wcp-thumb" data-idx="${i}" onclick="openWebcamPlayer(${i})">
          ${thumb ? `<img src="${thumb}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div style="height:66px;background:#0a0c18"></div>'}
          <div class="wcp-play-ico">⛶</div>
          <div class="wcp-thumb-lbl">${city.toUpperCase()}</div>
        </div>`;
    }).join('');
  } catch(e) {
    loading.style.display = 'none';
    empty.style.display = 'flex';
    empty.textContent = `CAMERA FEED ERROR\n${e.message}`;
    console.warn('[MERIDIAN webcam]', e);
  }
}

function openWebcamPlayer(idx) {
  const cam = _currentWebcams[idx];
  if (!cam) return;
  const city = (cam.location?.city || cam.location?.country || 'CAMERA').toUpperCase();
  document.getElementById('wcam-lb-title').textContent = city;
  const lb = document.getElementById('wcam-lightbox');
  const iframe = document.getElementById('wcam-lb-iframe');
  const img = document.getElementById('wcam-lb-img');
  // Prefer live stream → day player → image fallback
  const embedUrl = cam.player?.streaming?.embed || cam.player?.day?.embed || cam.player?.current?.embed || '';
  if (embedUrl) {
    iframe.style.display = 'block';
    if (img) img.style.display = 'none';
    iframe.src = embedUrl;
  } else {
    // No embed — show full-resolution preview image instead
    const imgUrl = cam.images?.daylight?.full || cam.images?.current?.full || cam.images?.daylight?.preview || cam.images?.current?.preview || '';
    if (!imgUrl) return;
    iframe.style.display = 'none';
    if (!img) {
      const el = document.createElement('img');
      el.id = 'wcam-lb-img';
      el.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
      document.querySelector('.wcam-lb-box').appendChild(el);
    }
    document.getElementById('wcam-lb-img').src = imgUrl;
    document.getElementById('wcam-lb-img').style.display = 'block';
  }
  lb.classList.add('on');
}

function closeWebcamPlayer() {
  closeWebcamLightbox();
}

function closeWebcamLightbox() {
  document.getElementById('wcam-lightbox').classList.remove('on');
  document.getElementById('wcam-lb-iframe').src = 'about:blank';
}

// ─── Resizable helper (edge/corner drag) ────────────
function makeResizable(panel) {
  if (panel._resizeInit) return;
  panel._resizeInit = true;
  const EDGE = 7; // px from border edge that triggers resize
  let resizing = false, dir = '';
  let startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0;
  const cursorMap = { s:'s-resize', e:'e-resize', w:'w-resize',
    se:'se-resize', sw:'sw-resize' };

  function getDir(e) {
    const r = panel.getBoundingClientRect();
    const onR = e.clientX >= r.right - EDGE && e.clientX <= r.right + EDGE;
    const onL = e.clientX >= r.left - EDGE && e.clientX <= r.left + EDGE;
    const onB = e.clientY >= r.bottom - EDGE && e.clientY <= r.bottom + EDGE;
    // Exclude top edge (used by drag handle)
    if (onB && onR) return 'se';
    if (onB && onL) return 'sw';
    if (onB) return 's';
    if (onR) return 'e';
    if (onL) return 'w';
    return '';
  }

  panel.addEventListener('mousemove', e => {
    if (resizing) return;
    const d = getDir(e);
    panel.style.cursor = cursorMap[d] || '';
  });
  panel.addEventListener('mouseleave', () => {
    if (!resizing) panel.style.cursor = '';
  });

  panel.addEventListener('mousedown', e => {
    const d = getDir(e);
    if (!d) return;
    resizing = true; dir = d;
    const r = panel.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startW = r.width;   startH = r.height;
    startL = parseInt(panel.style.left) || r.left;
    startT = parseInt(panel.style.top)  || r.top;
    panel.style.left = startL + 'px';
    panel.style.top  = startT + 'px';
    panel.style.right = 'auto';
    e.preventDefault(); e.stopPropagation();
  });

  document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    const MIN_W = 280, MIN_H = 180;
    if (dir.includes('e')) panel.style.width  = Math.max(MIN_W, startW + dx) + 'px';
    if (dir.includes('s')) panel.style.height = Math.max(MIN_H, startH + dy) + 'px';
    if (dir.includes('w')) {
      const nw = Math.max(MIN_W, startW - dx);
      panel.style.width = nw + 'px';
      panel.style.left  = (startL + startW - nw) + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false; dir = '';
    panel.style.cursor = '';
  });
}

// ─── Draggable helper for floating panels ───────────
function _makePanelDraggable(panel, handle) {
  if (!handle || panel._dragInit) return;
  panel._dragInit = true;
  let startX, startY, initLeft, initTop;

  // Ensure panel has explicit position
  if (!panel.style.left) panel.style.left = panel.getBoundingClientRect().left + 'px';
  if (!panel.style.top)  panel.style.top  = panel.getBoundingClientRect().top  + 'px';
  // Switch from bottom/right-anchored to top/left-anchored positioning
  panel.style.right  = 'auto';
  panel.style.bottom = 'auto';

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    initLeft = parseInt(panel.style.left) || panel.getBoundingClientRect().left;
    initTop  = parseInt(panel.style.top)  || panel.getBoundingClientRect().top;

    function onMove(e) {
      panel.style.left = (initLeft + e.clientX - startX) + 'px';
      panel.style.top  = (initTop  + e.clientY - startY) + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
// ── Generic panel draggable ──────────
function makeDraggable(panel, handle) {
  let ox=0, oy=0, startL=0, startT=0, dragging=false;
  handle.addEventListener('mousedown', e => {
    if (e.target.tagName==='BUTTON'||e.target.tagName==='A') return;
    dragging = true;
    const r = panel.getBoundingClientRect();
    // Convert to explicit left/top if using CSS positioning
    panel.style.left   = r.left + 'px';
    panel.style.top    = r.top  + 'px';
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    startL = r.left; startT = r.top;
    ox = e.clientX; oy = e.clientY;
    panel.classList.add('panel-dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    panel.style.left = (startL + e.clientX - ox) + 'px';
    panel.style.top  = (startT + e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('panel-dragging');
  });
}
function initDraggablePanels() {
  [
    ['shipping-panel','sp-hdr'],
    ['sanctions-panel','san-hdr'],
    ['div-panel','div-hdr'],
  ].forEach(([pid, hid]) => {
    const p = document.getElementById(pid);
    const h = p && p.querySelector('.'+hid);
    if (p && h) makeDraggable(p, h);
  });
  // Cascade widget uses its label as handle
  const cw = document.getElementById('cascade-widget');
  if (cw) {
    const lbl = cw.querySelector('.cw-lbl');
    if (lbl) { lbl.classList.add('drag-handle'); makeDraggable(cw, lbl); }
  }
}
// Layer control drag-to-scroll
(function(){
  const lc = document.getElementById('layer-ctrl');
  if (!lc) return;
  let isDown=false, startX=0, scrollLeft=0;
  lc.addEventListener('mousedown', e => { isDown=true; lc.style.cursor='grabbing'; startX=e.pageX-lc.offsetLeft; scrollLeft=lc.scrollLeft; });
  lc.addEventListener('mouseleave', () => { isDown=false; lc.style.cursor='grab'; });
  lc.addEventListener('mouseup', () => { isDown=false; lc.style.cursor='grab'; });
  lc.addEventListener('mousemove', e => { if(!isDown)return; e.preventDefault(); const x=e.pageX-lc.offsetLeft; lc.scrollLeft=scrollLeft-(x-startX); });
})();
// ═══════════════════════════════════════════
// CITY INTEL PANEL
// ═══════════════════════════════════════════
const _CITY_TYPE_SVG = {
  capital:    `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6,0.5 7.4,4.2 11.3,4.2 8.2,6.5 9.4,10.3 6,8 2.6,10.3 3.8,6.5 0.7,4.2 4.6,4.2" fill="currentColor"/></svg>`,
  financial:  `<svg viewBox="0 0 12 12" width="100%" height="100%"><rect x="0.5" y="7.5" width="2.2" height="4" fill="currentColor"/><rect x="3.5" y="5" width="2.2" height="6.5" fill="currentColor"/><rect x="6.5" y="2.5" width="2.2" height="9" fill="currentColor"/><rect x="9.5" y="4.5" width="2" height="7" fill="currentColor"/></svg>`,
  military:   `<svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 1L1.5 3.5V7c0 2.2 2 4 4.5 4.5C10 11 10.5 9.2 10.5 7V3.5Z" fill="currentColor"/></svg>`,
  naval:      `<svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 1v3M4.5 4h3M2.5 6.5l1 3.5h5l1-3.5C8.5 6 7 5.5 6 5.5S3.5 6 2.5 6.5z" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`,
  port:       `<svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="2.5" r="1.5" stroke="currentColor" stroke-width="1" fill="none"/><line x1="6" y1="4" x2="6" y2="10" stroke="currentColor" stroke-width="1.1"/><path d="M2.5 7.5c1 2 6 2 7 0" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>`,
  conflict:   `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6,1 11.5,11 0.5,11" fill="currentColor"/></svg>`,
  energy:     `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="7,0.5 3,6.5 6,6.5 5,11.5 9.5,5 6.5,5" fill="currentColor"/></svg>`,
  diplomatic: `<svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" fill="none"/><ellipse cx="6" cy="6" rx="2.5" ry="5" stroke="currentColor" stroke-width="0.8" fill="none"/><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="0.8"/></svg>`,
  city:       `<svg viewBox="0 0 12 12" width="100%" height="100%"><rect x="1.5" y="5.5" width="9" height="6" fill="currentColor" opacity=".75"/><rect x="3.5" y="2.5" width="5" height="3" fill="currentColor"/></svg>`,
};
const _CITY_COL = { capital:'#E8D5A3', financial:'#FFD60A', military:'#FF6D00', naval:'#2979FF', port:'#00BCD4', conflict:'#FF2D55', energy:'#FF9F0A', diplomatic:'#30D158', city:'#6674CC' };
const _CITY_TYPE_LBL = { capital:'CAPITAL CITY', financial:'FINANCIAL CENTRE', military:'MILITARY BASE', naval:'NAVAL BASE', port:'PORT / MARITIME HUB', conflict:'CONFLICT ZONE', energy:'ENERGY HUB', diplomatic:'DIPLOMATIC CAPITAL', city:'MAJOR CITY' };

function openCityPanel(city) {
  window._cipCurrentCity = city;
  const panel = document.getElementById('city-panel');
  const type  = city.icon_type || 'city';
  const color = _CITY_COL[type] || '#6674CC';
  // Update PIN button state
  const pinBtn = document.getElementById('cip-pin-btn');
  if (pinBtn) {
    const key = `city:${city.name}:${(city.lat||0).toFixed(1)}`;
    const isPinned = typeof _analystGeoMap !== 'undefined' && !!_analystGeoMap[key];
    pinBtn.textContent = isPinned ? 'PINNED' : 'PIN';
    pinBtn.style.color = isPinned ? '#00D4FF' : '';
  }

  // Header
  const iconEl = document.getElementById('cip-type-icon');
  iconEl.innerHTML = _CITY_TYPE_SVG[type] || _CITY_TYPE_SVG.city;
  iconEl.style.color = color;
  document.getElementById('cip-name').textContent = city.name.toUpperCase();
  document.getElementById('cip-meta').textContent = [
    _CITY_TYPE_LBL[type] || type.toUpperCase(),
    city.country ? city.country.toUpperCase() : '',
  ].filter(Boolean).join(' · ');

  // Reset briefs
  document.getElementById('cip-city-brief').innerHTML  = '<span class="cip-loading">SCANNING FEEDS…</span>';
  document.getElementById('cip-nation-brief').innerHTML = '<span class="cip-loading">SCANNING FEEDS…</span>';

  panel.classList.add('on');
  _makePanelDraggable(panel, panel.querySelector('.cip-hdr'));

  // Webcam auto-load
  if (typeof _webcamPanelEnabled !== 'undefined' && _webcamPanelEnabled) {
    loadWebcams({ lat: city.lat, lng: city.lng, region: city.name });
  }

  // Gather relevant stories for context
  const cityLc    = city.name.toLowerCase();
  const countryLc = (city.country || '').toLowerCase();
  const allStories = typeof NEWS !== 'undefined' ? NEWS : [];

  const cityStories = allStories.filter(s => {
    const t = ((s.title||'') + ' ' + (s.region||'') + ' ' + (s.summary||'')).toLowerCase();
    return t.includes(cityLc);
  }).slice(0, 6);

  const nationStories = allStories.filter(s => {
    if (!countryLc) return false;
    const t = ((s.title||'') + ' ' + (s.region||'') + ' ' + (s.summary||'')).toLowerCase();
    return t.includes(countryLc) && !cityStories.includes(s);
  }).slice(0, 6);

  // Fallback: use geo/military if no direct matches
  const fallback = allStories.filter(s => s.cat === 'geo' || s.cat === 'military').slice(0, 4);

  const cityCtx    = (cityStories.length    ? cityStories    : fallback).map(s => `• ${s.title}`).join('\n');
  const nationCtx  = (nationStories.length  ? nationStories  : fallback).map(s => `• ${s.title}`).join('\n');

  // AI briefs
  _fetchCityBrief(city, type, color, cityCtx, nationCtx);
}

async function _fetchCityBrief(city, type, color, cityCtx, nationCtx) {
  const country = city.country || 'unknown nation';
  const sys = 'You are a geopolitical intelligence analyst. Write in crisp, precise intelligence briefing style. No bullet points — flowing prose, 3-4 sentences maximum per section.';

  // City brief
  try {
    const cityBrief = await callOpenAI(sys,
      `24-hour intelligence brief for ${city.name}, ${country} (${_CITY_TYPE_LBL[type] || type}).\nRecent relevant headlines:\n${cityCtx || 'No direct city coverage in current feeds.'}\nProvide a concise 3-sentence analyst assessment covering security, economic, and geopolitical situation for this city today.`,
      320
    );
    const el = document.getElementById('cip-city-brief');
    if (el) el.textContent = cityBrief;
  } catch(e) {
    const el = document.getElementById('cip-city-brief');
    if (el) el.innerHTML = `<span style="font-family:var(--f-mono);font-size:8px;color:var(--t3)">BRIEF UNAVAILABLE — ${e.message === 'API_KEY_MISSING' ? 'ADD OPENAI KEY' : 'API ERROR'}</span>`;
  }

  // Nation brief
  try {
    const nationBrief = await callOpenAI(sys,
      `24-hour national intelligence brief for ${country}.\nRecent relevant headlines:\n${nationCtx || 'No direct national coverage in current feeds.'}\nProvide a concise 4-sentence strategic overview covering geopolitical position, internal stability, economic outlook, and key international relationships today.`,
      420
    );
    const el = document.getElementById('cip-nation-brief');
    if (el) el.textContent = nationBrief;
  } catch(e) {
    const el = document.getElementById('cip-nation-brief');
    if (el) el.innerHTML = `<span style="font-family:var(--f-mono);font-size:8px;color:var(--t3)">BRIEF UNAVAILABLE — ${e.message === 'API_KEY_MISSING' ? 'ADD OPENAI KEY' : 'API ERROR'}</span>`;
  }
}

function closeCityPanel() {
  document.getElementById('city-panel').classList.remove('on');
}

// Hook into openArticle to auto-load webcams when panel is enabled
(function patchOpenArticle() {
  const _origOpenArticle = openArticle;
  openArticle = function(story) {
    _origOpenArticle(story);
    if (_webcamPanelEnabled && story && story.lat != null) {
      loadWebcams(story);
    }
    // Auto-select best broadcaster in live news panel if it's open
    if (_lnpActive && story) {
      const bestId = _selectBroadcaster(story);
      document.getElementById('lnp-loc').textContent = (story.region || 'GLOBAL FEED').toUpperCase();
      if (bestId !== _lnpCurrentId) switchBroadcaster(bestId);
    }
  };
})();
