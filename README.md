<div align="center">

<a href="https://auspex-azure.vercel.app" title="Open the live AUSPEX site"><img src=".github/assets/banner.png" alt="AUSPEX — a living instrument for watching over the world — click to open the live site" width="100%"/></a>

&nbsp;

<img alt="senses" src="https://img.shields.io/badge/senses-perils_%2B_breakthroughs-34D399?style=for-the-badge&labelColor=04070b"/>
<img alt="relief tools" src="https://img.shields.io/badge/RELIEF_tools-10-34D399?style=for-the-badge&labelColor=04070b"/>
<img alt="boards" src="https://img.shields.io/badge/tool_boards-2-34D399?style=for-the-badge&labelColor=04070b"/>
<img alt="tests" src="https://img.shields.io/badge/tests-104_passing-A3E635?style=for-the-badge&labelColor=04070b"/>
<a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-34D399?style=for-the-badge&labelColor=04070b"/></a>
<br/>
<img alt="news" src="https://img.shields.io/badge/news-RSS_%2B_GDELT_%2B_NewsAPI_(server--side)-6b7382?style=flat-square&labelColor=04070b"/>
<img alt="globe" src="https://img.shields.io/badge/globe-three--globe_%2F_NASA_marble-6b7382?style=flat-square&labelColor=04070b"/>
<img alt="data" src="https://img.shields.io/badge/data-USGS_%C2%B7_GDACS_%C2%B7_Launch_Library-6b7382?style=flat-square&labelColor=04070b"/>
<img alt="backend" src="https://img.shields.io/badge/worker-node_%2F_express_%C2%B7_supabase-6b7382?style=flat-square&labelColor=04070b"/>

&nbsp;

<a href="#quickstart"><kbd> &nbsp; <strong>Quickstart</strong> &nbsp; </kbd></a> &nbsp;
<a href="#what-it-senses"><kbd> &nbsp; <strong>What it senses</strong> &nbsp; </kbd></a> &nbsp;
<a href="#two-boards"><kbd> &nbsp; <strong>The boards</strong> &nbsp; </kbd></a> &nbsp;
<a href="#how-it-works"><kbd> &nbsp; <strong>Architecture</strong> &nbsp; </kbd></a> &nbsp;
<a href="#deploy"><kbd> &nbsp; <strong>Deploy</strong> &nbsp; </kbd></a>

</div>

---

## What this is

The *auspex* was the one who read the sky for signs and spoke them aloud, so the city could act before the storm. Not a spy — a guardian who turned what the world was already showing into warning, in time for it to matter.

**AUSPEX is that, for the whole planet, for everyone.** A living globe where autonomous pipelines read the world's public signals — earthquakes, floods, cyclones, conflict, displacement, outbreaks, *and* the world's progress: launches, discoveries, medical and scientific breakthroughs — score them honestly, draw the connections between them, and render it all so that *anyone* can see what is actually happening. No login. No Bloomberg terminal. No institutional wall.

It is built against one specific enemy: the version of the world sold by a doom-optimised feed. AUSPEX is calm where the world is calm, lights up where it isn't, reserves red for genuine danger, and carries the good news beside the bad — because awareness, not alarm, is the point.

> *The globe is the page. Red means danger. Everything else is the world, alive.*

---

## How it works

Two processes, one contract — so the public side ships **zero secrets** and a million visitors cost about the same as one.

```
  PUBLIC  (keyless, edge-cacheable)                PRIVATE  (keyed, scheduled)
  ┌──────────────────────────────────┐            ┌────────────────────────────────┐
  │ frontend · static · :8800        │   reads    │ worker · node/express · :8801  │
  │   the living green globe         │ ◄───────── │   USGS + GDACS  (perils)       │
  │   1,000-city base layer          │  snapshot  │   Launch Library 2 (progress)  │
  │   typed event icons + arcs       │   .json    │  RSS + GDELT + NewsAPI (server) │
  │   honest cards · live map key    │  news.json │   honest reasoning (severity,  │
  │   Analyst + RELIEF tool boards   │            │   confidence, links, sources)  │
  └──────────────────────────────────┘            └────────────────────────────────┘
                  │                                              │
                  └────────────  Supabase  ──────────────────────┘
                       persistence · ~2,000-story history · countries · regions
```

