# AUSPEX Plan 1 — Foundation & the Disaster Instrument

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a complete, keyless, public-safe disaster instrument — a Node/Express snapshot worker (port 8801) that senses USGS + GDACS events and a frontend (port 8800) that renders them on the existing NASA globe with honest event cards, a live map key, and a static 1,000-city base layer.

**Architecture:** Two processes, one data contract. The worker polls keyless public feeds on a schedule, normalizes to the `snapshot.json` shape (spec §13), runs an optional/degradable LLM reasoning pass, and serves the snapshot over HTTP. The frontend (Meridian's globals-based vanilla JS) fetches the snapshot, pushes events into the existing single render function `_updateAllGlobeElementsNow()`, and reuses the existing panel + map-key components. All pure logic (severity, normalize, filter, snapshot assembly) lives in ES modules under `src/` and `worker/`, unit-tested with Vitest; the browser globals call those behaviors via the global `SNAPSHOT_EVENTS` array.

**Tech Stack:** Vanilla JS + globe.gl/three-globe (frontend, no bundler), Node 18+/Express (worker), Vitest (tests), public keyless feeds (USGS earthquakes GeoJSON, GDACS event list), GeoNames `cities15000` (public domain) for the city dataset.

**Spec:** `docs/specs/2026-06-17-auspex-consolidated-design.md`

---

## File Structure

**Create:**
- `vitest.config.js` — test config
- `src/severity.js` — pure severity math (magnitude→severity, band, color, radius)
- `src/normalize.js` — pure USGS/GDACS → snapshot-event normalizers + validator
- `src/filter.js` — pure filter predicate + map-key row derivation
- `scripts/gen-cities.mjs` — one-time generator for the city dataset
- `data/cities-1000.json` — committed static base geography (~1,000 relevant cities)
- `worker/package.json`, `worker/index.js`, `worker/poller.js`, `worker/reason.js`, `worker/snapshot.js`, `worker/senses/usgs.js`, `worker/senses/gdacs.js` — the snapshot worker
- `js/snapshot.js` — browser globals: `fetchSnapshot()`, `toggleSnapshotEvents()`
- `tests/severity.test.js`, `tests/normalize.test.js`, `tests/filter.test.js`, `tests/snapshot.test.js`, `tests/cities.test.js`

**Modify:**
- `package.json` — scripts + devDependency (vitest)
- `js/config.js` — declare `SNAPSHOT_EVENTS`, `snapshotVisible`, `_snapshotFetchedAt`
- `js/overlay.js` — `toggleCities()` reads static JSON instead of Supabase
- `js/globe.js` — `makeAuspexEventMarker()`, render block + dispatch + rings
- `js/analyst.js` — `buildMapKey()` reads live `SNAPSHOT_EVENTS`
- `js/main.js` — schedule `fetchSnapshot()`
- `index.html` — load `js/snapshot.js`, add `#lc-events` button
- `css/meridian.css` — `.auspex-*` marker styles + `@keyframes auspex-pulse`
- `.gitignore` — ignore `/snapshot.json`
- `js/keys.example.js` — document `AUSPEX_LLM_KEY`

---

## Task 1: Add Vitest test infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: Add scripts + devDependency to `package.json`**

```json
{
  "name": "auspex",
  "private": true,
  "version": "0.1.0",
  "description": "AUSPEX — a living instrument for watching over the world. Planetary early-warning commons, built on the Meridian globe platform.",
  "scripts": {
    "dev": "npx -y serve -l 8800 -s .",
    "worker": "node worker/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Step 3: Install**

Run: `cd /Users/connorevans/Downloads/AUSPEX && npm install`
Expected: vitest added under `node_modules`, no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json vitest.config.js
git commit -m "chore: add vitest test infrastructure"
```

---

## Task 2: Severity module (TDD)

**Files:**
- Create: `src/severity.js`
- Test: `tests/severity.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/severity.test.js
import { describe, it, expect } from 'vitest';
import { quakeMagnitudeToSeverity, severityToBand, severityToColor, severityToRadius } from '../src/severity.js';

describe('quakeMagnitudeToSeverity', () => {
  it('clamps below 3 to 0', () => expect(quakeMagnitudeToSeverity(2)).toBe(0));
  it('M9 maps to 1.0', () => expect(quakeMagnitudeToSeverity(9)).toBe(1));
  it('M6 maps to 0.5', () => expect(quakeMagnitudeToSeverity(6)).toBe(0.5));
});
describe('severityToBand', () => {
  it('0.1 is minor', () => expect(severityToBand(0.1)).toBe('minor'));
  it('0.72 is major', () => expect(severityToBand(0.72)).toBe('major'));
  it('0.95 is great', () => expect(severityToBand(0.95)).toBe('great'));
});
describe('severityToColor', () => {
  it('high peril is red', () => expect(severityToColor(0.8, 'peril')).toBe('#FF2D55'));
  it('low breakthrough is blue', () => expect(severityToColor(0.3, 'breakthrough')).toBe('#007AFF'));
});
describe('severityToRadius', () => {
  it('0 severity is base radius', () => expect(severityToRadius(0)).toBe(1.5));
  it('1.0 severity is max radius', () => expect(severityToRadius(1)).toBe(7));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- severity`
Expected: FAIL — cannot resolve `../src/severity.js`.

- [ ] **Step 3: Write minimal implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- severity`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/severity.js tests/severity.test.js
git commit -m "feat: severity math module (magnitude/band/color/radius)"
```

---

## Task 3: Snapshot normalizers (TDD)

**Files:**
- Create: `src/normalize.js`
- Test: `tests/normalize.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/normalize.test.js
import { describe, it, expect } from 'vitest';
import { normalizeUSGSFeature, normalizeGDACSItem, validateSnapshotEvent } from '../src/normalize.js';

const usgsFeature = {
  id: 'us7000abcd',
  properties: { mag: 6.4, time: 1718000000000, place: '28 km W of Coastline' },
  geometry: { coordinates: [-71.9, -33.1, 10] },
};

describe('normalizeUSGSFeature', () => {
  const e = normalizeUSGSFeature(usgsFeature);
  it('prefixes id with usgs:', () => expect(e.id).toBe('usgs:us7000abcd'));
  it('maps lat/lng from [lng,lat,depth]', () => { expect(e.lat).toBe(-33.1); expect(e.lng).toBe(-71.9); });
  it('is a confirmed disaster earthquake', () => {
    expect(e.sense).toBe('disaster'); expect(e.type).toBe('earthquake');
    expect(e.polarity).toBe('peril'); expect(e.confidence).toBe('confirmed');
  });
  it('severity within 0..1', () => { expect(e.severity).toBeGreaterThanOrEqual(0); expect(e.severity).toBeLessThanOrEqual(1); });
  it('passes validation', () => expect(validateSnapshotEvent(e)).toBe(true));
});

const gdacsItem = {
  properties: { eventid: 'TC123', eventtype: 'TC', name: 'Cyclone Test', alertscore: 80,
    fromdate: '2026-06-17T00:00:00Z', description: 'A tropical cyclone.', url: { report: 'https://gdacs.org/x' } },
  geometry: { coordinates: [120.0, 14.0] },
};

describe('normalizeGDACSItem', () => {
  const e = normalizeGDACSItem(gdacsItem);
  it('maps eventtype TC to cyclone', () => expect(e.type).toBe('cyclone'));
  it('clamps severity to 0..1', () => { expect(e.severity).toBeGreaterThanOrEqual(0); expect(e.severity).toBeLessThanOrEqual(1); });
  it('passes validation', () => expect(validateSnapshotEvent(e)).toBe(true));
});

describe('validateSnapshotEvent', () => {
  it('rejects NaN coordinates', () => expect(validateSnapshotEvent({ ...normalizeUSGSFeature(usgsFeature), lat: NaN })).toBe(false));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- normalize`
Expected: FAIL — cannot resolve `../src/normalize.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/normalize.js — pure, no I/O, no globals
import { quakeMagnitudeToSeverity, severityToBand } from './severity.js';

export function normalizeUSGSFeature(f) {
  const mag = f.properties.mag ?? 0;
  const severity = quakeMagnitudeToSeverity(mag);
  const depth = f.geometry.coordinates[2];
  return {
    id: `usgs:${f.id}`,
    sense: 'disaster',
    type: 'earthquake',
    polarity: 'peril',
    title: `M${mag.toFixed(1)} earthquake`,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    metric: { label: 'magnitude', value: mag, band: severityToBand(severity) },
    severity,
    confidence: 'confirmed',
    occurredAt: new Date(f.properties.time).toISOString(),
    brief: `Magnitude ${mag.toFixed(1)} earthquake. Depth ${Math.round(depth)} km. ${f.properties.place}.`,
    sources: [{ name: 'USGS', url: `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}/executive` }],
    links: [],
    icon: 'earthquake',
  };
}

export function normalizeGDACSItem(item) {
  const p = item.properties ?? {};
  const severity = Math.min(1, Math.max(0, (p.alertscore ?? 0) / 100));
  const typeMap = { EQ: 'earthquake', TC: 'cyclone', FL: 'flood', VO: 'volcano', DR: 'drought', WF: 'fire' };
  const type = typeMap[p.eventtype] ?? 'disaster';
  const coords = item.geometry?.coordinates ?? [0, 0];
  return {
    id: `gdacs:${p.eventid ?? `${type}-${coords[0]}-${coords[1]}`}`,
    sense: 'disaster',
    type,
    polarity: 'peril',
    title: p.name ?? 'GDACS event',
    lat: coords[1] ?? 0,
    lng: coords[0] ?? 0,
    metric: { label: 'alert', value: p.alertscore ?? 0, band: severity > 0.66 ? 'red' : severity > 0.33 ? 'orange' : 'green' },
    severity,
    confidence: 'confirmed',
    occurredAt: p.fromdate ?? new Date().toISOString(),
    brief: p.description ?? p.name ?? '',
    sources: [{ name: 'GDACS', url: p.url?.report ?? 'https://gdacs.org' }],
    links: [],
    icon: type,
  };
}

export function validateSnapshotEvent(e) {
  return (
    typeof e.id === 'string' && e.id.length > 0 &&
    typeof e.lat === 'number' && !Number.isNaN(e.lat) &&
    typeof e.lng === 'number' && !Number.isNaN(e.lng) &&
    typeof e.severity === 'number' && e.severity >= 0 && e.severity <= 1 &&
    (e.confidence === 'confirmed' || e.confidence === 'unconfirmed') &&
    typeof e.brief === 'string'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/normalize.js tests/normalize.test.js
git commit -m "feat: USGS/GDACS snapshot normalizers + validator"
```

