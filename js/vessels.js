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

function makeVesselMarker(v) {
  const col = _vsCol(v);
  const hdg = +(v.heading) || 0;
  const d = document.createElement('div');
  d.className = `vs-m vs-${v.category || 'other'}`;
  d.style.color = col;
  const name = (v.name || `MMSI ${v.mmsi}`).toUpperCase();
  const sog  = v.sog != null ? Math.round(v.sog) : '–';
  d.innerHTML = `
    <div class="vs-inner" style="transform:rotate(${hdg}deg)">${SHIP_SVG}</div>
    <div class="vs-tip"><div class="vs-tip-cs" style="color:${col}">${name}</div><div class="vs-tip-type" style="color:${col}">${_vsLabel(v)}</div><div class="vs-tip-row"><span>COG ${Math.round(v.cog||0)}°</span><span>${sog}kn</span><span>${(v.destination||'—').slice(0,14)}</span></div></div>`;
  d.addEventListener('click', e => { e.stopPropagation(); showVesselInfo(v); });
  return d;
}

// Click card — identical look/behaviour to showFlightInfo (centre-bottom,
// draggable, auto-dismiss).
function showVesselInfo(v) {
  if (_vesselInfoPanel) _vesselInfoPanel.remove();
  const col = _vsCol(v);
  const sog = v.sog != null ? v.sog.toFixed(1) : '—';
  const panel = document.createElement('div');
  panel.id = 'vs-info-panel';
  panel.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:200;background:rgba(4,6,17,.97);border:1px solid ${col}44;border-radius:4px;padding:12px 16px;font-family:var(--f-mono);backdrop-filter:blur(20px);display:flex;align-items:center;gap:14px;min-width:320px;pointer-events:all;cursor:grab;user-select:none`;
  panel.innerHTML = `
    <div style="color:${col};flex-shrink:0;width:26px;height:26px;filter:drop-shadow(0 0 6px ${col})">${SHIP_SVG}</div>
    <div style="flex:1;min-width:0">
      <div style="color:${col};font-size:11px;font-weight:700;letter-spacing:.12em;margin-bottom:3px">${(v.name||`MMSI ${v.mmsi}`).toUpperCase()} <span style="font-size:8px;opacity:.6;margin-left:6px">${_vsLabel(v)}</span></div>
      <div style="font-size:8px;color:var(--t3);display:flex;gap:12px;flex-wrap:wrap">
        <span>MMSI: ${v.mmsi}</span>
        <span>SPD: ${sog}kn</span>
        <span>COG: ${Math.round(v.cog||0)}°</span>
        <span>HDG: ${Math.round(v.heading||0)}°</span>
        <span>DEST: ${(v.destination||'—').toUpperCase()}</span>
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
  if (vesselsVisible) updateAllGlobeElements();
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
    updateAllGlobeElements();
  }
}