The heavy work runs **once per event in the worker**, not once per visitor. That — plus a keyless disaster path (USGS and GDACS need no keys) — is what lets AUSPEX be free, fast on a weak connection, and honest about its sources.

```
  the instrument
  ├─ living globe ......... NASA day/night marble, breathing green aura that
  │                         shifts with world state — red only on real peril
  ├─ 1,000 cities ......... typed + readable — capitals (a gold star), finance, tech,
  │                         ports, tourism, energy, megacities — each its own icon
  ├─ orbiting moon ........ a real-textured Moon on a normal orbit, for depth and life
  ├─ typed event icons .... quake · volcano · flood · cyclone · fire · drought ·
  │                         launch · medical · physics · science · financial
  ├─ connections .......... real links between events close in space + time,
  │                         drawn in light — never invented causation
  ├─ honest cards ......... severity · confidence · plain brief · sources, one tap
  ├─ live map key .......... a legend that derives itself from what's on the globe
  └─ every icon clickable .. nothing on the map is a dead pixel
```

---

## What it senses

AUSPEX reads two halves of the same pulse.

<table>
<tr>
<td valign="top" width="50%">

#### ◆ Perils
| | sensed from |
|---|---|
| earthquakes | USGS (keyless) |
| cyclone · flood · volcano · drought | GDACS (keyless) |
| conflict · unrest | news + regions |
| displacement · famine · access | news + regions |
| outbreaks · civilian harm | news signals |

</td>
<td valign="top" width="50%">

#### ◆ Breakthroughs
| | sensed from |
|---|---|
| space launches · milestones | Launch Library 2 |
| medical · physics · science | news signals |
| financial · technological | news signals |
| human progress | the *Good News* feed |

</td>
</tr>
</table>

The word *auspicious* descends from *auspex* — the watcher announced **favourable** omens too. Carrying the world's breakthroughs beside its perils isn't an add-on; it is the truest form of the name.

---

## Two boards

AUSPEX puts genuinely powerful tools in ordinary hands. Two parallel boards, both AI-powered, both pin-linked to anything on the globe, both grounded in the live feed and Supabase history.

<table>
<tr>
<td valign="top" width="50%">

### ANALYST
*The intelligence lens — military-grade, democratised.*

- Situation Synthesis (AI brief)
- Consensus Board (5-persona panel)
- Red Team / Adversary Playbook
- Escalation Matrix
- Dead Reckoning · Narrative Timeline
- Historical Search · Saved Boards

</td>
<td valign="top" width="50%">

### RELIEF
*The humanitarian lens — its equal, for care.*

- Situation Report · Response Council
- Needs & Gaps Matrix
- Displacement Tracker · Famine & Food-Security Watch
- Access & Blackout · Recovery Timeline
- **Health & Outbreak Watch** · **Civilian Protection**
- Good News — humanity's wins

</td>
</tr>
</table>

Pin a region, event, city, country, or story to either board (the green **PIN TO RELIEF** sits beside every **PIN TO ANALYST**), change focus freely, and run the tools against deep, real context — focus-relevant news, Supabase history, nearby events and their links, full region and country records.

---

## The unbiased feed

The news layer is the anti-social-media core, and it is deliberate:

- **Server-side and broad.** A spread of reputable global RSS feeds (BBC, Guardian, Al Jazeera, NPR, DW, France 24, UN News, ReliefWeb, science desks) as the keyless backbone, plus the GDELT firehose and optional NewsAPI — all fetched server-side, deduped, cached. Perils *and* progress, across regions and viewpoints, with no per-visitor rate limit.
- **Filtered for signal.** A junk filter drops advertisements, PR fluff, and pop-culture/celebrity noise, while a priority allowlist guarantees real geopolitics, economy, disaster, science, and health are never wrongly dropped.
- **Multi-source by design.** **Divergence** compares how Western, Chinese, and Russian outlets cover the same story; **Silence** detects information blackouts; ten global **broadcasters** span all six inhabited continents — North America, South America, Europe, Africa, Asia, and Oceania. You see the spread, not one outlet's frame.

