'use strict';

// ═══════════════════════════════════════════
// DATA OVERLAYS — C1 FLIGHTS, B3 CABLES, A2 DIVERGENCE,
//                 A1 CASCADE, A3 SILENCE, B1 THREATS,
//                 B2 FOG, C2 SHIPPING, C3 SANCTIONS
// ═══════════════════════════════════════════
const MIL_CALLSIGN_PFX = ['REACH','JAKE','DUKE','SPAR','MAGMA','IRON','VAPOR','RCH','PAT','SKILL','EVAC','COBRA','VIPER','RAPTOR','TALON','HAWK','EAGLE','GHOST','STORM','WOLF'];
const MIL_ICAO_PFX     = ['AE','43C','43D','43E','3E','A1','A2','A3','A4']; // US/NATO/Russian military hex blocks
const CARGO_CALLSIGN   = ['UPS','FDX','ATN','GTI','ABX','PAC','CLX','SWG','BOX','MPH','KFS','JTG'];
const CARGO_ICAO_PFX   = ['A0','A9','AA']; // cargo operator blocks

function classifyFlight(f) {
  const cs  = (f.callsign||'').trim().toUpperCase();
  const ic  = (f.icao||'').toUpperCase();
  if (MIL_CALLSIGN_PFX.some(p => cs.startsWith(p)) || MIL_ICAO_PFX.some(p => ic.startsWith(p))) return 'military';
  if (CARGO_CALLSIGN.some(p => cs.startsWith(p)) || CARGO_ICAO_PFX.some(p => ic.startsWith(p))) return 'cargo';
  return 'passenger';
}

// Flexport-style top-down aircraft glyph — fuselage + swept wings + tail,
// nose pointing north (0°); makeFlightMarker rotates it to the live heading.
const PLANE_SVG = `<svg class="fl-plane" viewBox="0 0 56 56" fill="currentColor"><ellipse cx="28" cy="28" rx="3.6" ry="19"/><path d="M28 19 L7 34 L9 38 L28 30 L47 38 L49 34 Z"/><path d="M28 42 L18 51 L20 53 L28 46 L36 53 L38 51 Z"/></svg>`;

// How many live aircraft to render as markers, and how many to draw trails for
// (trails are dashed/animated arcs — capped lower to keep the globe smooth).
const FLIGHT_LIMIT = 1000;
const FLIGHT_ARC_LIMIT = 300;

