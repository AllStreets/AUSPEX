# AUSPEX — RELIEF Board (Humanitarian Tools)

**Date:** 2026-06-19
**Goal:** A humanitarian counterpart to the military-grade Analyst Board — equally (or more) powerful,
but oriented toward care, relief, and human protection. A new `RELIEF` button above `ANALYST` in the
command panel opens a full board of 8 tools, AI-powered, pin-linked, and woven through the platform
(globe arcs/markers) exactly like the Analyst Board. **Not "done" until all 8 tools are fully built.**

## Integration & architecture
- **Button:** add a `RELIEF` button to `#cmd-panel` in index.html, positioned ABOVE `ANALYST`.
- **Overlay:** `#relief-overlay` (mirror the structure/CSS of `#analyst-overlay`): header, a left tool
  menu (the 8 tools), a main work area where the selected tool renders, and a context strip showing
  the current focus (a pinned region/event/city, or "Global").
- **Context / pinning:** reuse the existing pin pool (`analystAssets` / `pinGeoAsset`) so anything
  pinned anywhere on the platform is available to RELIEF too. A tool acts on the current focus
  (the most recently pinned region/event/city) or Global if nothing is pinned.
- **Code:** new `js/relief.js` (browser globals, loaded after analyst.js). Reuse `callOpenAI(sys,user,maxTokens)`
  from analyst.js for AI tools, and the existing live data globals: `NEWS`, `REGION_DATA`,
  `COUNTRY_DATA`, `CITY_DATA`, `SNAPSHOT_EVENTS`. Reuse the analyst overlay CSS patterns + Living Green theme.
- **Honesty:** AI tools must ground answers in the supplied context (relevant NEWS items, region/event
  data) and state uncertainty + sources. No invented numbers presented as fact — estimates labeled as estimates.
- **No emojis.** Icons via SVG / existing icon system.

## The 8 tools

1. **Situation Report** *(AI; mirrors analyst Synthesize Brief)*
   Input: current focus (pinned region/event/city) or a picked crisis. Builds context from NEWS filtered
   to that area + nearby SNAPSHOT_EVENTS + REGION_DATA. OpenAI generates an honest humanitarian sitrep:
   overview, estimated affected & displaced population (labeled estimate), infrastructure & access status,
   urgent needs by sector (food/water/shelter/health/protection), recommended response, and a confidence
   note. Rendered as a formatted brief; exportable.

2. **Response Council** *(AI; mirrors Consensus Board with humanitarian roles)*
   Five role agents — Logistics & Access, Health & Medical, Shelter & Camp Coordination, Food/Water/WASH,
   Protection & Rights — each give an assessment + top recommended action for the focus crisis (parallel
   OpenAI calls), then a Coordinator synthesizes a prioritized joint response plan. Rendered as role cards
   + synthesis.

3. **Needs & Gaps Matrix** *(algorithmic + optional AI labels; mirrors Escalation Matrix)*
   A grid: sectors {Food, Water/WASH, Shelter, Health, Protection, Logistics} × {Severity, Coverage, Gap}.
   Score each from signals in NEWS/REGION_DATA/events for the focus area (keyword/severity heuristics).
   Color-coded (critical/high/moderate/low) using the warm severity ramp. Click a cell → the supporting
   signals (stories/events) behind that score.

4. **Displacement Tracker** *(data + globe + AI narrative)*
   Identify active displacement from conflict/disaster zones (REGION_DATA conflict zones + high-severity
   events). For each, estimate origin → likely destination countries (neighbors via COUNTRY_DATA / a small
   adjacency heuristic) and draw displacement arcs on the globe (distinct style). List situations with an
   AI one-paragraph narrative each. Toggling the tool shows/hides the arcs.

5. **Famine & Food-Security Watch** *(data + globe + AI)*
   Classify food-security risk (IPC-style 1–5) for at-risk regions, driven by drought events, conflict
   zones, and economic/news signals. List at-risk areas with drivers; render food-security markers/zones
   on the globe. AI gives a short driver explanation per area.

6. **Access & Blackout** *(repurpose SILENCE; data + globe)*
   Reframe the existing information-blackout/silence detection as humanitarian ACCESS: where aid can and
   cannot reach (blackout zones, conflict-sealed areas, persistent dark zones). List zones with access
   status (open / constrained / sealed) and why; render on the globe. Reuse `_silenceAnomalies` + conflict regions.

7. **Recovery Timeline** *(AI; mirrors Narrative Timeline)*
   For a focus crisis (esp. past/ongoing), an AI-generated recovery & reconstruction status: phases,
   what's rebuilt vs outstanding, milestones, and risks to recovery — grounded in available news/history.
   Rendered as a chronological timeline.

8. **Good News** *(data; the progress feed)*
   Humanity's wins: surface breakthrough-polarity events (SNAPSHOT_EVENTS where polarity==='breakthrough')
   plus positive/progress NEWS (the broadened GDELT progress terms), curated into an uplifting feed —
   medical, science, space, social progress — each with its icon + brief + source. The deliberate
   counter-weight to a doom feed.

## Build sequence (each pass fully builds its tools — no stubs)
- **Pass 1:** RELIEF shell (button, overlay, tool menu, context/pin, CSS) + tools 1–3 (Situation Report,
  Response Council, Needs & Gaps Matrix).
- **Pass 2:** tools 4–6 (Displacement Tracker, Famine Watch, Access & Blackout) incl. globe linkage.
- **Pass 3:** tools 7–8 (Recovery Timeline, Good News) + full integration polish + end-to-end verification
  of all 8 tools.

## Done when
All 8 tools open from the RELIEF board, each produces real, grounded output (AI tools return content;
data tools render real data and globe layers), pinning works, and it's verified live. Then merge.
