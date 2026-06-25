'use strict';

// ═══════════════════════════════════════════
// LIVE AIS VESSELS — a twin of the FLIGHTS layer.
// Real ship positions from aisstream.io via the server-side proxy
// (/vessels.json). Visuals, categories, colours and land-avoidance are ported
// from the Flexport dashboard's vessel implementation; the marker + click popup
// mirror AUSPEX's flights so the two layers feel identical.
// ═══════════════════════════════════════════

const VESSEL_LIMIT = 2500;

// Top-down vessel hull (pointed bow up at 0°) — ported from Flexport's ship
// canvas: hull + white centreline + superstructure block. makeVesselMarker
// rotates it to the live heading.
const SHIP_SVG = `<svg class="vs-ship" viewBox="0 0 32 48" fill="currentColor"><path d="M16 3 C21.5 11 23.5 22 22 32 L20 44 L12 44 L10 32 C8.5 22 10.5 11 16 3 Z"/><line x1="16" y1="9" x2="16" y2="40" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/><rect x="12.5" y="25" width="7" height="7" fill="rgba(255,255,255,.28)"/></svg>`;

// Category → colour (Flexport's palette: tanker orange, cargo/container cyan,
// utility violet) + human label.
const VS_COLOR = { tanker:'#f97316', cargo:'#00d4ff', passenger:'#0A84FF', hsc:'#5ac8fa', tug:'#a78bfa', fishing:'#a78bfa', other:'#22D3EE' };
const VS_LABEL = { tanker:'TANKER', cargo:'CARGO', passenger:'PASSENGER', hsc:'HIGH-SPEED CRAFT', tug:'TUG / TOW', fishing:'FISHING / UTILITY', other:'VESSEL' };
function _vsCol(v)   { return VS_COLOR[v.category] || VS_COLOR.other; }
function _vsLabel(v) { return VS_LABEL[v.category] || VS_LABEL.other; }

