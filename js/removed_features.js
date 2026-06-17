// ═══════════════════════════════════════════════════════════════
// REMOVED FEATURES — code preserved here for future restoration
//
// To re-enable a feature:
//   1. Copy the relevant section back into the appropriate source file
//   2. Restore the button in index.html
//   3. Re-add any state variables to config.js
//   4. Re-add any globe.js / updateAllGlobeElements hooks
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// F1 — SATELLITE VIEW
// Originally in: js/features.js
// Button HTML: <button class="lc-btn" id="lc-sat" style="--lc:#1E90FF" onclick="toggleSatellite()" title="NASA GIBS live satellite imagery"><span class="lc-pip"></span>SATELLITE</button>
// Required state in config.js: let satModeOn = false; let _satBlobUrl = null;
// Required HTML badge: <div id="sat-badge" ...><span id="sat-date-lbl"></span></div>
// ───────────────────────────────────────────────────────────────
function getSatDate() {
  const d = new Date();
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
}

function getSatUrl() {
  // BlueMarble_NextGeneration: seamless monthly MODIS composite — no swath gaps
  // Daily MODIS (MODIS_Terra_CorrectedReflectance_TrueColor) has black stripe artifacts
  return 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=BlueMarble_NextGeneration&BBOX=-180,-90,180,90&SRS=EPSG:4326&WIDTH=2048&HEIGHT=1024&FORMAT=image%2Fjpeg';
}

async function _loadSatTexture() {
  // fetch() → blob URL bypasses Three.js CORS restriction on cross-origin images
  const url = getSatUrl();
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`WMS ${resp.status}`);
  const blob = await resp.blob();
  if (_satBlobUrl) URL.revokeObjectURL(_satBlobUrl);
  _satBlobUrl = URL.createObjectURL(blob);
  return _satBlobUrl;
}

async function toggleSatellite() {
  satModeOn = !satModeOn;
  const btn = document.getElementById('lc-sat');
  const badge = document.getElementById('sat-badge');

  if (satModeOn) {
    btn.classList.add('on');
    badge.classList.add('on');
    document.getElementById('sat-date-lbl').textContent = getSatDate();
    btn.textContent = 'LOADING…';
    const wrap = document.getElementById('globe-wrap');
    try {
      const blobUrl = await _loadSatTexture();
      wrap.classList.add('fading');
      setTimeout(() => {
        if (G && satModeOn) {
          G.globeImageUrl(blobUrl);
          G.atmosphereColor('#0a1832');
          G.atmosphereAltitude(0.15);
        }
        wrap.classList.remove('fading');
      }, 400);
    } catch(e) {
      console.warn('[SAT] texture load failed:', e);
      satModeOn = false;
      btn.classList.remove('on');
      badge.classList.remove('on');
    }
    btn.innerHTML = '<span class="lc-pip"></span>SATELLITE';
  } else {
    btn.classList.remove('on');
    badge.classList.remove('on');
    const wrap = document.getElementById('globe-wrap');
    wrap.classList.add('fading');
    setTimeout(() => {
      if (G && lastTod) {
        G.globeImageUrl(getTexture(lastTod));
        G.atmosphereColor(getAtmos(lastTod));
        G.atmosphereAltitude(0.17);
      }
      wrap.classList.remove('fading');
      if (_satBlobUrl) { URL.revokeObjectURL(_satBlobUrl); _satBlobUrl = null; }
    }, 700);
  }
}


