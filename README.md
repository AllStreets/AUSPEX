<div align="center">

# AUSPEX

**A living instrument for watching over the world.**

*The auspex was the one who read the sky for signs and spoke them aloud,*
*so the city could act before the storm. This is that — for the whole planet, for everyone.*

`watchful · honest · open · alive`

</div>

---

AUSPEX is an open, real-time instrument for sensing the whole pulse of the planet — its perils and
its breakthroughs. Autonomous pipelines continuously read the world's public signals and render
them on a living globe that **anyone** can read: no login, no terminal, no institutional wall. The
kind of situational awareness that today costs a Bloomberg subscription, made into a commons and
given to the world.

```
  what it watches                            status
  ├─ disasters ........ quake · cyclone · flood · volcano · fire ....... LIVE  (USGS · GDACS)
  ├─ conflict ......... unrest · escalation .............................. planned
  ├─ supply chains .... ports · shipping · shortages ..................... planned
  ├─ climate .......... drought · heat · environment ..................... planned
  ├─ public health .... outbreak signals ................................. planned
  └─ breakthroughs .... financial · space · medical · physics · science .. planned

  what it does
  ├─ senses ........... open, keyless public feeds, geolocated in real time
  ├─ reasons .......... severity, calibrated confidence, plain-language briefs
  ├─ connects ......... the link between events, drawn in light            (planned)
  └─ shows ............ a planet with a pulse: calm where calm, light where not
```

## How it works

Two processes, one data contract — so the public side ships **zero secrets** and a million
visitors cost about the same as one.

```
  PUBLIC  (keyless, edge-cacheable)            PRIVATE  (keyed, scheduled)
  ┌────────────────────────────────┐          ┌──────────────────────────────┐
  │ frontend · static · :8800      │  reads   │ snapshot worker · :8801       │
  │  NASA day/night globe          │ ◄─────── │  polls USGS + GDACS (keyless) │
  │  1,000-city base layer         │ snapshot │  normalizes · scores · briefs │
  │  event markers · honest cards  │  .json   │  writes snapshot.json         │
  │  live, collapsing map key      │          │  (LLM key stays server-side)  │
  └────────────────────────────────┘          └──────────────────────────────┘
```

The heavy reasoning runs **once per event** in the worker, not once per visitor. That is what lets
AUSPEX be free, fast on a weak connection, and sustainable at planetary scale.

## Run it locally

```bash
npm install          # frontend dev tooling + tests
npm test             # 33 passing — the tested pure core (severity / normalize / filter / snapshot)

# terminal 1 — the snapshot worker (senses the world, writes snapshot.json)
cd worker && npm install && cd ..
npm run worker       # http://localhost:8801  · polls USGS + GDACS every 3 min

# terminal 2 — the globe
npm run dev          # http://localhost:8800
```

Open **http://localhost:8800**. The globe lights up with live earthquakes and disasters; toggle
**CITIES** for the 1,000-city layer; click any event for an honest card (severity, confidence,
plain brief, sources); open the **MAP KEY** for a legend that derives itself from whatever is
currently on the globe. Disaster sensing is **keyless** — it runs with no API keys at all.

## Principles

- **For everyone.** No login to see the planet. Readable by a child, useful to an analyst, fast on a cheap phone.
- **Honest before impressive.** Confidence and sources on every event. Unconfirmed signals look unconfirmed. We never cry wolf.
- **A commons, not a product.** It watches events and systems — never people. A guardian's name, not a spy's.
- **Worthy before public.** It does not ship to the world until it is worthy of everyone in the world.

## Status

**Phase 1 — the disaster instrument — is live locally.** The globe, the 1,000-city layer, the
keyless USGS + GDACS snapshot worker, event rendering, honest cards, and the live map key all work
end to end on a tested foundation. Next: the remaining senses (conflict, supply, climate, health,
and the breakthroughs — financial, space, medical, physics), cross-domain connection reasoning, and
the accessibility/performance/deploy work that earns the public launch.

Vision: [`docs/VISION.md`](docs/VISION.md) · Architecture: [`docs/specs/`](docs/specs) · Build plan: [`docs/plans/`](docs/plans)

---

<div align="center">
<sub>One of three. AgentZeus watches the world <em>for you</em>. NEXUS runs the agents. AUSPEX watches the world <em>for everyone</em>.</sub>
</div>
