# AUSPEX — Consolidated Design Spec

**Date:** 2026-06-17
**Status:** Draft for review
**Scope:** The full AUSPEX build, all four phases folded into one effort on the Meridian foundation.

This is the implementation blueprint. It supersedes the narrow "v1 = disasters only" plan: now that
AUSPEX inherits Meridian's working globe platform, we build the whole instrument in one coherent
effort, sequenced so it is shippable and honest at every step. See `docs/VISION.md` for the why.

---

## 1. Goal

A single, beautiful, public, real-time instrument — a living Earth — that senses the world's
**perils** (disasters first, then conflict / supply / climate / health) and its **breakthroughs**
(financial, space, medical, physics, science), reasons over them honestly, draws the connections
between them, and is readable by anyone on any device with no login. The bar: worthy of everyone in
the world. We do not launch publicly until it clears that bar (Phase 4).

## 2. Principles (binding)

- **For everyone.** No login to see the planet. Fast on a cheap phone / weak connection.
- **Honest before impressive.** Confidence and sources on every claim. Unconfirmed signals look
  unconfirmed. Never alarmist, never invented.
- **Keyless public path.** The public frontend ships **no secrets**. All keyed work happens in the
  backend worker; the public reads only a pre-computed snapshot + static assets.
- **A commons, not surveillance.** We watch events and systems, never individuals.
- **Alive, calm, uncluttered.** Severity/significance rendered as light; restraint over density.
  Dark, glowing, icons-only, no emojis.

## 3. Architecture (Approach 1 — snapshot-served)

Two processes, one data contract.

```
   PUBLIC (keyless, edge-cacheable)              PRIVATE (keyed, scheduled)
   ┌───────────────────────────────┐            ┌──────────────────────────────┐
   │ Frontend · static · :8800     │            │ Snapshot worker · Node/Express│
   │  - Meridian globe (NASA d/n)  │  reads     │  :8801                        │
   │  - holographic event overlays │ ◄───────── │  - polls senses on a schedule │
   │  - 1,000-city base layer      │ snapshot   │  - honest-reasoning pass (LLM)│
   │  - honest cards, live map key │  .json     │  - writes snapshot.json       │
   │  - filters                    │  + cities  │  - keys stay server-side      │
   └───────────────────────────────┘            └──────────────────────────────┘
```

- **Frontend (:8800):** the existing vanilla-JS Meridian app. Renders from two static inputs:
  `data/cities-1000.json` (base geography, committed) and `snapshot.json` (live, written by the
  worker / fetched from its public read endpoint or a CDN copy). No API keys in the browser.
- **Worker (:8801):** Node/Express. On a schedule (configurable; default every few minutes per
  sense), it ingests sources, runs the reasoning pass, and writes `snapshot.json`. The only place
  secrets live. Matches the Chicago/Flexport backend pattern; deployable to Railway.
- **Why per-event, not per-visitor:** reasoning runs once per event in the worker, so a million
  visitors cost ~the same as one. This is what makes "free, for everyone" sustainable.

### Decision: the AI reasoning runs in the worker only.
The browser never calls an LLM. This keeps the public path keyless and cheap.

## 4. The globe (reuse + extend Meridian)

Keep Meridian's `js/globe.js`: three-globe render, NASA **Blue Marble (day) / Earth-at-Night
(night)** textures, the day/night toggle, star-field, atmosphere, vignette/scanlines. Extend with a
**holographic overlay layer** for events (rings, arcs, points) built on top of the marble — sparse
and high-tech, never cluttered. The globe is the page, not a widget.

## 5. Base geography — 1,000 relevant cities (Task 3)

Replace the underseeded Supabase `cities` table with a committed static `data/cities-1000.json`:
~1,000 **relevant** cities — capitals, major metros, financial hubs, ports, strategic centers.
Reuse the existing typed fields (`is_capital`, `is_financial`, `is_port`, `strategic_tier`,
`icon_type`). Rendered directly as globe points; **no Supabase dependency** for base geography.

- **Typed city icons** (Task 8 overlap): capital, financial hub, port, megacity, strategic — each a
  distinct SVG marker.
- **Culling:** population / strategic-tier / camera-altitude based, so the globe is never cluttered.
- **Filters:** by city type and tier, region, population.

City record:
```json
{ "name":"Tokyo","country":"Japan","iso2":"JP","lat":35.68,"lng":139.69,
  "population":37400000,"is_capital":true,"is_financial":true,"is_port":true,
  "strategic_tier":1,"icon_type":"capital" }
```

## 6. The senses (data sources, folded across phases)

All senses flow through the worker into one `snapshot.json`. Keyless sources preferred for the
public path; keyed sources run server-side only.

**Perils**
- Disasters (lead): **USGS earthquakes** (GeoJSON, keyless) + **GDACS** multi-hazard (keyless:
  cyclone/flood/volcano/drought). Later: NASA FIRMS fire, conflict, supply, climate, health.

**Breakthroughs**
- **Space:** launches / milestones (e.g., public launch APIs, NASA feeds).
- **Financial:** notable market turns (keyless/low-cost feeds; degrade gracefully).
- **Medical / physics / science:** breakthrough announcements (curated reputable feeds; later
  arXiv / research signals).

Each sense is an independent ingest module with the same output shape, so adding a sense is additive,
never a rewrite. Senses the worker can't reach degrade silently (no fake data).

## 7. The reasoning layer (honest, calibrated, connected)