---

## Task 4: Filter predicate + map-key derivation (TDD)

**Files:**
- Create: `src/filter.js`
- Test: `tests/filter.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/filter.test.js
import { describe, it, expect } from 'vitest';
import { buildFilterPredicate, applyFilter, deriveMapKeyRows } from '../src/filter.js';

const now = Date.now();
const events = [
  { id:'a', sense:'disaster', type:'earthquake', severity:0.8, confidence:'confirmed', occurredAt:new Date(now-3600_000).toISOString() },
  { id:'b', sense:'disaster', type:'flood',      severity:0.2, confidence:'unconfirmed', occurredAt:new Date(now-3600_000).toISOString() },
  { id:'c', sense:'space',    type:'launch',     severity:0.9, confidence:'confirmed', occurredAt:new Date(now-1000*3600*100).toISOString() },
];

describe('applyFilter', () => {
  it('confirmedOnly removes unconfirmed', () => expect(applyFilter(events, { confirmedOnly:true }).map(e=>e.id)).toEqual(['a','c']));
  it('minSeverity removes low severity', () => expect(applyFilter(events, { minSeverity:0.5 }).map(e=>e.id)).toEqual(['a','c']));
  it('senses filter keeps only listed senses', () => expect(applyFilter(events, { senses:['disaster'] }).map(e=>e.id)).toEqual(['a','b']));
  it('timeWindowHours removes old events', () => expect(applyFilter(events, { timeWindowHours:48 }).map(e=>e.id)).toEqual(['a','b']));
});

describe('deriveMapKeyRows', () => {
  const rows = deriveMapKeyRows(events, [{ icon_type:'capital' }], { senses:['disaster'], timeWindowHours:48 });
  it('includes a disaster section', () => expect(rows.some(r=>r.section==='DISASTER EVENTS')).toBe(true));
  it('includes earthquake and flood types only', () => {
    const types = rows.filter(r=>r.icon).map(r=>r.icon).sort();
    expect(types).toEqual(['earthquake','flood']);
  });
  it('flags unconfirmed when present', () => expect(rows.some(r=>r.special==='unconfirmed')).toBe(true));
  it('includes a city section when cities present', () => expect(rows.some(r=>r.section==='CITY LAYER')).toBe(true));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- filter`