---

## Quickstart

> **Prerequisites:** Node 18+ (24 recommended). Disaster sensing needs **zero** API keys. For the AI tools and the keyed feeds, copy `js/keys.local.example.js` → `js/keys.local.js` (gitignored; sets `window.AUSPEX_KEYS`) and `worker/.env.example` → `worker/.env`. The committed `js/keys.js` is secret-free and falls back to empty keys when `js/keys.local.js` is absent (e.g. on Vercel).

```bash
git clone https://github.com/AllStreets/AUSPEX.git
cd AUSPEX
npm install
npm test                 # 104 passing — the tested core (severity / normalize / filter / news / connect)

# terminal 1 — the worker: senses the world, serves snapshot.json + news.json
cd worker && npm install && cd ..
npm run worker           # http://localhost:8801

# terminal 2 — the living globe
npm run dev              # http://localhost:8800
```

Open **http://localhost:8800**. The globe lights up with live events; toggle **CITIES** for the 1,000-city layer; click any icon for an honest card; open the **MAP KEY** for the live legend; open **ANALYST** or **RELIEF** above it for the tool boards.

---

## Deploy

| piece | host | notes |
|---|---|---|
| frontend | static (Vercel) — `vercel.json` included | point `WORKER_BASE` at the worker URL |
| worker | container (Railway / Render / Fly) — `worker/Dockerfile` included | env: `NEWS_API_KEY`, `AUSPEX_LLM_KEY`, `ALLOWED_ORIGIN` |
| database | Supabase | schema in `sql/schema.sql`; anon key is publishable, RLS-protected |
| refresh | `api/refresh` + cron | keeps the corpus fresh without traffic — see below |

**Always fresh.** `/news.json` and `/snapshot.json` are fetched live server-side and edge-cached for ~10 minutes, so every visitor sees current data. To keep the Supabase corpus growing *independent of traffic*, `api/refresh` fetches the live feed, geolocates it, and archives fresh stories (duplicates ignored). It runs **several times a day** via `.github/workflows/refresh.yml` (GitHub Actions, plan-independent) plus a **once-a-day** Vercel cron in `vercel.json`. Optionally set `CRON_SECRET` (same value in the Vercel env and the repo's Actions secret) to lock the endpoint down.

**Cost guard.** The AI tools run through `api/ai`, which caps each visitor (by hashed IP) at **1,000,000 OpenAI tokens per UTC day** so no single user can run up the bill. Usage is tracked in Supabase (`ai_usage`, an add-only RLS-locked counter — a visitor can't reset their own); over the cap returns `429`. It works out of the box (no extra keys) and fails open if the store is briefly unreachable. Change the ceiling with `AI_DAILY_TOKEN_LIMIT`.

The public frontend ships no secrets — all keyed work lives in the worker. **AUSPEX does not go public until it is worthy of everyone in the world.** That is the bar.

---

## Principles

- **For everyone.** No login to see the planet. Readable by a child, useful to an analyst, fast on a cheap phone.
- **Honest before impressive.** Confidence and sources on every claim. Unconfirmed signals look unconfirmed. We never cry wolf, and we never dress a rumour as a fact.
- **A commons, not a product.** It watches events and systems — never people. A guardian's name, not a spy's.
- **Alive, calm, uncluttered.** Severity is light. Red is earned. Green is the instrument, breathing.

---

<div align="center">

One of three. **AgentZeus** watches the world *for you*. **NEXUS** runs the agents. **AUSPEX** watches the world *for everyone*.

<sub>Built on the Meridian globe platform · vision in <a href="docs/VISION.md">docs/VISION.md</a> · specs + plans under <a href="docs/specs">docs/</a></sub>

</div>
