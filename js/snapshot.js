'use strict';
async function fetchSnapshot() {
  try {
    const r = await fetch(`${WORKER_BASE}/snapshot.json`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _snapshotFetchedAt = Date.now();
    SNAPSHOT_EVENTS = Array.isArray(data.events) ? data.events : [];
    if (typeof updateAura === 'function') updateAura();
    updateAllGlobeElements();
    console.log(`[AUSPEX] snapshot loaded: ${SNAPSHOT_EVENTS.length} events`);
  } catch (e) {
    console.warn('[AUSPEX] snapshot fetch failed (worker may be offline):', e.message);
  }
}
function toggleSnapshotEvents() {
  snapshotVisible = !snapshotVisible;
  const btn = document.getElementById('lc-events');
  if (btn) btn.classList.toggle('on', snapshotVisible);
  updateAllGlobeElements();
}
// STORIES layer — show/hide the geolocated, category-colored news dots.
function toggleStoriesLayer() {
  storiesVisible = !storiesVisible;
  const btn = document.getElementById('lc-stories');
  if (btn) btn.classList.toggle('on', storiesVisible);
  updateAllGlobeElements();
}
