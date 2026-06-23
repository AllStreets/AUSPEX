'use strict';
// ═══════════════════════════════════════════
// AUSPEX EVENT ICON SYSTEM
// Inline SVG glyphs for every sensed event type. Color is inherited via
// currentColor so callers (globe markers, map key, event card) control hue.
// Rendered small (~12–16px); kept minimal and recognizable.
// Browser global — no module syntax.
// ═══════════════════════════════════════════
const AUSPEX_EVENT_ICONS = {
  // ── PERILS ──────────────────────────────
  // Seismic waves radiating from an epicentre
  earthquake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M7 12a5 5 0 0 1 10 0"/><path d="M4 12a8 8 0 0 1 16 0"/></svg>`,
  // Mountain triangle with an eruption plume
  volcano: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18l-5.5-9h-5L3 20Z"/><path d="M10.5 11l1.5-3 1.5 3"/><path d="M12 5V3M9.5 5.5 8 4M14.5 5.5 16 4"/></svg>`,
  // Stacked water waves
  flood: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2 0 2.5 1.5 5 1.5S14 8 14 8s2 1.5 4.5 1.5S22 8 22 8"/><path d="M2 13c2 0 2.5 1.5 5 1.5S14 13 14 13s2 1.5 4.5 1.5S22 13 22 13"/><path d="M2 18c2 0 2.5 1.5 5 1.5S14 18 14 18s2 1.5 4.5 1.5S22 18 22 18"/></svg>`,
  // 3D vortex funnel — perspective rings (back edge faded, front solid) + swirling tail
  cyclone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><g stroke-opacity="0.4"><path d="M4 5A8 2.4 0 0 1 20 5"/><path d="M6.2 9A5.8 1.9 0 0 1 17.8 9"/><path d="M8.2 12.5A3.8 1.5 0 0 1 15.8 12.5"/><path d="M10 15.5A2 1 0 0 1 14 15.5"/></g><path d="M4 5A8 2.4 0 0 0 20 5"/><path d="M6.2 9A5.8 1.9 0 0 0 17.8 9"/><path d="M8.2 12.5A3.8 1.5 0 0 0 15.8 12.5"/><path d="M10 15.5A2 1 0 0 0 14 15.5"/><path d="M4 5Q7.5 13 11 16.5"/><path d="M20 5Q16.5 13 13 16.5"/><path d="M11.5 16.5c0 2.4 1.7 3.7 3.5 3"/></svg>`,
  // Flame
  fire: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2c.6 2.8-1.2 4.3-2.4 5.7C8.2 9.3 7 10.7 7 13a5 5 0 0 0 10 0c0-1.7-.8-3-1.6-4-.3.9-1 1.6-1.9 1.6 1-2.3-.2-5.6-1.5-8.6Z"/></svg>`,
  // Cracked, parched earth under a low sun
  drought: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2.5"/><path d="M12 2.5V1M16 6h1.5M6.5 6H8M15 3l1-1M9 3 8 2"/><path d="M3 16h18M8 13l-1 3 2 4M14 13l1 3-1.5 4M11.5 13v3l1 4"/></svg>`,
  // Generic disaster fallback — warning triangle
  disaster: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 22 20H2L12 3Z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.8" fill="currentColor" stroke="none"/></svg>`,

  // ── BREAKTHROUGHS ───────────────────────
  // Rocket ascending
  launch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 1.5 5 5 5 9 0 2.2-.7 3.8-1.5 5h-7C7.7 14.8 7 13.2 7 11c0-4 2-7.5 5-9Z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.5 16 7 19m7.5-3 2.5 3M12 16v4"/></svg>`,
  // Orbiting planet
  space: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-25 12 12)"/></svg>`,
  // Heartbeat pulse with a cross
  medical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-5 3 10 2.5-7 1.5 2H22"/></svg>`,
  // Atom
  physics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></svg>`,
  // Lab flask / beaker
  science: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.4 2h11.2A1.5 1.5 0 0 0 19 19l-5-10V3"/><path d="M7.5 15h9"/></svg>`,
  // Upward chart / growth arrow
  financial: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg>`,
  // CPU / chip
  tech: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/></svg>`,

  // ── DEFAULT ─────────────────────────────
  // Small diamond for anything unmatched
  default: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 4 20 12 12 20 4 12Z"/></svg>`,
};

// Resolve a glyph for an event type/icon string, falling back to default.
function auspexEventIcon(key) {
  return (key && AUSPEX_EVENT_ICONS[key]) || AUSPEX_EVENT_ICONS.default;
}

// Resolve the best glyph for a whole event — stays fluid for brand-new event
// kinds the snapshot may invent. Tries explicit icon, then type, then sense;
// finally falls back by POLARITY (peril → warning triangle, breakthrough →
// science flask) so an unknown type never collapses to a meaningless diamond.
function auspexEventGlyph(event) {
  if (!event) return AUSPEX_EVENT_ICONS.default;
  const direct = AUSPEX_EVENT_ICONS[event.icon]
    || AUSPEX_EVENT_ICONS[event.type]
    || AUSPEX_EVENT_ICONS[event.sense];
  if (direct) return direct;
  if (event.polarity === 'peril') return AUSPEX_EVENT_ICONS.disaster;
  if (event.polarity === 'breakthrough') return AUSPEX_EVENT_ICONS.science;
  return AUSPEX_EVENT_ICONS.default;
}

// Lift a hex color toward white by amount t (0..1). Glyph strokes are drawn in a
// lifted tint of the event's type color so they stay legible against their own
// same-hued halo — without this a launch's blue rocket vanished into its blue
// glow and read as a featureless orb. Hue still encodes type; only luminance lifts.
function auspexLiftColor(hex, t) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex || '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lift = (c) => Math.round(c + (255 - c) * t);
  const r = lift((n >> 16) & 255), g = lift((n >> 8) & 255), b = lift(n & 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════
// AUSPEX EVENT COLORS
// Per-type hues so every event reads distinctly on the dark globe — color
// encodes TYPE, while severity encodes SIZE/glow elsewhere. A high-severity
// peril override keeps "red = genuinely dangerous" legible. Single source of
// truth for event color across globe markers, map key and the event card.
// ═══════════════════════════════════════════
const AUSPEX_EVENT_COLORS = {
  // ── PERILS ──────────────────────────────
  earthquake: '#E0903A',
  volcano:    '#FF5A36',
  flood:      '#3B9EFF',
  cyclone:    '#5EEAD4',
  fire:       '#FF7A1A',
  drought:    '#D6B24A',
  disaster:   '#FF8C66', // generic peril fallback

  // ── BREAKTHROUGHS ───────────────────────
  launch:       '#8BA0FF',
  space:        '#8BA0FF',
  medical:      '#FF74A8',
  physics:      '#A78BFA',
  science:      '#67E8F9',
  financial:    '#FACC4D',
  tech:         '#93A4FF',
  breakthrough: '#5AC8FA', // generic breakthrough fallback
};

// Resolve an event's display color. Genuinely severe perils always read red;
// otherwise color is determined by the event's type/icon, with a per-polarity
// fallback for anything unmatched.
function auspexEventColor(event) {
  if (!event) return AUSPEX_EVENT_COLORS.breakthrough;
  if (event.polarity === 'peril' && (event.severity ?? 0) >= 0.7) return '#FF4D5E';
  const byType = AUSPEX_EVENT_COLORS[event.icon || event.type];
  if (byType) return byType;
  return event.polarity === 'peril' ? AUSPEX_EVENT_COLORS.disaster : AUSPEX_EVENT_COLORS.breakthrough;
}