// Flag state from the MMSI MID (first 3 digits) → { iso, name }. Ported from
// Flexport's MID table but keyed to ISO-2 codes so we can render a real flag
// ICON (flagcdn SVG), never an emoji. Destination is usually blank/garbage on
// AIS, so the popup shows this instead.
const MID_TO_FLAG = {
  201:['al','Albania'],205:['be','Belgium'],209:['cy','Cyprus'],210:['cy','Cyprus'],212:['cy','Cyprus'],
  211:['de','Germany'],218:['de','Germany'],219:['dk','Denmark'],220:['dk','Denmark'],
  224:['es','Spain'],225:['es','Spain'],226:['fr','France'],227:['fr','France'],228:['fr','France'],
  229:['mt','Malta'],230:['fi','Finland'],231:['fo','Faroe Islands'],
  232:['gb','United Kingdom'],233:['gb','United Kingdom'],234:['gb','United Kingdom'],235:['gb','United Kingdom'],
  236:['gi','Gibraltar'],237:['gr','Greece'],239:['gr','Greece'],240:['gr','Greece'],241:['gr','Greece'],
  244:['nl','Netherlands'],245:['nl','Netherlands'],246:['nl','Netherlands'],247:['it','Italy'],
  248:['mt','Malta'],249:['mt','Malta'],256:['mt','Malta'],215:['mt','Malta'],253:['lu','Luxembourg'],
  255:['pt','Portugal'],257:['no','Norway'],258:['no','Norway'],259:['no','Norway'],
  261:['pl','Poland'],265:['se','Sweden'],266:['se','Sweden'],269:['ch','Switzerland'],
  271:['tr','Turkey'],272:['ua','Ukraine'],273:['ru','Russia'],214:['md','Moldova'],
  303:['us','United States'],338:['us','United States'],366:['us','United States'],367:['us','United States'],
  368:['us','United States'],369:['us','United States'],316:['ca','Canada'],
  304:['ag','Antigua & Barbuda'],305:['ag','Antigua & Barbuda'],308:['bs','Bahamas'],309:['bs','Bahamas'],311:['bs','Bahamas'],
  310:['bm','Bermuda'],319:['ky','Cayman Islands'],312:['bz','Belize'],341:['kn','St Kitts & Nevis'],
  375:['vc','St Vincent'],376:['vc','St Vincent'],377:['vc','St Vincent'],
  351:['pa','Panama'],352:['pa','Panama'],353:['pa','Panama'],354:['pa','Panama'],355:['pa','Panama'],
  356:['pa','Panama'],357:['pa','Panama'],370:['pa','Panama'],371:['pa','Panama'],372:['pa','Panama'],
  373:['pa','Panama'],374:['pa','Panama'],
  412:['cn','China'],413:['cn','China'],414:['cn','China'],461:['cn','China'],416:['tw','Taiwan'],
  419:['in','India'],422:['ir','Iran'],431:['jp','Japan'],432:['jp','Japan'],
  440:['kr','South Korea'],441:['kr','South Korea'],470:['ae','UAE'],471:['ae','UAE'],472:['ae','UAE'],
  477:['hk','Hong Kong'],478:['ph','Philippines'],548:['ph','Philippines'],
  503:['au','Australia'],510:['mh','Marshall Islands'],538:['mh','Marshall Islands'],512:['nz','New Zealand'],
  518:['ck','Cook Islands'],521:['id','Indonesia'],525:['id','Indonesia'],533:['my','Malaysia'],
  563:['sg','Singapore'],564:['sg','Singapore'],565:['sg','Singapore'],566:['sg','Singapore'],
  567:['th','Thailand'],574:['vn','Vietnam'],576:['vu','Vanuatu'],577:['vu','Vanuatu'],
  601:['za','South Africa'],620:['km','Comoros'],636:['lr','Liberia'],667:['sl','Sierra Leone'],
  671:['tg','Togo'],674:['tz','Tanzania'],677:['tz','Tanzania'],
};
function vesselFlag(mmsi) {
  const mid = Math.floor((+mmsi || 0) / 1000000);
  const m = MID_TO_FLAG[mid];
  return m ? { iso: m[0], name: m[1] } : null;
}
function _flagImg(fl, h) { return fl ? `<img class="vs-flag" src="https://flagcdn.com/${fl.iso}.svg" alt="${fl.name}" loading="lazy" style="height:${h}px">` : ''; }

// ── GPU SPRITE RENDERING ────────────────────────────────────────────────────
// Hundreds of HTML markers tank the framerate (the browser re-lays-out every DOM
// node each frame). Flexport renders vessels as THREE sprites on the WebGL
// canvas instead — thousands stay at 60fps. We do the same via globe.gl's
// objectsData layer (the moon uses customLayer, so this layer is free), with
// native onObjectClick/onObjectHover and a per-frame heading update.

let _THREE = null, _threeP = null;
function _ensureThree() {
  if (_THREE) return Promise.resolve(_THREE);
  if (_threeP) return _threeP;
  const rev = (typeof window !== 'undefined' && window.__THREE__) || '183';
  _threeP = import(`https://cdn.jsdelivr.net/npm/three@0.${rev}.0/build/three.module.js`)
    .then(m => { _THREE = m; return m; });
  return _threeP;
}

// Ship texture per colour — ported from Flexport's makeShipCanvas (glow halo +
// pointed-bow hull + white centreline + superstructure). Bow points UP (+Y);
// the heading loop rotates the sprite to course.
const _shipTex = {};
function _shipTexture(hex) {
  if (_shipTex[hex]) return _shipTex[hex];
  const c = document.createElement('canvas'); c.width = 32; c.height = 48;
  const ctx = c.getContext('2d');
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const glow = ctx.createRadialGradient(16,24,2,16,24,16);
  glow.addColorStop(0,`rgba(${r},${g},${b},0.30)`); glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0,0,32,48);
  ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
  ctx.beginPath();
  ctx.moveTo(16,4); ctx.bezierCurveTo(22,12,24,22,22,32);
  ctx.lineTo(20,44); ctx.lineTo(12,44); ctx.lineTo(10,32);
  ctx.bezierCurveTo(8,22,10,12,16,4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16,8); ctx.lineTo(16,40); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(12,26,8,8);
  const tex = new _THREE.CanvasTexture(c);
  if ('colorSpace' in tex) tex.colorSpace = _THREE.SRGBColorSpace;
  _shipTex[hex] = tex; return tex;
}

