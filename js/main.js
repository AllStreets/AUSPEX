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
// Polls the AgentZeus auspex-bridge for voice commands.
// OFF by default — opt in with localStorage.setItem('auspex_bridge','1').
// Without this, the bridge does not poll, so an offline AgentZeus on :3000
// never spams the console with failed-fetch errors.
// ═══════════════════════════════════════════
(function startCommandBus() {
  // AUSPEX is a normal public site AND routes commands from AgentZeus by default.
  // Disable with localStorage.auspex_bridge = '0'.
  if (localStorage.getItem('auspex_bridge') === '0') return;

  // Poll the DEPLOYED AgentZeus bridge over HTTPS — a public HTTPS page cannot
  // fetch http://localhost (mixed content). Override via window.AUSPEX_BRIDGE_URL
  // (set it to http://localhost:3000/api/auspex-bridge when running AUSPEX locally).
  const BRIDGE_URL = (typeof window !== 'undefined' && window.AUSPEX_BRIDGE_URL)
    || 'https://agent-zeus-git-main-connor-evans-projects.vercel.app/api/auspex-bridge';
  let _lastTs = Date.now(); // ignore any backlog from before this page loaded

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
            shipping: 'toggleShipping',
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
            stories:  'toggleStoriesLayer',
          };
          const tfn = toolMap[payload.tool];
          if (tfn && typeof window[tfn] === 'function') window[tfn]();
        }
        break;
      case 'open_page':
        if (payload.page) {
          const pageMap = {
            analyst: 'openAnalystMode',
            relief:  'openRelief',
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
