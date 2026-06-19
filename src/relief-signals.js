// src/relief-signals.js — pure, no I/O, no globals.
// Canonical signal-classification helpers for the RELIEF board's data tools
// (Tool 9 Health & Outbreak Watch, Tool 10 Civilian Protection). The browser
// bundle (js/relief.js) mirrors these thresholds inline; this module is the
// tested source of truth so the scoring stays honest and deterministic.

// Health & Outbreak Watch — map a composite signal score to a 1-4 phase.
//   1 WATCH · 2 CONCERN · 3 OUTBREAK · 4 EMERGENCY
export function healthScoreToPhase(score) {
  const s = Number(score) || 0;
  if (s >= 3.2) return 4;
  if (s >= 2.0) return 3;
  if (s >= 1.0) return 2;
  return 1;
}

export const HEALTH_PHASE_LABEL = { 1: 'WATCH', 2: 'CONCERN', 3: 'OUTBREAK', 4: 'EMERGENCY' };

// Health keywords (disease / health-emergency signals) and acute lifters.
export const HEALTH_KEYWORDS = [
  'outbreak', 'epidemic', 'pandemic', 'cholera', 'measles', 'ebola', 'marburg',
  'dengue', 'malaria', 'polio', 'mpox', 'monkeypox', 'diphtheria', 'typhoid',
  'meningitis', 'yellow fever', 'lassa', 'avian flu', 'bird flu', 'h5n1',
  'contaminated water', 'waterborne', 'disease', 'infection', 'virus', 'cases surge',
  'malnutrition', 'malnourish', 'famine deaths', 'hospital overwhelmed', 'vaccine shortage',
];
export const HEALTH_ACUTE = ['deaths', 'dead', 'killed', 'surge', 'spreading', 'overwhelmed', 'declared', 'emergency', 'thousands', 'children'];

// Does a text contain any health-emergency signal?
export function hasHealthSignal(text) {
  const t = String(text || '').toLowerCase();
  return HEALTH_KEYWORDS.some(k => t.includes(k));
}

// Score one story's health contribution (deterministic; matches js/relief.js).
export function healthStoryPoints(text, breaking = false) {
  const t = String(text || '').toLowerCase();
  if (!HEALTH_KEYWORDS.some(k => t.includes(k))) return 0;
  let pts = 1.0;
  if (HEALTH_ACUTE.some(k => t.includes(k))) pts += 0.8;
  if (breaking) pts += 0.4;
  return pts;
}

// A region string is a usable PLACE label only if it does not look like a source
// domain / URL. Some archived stories carry the publisher domain in the region
// field (e.g. "Abcnews.com") — surfacing a website as an affected area is a data
// mismatch, so the Health & Outbreak tool rejects those. (js/relief.js mirrors
// this as _rlValidPlace.)
export function isPlaceName(name) {
  const n = String(name || '').trim();
  if (n.length < 2) return false;
  if (/\.(com|org|net|co|io|gov|edu|news|tv|info|uk|us)\b/i.test(n)) return false;
  if (/https?:|www\.|@|\//.test(n)) return false;
  return true;
}

// Civilian Protection — the canonical concern taxonomy and its keywords.
// Keywords are deliberately specific to humanitarian protection: bare words like
// "blockade" (matches a naval blockade), "disappear" ("jobs disappear"), "fled"
// or "refugee" (matches sports/business copy) caused false positives in live
// testing, so each entry requires a civilian-harm phrasing.
export const PROTECTION_SIGNALS = [
  { id: 'casualties',   label: 'Civilian casualties',           kw: ['civilian casualt', 'civilians killed', 'civilian deaths', 'civilians dead', 'killed civilians', 'civilian toll'] },
  { id: 'health_ed',    label: 'Attacks on hospitals/schools',  kw: ['hospital hit', 'attack on hospital', 'hospital struck', 'hospital bombed', 'school hit', 'attack on school', 'school struck', 'clinic struck', 'medical facility hit', 'attack on medical'] },
  { id: 'siege',        label: 'Siege / blockade of aid',       kw: ['under siege', 'besieged', 'aid blocked', 'aid denied', 'aid convoy blocked', 'humanitarian blockade', 'starvation as a weapon', 'blockade of aid', 'denied humanitarian access'] },
  { id: 'displacement', label: 'Forced displacement',           kw: ['forcibly displaced', 'forced displacement', 'mass displacement', 'forced to flee', 'expelled from their', 'ethnic cleansing', 'driven from their homes'] },
  { id: 'detention',    label: 'Detention / disappearance',     kw: ['arbitrary detention', 'arbitrarily detained', 'mass detention', 'forced disappearance', 'forcibly disappeared', 'enforced disappearance', 'abducted civilians', 'hostages held', 'taken hostage'] },
  { id: 'rights',       label: 'Human-rights violations',       kw: ['human rights violation', 'human rights abuse', 'war crime', 'atrocit', 'torture', 'extrajudicial', 'crimes against humanity', 'genocide', 'summary execution'] },
  { id: 'gbv_child',    label: 'GBV / child protection',        kw: ['gender-based violence', 'sexual violence', 'rape as a weapon', 'child soldier', 'children recruited', 'human trafficking', 'child abduction'] },
];

// Classify a story's text into the protection-concern ids it matches.
export function classifyProtection(text) {
  const t = String(text || '').toLowerCase();
  return PROTECTION_SIGNALS.filter(sig => sig.kw.some(k => t.includes(k))).map(sig => sig.id);
}
