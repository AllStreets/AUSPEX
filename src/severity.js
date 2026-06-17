// src/severity.js — pure, no I/O, no globals
export function quakeMagnitudeToSeverity(mag) {
  return Math.min(1, Math.max(0, (mag - 3) / 6));
}
export function severityToBand(s) {
  if (s < 0.2) return 'minor';
  if (s < 0.4) return 'moderate';
  if (s < 0.6) return 'strong';
  if (s < 0.85) return 'major';
  return 'great';
}
export function severityToColor(severity, polarity = 'peril') {
  if (polarity === 'breakthrough') {
    return severity > 0.7 ? '#5AC8FA' : severity > 0.4 ? '#32ADE6' : '#007AFF';
  }
  return severity > 0.7 ? '#FF2D55' : severity > 0.4 ? '#FF9F0A' : '#FFD60A';
}
export function severityToRadius(severity) {
  return 1.5 + severity * 5.5;
}