let _vsSprites = []; // { s: THREE.Sprite, v }
const VS_SCALE = 3.2; // globe radius is 100u; tuned to match the old icon size

function makeVesselSprite(v) {
  const mat = new _THREE.SpriteMaterial({ map: _shipTexture(_vsCol(v)), transparent: true, depthWrite: false, sizeAttenuation: true });
  const s = new _THREE.Sprite(mat);
  s.scale.set(VS_SCALE * 0.66, VS_SCALE, 1); // taller than wide (bow-forward)
  s.__v = v;
  _vsSprites.push({ s, v });
  return s;
}

// Push live data into the objects layer (or clear it).
function renderVesselObjects() {
  if (!G || typeof G.objectsData !== 'function') return;
  _ensureThree().then(() => {
    // dispose the previous frame's materials (textures are cached + shared, keep them)
    for (const o of _vsSprites) { try { o.s.material.dispose(); } catch {} }
    _vsSprites = [];
    G.objectsData(vesselsVisible ? vesselData : [])
      .objectLat(d => d.lat).objectLng(d => d.lng)
      .objectAltitude(0.004)
      .objectThreeObject(makeVesselSprite)
      .onObjectClick(v => showVesselInfo(v))
      .onObjectHover(v => _onVesselHover(v));
    if (vesselsVisible) _startHeadingLoop(); else _stopHeadingLoop();
  });
}

// Per-frame heading: project each vessel + a point 0.5° ahead to screen space and
// rotate the sprite so the bow points along its course, correct as the globe
// turns. Pure math on the GPU-rendered sprites — no DOM, no layout, no lag.
function _forwardPoint(lat, lng, brngDeg) {
  const d = 0.5 * Math.PI/180, brng = brngDeg * Math.PI/180;
  const la = lat*Math.PI/180, lo = lng*Math.PI/180;
  const la2 = Math.asin(Math.sin(la)*Math.cos(d) + Math.cos(la)*Math.sin(d)*Math.cos(brng));
  const lo2 = lo + Math.atan2(Math.sin(brng)*Math.sin(d)*Math.cos(la), Math.cos(d) - Math.sin(la)*Math.sin(la2));
  return { lat: la2*180/Math.PI, lng: lo2*180/Math.PI };
}
function _llToVec(lat, lng, R, out) {
  const phi = (90 - lat) * Math.PI/180, th = (90 - lng) * Math.PI/180;
  out.set(R*Math.sin(phi)*Math.cos(th), R*Math.cos(phi), R*Math.sin(phi)*Math.sin(th));
  return out;
}
// Headings only change on-screen when the camera moves, so recompute on the
// controls' 'change' event instead of every frame — an idle globe costs nothing.
let _vsHdgVecA = null, _vsHdgVecB = null, _vsHdgBound = false;
function _recomputeHeadings() {
  if (!vesselsVisible || !_THREE || !_vsSprites.length) return;
  const cam = G.camera(); if (!cam) return;
  const A = _vsHdgVecA || (_vsHdgVecA = new _THREE.Vector3());
  const B = _vsHdgVecB || (_vsHdgVecB = new _THREE.Vector3());
  for (const { s, v } of _vsSprites) {
    const h = (v.heading != null ? v.heading : v.cog) || 0;
    const fp = _forwardPoint(v.lat, v.lng, h);
    _llToVec(v.lat, v.lng, 100.4, A).project(cam);
    _llToVec(fp.lat, fp.lng, 100.4, B).project(cam);
    const dx = B.x - A.x, dy = B.y - A.y;
    if (dx*dx + dy*dy > 1e-9) s.material.rotation = Math.atan2(dy, dx) - Math.PI/2;
  }
}
function _startHeadingLoop() {
  if (!_vsHdgBound) {
    const c = G.controls && G.controls();
    if (c && c.addEventListener) { c.addEventListener('change', _recomputeHeadings); _vsHdgBound = true; }
    window.addEventListener('resize', _recomputeHeadings);
  }
  // sprites may build a tick after objectsData() — compute now and shortly after.
  _recomputeHeadings();
  setTimeout(_recomputeHeadings, 120);
}
function _stopHeadingLoop() { /* listener is harmless when vessels are off (no-ops) */ }