Expected: FAIL — cannot resolve `../src/filter.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/filter.js — pure, no I/O, no globals
export function buildFilterPredicate(f = {}) {
  const { senses, minSeverity = 0, confirmedOnly = false, timeWindowHours = 48 } = f;
  const cutoff = Date.now() - timeWindowHours * 3600_000;
  return (event) => {
    if (senses?.length && !senses.includes(event.sense)) return false;
    if ((event.severity ?? 0) < minSeverity) return false;
    if (confirmedOnly && event.confidence !== 'confirmed') return false;
    if (new Date(event.occurredAt).getTime() < cutoff) return false;
    return true;
  };
}

export function applyFilter(events, filterState) {
  return events.filter(buildFilterPredicate(filterState));
}

export function deriveMapKeyRows(events, cities = [], activeFilters = {}) {
  const rows = [];
  const visible = events.filter(buildFilterPredicate(activeFilters));
  const seenSenses = new Set(visible.map(e => e.sense));
  const seenTypes = [...new Set(visible.map(e => e.type))].sort();
  const hasUnconfirmed = visible.some(e => e.confidence === 'unconfirmed');
  if (seenSenses.has('disaster')) rows.push({ section: 'DISASTER EVENTS' });
  seenTypes.forEach(t => rows.push({ icon: t, sense: 'disaster' }));
  if (hasUnconfirmed) rows.push({ special: 'unconfirmed' });
  if (cities.length) {
    rows.push({ section: 'CITY LAYER' });
    [...new Set(cities.map(c => c.icon_type))].forEach(t => rows.push({ cityType: t }));
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- filter`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/filter.js tests/filter.test.js
git commit -m "feat: filter predicate + live map-key row derivation"
```

---

## Task 5: Generate the 1,000-city dataset

**Files:**
- Create: `scripts/gen-cities.mjs`
- Create: `data/cities-1000.json` (generated output, committed)
- Test: `tests/cities.test.js`

- [ ] **Step 1: Write the generator**

```js
// scripts/gen-cities.mjs
// One-time generator. Requires GeoNames cities15000.txt (public domain, CC-BY).
// Download first:
//   curl -sL https://download.geonames.org/export/dump/cities15000.zip -o /tmp/cities15000.zip
//   unzip -o /tmp/cities15000.zip -d /tmp
// Then: node scripts/gen-cities.mjs
import { readFileSync, writeFileSync } from 'fs';