// Major air hubs — a live ADS-B fix has no origin, so each plane's trail is
// drawn from its nearest hub (Flexport's approach) to its current position.
const FLIGHT_HUBS = [
  {lat:33.94,lng:-118.41},{lat:40.64,lng:-73.78},{lat:41.98,lng:-87.90},{lat:32.90,lng:-97.04},
  {lat:33.64,lng:-84.43},{lat:37.62,lng:-122.38},{lat:25.79,lng:-80.29},{lat:35.04,lng:-89.98},
  {lat:51.47,lng:-0.46},{lat:49.01,lng:2.55},{lat:50.04,lng:8.56},{lat:52.31,lng:4.76},
  {lat:40.49,lng:-3.57},{lat:41.80,lng:12.25},{lat:55.62,lng:37.41},{lat:41.28,lng:28.75},
  {lat:25.25,lng:55.36},{lat:24.43,lng:54.65},{lat:1.36,lng:103.99},{lat:22.31,lng:113.92},
  {lat:31.14,lng:121.81},{lat:40.08,lng:116.58},{lat:35.55,lng:139.78},{lat:37.46,lng:126.44},
  {lat:19.09,lng:72.87},{lat:28.56,lng:77.10},{lat:-33.95,lng:151.18},{lat:-23.43,lng:-46.47},
  {lat:-34.82,lng:-58.54},{lat:19.44,lng:-99.07},{lat:43.68,lng:-79.63},{lat:9.01,lng:38.80},
  {lat:-1.32,lng:36.93},{lat:6.58,lng:3.32},{lat:30.12,lng:31.41},{lat:-26.13,lng:28.24},
];
function _nearestHub(lat, lng) {
  let best = FLIGHT_HUBS[0], bd = Infinity;
  for (const h of FLIGHT_HUBS) {
    const d = (h.lat - lat) ** 2 + (h.lng - lng) ** 2;
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
// Flight trail arcs (nearest hub → plane), coloured by category. Drawn only
// while the FLIGHTS layer is on; merged into the globe arc pipeline by refreshArcs.
function computeFlightArcs() {
  if (typeof flightsVisible === 'undefined' || !flightsVisible || !flightData.length) return [];
  return flightData.slice(0, FLIGHT_ARC_LIMIT).map(f => {
    const col = f.flightType === 'military' ? '#30D158' : f.flightType === 'cargo' ? '#A78BFA' : '#0A84FF';
    const h = _nearestHub(f.lat, f.lng);
    return { slat: h.lat, slng: h.lng, elat: f.lat, elng: f.lng, c1: col + '08', c2: col + 'cc', _flight: true };
  });
}

function showFlightInfo(f) {
  if (_flightInfoPanel) _flightInfoPanel.remove();
  const col = f.flightType==='military'?'#30D158':f.flightType==='cargo'?'#A78BFA':'#0A84FF';
  const alt = Math.round((f.alt||0)/0.3048/100)*100;
  const spd = Math.round((f.vel||0)*1.944);
  const panel = document.createElement('div');
  panel.id = 'fl-info-panel';
  // Initial centered position — drag will convert to fixed top/left
  const initBottom = 80;
  panel.style.cssText = `position:fixed;bottom:${initBottom}px;left:50%;transform:translateX(-50%);z-index:200;background:rgba(4,6,17,.97);border:1px solid ${col}44;border-radius:4px;padding:12px 16px;font-family:var(--f-mono);backdrop-filter:blur(20px);display:flex;align-items:center;gap:14px;min-width:320px;pointer-events:all;cursor:grab;user-select:none`;
  panel.innerHTML = `
    <div style="color:${col};flex-shrink:0;width:26px;height:26px;filter:drop-shadow(0 0 6px ${col})">${PLANE_SVG}</div>
    <div style="flex:1;min-width:0">
      <div style="color:${col};font-size:11px;font-weight:700;letter-spacing:.12em;margin-bottom:3px">${(f.callsign||f.icao||'?').toUpperCase()} <span style="font-size:8px;opacity:.6;margin-left:6px">${f.flightType==='military'?'MILITARY':f.flightType==='cargo'?'CARGO FREIGHTER':'COMMERCIAL PASSENGER'}</span></div>
      <div style="font-size:8px;color:var(--t3);display:flex;gap:12px;flex-wrap:wrap">
        <span>COUNTRY: ${(f.country||'—').toUpperCase()}</span>
        <span>HDG: ${Math.round(f.heading||0)}°</span>
        <span>ALT: ${alt.toLocaleString()}ft</span>
        <span>SPD: ${spd}kts</span>
      </div>
    </div>
    <button id="fl-close-btn" style="background:none;border:1px solid var(--b1);border-radius:2px;color:var(--t3);cursor:pointer;padding:3px 8px;font-family:var(--f-mono);font-size:10px;flex-shrink:0">×</button>`;
  document.body.appendChild(panel);
  panel.querySelector('#fl-close-btn').addEventListener('click', () => panel.remove());
  _flightInfoPanel = panel;

  // Drag logic
  let dragging = false, offX = 0, offY = 0;
  const onMove = e => {
    if (!dragging) return;
    panel.style.left = (e.clientX - offX) + 'px';
    panel.style.top  = (e.clientY - offY) + 'px';
  };
  const onUp = () => { dragging = false; panel.style.cursor = 'grab'; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  panel.addEventListener('mousedown', e => {
    if (e.target.closest('#fl-close-btn')) return;
    dragging = true;
    panel.style.cursor = 'grabbing';
    // Convert bottom/transform positioning to top/left so dragging works
    const rect = panel.getBoundingClientRect();
    panel.style.transform = 'none';
    panel.style.bottom = '';
    panel.style.left = rect.left + 'px';
    panel.style.top  = rect.top  + 'px';
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  setTimeout(() => { if (panel.parentNode) panel.remove(); }, 12000);
}

function makeFlightMarker(f) {
  const type = f.flightType || 'passenger';
  const col  = type==='military'?'#30D158':type==='cargo'?'#A78BFA':'#0A84FF';
  const hdg  = +(f.heading) || 0;
  const d = document.createElement('div');
  d.className = `fl-m fl-${type}`;
  // Outer div: Globe.gl may set its own transform for positioning — do NOT add rotation here
  d.style.color = col;
  // Inner div rotates the plane SVG to match heading. SVG points north (0°).
  const pulse = type==='military' ? `<div class="fl-pulse"></div>` : '';
  const cs  = (f.callsign||f.icao||'?').toUpperCase();
  const alt = Math.round((f.alt||0)/0.3048/1000);
  const spd = Math.round((f.vel||0)*1.944);
  const typeStr = type==='military'?'MILITARY':type==='cargo'?'CARGO':'PASSENGER';
  d.innerHTML = `
    <div class="fl-inner" style="transform:rotate(${hdg}deg)">${pulse}${PLANE_SVG}</div>
    <div class="fl-tip"><div class="fl-tip-cs" style="color:${col}">${cs}</div><div class="fl-tip-type" style="color:${col}">${typeStr}</div><div class="fl-tip-row"><span>HDG ${Math.round(hdg)}°</span><span>FL${alt*10}</span><span>${spd}kts</span></div></div>`;
  d.addEventListener('click', e => { e.stopPropagation(); showFlightInfo(f); });
  return d;
}

async function fetchFlights() {
  try {
    // Real live ADS-B via the server-side proxy (OpenSky bulk + adsb.lol
    // fallback), already classified military/cargo/passenger with the right
    // units. Allow a long timeout — OpenSky bulk is fast but a cold serverless
    // fetch can take a few seconds.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(`${WORKER_BASE || ''}/flights.json`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const fl = (d.flights || [])
      .filter(f => f.lat != null && f.lng != null)
      .map(f => ({ ...f, flightType: f.flightType || 'passenger', _type: 'flight' }))
      .slice(0, FLIGHT_LIMIT);
    if (fl.length < 5) throw new Error('too few flights');
    flightData = fl;
    _setFlightBadge(true);
  } catch(e) {
    console.warn('Live flights failed, using seed:', e.message);
    _setFlightBadge(false);
    flightData = [
      // Military — global spread
      { icao:'AE4B8D', callsign:'REACH185',  country:'US',         lng:46.5,   lat:37.2,  alt:9800,  vel:252, heading:280, flightType:'military', _type:'flight' },
      { icao:'AE014A', callsign:'JAKE50',    country:'US',         lng:35.6,   lat:36.1,  alt:8400,  vel:240, heading:95,  flightType:'military', _type:'flight' },
      { icao:'AEF142', callsign:'VAPOR01',   country:'US',         lng:29.3,   lat:48.8,  alt:10500, vel:263, heading:200, flightType:'military', _type:'flight' },
      { icao:'AE91AB', callsign:'COBRA72',   country:'US',         lng:18.5,   lat:52.2,  alt:11000, vel:270, heading:115, flightType:'military', _type:'flight' },
      { icao:'43C1A0', callsign:'RU7700',    country:'Russia',     lng:37.6,   lat:55.7,  alt:9000,  vel:245, heading:330, flightType:'military', _type:'flight' },
      { icao:'43D020', callsign:'RU2201',    country:'Russia',     lng:61.2,   lat:53.1,  alt:8500,  vel:238, heading:270, flightType:'military', _type:'flight' },
      { icao:'AE5599', callsign:'TALON11',   country:'US',         lng:51.4,   lat:25.3,  alt:10800, vel:255, heading:45,  flightType:'military', _type:'flight' },
      { icao:'AE8810', callsign:'GHOST41',   country:'US',         lng:103.8,  lat:1.4,   alt:12000, vel:260, heading:180, flightType:'military', _type:'flight' },
      { icao:'43E009', callsign:'STORM03',   country:'Russia',     lng:44.1,   lat:42.8,  alt:7500,  vel:230, heading:225, flightType:'military', _type:'flight' },
      { icao:'AE3311', callsign:'HAWK99',    country:'US',         lng:-5.6,   lat:36.1,  alt:9200,  vel:248, heading:10,  flightType:'military', _type:'flight' },
      { icao:'AE9921', callsign:'IRON11',    country:'US',         lng:-75.5,  lat:38.9,  alt:8500,  vel:245, heading:180, flightType:'military', _type:'flight' },
      { icao:'AEC301', callsign:'SPAR19',    country:'US',         lng:-87.6,  lat:41.8,  alt:11000, vel:260, heading:270, flightType:'military', _type:'flight' },
      { icao:'AE7712', callsign:'REACH44',   country:'US',         lng:-118.2, lat:34.1,  alt:9800,  vel:255, heading:90,  flightType:'military', _type:'flight' },
      { icao:'AE0022', callsign:'DRAGON7',   country:'US',         lng:-157.8, lat:21.3,  alt:10200, vel:262, heading:45,  flightType:'military', _type:'flight' },
      { icao:'AEB881', callsign:'HAVOC01',   country:'US',         lng:127.8,  lat:26.3,  alt:9500,  vel:248, heading:20,  flightType:'military', _type:'flight' },
      { icao:'7800AA', callsign:'PLF801',    country:'China',      lng:121.5,  lat:31.2,  alt:8000,  vel:235, heading:90,  flightType:'military', _type:'flight' },
      { icao:'4001F1', callsign:'RRR901',    country:'UK',         lng:-1.5,   lat:52.4,  alt:9000,  vel:240, heading:180, flightType:'military', _type:'flight' },
      // Cargo — global hubs
      { icao:'A06B2A', callsign:'UPS342',    country:'US',         lng:-0.5,   lat:51.5,  alt:11000, vel:255, heading:270, flightType:'cargo', _type:'flight' },
      { icao:'AA1234', callsign:'FDX891',    country:'US',         lng:2.3,    lat:48.8,  alt:10500, vel:248, heading:280, flightType:'cargo', _type:'flight' },
      { icao:'A98BC1', callsign:'GTI201',    country:'US',         lng:13.4,   lat:52.5,  alt:11200, vel:252, heading:90,  flightType:'cargo', _type:'flight' },
      { icao:'A0C3D1', callsign:'UPS847',    country:'US',         lng:-90.2,  lat:36.0,  alt:10800, vel:250, heading:60,  flightType:'cargo', _type:'flight' },
      { icao:'A11233', callsign:'FDX22',     country:'US',         lng:-122.4, lat:37.6,  alt:11200, vel:258, heading:280, flightType:'cargo', _type:'flight' },
      { icao:'A29901', callsign:'UPS19',     country:'US',         lng:-80.2,  lat:25.8,  alt:10600, vel:252, heading:310, flightType:'cargo', _type:'flight' },
      { icao:'B88B01', callsign:'CKS201',    country:'China',      lng:113.3,  lat:23.1,  alt:11000, vel:255, heading:40,  flightType:'cargo', _type:'flight' },
      { icao:'896012', callsign:'SIA8001',   country:'Singapore',  lng:103.8,  lat:1.4,   alt:10800, vel:260, heading:270, flightType:'cargo', _type:'flight' },
      { icao:'A5F210', callsign:'ATN801',    country:'US',         lng:-73.8,  lat:40.6,  alt:9800,  vel:248, heading:180, flightType:'cargo', _type:'flight' },
      // Passenger — global spread
      { icao:'3C6701', callsign:'DLH453',    country:'Germany',    lng:8.5,    lat:48.1,  alt:11000, vel:268, heading:190, flightType:'passenger', _type:'flight' },
      { icao:'400F43', callsign:'BAW103',    country:'UK',         lng:-1.8,   lat:51.5,  alt:10800, vel:262, heading:290, flightType:'passenger', _type:'flight' },
      { icao:'734083', callsign:'THY134',    country:'Turkey',     lng:28.9,   lat:41.0,  alt:9800,  vel:255, heading:320, flightType:'passenger', _type:'flight' },
      { icao:'896080', callsign:'SIA351',    country:'Singapore',  lng:103.9,  lat:1.3,   alt:11200, vel:270, heading:40,  flightType:'passenger', _type:'flight' },
      { icao:'780B12', callsign:'CCA981',    country:'China',      lng:116.4,  lat:39.9,  alt:10500, vel:265, heading:135, flightType:'passenger', _type:'flight' },
      { icao:'4CA244', callsign:'EIN403',    country:'Ireland',    lng:-6.3,   lat:53.4,  alt:10200, vel:258, heading:275, flightType:'passenger', _type:'flight' },
      { icao:'3408A0', callsign:'AFR447',    country:'France',     lng:2.5,    lat:46.2,  alt:11000, vel:265, heading:225, flightType:'passenger', _type:'flight' },
      { icao:'A3C112', callsign:'AAL100',    country:'US',         lng:-73.8,  lat:40.6,  alt:11200, vel:270, heading:60,  flightType:'passenger', _type:'flight' },
      { icao:'A4B221', callsign:'UAL910',    country:'US',         lng:-122.4, lat:37.6,  alt:10800, vel:265, heading:285, flightType:'passenger', _type:'flight' },
      { icao:'A5D334', callsign:'DAL55',     country:'US',         lng:-84.4,  lat:33.6,  alt:11000, vel:268, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'A7F445', callsign:'SWA2301',   country:'US',         lng:-97.0,  lat:32.9,  alt:9500,  vel:255, heading:225, flightType:'passenger', _type:'flight' },
      { icao:'A9A556', callsign:'JBU440',    country:'US',         lng:-80.3,  lat:25.8,  alt:10200, vel:262, heading:310, flightType:'passenger', _type:'flight' },
      { icao:'C00667', callsign:'ACA880',    country:'Canada',     lng:-79.6,  lat:43.7,  alt:10500, vel:260, heading:60,  flightType:'passenger', _type:'flight' },
      { icao:'C11778', callsign:'WJA301',    country:'Canada',     lng:-114.1, lat:51.1,  alt:9800,  vel:255, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'E30189', callsign:'TAM8811',   country:'Brazil',     lng:-46.6,  lat:-23.6, alt:10500, vel:265, heading:45,  flightType:'passenger', _type:'flight' },
      { icao:'E44291', callsign:'GLO1234',   country:'Brazil',     lng:-43.2,  lat:-22.9, alt:9800,  vel:258, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'6C0021', callsign:'MEX311',    country:'Mexico',     lng:-99.1,  lat:19.4,  alt:9500,  vel:252, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'8A0099', callsign:'QFA11',     country:'Australia',  lng:151.2,  lat:-33.9, alt:10800, vel:268, heading:330, flightType:'passenger', _type:'flight' },
      { icao:'8A1199', callsign:'VOZ880',    country:'Australia',  lng:144.9,  lat:-37.8, alt:9500,  vel:255, heading:60,  flightType:'passenger', _type:'flight' },
      { icao:'7C0312', callsign:'KAL802',    country:'South Korea',lng:126.9,  lat:37.5,  alt:11000, vel:270, heading:310, flightType:'passenger', _type:'flight' },
      { icao:'7D0413', callsign:'JAL007',    country:'Japan',      lng:139.7,  lat:35.7,  alt:11200, vel:265, heading:50,  flightType:'passenger', _type:'flight' },
      { icao:'6E0523', callsign:'IGO661',    country:'India',      lng:77.1,   lat:28.6,  alt:9800,  vel:260, heading:225, flightType:'passenger', _type:'flight' },
      { icao:'6F0633', callsign:'AIC101',    country:'India',      lng:72.8,   lat:19.1,  alt:10500, vel:255, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'738011', callsign:'THY7',      country:'Turkey',     lng:32.9,   lat:39.9,  alt:9500,  vel:258, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'740121', callsign:'UAE7',      country:'UAE',        lng:55.4,   lat:25.3,  alt:11000, vel:270, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'741231', callsign:'QTR8',      country:'Qatar',      lng:51.6,   lat:25.3,  alt:10800, vel:265, heading:285, flightType:'passenger', _type:'flight' },
      { icao:'601009', callsign:'ETH501',    country:'Ethiopia',   lng:38.8,   lat:9.0,   alt:10200, vel:258, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'602109', callsign:'KQA100',    country:'Kenya',      lng:36.8,   lat:-1.3,  alt:9800,  vel:252, heading:0,   flightType:'passenger', _type:'flight' },
      // Additional passenger — filling to 120
      { icao:'A1E001', callsign:'AAL789',    country:'US',         lng:-112.0, lat:33.4,  alt:10200, vel:262, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'A2E002', callsign:'UAL44',     country:'US',         lng:-104.9, lat:39.7,  alt:10500, vel:265, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'A3E003', callsign:'AAL55',     country:'US',         lng:-90.2,  lat:29.9,  alt:9800,  vel:258, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'A4E004', callsign:'DAL310',    country:'US',         lng:-77.0,  lat:38.9,  alt:11000, vel:268, heading:45,  flightType:'passenger', _type:'flight' },
      { icao:'A5E005', callsign:'UAL202',    country:'US',         lng:-118.4, lat:34.0,  alt:10800, vel:260, heading:180, flightType:'passenger', _type:'flight' },
      { icao:'A6E006', callsign:'SWA811',    country:'US',         lng:-95.3,  lat:29.9,  alt:9500,  vel:255, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'A7E007', callsign:'AAL1940',   country:'US',         lng:-71.0,  lat:42.3,  alt:10200, vel:262, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'A8E008', callsign:'DAL4501',   country:'US',         lng:-93.2,  lat:44.9,  alt:9800,  vel:258, heading:180, flightType:'passenger', _type:'flight' },
      { icao:'C2E009', callsign:'ACA221',    country:'Canada',     lng:-75.7,  lat:45.4,  alt:10500, vel:260, heading:300, flightType:'passenger', _type:'flight' },
      { icao:'C3E010', callsign:'ACA719',    country:'Canada',     lng:-123.2, lat:49.2,  alt:9800,  vel:255, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'E5E011', callsign:'TAM550',    country:'Brazil',     lng:-51.2,  lat:-30.1, alt:10200, vel:258, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'E6E012', callsign:'LAT800',    country:'Chile',      lng:-70.7,  lat:-33.5, alt:10800, vel:262, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'E7E013', callsign:'ARG901',    country:'Argentina',  lng:-58.4,  lat:-34.6, alt:9500,  vel:255, heading:45,  flightType:'passenger', _type:'flight' },
      { icao:'E8E014', callsign:'AVA301',    country:'Colombia',   lng:-74.1,  lat:4.7,   alt:10200, vel:260, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'6D0015', callsign:'BOA231',    country:'Bolivia',    lng:-68.1,  lat:-16.5, alt:8500,  vel:248, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'4BE016', callsign:'IBE6002',   country:'Spain',      lng:-3.7,   lat:40.5,  alt:11000, vel:270, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'4CF017', callsign:'KLM882',    country:'Netherlands',lng:4.9,    lat:52.3,  alt:10800, vel:265, heading:60,  flightType:'passenger', _type:'flight' },
      { icao:'3D0018', callsign:'SAS902',    country:'Sweden',     lng:18.1,   lat:59.7,  alt:10500, vel:262, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'4480019', callsign:'FIN332',   country:'Finland',    lng:25.0,   lat:60.3,  alt:9800,  vel:255, heading:180, flightType:'passenger', _type:'flight' },
      { icao:'4B3020', callsign:'AUA101',    country:'Austria',    lng:16.4,   lat:48.2,  alt:10200, vel:258, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'4D4021', callsign:'SWR441',    country:'Switzerland',lng:8.6,    lat:47.5,  alt:11000, vel:268, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'3B0022', callsign:'BEL371',    country:'Belgium',    lng:4.5,    lat:50.9,  alt:10500, vel:262, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'480023', callsign:'TAP944',    country:'Portugal',   lng:-9.1,   lat:38.7,  alt:10200, vel:258, heading:60,  flightType:'passenger', _type:'flight' },
      { icao:'3C0024', callsign:'DLH777',    country:'Germany',    lng:9.9,    lat:51.5,  alt:10800, vel:265, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'730025', callsign:'MSD211',    country:'Morocco',    lng:-7.6,   lat:33.6,  alt:9500,  vel:252, heading:45,  flightType:'passenger', _type:'flight' },
      { icao:'600026', callsign:'EAL771',    country:'Egypt',      lng:31.2,   lat:30.1,  alt:10200, vel:258, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'601027', callsign:'MSR801',    country:'Egypt',      lng:30.1,   lat:26.8,  alt:9800,  vel:255, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'710028', callsign:'SVA281',    country:'Saudi Arabia',lng:46.7,  lat:24.7,  alt:11000, vel:265, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'712029', callsign:'FDB441',    country:'UAE',        lng:55.3,   lat:25.0,  alt:10800, vel:268, heading:45,  flightType:'passenger', _type:'flight' },
      { icao:'713030', callsign:'ETD371',    country:'UAE',        lng:54.6,   lat:24.5,  alt:10500, vel:262, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'714031', callsign:'GFA111',    country:'Bahrain',    lng:50.6,   lat:26.2,  alt:9500,  vel:252, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'715032', callsign:'KAC801',    country:'Kuwait',     lng:47.9,   lat:29.2,  alt:10200, vel:258, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'6A0033', callsign:'RWA271',    country:'Rwanda',     lng:30.1,   lat:-1.9,  alt:9800,  vel:252, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'6B0034', callsign:'DAH781',    country:'Algeria',    lng:3.0,    lat:36.7,  alt:10200, vel:258, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'7E0035', callsign:'PIA330',    country:'Pakistan',   lng:67.0,   lat:24.9,  alt:9500,  vel:252, heading:45,  flightType:'passenger', _type:'flight' },
      { icao:'7F0036', callsign:'BBS112',    country:'Bangladesh', lng:90.4,   lat:23.8,  alt:9800,  vel:255, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'800037', callsign:'THA661',    country:'Thailand',   lng:100.5,  lat:13.7,  alt:10500, vel:262, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'801038', callsign:'MAS770',    country:'Malaysia',   lng:101.7,  lat:3.1,   alt:10800, vel:265, heading:45,  flightType:'passenger', _type:'flight' },
      { icao:'802039', callsign:'GIA441',    country:'Indonesia',  lng:106.8,  lat:-6.2,  alt:10200, vel:258, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'803040', callsign:'PAL881',    country:'Philippines',lng:121.0,  lat:14.6,  alt:9800,  vel:255, heading:270, flightType:'passenger', _type:'flight' },
      { icao:'804041', callsign:'VNA601',    country:'Vietnam',    lng:105.9,  lat:21.2,  alt:10500, vel:262, heading:180, flightType:'passenger', _type:'flight' },
      { icao:'7A0042', callsign:'CSN501',    country:'China',      lng:108.9,  lat:34.3,  alt:10800, vel:265, heading:90,  flightType:'passenger', _type:'flight' },
      { icao:'7B0043', callsign:'CES601',    country:'China',      lng:120.2,  lat:30.3,  alt:11000, vel:268, heading:315, flightType:'passenger', _type:'flight' },
      { icao:'7C0044', callsign:'KAL331',    country:'South Korea',lng:129.1,  lat:35.2,  alt:10500, vel:262, heading:180, flightType:'passenger', _type:'flight' },
      { icao:'8B0045', callsign:'ANZ881',    country:'New Zealand',lng:174.8,  lat:-36.9, alt:10800, vel:265, heading:330, flightType:'passenger', _type:'flight' },
      { icao:'8C0046', callsign:'QFA55',     country:'Australia',  lng:153.0,  lat:-27.5, alt:9800,  vel:255, heading:270, flightType:'passenger', _type:'flight' },
      // Additional military
      { icao:'AEF901', callsign:'USAF501',   country:'US',         lng:-80.2,  lat:32.0,  alt:9500,  vel:248, heading:90,  flightType:'military', _type:'flight' },
      { icao:'AEF902', callsign:'NAVY701',   country:'US',         lng:-117.2, lat:32.7,  alt:8000,  vel:240, heading:270, flightType:'military', _type:'flight' },
      { icao:'AEF903', callsign:'BOXER11',   country:'US',         lng:-64.8,  lat:17.9,  alt:10500, vel:255, heading:315, flightType:'military', _type:'flight' },
      { icao:'4002F1', callsign:'RAF771',    country:'UK',         lng:-1.8,   lat:51.4,  alt:8500,  vel:242, heading:270, flightType:'military', _type:'flight' },
      { icao:'3901F0', callsign:'FAF881',    country:'France',     lng:2.1,    lat:47.9,  alt:9000,  vel:244, heading:180, flightType:'military', _type:'flight' },
      { icao:'7801AB', callsign:'PLF901',    country:'China',      lng:110.4,  lat:20.1,  alt:7500,  vel:235, heading:270, flightType:'military', _type:'flight' },
      { icao:'7802AB', callsign:'PLN102',    country:'China',      lng:122.1,  lat:30.8,  alt:8000,  vel:238, heading:90,  flightType:'military', _type:'flight' },
      // Additional cargo
      { icao:'A1F010', callsign:'FDX330',    country:'US',         lng:-90.1,  lat:35.0,  alt:10800, vel:252, heading:270, flightType:'cargo', _type:'flight' },
      { icao:'A2F011', callsign:'UPS910',    country:'US',         lng:-85.7,  lat:38.2,  alt:11200, vel:255, heading:90,  flightType:'cargo', _type:'flight' },
      { icao:'A3F012', callsign:'ABX801',    country:'US',         lng:-84.0,  lat:39.9,  alt:10500, vel:250, heading:315, flightType:'cargo', _type:'flight' },
      { icao:'A4F013', callsign:'GTI440',    country:'US',         lng:-73.8,  lat:40.7,  alt:11000, vel:255, heading:60,  flightType:'cargo', _type:'flight' },
      { icao:'B8F014', callsign:'CKS881',    country:'China',      lng:116.5,  lat:40.1,  alt:10800, vel:252, heading:270, flightType:'cargo', _type:'flight' },
      { icao:'B9F015', callsign:'YZR201',    country:'China',      lng:121.4,  lat:31.3,  alt:10500, vel:250, heading:180, flightType:'cargo', _type:'flight' },
      { icao:'E9F016', callsign:'LAN993',    country:'Chile',      lng:-70.6,  lat:-33.4, alt:10200, vel:248, heading:90,  flightType:'cargo', _type:'flight' },
      { icao:'3CF017', callsign:'DHL441',    country:'Germany',    lng:6.1,    lat:50.9,  alt:10800, vel:252, heading:270, flightType:'cargo', _type:'flight' },
      { icao:'4AF018', callsign:'TNT221',    country:'Belgium',    lng:5.4,    lat:50.6,  alt:10500, vel:250, heading:315, flightType:'cargo', _type:'flight' },
      { icao:'897019', callsign:'SIL8801',   country:'Singapore',  lng:104.0,  lat:1.4,   alt:11000, vel:255, heading:90,  flightType:'cargo', _type:'flight' },
    ];
  }
  _showFlightBadge(flightsVisible);
  if (flightsVisible) updateAllGlobeElements();
}

function _setFlightBadge(isLive) {
  const badge = document.getElementById('flight-data-badge');
  const lbl   = document.getElementById('fdb-label');
  if (!badge) return;
  badge.className = isLive ? 'live' : 'sim';
  lbl.textContent = isLive ? 'LIVE ADS-B' : 'SIM DATA';
}

function _showFlightBadge(show) {
  const badge = document.getElementById('flight-data-badge');
  if (badge) badge.style.display = show ? 'flex' : 'none';
}

function toggleFlights() {
  flightsVisible = !flightsVisible;
  document.getElementById('lc-flights').classList.toggle('on', flightsVisible);
  if (flightsVisible) {
    fetchFlights();
    _flightTimer = setInterval(fetchFlights, 90000);
  } else {
    clearInterval(_flightTimer);
    _showFlightBadge(false);
    updateAllGlobeElements();
  }
}

// ═══════════════════════════════════════════
// B3 — SUBSURFACE NETWORK PULSE
// Uses globe.gl pathsData (surface paths) instead of arcsData so cables
// hug the earth and follow sea-route waypoints. Points are [lng, lat].
// ═══════════════════════════════════════════
const _CABLE_PALETTE = [
  '#00e5ffdd','#26c6dadd','#4fc3f7dd','#00b8d9dd','#80deeadd',
  '#29b6f6dd','#4dd0e1dd','#0288d1dd','#0097a7dd','#00838fdd',
];

const _STATIC_CABLE_ROUTES = [
  // ── TRANSATLANTIC ────────────────────────────────
  [[-0.1,51.5],[-4,50],[-15,47],[-30,43],[-50,40],[-74.0,40.7]],
  [[-4.5,48.4],[-10,47],[-20,44],[-40,42],[-65,40],[-74.0,40.7]],
  [[-8.5,43.3],[-12,41],[-20,37],[-40,36],[-65,37],[-77.0,38.9]],
  [[12.5,55.7],[5,55],[-5,53],[-15,51],[-35,47],[-60,43],[-74.0,40.7]],
  [[-0.1,51.5],[-5,45],[-10,35],[-15,25],[-17.4,14.7]],
  [[-74.0,40.7],[-35,38],[-25.7,37.9]],
  // ── TRANSPACIFIC ─────────────────────────────────
  [[-122.4,37.8],[-135,40],[-150,42],[-165,40],[-175,37],[139.7,35.7]],
  [[-122.4,37.8],[-135,32],[-148,26],[-157.8,21.3]],
  [[-157.8,21.3],[-165,24],[-175,30],[139.7,35.7]],
  [[-118.2,34.0],[-130,28],[-150,18],[-165,5],[-175,-15],[151.2,-33.9]],
  [[-118.2,34.0],[-125,30],[-140,25],[-162,20],[-175,15],[114.2,22.3]],
  [[-122.3,47.6],[-130,45],[-145,42],[-160,40],[139.7,35.7]],
  [[139.7,35.7],[140,25],[145,10],[150,0],[151.2,-33.9]],
  [[139.7,35.7],[145,30],[155,15],[165,0],[170,-20],[174.8,-41.3]],
  [[-118.2,34.0],[-125,22],[-140,10],[-155,0],[-73.0,-36.8]],
  // ── INDIAN OCEAN ─────────────────────────────────
  [[72.9,19.1],[79,10],[82,5],[103.8,1.35]],
  [[-4.5,48.4],[5,38],[25,33],[37,20],[48,14],[72.9,19.1]],
  [[103.8,1.35],[80,8],[55,14],[55.3,25.2]],
  [[72.9,19.1],[60,15],[50,13],[43,11.6]],
  [[57.5,-20.2],[40,-28],[18.5,-33.9]],
  [[55.3,25.2],[45,22],[38,15],[35,27],[31.2,30.0]],
  [[72.9,19.1],[65,-10],[57.5,-20.2]],
  // ── EAST ASIA ────────────────────────────────────
  [[139.7,35.7],[130,30],[123,25],[114.2,22.3]],
  [[114.2,22.3],[112,15],[108,8],[103.8,1.35]],
  [[126.9,37.5],[130,35],[133,34],[139.7,35.7]],
  [[126.9,37.5],[123,30],[120,26],[114.2,22.3]],
  [[103.8,1.35],[90,5],[80.3,13.1]],
  [[103.8,1.35],[105,-3],[106.8,-6.2]],
  // ── AFRICA ───────────────────────────────────────
  [[-0.1,51.5],[-5,40],[-10,30],[-15,18],[-10,5],[5,-10],[18.5,-33.9]],
  [[36.8,-1.3],[40,5],[43,12],[40,18],[35,25],[31.2,30.0]],
  [[36.8,-1.3],[35,-15],[33,-25],[18.5,-33.9]],
  [[18.5,-33.9],[8,-36],[-5,-38],[-20,-38],[-46.6,-23.5]],
  [[-17.4,14.7],[-15,25],[-10,36],[-5,44],[-0.1,51.5]],
  [[31.2,30.0],[25,33],[15,37],[5,40],[0,43],[-0.1,51.5]],
  // ── AMERICAS ─────────────────────────────────────
  [[-74.0,40.7],[-60,30],[-48,15],[-40,5],[-46.6,-23.5]],
  [[-80.2,25.8],[-68,15],[-53,5],[-46.6,-23.5]],
  [[-66.1,18.5],[-58,12],[-48,5],[-46.6,-23.5]],
  [[-46.6,-23.5],[-50,-30],[-58.4,-34.6]],
  [[-74.0,40.7],[-68,25],[-66.9,10.5]],
  // ── EUROPE ───────────────────────────────────────
  [[-0.1,51.5],[1,51],[2.3,48.8]],
  [[-0.1,51.5],[2,52],[4.9,52.4]],
  [[12.5,55.7],[10,57],[10.7,59.9]],
  [[10.7,59.9],[15,60],[20,61],[24.9,60.2]],
  [[24.9,60.2],[24,57],[24.1,56.9]],
  // ── ARCTIC ───────────────────────────────────────
  [[10.7,59.9],[0,65],[-20,68],[-50,70],[-100,71],[-156.8,71.2]],
  // ── AUSTRALIA / PACIFIC ──────────────────────────
  [[151.2,-33.9],[160,-35],[170,-36],[174.7,-36.8]],
  [[151.2,-33.9],[162,-28],[170,-22],[178,-18],[-170,-17],[-149.5,-17.7]],
  [[174.8,-41.3],[178,-35],[-170,-28],[-160,-22],[-149.5,-17.7]],
  [[168.3,-17.8],[162,-22],[156,-28],[151.2,-33.9]],
];

function _buildStaticCablePaths() {
  cablePaths = _STATIC_CABLE_ROUTES.map((pts, i) => ({
    pts,
    c1: _CABLE_PALETTE[i % _CABLE_PALETTE.length],
    _cable: true,
  }));
}

// Merged path renderer — always includes: country borders + DMZ lines; cables when toggled on
function refreshAllPaths() {
  if (!G || typeof G.pathsData !== 'function') return;
  const dmz     = (typeof _dmzGlobePaths !== 'undefined') ? _dmzGlobePaths : [];
  const borders = (typeof borderPaths !== 'undefined') ? borderPaths : [];
  const all     = [...borders, ...dmz, ...cablePaths];
  G.pathsData(all)
    .pathPoints(d => d.pts)
    .pathPointLat(p => p[1])
    .pathPointLng(p => p[0])
    .pathPointAlt(p => p.length > 2 ? p[2] : 0)
    .pathColor(d => d._disrupted ? '#FF3B30' : d.c1)
    .pathStroke(d => d._dmz ? 1.4 : d._border ? 0.5 : 0.6)
    .pathDashLength(d => d._dmz ? 0.3 : (d._border || d._cable) ? 1.0 : 0.4)
    .pathDashGap(d => d._dmz ? 0.08 : 0)
    .pathDashAnimateTime(0);
}

function refreshCablePaths() { refreshAllPaths(); }

async function fetchAndBuildCablePaths() {
  if (_cablesFetched) return;
  _cablesFetched = true;
  document.getElementById('lc-cables').textContent = '…CABLES';
  try {
    const r = await fetchWithTimeout('https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/public/api/v3/cable/cable-geo.json', 10000);
    const data = await r.json();
    const livePaths = [];
    for (const feat of (data.features||[])) {
      if (!feat.geometry) continue;
      // Each segment is a full coordinate array [lng, lat] — use as-is for pathsData
      const allLines = feat.geometry.type === 'MultiLineString'
        ? feat.geometry.coordinates
        : [feat.geometry.coordinates];
      const idx = (feat.properties?.name||'').split('').reduce((h,c)=>h+c.charCodeAt(0),0) % 10;
      for (const line of allLines) {
        if (!line || line.length < 2) continue;
        livePaths.push({ pts: line, c1: _CABLE_PALETTE[idx], _cable: true });
      }
    }
    // Only replace static paths if live data has valid routes
    if (livePaths.length > 0) {
      cablePaths = livePaths;
      if (cablesVisible) refreshCablePaths();
    }
  } catch(e) {
    console.warn('[MERIDIAN cables] TeleGeography fetch failed:', e.message);
  }
  document.getElementById('lc-cables').innerHTML = '<span class="lc-pip"></span>CABLES';
}

function toggleCables() {
  cablesVisible = !cablesVisible;
  document.getElementById('lc-cables').classList.toggle('on', cablesVisible);
  if (cablesVisible) {
    _buildStaticCablePaths();
    refreshCablePaths();
    if (!_cablesFetched) fetchAndBuildCablePaths();
  } else {
    cablePaths = [];
    refreshCablePaths();
  }
}

// ═══════════════════════════════════════════
// A2 — NARRATIVE DIVERGENCE RADAR
// ═══════════════════════════════════════════
const DIV_SOURCES = {
  western: { names:['Reuters','AP','BBC','Guardian','FT','NYT','WSJ','Bloomberg','CNN','Politico','WIRED','Axios','NPR'], color:'#0A84FF', lat:51.5, lng:-0.1 },
  chinese: { names:['Xinhua','CGTN','Global Times','Caixin','China Daily','SCMP','South China Morning Post'], color:'#FF2D55', lat:39.9, lng:116.4 },
  russian: { names:['RT','TASS','Interfax','RIA','Sputnik','Novosti'], color:'#FF9F0A', lat:55.8, lng:37.6 },
};

function extractTermFreq(stories) {
  const freq = {};
  const stop = new Set(['the','a','an','in','on','at','to','for','of','and','is','was','has','by','with','from','are','be','been','this','that','it','its','not','will','or','as','we','have','they','their','new','said','over','also','after','about','into','more','than','been','would','could','when','who','how','what','which','were','had','have','did','do','but','says','say','per','up','out','one','two','three','can','its']);
  for (const s of stories) {
    const words = (s.title+' '+(s.summary||'')).toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(w=>w.length>4&&!stop.has(w));
    for (const w of words) freq[w] = (freq[w]||0)+1;
  }
  return freq;
}

function cosineSim(a, b) {
  const keys = [...new Set([...Object.keys(a),...Object.keys(b)])];
  let dot=0,mA=0,mB=0;
  for (const k of keys) { const va=a[k]||0,vb=b[k]||0; dot+=va*vb; mA+=va*va; mB+=vb*vb; }
  return (mA&&mB) ? dot/(Math.sqrt(mA)*Math.sqrt(mB)) : 0;
}

function toggleDivergence() {
  divergenceVisible = !divergenceVisible;
  document.getElementById('lc-diverge').classList.toggle('on', divergenceVisible);
  document.getElementById('div-panel').classList.toggle('on', divergenceVisible);
  if (divergenceVisible) computeAndRenderDivergence();
  else { divergeArcs = []; refreshArcs(); }
}

function computeAndRenderDivergence() {
  const groups = { western:[], chinese:[], russian:[] };
  for (const s of NEWS) {
    for (const [k, cfg] of Object.entries(DIV_SOURCES)) {
      if (cfg.names.some(n => s.src.toLowerCase().includes(n.toLowerCase()))) groups[k].push(s);
    }
  }
  const freqs = {};
  for (const k of Object.keys(groups)) freqs[k] = extractTermFreq(groups[k]);

  const wc = Math.round((1 - cosineSim(freqs.western||{}, freqs.chinese||{}))*100);
  const wr = Math.round((1 - cosineSim(freqs.western||{}, freqs.russian||{}))*100);
  const cr = Math.round((1 - cosineSim(freqs.chinese||{}, freqs.russian||{}))*100);

  // Render panel
  document.getElementById('div-pairs').innerHTML = [
    { k1:'western', k2:'chinese', pct:wc },
    { k1:'western', k2:'russian', pct:wr },
    { k1:'chinese', k2:'russian', pct:cr },
  ].map(({k1,k2,pct}) => `
    <div class="div-pair">
      <span class="div-lbl" style="color:${DIV_SOURCES[k1].color}">${k1.toUpperCase()}</span>
      <div class="div-bar"><div class="div-fill" style="width:${pct}%;background:linear-gradient(90deg,${DIV_SOURCES[k1].color},${DIV_SOURCES[k2].color})"></div></div>
      <span class="div-lbl" style="color:${DIV_SOURCES[k2].color}">${k2.toUpperCase()}</span>
      <span class="div-pct">${pct}%</span>
    </div>`).join('');

  document.getElementById('div-counts').innerHTML = Object.entries(groups)
    .map(([k,arr]) => `<span style="color:${DIV_SOURCES[k].color}">${k.toUpperCase()}: ${arr.length}</span>`).join(' · ');

  // Top divergent terms (words in one but not other)
  const wKeys = Object.keys(freqs.western||{}).filter(w=>(freqs.western[w]||0)>1&&!(freqs.chinese||{})[w]&&!(freqs.russian||{})[w]).slice(0,6);
  const cKeys = Object.keys(freqs.chinese||{}).filter(w=>(freqs.chinese[w]||0)>1&&!(freqs.western||{})[w]).slice(0,4);
  document.getElementById('div-top-words').innerHTML = [
    ...wKeys.map(w=>`<span class="div-word" style="color:#0A84FF">${w}</span>`),
    ...cKeys.map(w=>`<span class="div-word" style="color:#FF2D55">${w}</span>`),
  ].join('');

  // Fracture arcs on globe
  divergeArcs = [
    { slat:DIV_SOURCES.western.lat, slng:DIV_SOURCES.western.lng, elat:DIV_SOURCES.chinese.lat, elng:DIV_SOURCES.chinese.lng, c1:'#0A84FF88', c2:'#FF2D5518', _diverge:true },
    { slat:DIV_SOURCES.western.lat, slng:DIV_SOURCES.western.lng, elat:DIV_SOURCES.russian.lat, elng:DIV_SOURCES.russian.lng, c1:'#0A84FF88', c2:'#FF9F0A18', _diverge:true },
    { slat:DIV_SOURCES.chinese.lat, slng:DIV_SOURCES.chinese.lng, elat:DIV_SOURCES.russian.lat, elng:DIV_SOURCES.russian.lng, c1:'#FF2D5566', c2:'#FF9F0A18', _diverge:true },
  ];
  refreshArcs();
}

// ═══════════════════════════════════════════
// A1 — CASCADE PREDICTOR
const CASCADE_TEMPLATES = [
  // Political / Civil
  { name:'ARAB SPRING',             kw:['protest','regime','revolution','uprising','government falls','military coup','demonstrators','mass protest','crackdown','dictator','authoritarian'], spread:[[-1.3,36.8],[15.6,32.5],[30.0,31.2],[36.8,10.2],[33.9,35.5]], color:'#FF2D55' },
  { name:'DEMOCRATIC BACKSLIDE',    kw:['election fraud','stolen election','emergency powers','press freedom','judiciary purge','political prisoner','opposition arrested','censorship','rigged','autocracy','constitutional crisis'], spread:[[47.0,28.9],[52.2,21.0],[44.4,26.1],[51.5,-0.1],[55.8,37.6]], color:'#FF6D00' },
  { name:'SEPARATIST CASCADE',      kw:['independence referendum','secession','autonomous region','self-determination','ethnic cleansing','minority rights','federal collapse','breakaway','partition'], spread:[[44.8,20.5],[42.9,47.5],[41.7,44.8],[40.4,-3.7],[45.4,12.3]], color:'#FF2D55' },
  { name:'REFUGEE CRISIS',          kw:['refugee','displaced','border crossing','asylum seekers','humanitarian corridor','camp overwhelmed','migration surge','internally displaced','stateless'], spread:[[36.3,43.1],[41.0,28.9],[50.8,4.3],[48.1,11.6],[53.3,14.5]], color:'#B7950B' },
  // Military / Security
  { name:'GREAT POWER ESCALATION',  kw:['military exercises','nuclear threat','carrier group','troop deployment','missile launch','territorial violation','hypersonic','naval blockade','air defense','strategic bomber'], spread:[[39.9,116.4],[55.8,37.6],[40.7,-74.0],[51.5,-0.1],[35.7,139.7]], color:'#FF9F0A' },
  { name:'NUCLEAR STANDOFF',        kw:['nuclear warning','nuclear posture','launch on warning','first strike','dead hand','mutual assured','tactical nuclear','icbm','nuclear submarine','warhead','radiation','fallout'], spread:[[55.8,37.6],[39.9,116.4],[40.7,-74.0],[28.6,77.2],[33.7,73.1]], color:'#FF2D55' },
  { name:'TERROR WAVE',             kw:['terrorist attack','suicide bomber','isis','al-qaeda','jihad','sleeper cell','mass casualty','bomb blast','shooting spree','lone wolf attack','radicalization'], spread:[[48.9,2.3],[51.5,-0.1],[52.5,13.4],[41.9,12.5],[40.4,-3.7]], color:'#FF2D55' },
  { name:'CIVIL WAR IGNITION',      kw:['civil war','armed militia','rebel advance','capital siege','government forces','ceasefire collapsed','factions','warlord','sectarian violence','ethnic conflict'], spread:[[15.6,32.5],[6.3,2.4],[33.9,35.5],[36.2,37.2],[15.3,38.9]], color:'#FF6D00' },
  { name:'NAVAL CONFRONTATION',     kw:['naval standoff','strait blockade','warship confrontation','disputed waters','freedom of navigation','maritime exclusion','submarine detected','coast guard vessel','maritime border'], spread:[[22.3,114.2],[24.5,121.6],[35.5,129.8],[1.3,103.8],[10.8,106.7]], color:'#2979FF' },
  { name:'CYBER WARFARE CASCADE',   kw:['cyberattack','infrastructure hack','power grid attack','ransomware','state-sponsored hackers','critical infrastructure','ddos','malware','data breach','cyber espionage','supply chain attack'], spread:[[55.8,37.6],[39.9,116.4],[40.7,-74.0],[51.5,-0.1],[52.5,13.4]], color:'#30D158' },
  // Economic / Financial
  { name:'FINANCIAL CONTAGION',     kw:['bank run','deposits frozen','collapse','credit crunch','liquidity crisis','bailout','insolvency','sovereign debt','currency crisis','capital flight','market crash'], spread:[[51.5,-0.1],[48.9,2.3],[40.7,-74.0],[35.7,139.7],[22.3,114.2]], color:'#FFD60A' },
  { name:'CURRENCY COLLAPSE',       kw:['hyperinflation','currency devaluation','exchange rate crisis','foreign reserves depleted','imf bailout','dollarization','capital controls','inflation spiral','debt default'], spread:[[40.7,-74.0],[51.5,-0.1],[48.9,2.3],[-34.6,-58.4],[-15.8,-47.9]], color:'#FFD60A' },
  { name:'ENERGY SUPPLY SHOCK',     kw:['pipeline disruption','oil embargo','gas cutoff','opec reduction','energy crisis','supply cut','price spike','lng shortage','fuel rationing','energy weaponization'], spread:[[24.7,46.7],[55.8,37.6],[51.5,-0.1],[40.7,-74.0],[35.7,139.7]], color:'#FF9F0A' },
  { name:'FOOD SECURITY COLLAPSE',  kw:['famine','food prices surge','grain export ban','drought','crop failure','food shortage','starvation','malnutrition','wfp','agricultural collapse','food insecurity'], spread:[[15.6,32.5],[9.0,38.8],[-1.3,36.8],[13.5,2.1],[14.7,-17.5]], color:'#B7950B' },
  { name:'SUPPLY CHAIN FRACTURE',   kw:['port congestion','shipping delay','semiconductor shortage','critical minerals','rare earth','trade disruption','export controls','manufacturing halt','logistics breakdown','chokepoint'], spread:[[31.2,121.5],[1.3,103.8],[22.3,114.2],[37.5,127.0],[35.7,139.7]], color:'#FFD60A' },
  { name:'SANCTIONS SPIRAL',        kw:['sanctions escalation','sanctions package','asset freeze','swift exclusion','export ban','technology embargo','secondary sanctions','sanctions evasion','sanctioned entity'], spread:[[55.8,37.6],[35.7,51.4],[39.9,116.4],[40.7,-74.0],[51.5,-0.1]], color:'#2979FF' },
  // Health / Environmental
  { name:'PANDEMIC SPREAD',         kw:['outbreak','virus','cases surging','hospital overwhelmed','containment','quarantine','lockdown','pathogen','zoonotic','epidemic','who emergency','disease spread'], spread:[[30.6,114.3],[35.7,139.7],[48.9,2.3],[40.7,-74.0],[-33.9,151.2]], color:'#30D158' },
  { name:'CLIMATE CRISIS TIPPING',  kw:['flooding','drought emergency','wildfire','heatwave','glacier melt','sea level','climate refugee','crop collapse','water scarcity','extreme weather','carbon tipping point'], spread:[[-33.9,151.2],[40.7,-74.0],[-15.8,-47.9],[28.6,77.2],[1.3,36.8]], color:'#00BCD4' },
  { name:'NUCLEAR / RADIOLOGICAL',  kw:['radiation leak','meltdown','nuclear plant','radioactive','contamination','exclusion zone','dosimeter','reactor failure','dirty bomb','iaea alert','nuclear accident'], spread:[[51.4,30.1],[35.7,139.7],[48.8,2.3],[55.8,37.6],[40.7,-74.0]], color:'#FF9F0A' },
  // Intelligence / Information
  { name:'DISINFORMATION CAMPAIGN', kw:['propaganda','disinformation','deepfake','fake news','information warfare','narrative manipulation','sockpuppet','coordinated inauthentic','psyop','troll farm','election interference'], spread:[[55.8,37.6],[39.9,116.4],[40.7,-74.0],[48.9,2.3],[51.5,-0.1]], color:'#A78BFA' },
  { name:'INTELLIGENCE LEAK',       kw:['leaked documents','classified leak','whistleblower','intelligence failure','spy network','covert operation exposed','diplomatic cables','signals intelligence','source burned','nsa','cia','mi6'], spread:[[40.7,-74.0],[51.5,-0.1],[55.8,37.6],[48.9,2.3],[35.7,139.7]], color:'#A78BFA' },
  // Regional Specific
  { name:'TAIWAN STRAIT CRISIS',    kw:['taiwan','strait','pla','amphibious','invasion','blockade','chip','tsmc','one china','cross-strait','reunification by force'], spread:[[23.7,121.0],[39.9,116.4],[35.7,139.7],[37.5,127.0],[40.7,-74.0]], color:'#FF9F0A' },
  { name:'MIDDLE EAST ESCALATION',  kw:['hezbollah','hamas','iran nuclear','houthi','red sea attack','gulf of hormuz','oil tanker','irgc','proxy war','lebanese','israeli strike'], spread:[[31.8,35.2],[33.9,35.5],[32.1,34.8],[35.7,51.4],[24.7,46.7]], color:'#FF2D55' },
  { name:'UKRAINE WAR SPILLOVER',   kw:['ukraine','zaporizhzhia','kharkiv','odessa','dnipro','kyiv','russia offensive','nato article 5','escalation corridor','drone strike','occupied territory','frontline'], spread:[[50.4,30.5],[52.2,21.0],[55.8,37.6],[52.5,13.4],[51.5,-0.1]], color:'#FF6D00' },
  { name:'KOREAN PENINSULA CRISIS', kw:['north korea','kim jong','icbm test','pyongyang','demilitarized zone','nuclear program','hwasong','south korea','us forces korea','reunification','regime collapse'], spread:[[39.0,125.8],[37.5,127.0],[35.7,139.7],[40.7,-74.0],[22.3,114.2]], color:'#FF9F0A' },
  { name:'ARCTIC SOVEREIGNTY',      kw:['arctic','northwest passage','svalbard','ice shelf','polar military','arctic council','resource rights','polar route','undersea cable arctic','permafrost'], spread:[[55.8,37.6],[40.7,-74.0],[51.5,-0.1],[60.5,-151.0],[69.6,18.9]], color:'#00BCD4' },
];

function toggleCascade() {
  cascadeVisible = !cascadeVisible;
  document.getElementById('lc-cascade').classList.toggle('on', cascadeVisible);
  if (cascadeVisible) runCascadeAnalysis();
  else {
    document.getElementById('cascade-widget').style.display = 'none';
    cascadeArcsArr = [];
    refreshArcs();
  }
}

function runCascadeAnalysis() {
  const text = NEWS.map(s=>(s.title+' '+(s.summary||'')).toLowerCase()).join(' ');
  let best = null, bestScore = 0;
  for (const t of CASCADE_TEMPLATES) {
    const score = t.kw.filter(k=>text.includes(k)).length / t.kw.length;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  const confidence = bestScore === 0 ? 0 : Math.min(94, Math.round(bestScore * 130 + 12));
  const w = document.getElementById('cascade-widget');
  w.style.display = 'block';
  document.getElementById('cascade-match').textContent = best?.name || 'NO PATTERN MATCH';
  document.getElementById('cascade-match').style.color  = best?.color || '#8A93C8';
  document.getElementById('cascade-conf').textContent   = `${confidence}% CONFIDENCE`;
  document.getElementById('cascade-conf').style.color   = best?.color || '#8A93C8';

  if (G && best) {
    const origin = NEWS.find(s => best.kw.some(k=>(s.title+' '+(s.summary||'')).toLowerCase().includes(k)));
    if (origin) {
      cascadeArcsArr = best.spread.map(([lat,lng]) => ({
        slat:origin.lat, slng:origin.lng, elat:lat, elng:lng,
        c1:best.color+'bb', c2:best.color+'11', _cascade:true,
      }));
      refreshArcs();
    }
  }
}

// ═══════════════════════════════════════════
// A3 — SILENCE ANOMALY DETECTION
// ═══════════════════════════════════════════
const SILENCE_KEY  = 'auspex_silence_v1';

const KNOWN_ACTIVE_REGIONS = [
  { region:'North Korea', lat:40.3, lng:127.5 },
  { region:'Eastern Ukraine', lat:48.5, lng:36.7 },
  { region:'Gaza Strip', lat:31.35, lng:34.3 },
  { region:'Myanmar', lat:19.8, lng:96.1 },
  { region:'Sudan', lat:15.6, lng:32.5 },
];

function updateSilenceBaseline() {
  const bl = JSON.parse(localStorage.getItem(SILENCE_KEY)||'{}');
  const day = Math.floor(Date.now()/86400000);
  const counts = {};
  NEWS.forEach(s => { if(s.region) counts[s.region]=(counts[s.region]||0)+1; });
  bl[day] = { ...bl[day], ...counts };
  Object.keys(bl).filter(k=>+k<day-7).forEach(k=>delete bl[k]);
  localStorage.setItem(SILENCE_KEY, JSON.stringify(bl));
}

function detectSilenceAnomalies() {
  const bl = JSON.parse(localStorage.getItem(SILENCE_KEY)||'{}');
  const days = Object.values(bl);
  const current = {};
  NEWS.forEach(s => { if(s.region) current[s.region]=(current[s.region]||0)+1; });

  const anomalies = [];

  if (days.length >= 2) {
    const avg = {};
    for (const d of days) { for (const [r,c] of Object.entries(d)) avg[r]=(avg[r]||0)+c; }
    Object.keys(avg).forEach(k => avg[k] /= days.length);
    for (const [region, a] of Object.entries(avg)) {
      if (a < 2) continue;
      const cur = current[region]||0;
      if (cur < a * 0.25) {
        const coords = extractCoords(region);
        if (coords) anomalies.push({ region, lat:coords[0], lng:coords[1], severity:cur===0?'HIGH':'ELEVATED', reason:`Coverage ${Math.round((1-cur/a)*100)}% below 7-day baseline` });
      }
    }
  }

  // Always include known persistent blackout regions if no news this session
  for (const k of KNOWN_ACTIVE_REGIONS) {
    if (!anomalies.find(a=>a.region===k.region) && !(current[k.region])) {
      anomalies.push({ ...k, severity:'HIGH', reason:'Persistent information blackout — no coverage detected' });
    }
  }
  return anomalies.slice(0,6);
}

function toggleSilence() {
  silenceVisible = !silenceVisible;
  document.getElementById('lc-silence').classList.toggle('on', silenceVisible);
  const ov = document.getElementById('silence-overlay');
  ov.classList.toggle('on', silenceVisible);
  if (silenceVisible) {
    updateSilenceBaseline();
    renderSilenceAnomalies(detectSilenceAnomalies());
  } else {
    ov.innerHTML = '';
    updateAllGlobeElements();
  }
}

function renderSilenceAnomalies(anomalies) {
  const ov = document.getElementById('silence-overlay');
  const handle = '<div class="sl-handle">◉ SILENCE MONITOR<span class="sl-grip">⠿</span></div>';
  if (!anomalies.length) {
    ov.innerHTML = handle + '<div class="sl-clear">◉ ALL REGIONS REPORTING NORMALLY</div>';
  } else {
    ov.innerHTML = handle + anomalies.map(a => `
      <div class="sl-alert ${a.severity==='HIGH'?'sl-high':'sl-elevated'}">
        <div class="sl-icon">◉</div>
        <div>
          <div class="sl-title">INFORMATION BLACKOUT DETECTED</div>
          <div class="sl-region">${a.region.toUpperCase()}</div>
          <div class="sl-reason">${a.reason}</div>
        </div>
      </div>`).join('');
  }
  // Re-init drag each render (handle element is rebuilt)
  ov._dragInit = false;
  const handleEl = ov.querySelector('.sl-handle');
  if (handleEl) _makePanelDraggable(ov, handleEl);
  // Add blackout void markers to globe
  _silenceAnomalies = anomalies;
  updateAllGlobeElements();
}


// ═══════════════════════════════════════════
// B1 — ORBITAL THREAT RINGS (enhanced mode)
function toggleThreats() {
  threatsVisible = !threatsVisible;
  document.getElementById('lc-threats').classList.toggle('on', threatsVisible);
  const panel = document.getElementById('threats-panel');
  panel.classList.toggle('on', threatsVisible);
  if (threatsVisible) {
    renderThreatsPanel();
    // Init drag after panel is visible so getBoundingClientRect is correct
    const handle = panel.querySelector('.thr-hdr');
    if (handle) _makePanelDraggable(panel, handle);
  }
  updateAllGlobeElements();
}

function renderThreatsPanel() {
  const panel = document.getElementById('thr-list');
  if (!panel) return;

  // Score each story for US threat relevance
  const US_KEYWORDS = ['united states','us ','u.s.','washington','pentagon','cia','nato','american','congress','white house','federal reserve','dollar','treasury','sanctions','tariff','trade war','nuclear','missile','carrier','troops','invasion','escalat','conflict','war','attack','terror','cyber','hack','supply chain','china','russia','iran','north korea','taiwan','ukraine'];

  function scoreStory(s) {
    let score = 0;
    const text = ((s.title || '') + ' ' + (s.summary || '') + ' ' + (s.region || '')).toLowerCase();
    if (s.brk) score += 30;
    if (s.cat === 'military') score += 20;
    if (s.cat === 'geo') score += 15;
    if (s.cat === 'finance') score += 8;
    US_KEYWORDS.forEach(kw => { if (text.includes(kw)) score += 5; });
    return score;
  }

  function threatLevel(s, score) {
    if (s.brk || score >= 60) return 'critical';
    if (s.cat === 'military' || score >= 40) return 'high';
    return 'elevated';
  }

  const pool = (typeof NEWS !== 'undefined' ? NEWS : [])
    .filter(s => s.cat === 'military' || s.cat === 'geo' || s.cat === 'finance' || s.brk)
    .map(s => ({ s, score: scoreStory(s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!pool.length) {
    panel.innerHTML = '<div style="padding:18px 16px;font-family:var(--f-mono);font-size:8px;color:var(--t3);letter-spacing:.1em">NO ACTIVE THREATS DETECTED</div>';
    return;
  }

  panel.innerHTML = pool.map(({ s, score }, i) => {
    const lvl = threatLevel(s, score);
    const lvlLabel = lvl === 'critical' ? 'CRITICAL' : lvl === 'high' ? 'HIGH' : 'ELEVATED';
    const cat = (typeof CATS !== 'undefined' && CATS[s.cat]) ? CATS[s.cat].label : (s.cat || '').toUpperCase();
    const title = s.title ? (s.title.length > 60 ? s.title.slice(0, 58) + '…' : s.title) : '';
    return `<div class="thr-item">
      <div class="thr-rank">${i + 1}</div>
      <div class="thr-body">
        <div class="thr-meta">
          <span class="thr-level ${lvl}">${lvlLabel}</span>
          <span class="thr-cat">${cat}</span>
          ${s.region ? `<span class="thr-region">· ${s.region}</span>` : ''}
        </div>
        <div class="thr-title">${title}</div>
        ${s.src ? `<div class="thr-src">${s.src}${s.time ? ' · ' + s.time : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// MAP LAYER TOGGLES — CITIES / COUNTRIES
// ═══════════════════════════════════════════
let _citiesFetched = false;
function toggleCities() {
  citiesVisible = !citiesVisible;
  document.getElementById('lc-cities').classList.toggle('on', citiesVisible);
  if (citiesVisible && !_citiesFetched) {
    _citiesFetched = true;
    fetch('data/cities-1000.json')
      .then(r => r.json())
      .then(cities => { if (cities.length) { CITY_DATA = cities; } updateAllGlobeElements(); })
      .catch(e => { console.warn('[AUSPEX] Cities load failed:', e.message); updateAllGlobeElements(); });
  } else {
    updateAllGlobeElements();
  }
}

function toggleCountries() {
  countriesVisible = !countriesVisible;
  document.getElementById('lc-countries').classList.toggle('on', countriesVisible);
  updateAllGlobeElements();
}

// (B2 ATMOSPHERIC FOG feature removed)

// ═══════════════════════════════════════════
// C2 — SHIPPING CHOKEPOINT MONITOR
// ═══════════════════════════════════════════
const CHOKEPOINTS = [
  { name:'Suez Canal',        lat:30.1,  lng:32.6,  cap:52,  color:'#FFD60A' },
  { name:'Strait of Hormuz',  lat:26.6,  lng:56.3,  cap:21,  color:'#FF2D55' },
  { name:'Malacca Strait',    lat:2.5,   lng:101.5, cap:88,  color:'#30D158' },
  { name:'Panama Canal',      lat:9.1,   lng:-79.7, cap:14,  color:'#0A84FF' },
  { name:'Bosphorus',         lat:41.1,  lng:29.1,  cap:48,  color:'#FF9F0A' },
  { name:'Bab-el-Mandeb',     lat:12.5,  lng:43.4,  cap:39,  color:'#FF2D55' },
  { name:'Cape of Good Hope', lat:-34.4, lng:18.5,  cap:22,  color:'#30D158' },
  { name:'Cape Horn',         lat:-56.0, lng:-67.3, cap:8,   color:'#0A84FF' },
];

function toggleShipping() {
  shippingVisible = !shippingVisible;
  document.getElementById('lc-shipping').classList.toggle('on', shippingVisible);
  document.getElementById('shipping-panel').classList.toggle('on', shippingVisible);
  if (shippingVisible) initShippingData();
  else {
    if (_shippingWs) { _shippingWs.close(); _shippingWs = null; }
  }
}

function initShippingData() {
  // Try AISStream WebSocket; fall back to news-derived simulation
  try {
    _shippingWs = new WebSocket('wss://stream.aisstream.io/v0/stream');
    _shippingWs.onopen = () => {
      _shippingWs.send(JSON.stringify({
        APIKey: AISSTREAM_KEY,
        BoundingBoxes: CHOKEPOINTS.map(cp => [[cp.lat-2,cp.lng-3],[cp.lat+2,cp.lng+3]]),
        FilterMessageTypes:['PositionReport'],
      }));
      simulateShipping(); // pre-populate while real data streams in
    };
    _shippingWs.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.MessageType==='PositionReport') {
          const lat = msg.MetaData?.latitude || msg.MetaData?.Latitude;
          const lng = msg.MetaData?.longitude|| msg.MetaData?.Longitude;
          if (!lat||!lng) return;
          let near = null, minD = Infinity;
          for (const cp of CHOKEPOINTS) {
            const d = Math.sqrt(Math.pow(lat-cp.lat,2)+Math.pow(lng-cp.lng,2));
            if (d < minD) { minD=d; near=cp.name; }
          }
          if (near && minD < 3) { _vesselCounts[near]=(_vesselCounts[near]||0)+1; renderShippingPanel(); }
        }
      } catch{}
    };
    _shippingWs.onerror = () => simulateShipping();
  } catch { simulateShipping(); }
}

// Baseline geopolitical disruption (0=normal, 1=fully closed) — updated Apr 2025
const CP_BASELINE = {
  'Strait of Hormuz':  0.62, // Iran-US-Israel tensions; tanker seizures ongoing
  'Bab-el-Mandeb':     0.74, // Houthi attacks on Red Sea shipping — near-blockade
  'Suez Canal':        0.48, // ~70% traffic diverted via Cape of Good Hope
  'Panama Canal':      0.28, // Water level restrictions + US-Panama friction
  'Malacca Strait':    0.06,
  'Bosphorus':         0.14, // Montreux Convention warship restrictions
  'Cape of Good Hope': 0.00, // Traffic surge from Red Sea diversion — over-capacity
  'Cape Horn':         0.04,
};

function simulateShipping() {
  // Combine baseline geopolitical disruption with real-time news signal
  for (const cp of CHOKEPOINTS) {
    const cpText = cp.name.toLowerCase().replace(/ /g,'');
    const redSea = ['Bab-el-Mandeb','Suez Canal'].includes(cp.name);
    const goodHope = cp.name === 'Cape of Good Hope';
    const related = NEWS.filter(s => {
      const t = (s.title+' '+(s.summary||'')).toLowerCase();
      return t.includes(cpText.slice(0,6)) || (redSea && (t.includes('red sea')||t.includes('houthi')||t.includes('yemen')));
    });
    const newsDisruption = Math.min(0.25, related.length * 0.08);
    const baseline = CP_BASELINE[cp.name] || 0;
    // Cape of Good Hope gets extra traffic from Red Sea diversion
    const goodHopeBonus = goodHope ? Math.min(0.35, (_vesselCounts['Bab-el-Mandeb']||0) < cp.cap*0.4 ? 0.35 : 0.15) : 0;
    const totalDisruption = Math.min(0.88, baseline + newsDisruption - goodHopeBonus);
    _vesselCounts[cp.name] = Math.round(cp.cap * (1-totalDisruption) * (0.88+Math.random()*0.18));
  }
  renderShippingPanel();
}

function renderShippingPanel() {
  const rows = document.getElementById('shipping-rows');
  if (!rows) return;
  rows.innerHTML = CHOKEPOINTS.map(cp => {
    const count = _vesselCounts[cp.name]||0;
    const pct   = Math.min(100, Math.round(count/cp.cap*100));
    const status = pct<35?'CRITICAL':pct<65?'REDUCED':'NOMINAL';
    const sc = pct<35?'#FF2D55':pct<65?'#FF9F0A':'#30D158';
    return `<div class="sp-row">
      <div class="sp-name" style="color:${cp.color}">${cp.name}</div>
      <div class="sp-bar"><div class="sp-fill" style="width:${pct}%;background:${cp.color}"></div></div>
      <span class="sp-status" style="color:${sc}">${status}</span>
      <span class="sp-count">${count}v</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// C3 — SANCTIONS MESH TRACKER
const SANCTION_ENTITIES = [
  // Russian entities
  'Sberbank','VTB Bank','Gazprom','Rosneft','Lukoil','Novatek','Evraz','Sovcombank','Wagner','Prigozhin',
  // Iranian
  'IRGC','Islamic Revolutionary Guard','Quds Force','Hezbollah','Hamas','Islamic Jihad',
  // North Korean
  'Lazarus Group','DPRK','Kim Jong','Choe Son Hui','Bureau 39',
  // Chinese (targeted)
  'Huawei','SMIC','CloudMinds','Hikvision','Megvii','SenseTime','DJI',
  // Other
  'Tatmadaw','Myanmar Military','SAC','Maduro','Ortega','Lukashenko',
  'Al-Qaeda','ISIS','ISIL','Daesh','Taliban','Houthi','Houthis','Ansar Allah',
];

function toggleSanctions() {
  sanctionsVisible = !sanctionsVisible;
  document.getElementById('lc-sanctions').classList.toggle('on', sanctionsVisible);
  const panel = document.getElementById('sanctions-panel');
  panel.classList.toggle('on', sanctionsVisible);
  if (sanctionsVisible) {
    runSanctionsAnalysis();
    const handle = panel.querySelector('.san-hdr');
    if (handle) _makePanelDraggable(panel, handle);
  }
}

function runSanctionsAnalysis() {
  const hits = [];
  for (const s of NEWS) {
    const text = (s.title+' '+(s.summary||'')).toLowerCase();
    const matches = SANCTION_ENTITIES.filter(e => text.includes(e.toLowerCase()));
    if (matches.length) hits.push({ story:s, entities:matches });
  }
  document.getElementById('san-count').textContent = `${hits.length} STORIES CONTAIN SANCTIONED ENTITIES`;
  document.getElementById('san-list').innerHTML = hits.length
    ? hits.slice(0,12).map((h,idx) => `
        <div class="san-item" style="cursor:pointer" onclick="openArticle(NEWS.find(s=>s.id===${h.story.id}))">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div class="san-story">${h.story.title.slice(0,65)}${h.story.title.length>65?'…':''}</div>
            <a href="${h.story.url||'#'}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Read full article" style="flex-shrink:0;color:var(--t3);text-decoration:none;padding:2px 5px;border:1px solid var(--b1);border-radius:2px;font-family:var(--f-mono);font-size:8px;transition:all .15s" onmouseover="this.style.color='var(--t1)';this.style.borderColor='var(--b2)'" onmouseout="this.style.color='var(--t3)';this.style.borderColor='var(--b1)'">↗</a>
          </div>
          <div class="san-entities" style="margin-top:4px;flex-wrap:wrap;display:flex;gap:3px">
            ${h.entities.map(e=>`<a href="https://news.google.com/search?q=${encodeURIComponent(e)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="san-tag" style="text-decoration:none;cursor:pointer" title="Search news: ${e}">${e} ↗</a>`).join('')}
          </div>
        </div>`).join('')
    : '<div style="padding:16px;font-family:var(--f-mono);font-size:8px;color:var(--t3);text-align:center;letter-spacing:.1em">NO SANCTIONED ENTITIES DETECTED IN CURRENT FEED</div>';
}

// ═══════════════════════════════════════════
// NAV SEARCH
// ═══════════════════════════════════════════
function toggleNavSearch() {
  const wrap  = document.getElementById('lc-search-wrap');
  const icon  = document.getElementById('lc-search-icon');
  const input = document.getElementById('lc-search-input');
  wrap.classList.add('on');
  icon.style.display = 'none';
  input.value = '';
  input.focus();
  filterNavButtons('');
}

function closeNavSearch() {
  const wrap = document.getElementById('lc-search-wrap');
  const icon = document.getElementById('lc-search-icon');
  wrap.classList.remove('on');
  icon.style.display = '';
  // Restore all buttons
  document.querySelectorAll('#layer-ctrl .lc-btn').forEach(b => b.style.display = '');
}

function filterNavButtons(q) {
  const term = q.trim().toLowerCase();
  document.querySelectorAll('#layer-ctrl .lc-btn').forEach(btn => {
    const label = btn.textContent.replace('⚔','').trim().toLowerCase();
    btn.style.display = (!term || label.includes(term)) ? '' : 'none';
  });
}

