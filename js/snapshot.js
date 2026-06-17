'use strict';
async function fetchSnapshot() {
  try {
    const r = await fetch('http://localhost:8801/snapshot.json', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _snapshotFetchedAt = Date.now();
    SNAPSHOT_EVENTS = Array.isArray(data.events) ? data.events : [];
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
