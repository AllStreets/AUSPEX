'use strict';

// ═══════════════════════════════════════════
// BOOT SEQUENCE
// ═══════════════════════════════════════════

// Loading screen message cycler
const LD_MSGS = [
  'ESTABLISHING UPLINK...',
  'RENDERING THE EARTH...',
  "READING THE WORLD'S SIGNS...",
  'SYNCING THE SENSES...',
  'THE WATCH IS LIVE.',
];
let li = 0;
const ldInt = setInterval(() => {
  if (li < LD_MSGS.length) document.getElementById('ld-st').textContent = LD_MSGS[li++];
  else clearInterval(ldInt);
}, 400);

// Dismiss loading screen regardless of globe success
setTimeout(() => {
  const el = document.getElementById('loading');
  if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 1000); }
}, 2400);

initDraggablePanels();
initStars();
tick();
applyTod(getTod());
lastTod = getTod();
lastHour = new Date().getHours();

try {
  initGlobe();
} catch (err) {
  console.error('Globe init failed:', err);
  document.getElementById('ld-st').textContent = 'GLOBE UNAVAILABLE — CHECK CONNECTION';
}

initTicker();
initScrubber();
renderFeed(NEWS);
renderSentiment(NEWS);
archiveCurrentStories();
updateAllGlobeElements();
applyMeaningfulArcs(NEWS);
// Render DMZ / disputed border lines after globe stabilizes (borders load separately)
setTimeout(() => { if (typeof refreshAllPaths === 'function') refreshAllPaths(); }, 2000);

// Fetch live news + supporting data after globe is ready
setTimeout(() => fetchNews(), 800);
setTimeout(() => fetchEarthquakes(), 2000);
setTimeout(() => fetchSnapshot(), 3000);
setInterval(() => fetchSnapshot(), 3 * 60 * 1000);
// Bootstrap from Supabase server — seeds local cache with accumulated history
setTimeout(() => bootstrapFromSupabase(), 5000);

// Load regions + countries at startup (needed for threat rings and border colors).
// City data is deferred until the CITIES toggle is first activated.
setTimeout(async () => {
  try {
    const [regions, countries] = await Promise.all([sbFetchRegions(), sbFetchCountries()]);
    if (regions.length)   { REGION_DATA  = regions;   }
    if (countries.length) { COUNTRY_DATA = countries; }
    if (regions.length || countries.length) updateAllGlobeElements();
    // Defer border rendering so it doesn't block the globe's initial paint
    setTimeout(() => initCountryBorders(), 500);
  } catch(e) { console.warn('[AUSPEX] Map layer load failed:', e.message); }
}, 3000);
// Re-fetch market data every 5 minutes when panel is open
setInterval(() => { if (marketVisible) fetchMarketData(); }, 5 * 60 * 1000);

// ═══════════════════════════════════════════
// AGENTZEUS COMMAND BUS
// Polls AgentZeus meridian-bridge for voice commands
// ═══════════════════════════════════════════
(function startCommandBus() {
  const BRIDGE_URL = 'http://localhost:3000/api/meridian-bridge';
  let _lastTs = 0;

  async function pollBridge() {
    try {
      const res = await fetch(`${BRIDGE_URL}?after=${_lastTs}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.command) return;
      _lastTs = data.command.ts || Date.now();
      executeCmd(data.command.cmd, data.command.payload || {});
    } catch { /* bridge not running — silent */ }
  }

  function executeCmd(cmd, payload) {
    if (!G) return;
    switch (cmd) {
      case 'set_cat':
        if (payload.cat && typeof setCategory === 'function') setCategory(payload.cat);
        break;
      case 'toggle_overlay':
        if (payload.overlay) {
          const fnMap = {
            cities: 'toggleCities', countries: 'toggleCountries',
            cables: 'toggleCables', flights: 'toggleFlights',
            threats: 'toggleThreats', sanctions: 'toggleSanctions',
            shipping: 'toggleShipping', eq: 'toggleEQ',
          };
          const fn = fnMap[payload.overlay];
          if (fn && typeof window[fn] === 'function') window[fn]();
        }
        break;
      case 'toggle_tool':
        if (payload.tool) {
          const toolMap = {
            silence:  'toggleSilence',
            diverge:  'toggleDivergence',
            cascade:  'toggleCascade',
            livenews: 'toggleLiveNews',
            webcams:  'toggleWebcamPanel',
            wargame:  'openWargame',
          };
          const tfn = toolMap[payload.tool];
          if (tfn && typeof window[tfn] === 'function') window[tfn]();
        }
        break;
      case 'open_page':
        if (payload.page) {
          const pageMap = {
            analyst: 'openAnalystMode',
            brief:   'openDailyBrief',
            mapkey:  'toggleMapKey',
          };
          const pfn = pageMap[payload.page];
          if (pfn && typeof window[pfn] === 'function') window[pfn]();
        }
        break;
      case 'reset_view':
        if (typeof resetGlobe === 'function') resetGlobe();
        break;
      case 'set_spin':
        if (G.controls) {
          const on = !!payload.on;
          G.controls().autoRotate = on;
          G.controls().autoRotateSpeed = on ? 0.32 : 0;
          const spinBtn = document.getElementById('spin-btn');
          if (spinBtn) spinBtn.classList.toggle('on', on);
        }
        break;
      case 'open_meridian':
        // Already here — nothing to do
        break;
      default:
        console.log('[AUSPEX] Unknown cmd:', cmd);
    }
  }

  // Poll every 2 seconds
  setInterval(pollBridge, 2000);
})();