const TSV = '/tmp/cities15000.txt';
// GeoNames "geoname" table columns (tab-separated):
// 1 name, 4 latitude, 5 longitude, 7 feature code, 8 country code, 14 population
const FINANCIAL = new Set(['New York','London','Tokyo','Hong Kong','Singapore','Shanghai','Frankfurt','Zurich','Chicago','Toronto','Sydney','Shenzhen','Dubai']);
const PORTS     = new Set(['Rotterdam','Shanghai','Singapore','Busan','Hamburg','Antwerp','Los Angeles','Long Beach','Ningbo','Guangzhou','Jebel Ali','Tanjung Pelepas']);

const rows = readFileSync(TSV, 'utf8').split('\n').filter(Boolean).map(line => {
  const c = line.split('\t');
  return { name: c[2], lat: +c[4], lng: +c[5], fcode: c[7], iso2: c[8], population: +c[14] || 0 };
});

// Rank: capitals first, then by population. Keep top ~1000 distinct names.
const capitals = rows.filter(r => r.fcode === 'PPLC');
const others   = rows.filter(r => r.fcode !== 'PPLC').sort((a, b) => b.population - a.population);
const chosen = [];
const seen = new Set();
for (const r of [...capitals, ...others]) {
  if (seen.has(r.name)) continue;
  seen.add(r.name);
  chosen.push(r);
  if (chosen.length >= 1000) break;
}

function iconType(r) {
  if (r.fcode === 'PPLC') return 'capital';
  if (FINANCIAL.has(r.name)) return 'financial';
  if (PORTS.has(r.name)) return 'port';
  return 'city';
}
function tier(r) {
  if (r.fcode === 'PPLC' || r.population >= 5_000_000) return 1;
  if (r.population >= 1_000_000) return 2;
  return 3;
}

const out = chosen.map(r => ({
  name: r.name, country: r.iso2, iso2: r.iso2,
  lat: +r.lat.toFixed(4), lng: +r.lng.toFixed(4),
  population: r.population,
  is_capital: r.fcode === 'PPLC',
  is_financial: FINANCIAL.has(r.name),
  is_port: PORTS.has(r.name),
  strategic_tier: tier(r),
  icon_type: iconType(r),
}));

writeFileSync(new URL('../data/cities-1000.json', import.meta.url), JSON.stringify(out));
console.log(`wrote data/cities-1000.json (${out.length} cities)`);
```

- [ ] **Step 2: Run the generator**

```bash
cd /Users/connorevans/Downloads/AUSPEX
curl -sL https://download.geonames.org/export/dump/cities15000.zip -o /tmp/cities15000.zip
unzip -o /tmp/cities15000.zip -d /tmp
node scripts/gen-cities.mjs
```
Expected: `wrote data/cities-1000.json (1000 cities)`.

- [ ] **Step 3: Write the schema validation test**

```js
// tests/cities.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const cities = JSON.parse(readFileSync(new URL('../data/cities-1000.json', import.meta.url)));

