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

// Civilian Protection — the canonical concern taxonomy and its keywords.
export const PROTECTION_SIGNALS = [
  { id: 'casualties',   label: 'Civilian casualties',           kw: ['civilian casualt', 'civilians killed', 'civilian deaths', 'civilians dead', 'killed civilians'] },
  { id: 'health_ed',    label: 'Attacks on hospitals/schools',  kw: ['hospital hit', 'attack on hospital', 'hospital struck', 'school hit', 'attack on school', 'clinic struck', 'medical facility'] },
  { id: 'siege',        label: 'Siege / blockade of aid',       kw: ['siege', 'blockade', 'aid blocked', 'starvation as weapon', 'besieged', 'aid denied', 'humanitarian blockade'] },
  { id: 'displacement', label: 'Forced displacement',           kw: ['forcibly displaced', 'mass displacement', 'fled', 'forced to flee', 'expelled', 'ethnic cleansing'] },
  { id: 'detention',    label: 'Detention / disappearance',     kw: ['detained', 'detention', 'disappear', 'abduct', 'arbitrary arrest', 'hostage'] },
  { id: 'rights',       label: 'Human-rights violations',       kw: ['human rights', 'war crime', 'atrocit', 'torture', 'extrajudicial', 'crimes against humanity', 'genocide'] },
  { id: 'gbv_child',    label: 'GBV / child protection',        kw: ['gender-based violence', 'sexual violence', 'rape as', 'child soldier', 'children recruited', 'trafficking'] },
];

// Classify a story's text into the protection-concern ids it matches.
export function classifyProtection(text) {
  const t = String(text || '').toLowerCase();
  return PROTECTION_SIGNALS.filter(sig => sig.kw.some(k => t.includes(k))).map(sig => sig.id);
}