Per event, the worker produces:
- **severity / significance** (0–1) and a human band (e.g., quake magnitude band).
- **confidence**: `confirmed` (solid) vs `unconfirmed` (shimmer). Calibrated, not decorative.
- **brief**: one honest plain-language paragraph grounded only in the fetched data.
- **sources**: always present, linkable.

**Connection reasoning (Phase 3, Task 9):** a pass that links related events across senses
(e.g., quake → port closure → supply shortage) and emits `links` between event ids, rendered as
arcs. Hallucination is treated as a safety failure; the model connects and explains what is
verifiably present, never invents.

## 8. Event rendering on the globe (Task 5)

- Severity/significance → size + luminance ("severity as light").
- `confirmed` → solid glow; `unconfirmed` → dashed shimmer.
- **Perils vs breakthroughs** use distinct palettes (perils warm/red-amber; breakthroughs cool/cyan-
  violet) so the world's dangers and its progress are legible at a glance.
- `links` → arcs between connected events.
- Reuse Meridian's marker/ring rendering; keep overlays sparse.

## 9. Honest event cards (Task 6)

Adapt Meridian's panel: severity/significance dot, magnitude/metric, **confidence chip**, plain
brief, `SOURCES ›`. Calm, never alarmist; uncertainty explicit. "Pull the thread" expands sources
and connected events.

## 10. Icon system (Task 8)

One coherent SVG icon set, matching the reference-image style, covering:
- **City types:** capital, financial, port, megacity, strategic.
- **Perils:** earthquake, volcano, flood, cyclone, fire, (later conflict/health).
- **Breakthroughs:** space/launch, financial, medical, physics, science.
- **State decorations:** confirmed vs unconfirmed, severity scale.
Icons only, no emojis. High-tech, restrained.

## 11. The collapsible live map key (Task 7)

A pinned, collapsible legend **generated from whatever is currently on the globe** (from the live
snapshot + active filters), so it is never out of sync. Lists every active icon/marker and exactly
what it means: city types, disaster types by magnitude band, breakthrough types, confirmed vs
unconfirmed, the severity color scale. Updates as the snapshot and filters change.

## 12. Filters

A single filter model drives the globe, cards, and map key:
- senses (disaster, space, financial, medical, physics, …)
- polarity (peril / breakthrough / both)
- minimum severity / significance
- confirmed-only
- region
- time window
- city types & tiers

## 13. Data contract — `snapshot.json`

```json
{
  "generatedAt": "2026-06-17T07:00:00Z",
  "version": 1,
  "events": [
    {
      "id": "usgs:us7000abcd",
      "sense": "disaster",
      "type": "earthquake",
      "polarity": "peril",
      "title": "M6.4 earthquake",
      "lat": -33.1, "lng": -71.9,
      "metric": { "label": "magnitude", "value": 6.4, "band": "strong" },
      "severity": 0.72,
      "confidence": "confirmed",
      "occurredAt": "2026-06-17T06:48:00Z",
      "brief": "Strong, shallow quake near a populated coast. Shaking likely felt by ~1.2M people. No tsunami alert issued.",
      "sources": [ { "name": "USGS", "url": "https://earthquake.usgs.gov/..." } ],
      "links": [ "gdacs:TC123" ],
      "icon": "earthquake"
    }
  ]
}
```

Cities are a separate committed file (`data/cities-1000.json`), not part of the live snapshot.

## 14. Security & keys

- `js/keys.js` is gitignored; `js/keys.example.js` is the template. The leaked NewsAPI key was
  scrubbed from the docs.
- The **public frontend ships zero secrets**. The worker holds all keys (LLM, any keyed feeds) and
  exposes only the pre-computed `snapshot.json`.
- Disaster ingestion (USGS/GDACS) is keyless, so the disaster instrument is fully public-safe even
  before any key is configured.

## 15. Worthy & open (Phase 4, Task 10)

Before public launch: performance budget for cheap phones / weak connections (lazy assets, small
snapshot, cached textures), accessibility (readable contrast, keyboard, reduced-motion), no-login
public access, and deploy (static frontend + the 8801 worker; Railway for the worker, static host
for the frontend). Keyless public path verified. Do not launch until the bar is met.

## 16. Ports

- Frontend: **8800** · Worker: **8801** · (Brainstorm companion: ephemeral high port.)
- Clear of the active stack (3000 / 3001 / 5001 / 5173 / 5174 / 5175).

## 17. Build sequence (how the tasks order into one build)

1. **#1 Spec** (this) → review gate.
2. **#2 Loading page / branding** (loading page done; residual purge: `meridian.css` filename,
   `[MERIDIAN]` console tags).
3. **#3 Cities** — `data/cities-1000.json` + typed icons + filters; drop Supabase for geography.
4. **#4 Snapshot worker (8801)** — scaffold Node/Express, disasters first (USGS+GDACS, keyless),
   `snapshot.json` contract, reasoning pass.
5. **#8 Icon system** + **#5 event rendering** + **#6 honest cards** + **#7 live map key** — the
   visible instrument over the snapshot.
6. Add **breakthrough senses** (space/financial/medical/physics) to the worker.
7. **#9 Connection reasoning** — links + arcs.
8. **#10 Worthy & open** — perf, a11y, deploy.
9. **#11** — push to GitHub after each completed phase throughout.

## 18. Success criteria

A person anywhere, on a cheap phone, with no account, opens AUSPEX and within seconds understands
what is happening to the planet right now — perils and breakthroughs — trusts it because every
claim shows its confidence and sources, sees the connections drawn between events, and comes away
more aware and more able to act. The globe is beautiful, powerful, and crystal clear. Nothing on
screen is either clutter or untruth.
