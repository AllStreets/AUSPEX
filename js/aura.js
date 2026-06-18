'use strict';
// ═══════════════════════════════════════════════════════════
// AUSPEX — Breathing Aura Engine
// The signature accent (--aura) shifts and breathes with the
// state of the world, computed from SNAPSHOT_EVENTS.
//   calm   → green   (#1FB85C)  world is quiet — the instrument is alive
//   active → green   (#4ADE80)  meaningful recent activity
//   alert  → red     (#FF4D5E)  a real high-severity peril is live
// Red is reserved for genuine peril — never decoration.
// ═══════════════════════════════════════════════════════════

const AURA_COLORS = {
  calm:   '#1FB85C',
  active: '#4ADE80',
  alert:  '#FF4D5E'
};

const AURA_WINDOW_MS = 24 * 60 * 60 * 1000; // last 24h

// Parse an event timestamp; fall back to "now" so undated events still count.
function _auraEventTime(ev) {
  const t = ev && (ev.occurredAt || ev.detectedAt || ev.time);
  const ms = t ? Date.parse(t) : NaN;
  return Number.isFinite(ms) ? ms : Date.now();
}

// Compute the world state from the global SNAPSHOT_EVENTS.
function computeAuraState() {
  const events = (typeof SNAPSHOT_EVENTS !== 'undefined' && Array.isArray(SNAPSHOT_EVENTS))
    ? SNAPSHOT_EVENTS : [];
  if (!events.length) return 'calm';

  const now = Date.now();
  let inWindow = 0;
  let maxSev = 0;
  let alert = false;

  for (const ev of events) {
    if (!ev) continue;
    const age = now - _auraEventTime(ev);
    if (age < 0 || age > AURA_WINDOW_MS) continue;
    inWindow++;
    const sev = Number(ev.severity) || 0;
    if (sev > maxSev) maxSev = sev;
    if (sev >= 0.7 && ev.confidence === 'confirmed') alert = true;
  }

  // alert: any confirmed event with severity >= 0.7 in last 24h
  if (alert) return 'alert';
  // active: >= 8 events in window OR any severity >= 0.45
  if (inWindow >= 8 || maxSev >= 0.45) return 'active';
  // else calm
  return 'calm';
}

// Convert a #rrggbb hex to "r,g,b".
function _auraRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

// Drive the live --aura color + glow + globe atmosphere from world state.
function updateAura() {
  const state = computeAuraState();
  const color = AURA_COLORS[state] || AURA_COLORS.calm;
  const root = document.documentElement;

  root.style.setProperty('--aura', color);
  root.style.setProperty('--aura-soft', `rgba(${_auraRgb(color)},.18)`);
  if (document.body) document.body.dataset.aura = state;

  // Drive the globe atmosphere rim if the globe supports it.
  if (typeof G !== 'undefined' && G && typeof G.atmosphereColor === 'function') {
    try { G.atmosphereColor(color); } catch (e) { /* globe not ready */ }
  }

  return state;
}

// Run once on load and on a slow interval; also called after each snapshot.
function _auraInit() {
  updateAura();
  setInterval(updateAura, 30000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _auraInit);
} else {
  _auraInit();
}

// Expose as globals so snapshot.js can react after new data.
window.computeAuraState = computeAuraState;
window.updateAura = updateAura;