// ───────────────────────────────────────────────────────────────
// HEAT — Story Heatmap Overlay
// Originally in: js/ui.js
// Button HTML: <button class="lc-btn" id="lc-hm" style="--lc:#D35400" onclick="toggleHeatmap()" title="Story heat map"><span class="lc-pip"></span>HEAT</button>
// Required state in config.js: let heatmapVisible = false;
// Required in updateAllGlobeElements():
//   if (heatmapVisible) generateHeatBlobs(stories).forEach(b => visual.push(b));
//   + handler: if (item._type === 'heat') return makeHeatBlob(item);
// ───────────────────────────────────────────────────────────────
function generateHeatBlobs(stories) {
  const clusters = {};
  stories.forEach(s => {
    const key = `${Math.round(s.lat/12)*12}_${Math.round(s.lng/12)*12}`;
    if (!clusters[key]) clusters[key] = { lat:0, lng:0, count:0, colors:[] };
    clusters[key].lat += s.lat; clusters[key].lng += s.lng;
    clusters[key].count++; clusters[key].colors.push(s.color);
  });
  return Object.values(clusters).map(c => ({
    lat: c.lat/c.count, lng: c.lng/c.count,
    count: c.count, color: c.colors[0], _type: 'heat',
  }));
}

function makeHeatBlob(blob) {
  const d = document.createElement('div');
  const sz = 60 + blob.count * 22;
  d.className = 'hm-blob';
  d.style.cssText = `width:${sz}px;height:${sz}px;background:radial-gradient(circle,${blob.color}28 0%,${blob.color}0a 50%,transparent 70%)`;
  return d;
}

function toggleHeatmap() {
  heatmapVisible = !heatmapVisible;
  document.getElementById('lc-hm').classList.toggle('on', heatmapVisible);
  updateAllGlobeElements();
}


// ───────────────────────────────────────────────────────────────
// B2 — ATMOSPHERIC DATA FOG
// Originally in: js/overlay.js
// Button HTML: <button class="lc-btn" id="lc-fog" style="--lc:#3D6B1C" onclick="toggleFog()" title="Atmospheric data fog"><span class="lc-pip"></span>FOG</button>
// Required state in config.js: let fogVisible = false;
// Required HTML canvas: <canvas id="fog-layer"></canvas>
// Required CSS: #fog-layer{position:fixed;inset:0;z-index:2;pointer-events:none;display:none;mix-blend-mode:multiply}
// ───────────────────────────────────────────────────────────────
function toggleFog() {
  fogVisible = !fogVisible;
  document.getElementById('lc-fog').classList.toggle('on', fogVisible);
  const cv = document.getElementById('fog-layer');
  cv.style.display = fogVisible ? 'block' : 'none';
  if (fogVisible) renderFogLayer();
}

function renderFogLayer() {
  const cv = document.getElementById('fog-layer');
  cv.width  = window.innerWidth;
  cv.height = window.innerHeight;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);

  const toXY = (lat,lng) => ({
    x: (lng+180)/360 * cv.width * 0.55 + cv.width * 0.22,
    y: (90-lat)/180  * cv.height,
  });

  // Fog zones — regions with low/no news coverage
  const fogZones = [
    { lat:40.3, lng:127.5, r:160, opacity:.38 }, // North Korea
    { lat:19.8, lng:96.1,  r:140, opacity:.3  }, // Myanmar interior
    { lat:12.9, lng:30.2,  r:200, opacity:.28 }, // Sudan/Chad
    { lat:34.5, lng:66.0,  r:170, opacity:.3  }, // Afghanistan
    { lat:-5,   lng:23,    r:250, opacity:.25 }, // DRC interior
    { lat:23.5, lng:53.9,  r:130, opacity:.22 }, // Gulf interior
    { lat:3,    lng:18,    r:200, opacity:.22 }, // Central Africa
  ];

  for (const zone of fogZones) {
    const nearbyStories = NEWS.filter(s => Math.sqrt(Math.pow(s.lat-zone.lat,2)+Math.pow(s.lng-zone.lng,2)) < 8);
    if (nearbyStories.length > 3) continue;
    const {x,y} = toXY(zone.lat, zone.lng);
    const g = ctx.createRadialGradient(x,y,0,x,y,zone.r);
    g.addColorStop(0,   `rgba(3,4,12,${zone.opacity})`);
    g.addColorStop(0.5, `rgba(5,8,20,${zone.opacity*0.5})`);
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,cv.width,cv.height);
  }
}