// Single shared hover tooltip — always above everything; follows the cursor.
let _vsHoverEl = null, _vsMouse = { x: 0, y: 0 };
function _onVesselHover(v) {
  if (!_vsHoverEl) {
    _vsHoverEl = document.createElement('div');
    _vsHoverEl.id = 'vs-hover';
    document.body.appendChild(_vsHoverEl);
    document.addEventListener('mousemove', e => {
      _vsMouse = { x: e.clientX, y: e.clientY };
      if (_vsHoverEl.style.display === 'block') _positionHover();
    });
  }
  if (!v) { _vsHoverEl.style.display = 'none'; document.body.style.cursor = ''; return; }
  const col = _vsCol(v), fl = vesselFlag(v.mmsi);
  const sog = v.sog != null ? Math.round(v.sog) : '–';
  _vsHoverEl.innerHTML = `<div class="vs-h-cs" style="color:${col}">${(v.name||`MMSI ${v.mmsi}`).toUpperCase()}</div><div class="vs-h-type" style="color:${col}">${_vsLabel(v)}</div><div class="vs-h-row"><span>COG ${Math.round(v.cog||0)}°</span><span>${sog}kn</span><span>${fl ? fl.name : '—'}</span></div>`;
  _vsHoverEl.style.borderColor = col + '66';
  _vsHoverEl.style.display = 'block';
  document.body.style.cursor = 'pointer';
  _positionHover();
}
function _positionHover() {
  if (!_vsHoverEl) return;
  const pad = 16, w = _vsHoverEl.offsetWidth, h = _vsHoverEl.offsetHeight;
  let x = _vsMouse.x + pad, y = _vsMouse.y + pad;
  if (x + w > window.innerWidth - 8) x = _vsMouse.x - w - pad;
  if (y + h > window.innerHeight - 8) y = _vsMouse.y - h - pad;
  _vsHoverEl.style.left = x + 'px'; _vsHoverEl.style.top = y + 'px';
}