describe('cities-1000.json', () => {
  it('has at least 800 entries', () => expect(cities.length).toBeGreaterThan(800));
  it('every entry has valid fields', () => {
    const ALLOWED = ['capital','financial','port','military','naval','energy','diplomatic','city'];
    cities.forEach(c => {
      expect(typeof c.lat).toBe('number');
      expect(typeof c.lng).toBe('number');
      expect(typeof c.name).toBe('string');
      expect(ALLOWED).toContain(c.icon_type);
      expect([1, 2, 3]).toContain(c.strategic_tier);
    });
  });
  it('includes capitals', () => expect(cities.some(c => c.is_capital)).toBe(true));
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cities`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-cities.mjs data/cities-1000.json tests/cities.test.js
git commit -m "feat: generate committed 1,000-relevant-cities dataset"
```

---

## Task 6: Source cities from static JSON (replace Supabase)

**Files:**
- Modify: `js/overlay.js:748-759`

- [ ] **Step 1: Replace the Supabase fetch in `toggleCities()`**

Find (`js/overlay.js` ~line 748):

```js
let _citiesFetched = false;
function toggleCities() {
  citiesVisible = !citiesVisible;
  document.getElementById('lc-cities').classList.toggle('on', citiesVisible);
  if (citiesVisible && !_citiesFetched) {
    _citiesFetched = true;
    sbFetchCities(2).then(cities => {
      if (cities.length) { CITY_DATA = cities; }
      updateAllGlobeElements();
    }).catch(e => { console.warn('[MERIDIAN] City fetch failed:', e.message); updateAllGlobeElements(); });
  } else {
    updateAllGlobeElements();
  }
}
```

Replace with:

```js
let _citiesFetched = false;
function toggleCities() {
  citiesVisible = !citiesVisible;
  document.getElementById('lc-cities').classList.toggle('on', citiesVisible);
  if (citiesVisible && !_citiesFetched) {
    _citiesFetched = true;
    fetch('data/cities-1000.json')
      .then(r => r.json())
      .then(cities => { if (cities.length) { CITY_DATA = cities; } updateAllGlobeElements(); })
      .catch(e => { console.warn('[AUSPEX] Cities load failed:', e.message); updateAllGlobeElements(); });
  } else {
    updateAllGlobeElements();
  }
}
```

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev` (serves on 8800). Open http://localhost:8800, toggle the CITIES layer on.
Expected: ~1,000 city markers appear on the globe (capitals/financial/port styled via existing `makeCityMarker`). Console shows no `[AUSPEX] Cities load failed`.

- [ ] **Step 3: Commit**

```bash
git add js/overlay.js
git commit -m "feat: source city layer from static cities-1000.json (keyless)"
```

---

## Task 7: Scaffold the Node/Express worker (port 8801)

**Files:**
- Create: `worker/package.json`, `worker/index.js`
- Modify: `.gitignore` (add `/snapshot.json`)

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "auspex-worker",
  "private": true,
  "type": "module",
  "scripts": { "start": "node index.js" },
  "dependencies": { "express": "^4.18.2" }
}
```

- [ ] **Step 2: Create `worker/index.js`**

```js
import express from 'express';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pollAll } from './poller.js';

const SNAPSHOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../snapshot.json');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8800');
  next();
});

app.get('/snapshot.json', (req, res) => {
  if (existsSync(SNAPSHOT_PATH)) return res.sendFile(SNAPSHOT_PATH);
  res.json({ generatedAt: new Date().toISOString(), version: 1, events: [] });
});

app.listen(8801, () => console.log('[AUSPEX worker] listening on :8801'));

pollAll();
setInterval(pollAll, 3 * 60 * 1000);
```

- [ ] **Step 3: Add `/snapshot.json` to `.gitignore`**

Append to `.gitignore`:
```
# live snapshot (generated by the worker)
/snapshot.json
```

- [ ] **Step 4: Install worker deps**

Run: `cd /Users/connorevans/Downloads/AUSPEX/worker && npm install`
Expected: express installed; no errors. (Worker will not boot yet — `poller.js` arrives in Task 9. That is expected.)

- [ ] **Step 5: Commit**

```bash
cd /Users/connorevans/Downloads/AUSPEX
git add worker/package.json worker/index.js .gitignore
git commit -m "feat: scaffold snapshot worker (express, :8801, CORS)"
```

---

## Task 8: Snapshot assembly module (TDD)

**Files:**
- Create: `worker/snapshot.js`
- Test: `tests/snapshot.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/snapshot.test.js
import { describe, it, expect } from 'vitest';
import { buildSnapshot, dedupeById } from '../worker/snapshot.js';

const goodEvent = {
  id: 'usgs:us7000test', sense: 'disaster', type: 'earthquake', polarity: 'peril',
  title: 'M5.5 earthquake', lat: 35.0, lng: 139.0,
  metric: { label: 'magnitude', value: 5.5, band: 'moderate' },
  severity: 0.42, confidence: 'confirmed',
  occurredAt: new Date().toISOString(), brief: 'Test event.',
  sources: [], links: [], icon: 'earthquake',
};

describe('buildSnapshot', () => {
  it('includes valid events and sets version/generatedAt', () => {
    const snap = buildSnapshot([goodEvent]);
    expect(snap.events).toHaveLength(1);
    expect(snap.version).toBe(1);
    expect(typeof snap.generatedAt).toBe('string');
  });
  it('excludes invalid events', () => {
    const snap = buildSnapshot([{ ...goodEvent, lat: NaN }]);
    expect(snap.events).toHaveLength(0);
  });
});

describe('dedupeById', () => {
  it('keeps one event per id', () => {
    expect(dedupeById([goodEvent, { ...goodEvent }, { ...goodEvent, id: 'gdacs:x' }])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- snapshot`
Expected: FAIL — cannot resolve `../worker/snapshot.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// worker/snapshot.js
import { writeFileSync } from 'fs';
import { validateSnapshotEvent } from '../src/normalize.js';

export function dedupeById(events) {
  const map = new Map();
  for (const e of events) if (!map.has(e.id)) map.set(e.id, e);
  return [...map.values()];
}

export function buildSnapshot(events) {
  return {
    generatedAt: new Date().toISOString(),
    version: 1,
    events: dedupeById(events).filter(validateSnapshotEvent),
  };
}

export function writeSnapshot(snapshot, filePath) {
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- snapshot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/snapshot.js tests/snapshot.test.js
git commit -m "feat: snapshot assembly (dedupe + validate + write)"
```

---

## Task 9: Sense ingestion + poller + reasoning (worker wiring)

**Files:**
- Create: `worker/senses/usgs.js`, `worker/senses/gdacs.js`, `worker/reason.js`, `worker/poller.js`

- [ ] **Step 1: Create `worker/senses/usgs.js`**

```js
import { normalizeUSGSFeature } from '../../src/normalize.js';
const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';
export async function fetchUSGSEvents() {
  const r = await fetch(USGS_URL, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`USGS HTTP ${r.status}`);
  const d = await r.json();
  return d.features.map(normalizeUSGSFeature);
}
```

- [ ] **Step 2: Create `worker/senses/gdacs.js`**

```js
import { normalizeGDACSItem } from '../../src/normalize.js';
const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Orange,Red&limit=50';
export async function fetchGDACSEvents() {
  try {
    const r = await fetch(GDACS_URL, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`GDACS HTTP ${r.status}`);
    const d = await r.json();
    const features = d.features ?? d.events ?? [];
    return features.map(normalizeGDACSItem);
  } catch (e) {
    console.warn('[AUSPEX worker] GDACS degrade:', e.message);
    return [];
  }
}
```

- [ ] **Step 3: Create `worker/reason.js`**

```js
// Optional LLM reasoning pass. Degrades gracefully — returns events unchanged if no key.
export async function runReasoningPass(events, llmApiKey = null) {
  if (!llmApiKey) return events; // keyless degrade; Plan 2 enriches briefs here
  return events;
}
```

- [ ] **Step 4: Create `worker/poller.js`**

```js
import { fileURLToPath } from 'url';
import path from 'path';
import { fetchUSGSEvents } from './senses/usgs.js';
import { fetchGDACSEvents } from './senses/gdacs.js';
import { runReasoningPass } from './reason.js';
import { buildSnapshot, writeSnapshot } from './snapshot.js';

const SNAPSHOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../snapshot.json');

export async function pollAll() {
  console.log('[AUSPEX worker] polling senses...');
  const [usgs, gdacs] = await Promise.all([
    fetchUSGSEvents().catch(e => { console.warn('USGS failed:', e.message); return []; }),
    fetchGDACSEvents().catch(e => { console.warn('GDACS failed:', e.message); return []; }),
  ]);
  const events = await runReasoningPass([...usgs, ...gdacs], process.env.AUSPEX_LLM_KEY ?? null);
  const snapshot = buildSnapshot(events);
  writeSnapshot(snapshot, SNAPSHOT_PATH);
  console.log(`[AUSPEX worker] wrote snapshot.json (${snapshot.events.length} events)`);
}
```

- [ ] **Step 5: Boot the worker and verify it writes a real snapshot**

Run: `cd /Users/connorevans/Downloads/AUSPEX && npm run worker`
Expected: logs `listening on :8801`, then `wrote snapshot.json (N events)` with N > 0 (real recent quakes).
Then in another shell: `curl -s http://localhost:8801/snapshot.json | head -c 300` shows valid JSON with an `events` array. Stop the worker (Ctrl-C) when confirmed.

- [ ] **Step 6: Commit**

```bash
git add worker/senses/usgs.js worker/senses/gdacs.js worker/reason.js worker/poller.js
git commit -m "feat: USGS+GDACS ingestion, poller, degradable reasoning pass"
```

---

## Task 10: Frontend snapshot state + fetch loop

**Files:**
- Modify: `js/config.js` (after line 159)
- Create: `js/snapshot.js`
- Modify: `index.html` (script tag + `#lc-events` button)
- Modify: `js/main.js` (after line 53)

- [ ] **Step 1: Declare globals in `js/config.js`**

Add after the last layer-state declaration (~line 159):

```js
// AUSPEX snapshot layer
let SNAPSHOT_EVENTS = [];
let snapshotVisible = true;
let _snapshotFetchedAt = 0;
```

- [ ] **Step 2: Create `js/snapshot.js`**

```js
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
```

- [ ] **Step 3: Load `js/snapshot.js` and add the EVENTS button in `index.html`**

In `index.html`, add immediately after the `<script src="js/config.js"></script>` line:
```html
<script src="js/snapshot.js"></script>
```
And inside `#layer-ctrl`, after the cities button (`#lc-cities`):
```html
<button class="lc-btn on" id="lc-events" onclick="toggleSnapshotEvents()" title="Disaster events layer">EVENTS</button>
```

- [ ] **Step 4: Schedule the fetch in `js/main.js`**

Add after the `fetchEarthquakes()` setTimeout (~line 53):
```js
setTimeout(() => fetchSnapshot(), 3000);
setInterval(() => fetchSnapshot(), 3 * 60 * 1000);
```

- [ ] **Step 5: Verify wiring (no render yet)**

Run the worker (`npm run worker`) and the frontend (`npm run dev`). Open http://localhost:8800.
Expected: console logs `[AUSPEX] snapshot loaded: N events`. No visual markers yet (rendering is Task 11) — confirm no errors.

- [ ] **Step 6: Commit**

```bash
git add js/config.js js/snapshot.js index.html js/main.js
git commit -m "feat: frontend snapshot state + scheduled fetch from worker"
```

---

## Task 11: Render events on the globe

**Files:**
- Modify: `js/globe.js` (`_updateAllGlobeElementsNow` render block ~line 493, dispatch ~line 523, rings ~line 582; add `makeAuspexEventMarker` ~after line 347)
- Modify: `css/meridian.css`

- [ ] **Step 1: Add `makeAuspexEventMarker()` to `js/globe.js`**

Add after `makeEqMarker` (~line 347):

```js
function makeAuspexEventMarker(event) {
  const sev = event.severity ?? 0;
  const color = event.polarity === 'breakthrough'
    ? (sev > 0.7 ? '#5AC8FA' : '#007AFF')
    : (sev > 0.7 ? '#FF2D55' : sev > 0.4 ? '#FF9F0A' : '#FFD60A');
  const size = 8 + sev * 14;
  const unconfirmed = event.confidence === 'unconfirmed';
  const d = document.createElement('div');
  d.className = `auspex-m auspex-${event.type}${unconfirmed ? ' auspex-unconfirmed' : ''}`;
  d.style.cssText = `color:${color};position:relative;transform:translate(-50%,-50%)`;
  d.innerHTML =
    `<div class="auspex-ring" style="width:${size*2}px;height:${size*2}px;border:1px ${unconfirmed?'dashed':'solid'} ${color}${unconfirmed?'66':'99'};border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);animation:auspex-pulse 2.4s ease-out infinite"></div>` +
    `<div class="auspex-core" style="width:${size}px;height:${size}px;background:${color};border-radius:50%;box-shadow:0 0 ${Math.round(sev*12)}px ${color}bb;opacity:${unconfirmed?0.6:1}"></div>` +
    `<div class="auspex-tip">${event.title}</div>`;
  d.addEventListener('click', e => { e.stopPropagation(); openAuspexEventCard(event); });
  return d;
}
```

- [ ] **Step 2: Push events into `visual[]` and dispatch**

In `_updateAllGlobeElementsNow()`, after the `if (citiesVisible && CITY_DATA.length) {...}` block (~line 494):
```js
if (snapshotVisible && SNAPSHOT_EVENTS.length) {
  SNAPSHOT_EVENTS.forEach(e => visual.push({ ...e, _type: 'auspex_event' }));
}
```
In the `htmlElement` dispatch (~line 523), add before the final fallback `return makeMarker(item);`:
```js
if (item._type === 'auspex_event') return makeAuspexEventMarker(item);
```

- [ ] **Step 3: Add high-severity event rings**

Replace the `G.ringsData([..._brkRings, ...EQ_DATA.filter(e=>e.mag>=6.5), ..._conflictRings])` call (~line 582) with:
```js
const _auspexRings = snapshotVisible ? SNAPSHOT_EVENTS.filter(e => (e.severity ?? 0) >= 0.5) : [];
G.ringsData([..._brkRings, ...EQ_DATA.filter(e=>e.mag>=6.5), ..._conflictRings, ..._auspexRings]);
```

- [ ] **Step 4: Add marker CSS to `css/meridian.css`**

```css
.auspex-m { cursor:pointer; }
.auspex-tip { position:absolute; top:120%; left:50%; transform:translateX(-50%);
  font:500 9px/1 var(--f-mono,monospace); color:#cfe0f5; white-space:nowrap;
  opacity:0; transition:opacity .15s; pointer-events:none; letter-spacing:.05em; }
.auspex-m:hover .auspex-tip { opacity:1; }
@keyframes auspex-pulse {
  0%   { opacity:.9; transform:translate(-50%,-50%) scale(1); }
  100% { opacity:0;  transform:translate(-50%,-50%) scale(2.8); }
}
```

- [ ] **Step 5: Verify on the globe**

Run worker + `npm run dev`. Open http://localhost:8800.
Expected: live quake/disaster events appear as pulsing severity-colored markers; high-severity ones have expanding rings; unconfirmed (if any) render dashed/dimmed; hover shows the title tooltip.

- [ ] **Step 6: Commit**

```bash
git add js/globe.js css/meridian.css
git commit -m "feat: render snapshot events as holographic globe markers + rings"
```

---

## Task 12: Honest event cards

**Files:**
- Modify: `js/globe.js` (add `openAuspexEventCard`)
- Modify: `css/meridian.css` (add `.art-panel--event` styling)

- [ ] **Step 1: Add `openAuspexEventCard()` to `js/globe.js`**

Add near `openCityPanel` (reuses the existing `#art-panel` slots from `js/ui.js`):

```js
function openAuspexEventCard(event) {
  const panel = document.getElementById('art-panel');
  if (!panel) return;
  const sev = event.severity ?? 0;
  const sevColor = event.polarity === 'breakthrough'
    ? (sev > 0.7 ? '#5AC8FA' : '#007AFF')
    : (sev > 0.7 ? '#FF2D55' : sev > 0.4 ? '#FF9F0A' : '#FFD60A');
  const confirmed = event.confidence === 'confirmed';
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  panel.classList.add('art-panel--event');
  set('ap-cat', event.type.toUpperCase());
  const brk = document.getElementById('ap-brk');
  if (brk) { brk.textContent = confirmed ? 'CONFIRMED' : 'UNCONFIRMED'; brk.style.color = confirmed ? '#30D158' : '#FF9F0A'; brk.style.display = ''; }
  set('ap-title', event.title);
  set('ap-src', (event.sources || []).map(s => s.name).join(' · '));
  set('ap-time', new Date(event.occurredAt).toLocaleString());
  set('ap-region', `${event.metric?.label ?? ''}: ${event.metric?.value ?? ''} (${event.metric?.band ?? ''})`);
  set('ap-lead', event.brief || '');
  set('ap-text', '');
  const cdot = document.getElementById('ap-cdot'); if (cdot) cdot.style.background = sevColor;
  const link = document.getElementById('ap-link');
  if (link && event.sources?.[0]) { link.href = event.sources[0].url; link.textContent = 'SOURCES ›'; link.style.display = ''; }
  panel.classList.add('open');
}
```

- [ ] **Step 2: Add event-card styling to `css/meridian.css`**

```css
.art-panel--event #ap-lead { font-size:13px; line-height:1.6; color:#cfe0f5; }
.art-panel--event #ap-brk { border:1px solid currentColor; border-radius:999px; padding:2px 8px; font-size:9px; letter-spacing:.14em; }
```

- [ ] **Step 3: Verify**

Run worker + `npm run dev`. Click an event marker.
Expected: the panel opens showing TYPE, a CONFIRMED/UNCONFIRMED chip, title, the plain-language brief, the metric line, a severity-colored dot, and a `SOURCES ›` link that opens the real source URL.

- [ ] **Step 4: Commit**

```bash
git add js/globe.js css/meridian.css
git commit -m "feat: honest event cards (confidence chip + brief + sources)"
```

---

## Task 13: Live, collapsible map key

**Files:**
- Modify: `js/analyst.js` (`buildMapKey` ~line 893)

- [ ] **Step 1: Prepend live event rows in `buildMapKey()`**

At the start of `buildMapKey()` (before the existing static `rows`), build live rows from `SNAPSHOT_EVENTS` and `CITY_DATA`:

```js
function buildMapKey() {
  const rows = [];
  // AUSPEX live disaster events (derived from what is actually on the globe)
  if (typeof SNAPSHOT_EVENTS !== 'undefined' && SNAPSHOT_EVENTS.length) {
    rows.push({ s: 'DISASTER EVENTS (LIVE)' });
    [...new Set(SNAPSHOT_EVENTS.map(e => e.type))].sort().forEach(type => {
      rows.push({ dot: '#FF6D00', lbl: type.charAt(0).toUpperCase() + type.slice(1) });
    });
    if (SNAPSHOT_EVENTS.some(e => e.confidence === 'unconfirmed')) {
      rows.push({ dot: '#FF9F0A', lbl: 'Dashed ring — unconfirmed / preliminary' });
    }
    rows.push({ dot: '#FF2D55', lbl: 'Solid ring — confirmed event' });
  }
  if (typeof CITY_DATA !== 'undefined' && CITY_DATA.length && citiesVisible) {
    rows.push({ s: 'CITY LAYER (LIVE)' });
    [...new Set(CITY_DATA.map(c => c.icon_type))].forEach(t => {
      rows.push({ dot: '#6674CC', lbl: t.charAt(0).toUpperCase() + t.slice(1) });
    });
  }
  // ... existing static rows continue below (do not remove them) ...
```

Keep the existing static rows after this block (the existing render loop over `rows` into `#mk-list` is unchanged — it already handles `{s}` section headers and `{dot,lbl}` entries).

- [ ] **Step 2: Verify**

Run worker + `npm run dev`. Toggle CITIES on. Open the map key.
Expected: the key shows a live "DISASTER EVENTS (LIVE)" section listing exactly the event types currently present, the confirmed/unconfirmed legend, and a "CITY LAYER (LIVE)" section listing the city icon types present — re-derived each time it opens.

- [ ] **Step 3: Commit**

```bash
git add js/analyst.js
git commit -m "feat: live map key derived from current globe state"
```

---

## Task 14: Document the new key + push the phase

**Files:**
- Modify: `js/keys.example.js`

- [ ] **Step 1: Document the worker LLM key**

Append to `js/keys.example.js`:
```js
// Worker-only (set in the worker's environment as AUSPEX_LLM_KEY, NOT in the browser):
// AUSPEX_LLM_KEY=<YOUR_LLM_KEY>
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass (severity, normalize, filter, snapshot, cities).

- [ ] **Step 3: Commit and push the phase**

```bash
git add js/keys.example.js
git commit -m "docs: document worker AUSPEX_LLM_KEY; Plan 1 foundation complete"
git push
```

---

## Spec Coverage Map (self-review)

- §3 Architecture (snapshot-served, 8800/8801, keyless public path) → Tasks 7–11
- §4 Globe reuse + holographic overlays → Tasks 11
- §5 1,000-city static layer + typed icons + filters → Tasks 5, 6 (filters: `src/filter.js` Task 4)
- §6 Senses (disasters lead: USGS+GDACS keyless) → Task 9
- §7 Reasoning (honest, calibrated, sourced; degradable) → Tasks 3, 9
- §8 Event rendering (severity as light, confirmed/unconfirmed, palettes) → Tasks 2, 11
- §9 Honest event cards → Task 12
- §10 Icon system (disaster + city types) → Tasks 5, 11 (disaster markers); broader icon set continues in Plan 2
- §11 Collapsible live map key → Task 13
- §12 Filters → Task 4 (`src/filter.js`); UI filter controls land with breakthrough senses in Plan 2
- §13 snapshot.json contract → Tasks 3, 8
- §14 Security / keyless public path → Tasks 6 (cities keyless), 9 (worker holds keys), 14
- §16 Ports 8800/8801 → Tasks 1, 7

**Deferred to Plan 2/3 (intentional):** breakthrough senses (space/financial/medical/physics), connection-reasoning arcs (`snapshot.links` rendering), UI filter controls, performance/accessibility/deploy. Noted so coverage gaps are deliberate, not omissions.