// Click card — identical look/behaviour to showFlightInfo (centre-bottom,
// draggable, auto-dismiss).
function showVesselInfo(v) {
  if (_vesselInfoPanel) _vesselInfoPanel.remove();
  const col = _vsCol(v);
  const sog = v.sog != null ? v.sog.toFixed(1) : '—';
  const fl  = vesselFlag(v.mmsi);
  const flagCell = fl
    ? `<span style="display:inline-flex;align-items:center;gap:5px">FLAG: ${_flagImg(fl, 11)} ${fl.name.toUpperCase()}</span>`
    : `<span>FLAG: —</span>`;
  const panel = document.createElement('div');
  panel.id = 'vs-info-panel';
  panel.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:900;background:rgba(4,6,17,.97);border:1px solid ${col}44;border-radius:4px;padding:12px 16px;font-family:var(--f-mono);backdrop-filter:blur(20px);display:flex;align-items:center;gap:14px;min-width:320px;max-width:min(560px,90vw);box-sizing:border-box;pointer-events:all;cursor:grab;user-select:none`;
  panel.innerHTML = `
    <div style="color:${col};flex-shrink:0;width:26px;height:26px;filter:drop-shadow(0 0 6px ${col})">${SHIP_SVG}</div>
    <div style="flex:1;min-width:0">
      <div style="color:${col};font-size:11px;font-weight:700;letter-spacing:.12em;margin-bottom:3px">${(v.name||`MMSI ${v.mmsi}`).toUpperCase()} <span style="font-size:8px;opacity:.6;margin-left:6px">${_vsLabel(v)}</span></div>
      <div style="font-size:8px;color:var(--t3);display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <span>MMSI: ${v.mmsi}</span>
        <span>SPD: ${sog}kn</span>
        <span>COG: ${Math.round(v.cog||0)}°</span>
        <span>HDG: ${Math.round(v.heading||0)}°</span>
        ${flagCell}
        <span>CALL: ${(v.callsign||'—').toUpperCase()}</span>
      </div>
    </div>
    <button id="vs-close-btn" style="background:none;border:1px solid var(--b1);border-radius:2px;color:var(--t3);cursor:pointer;padding:3px 8px;font-family:var(--f-mono);font-size:10px;flex-shrink:0">×</button>`;
  document.body.appendChild(panel);
  panel.querySelector('#vs-close-btn').addEventListener('click', () => panel.remove());
  _vesselInfoPanel = panel;

  let dragging = false, offX = 0, offY = 0;
  const onMove = e => { if (!dragging) return; panel.style.left = (e.clientX - offX) + 'px'; panel.style.top = (e.clientY - offY) + 'px'; };
  const onUp = () => { dragging = false; panel.style.cursor = 'grab'; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  panel.addEventListener('mousedown', e => {
    if (e.target.closest('#vs-close-btn')) return;
    dragging = true; panel.style.cursor = 'grabbing';
    const rect = panel.getBoundingClientRect();
    panel.style.transform = 'none'; panel.style.bottom = '';
    panel.style.left = rect.left + 'px'; panel.style.top = rect.top + 'px';
    offX = e.clientX - rect.left; offY = e.clientY - rect.top;
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
  setTimeout(() => { if (panel.parentNode) panel.remove(); }, 12000);
}

async function fetchVessels() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(`${WORKER_BASE || ''}/vessels.json`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const vs = (d.vessels || [])
      .filter(v => v.lat != null && v.lng != null)
      .map(v => ({ ...v, _type: 'vessel' }))
      .slice(0, VESSEL_LIMIT);
    vesselData = vs;
    _setVesselBadge(vs.length > 0);
  } catch (e) {
    // No simulated fallback — vessels are live AIS or nothing (honest feed).
    console.warn('Live vessels failed:', e.message);
    vesselData = [];
    _setVesselBadge(false);
  }
  _showVesselBadge(vesselsVisible);
  renderVesselObjects();
}

function _setVesselBadge(isLive) {
  const badge = document.getElementById('vessel-data-badge');
  const lbl = document.getElementById('vdb-label');
  if (!badge) return;
  badge.className = isLive ? 'live' : 'sim';
  if (lbl) lbl.textContent = isLive ? 'LIVE AIS' : 'NO AIS FEED';
}
function _showVesselBadge(show) {
  const badge = document.getElementById('vessel-data-badge');
  if (badge) badge.style.display = show ? 'flex' : 'none';
}

function toggleVessels() {
  vesselsVisible = !vesselsVisible;
  document.getElementById('lc-vessels').classList.toggle('on', vesselsVisible);
  if (vesselsVisible) {
    fetchVessels();
    _vesselTimer = setInterval(fetchVessels, 45000);
  } else {
    clearInterval(_vesselTimer);
    _showVesselBadge(false);
    _stopHeadingLoop();
    if (_vsHoverEl) _vsHoverEl.style.display = 'none';
    renderVesselObjects(); // clears the objects layer
  }
}
