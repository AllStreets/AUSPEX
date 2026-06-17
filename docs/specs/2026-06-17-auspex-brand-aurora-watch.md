# AUSPEX Brand — "Aurora Watch (Living)"

**Date:** 2026-06-17
**Decision:** AUSPEX gets its own identity, fully separate from Meridian's red "intelligence-network"
look. Direction: **Aurora Watch** (calm cyan→violet guardian) **with a breathing accent** (the
Obsidian "mood" idea) — the signature color shifts and breathes with the state of the world.

## Why
Meridian reads as a red surveillance/war-room console. AUSPEX is a guardian-commons — calm, honest,
on your side. The brand must feel watchful and alive, not alarmist. **Red is reserved for genuine
peril severity** so that when the eye sees red, it means danger — never decoration.

## Palette (CSS custom properties, `:root` in css/auspex.css)
```
--bg:        #04060d   /* near-black navy */
--bg-2:      #070c16   /* panels / glass base */
--t1:        #e8eefb   /* primary text */
--t2:        #9fb0cc   /* secondary text */
--t3:        #5d6b86   /* muted text */
--line:      rgba(255,255,255,.08)
--line-2:    rgba(255,255,255,.14)

/* The breathing signature — the "aura" */
--aura-calm:   #8a7fff   /* violet — world is quiet */
--aura-active: #5ac8fa   /* cyan — world is active */
--aura-alert:  #ff4d6d   /* red — a real high-severity peril is live */
--aura:        #8a7fff   /* LIVE value, set by js/aura.js; defaults to calm */
--aura-soft:   rgba(138,127,255,.18)  /* glow tint, recomputed with --aura */

/* Signature gradient (wordmark, loading bar, key accents) */
--sig: linear-gradient(90deg, #7fe9ff, #c9b8ff);

/* Peril severity scale (events) — danger only */
--sev-low:  #FFD60A
--sev-mid:  #FF9F0A
--sev-high: #FF4D6D

/* Breakthroughs (Plan 2) */
--brk-cyan: #5AC8FA
--brk-gold: #FFD489
```

## The breathing accent (`js/aura.js`, new)
A small module that computes a **world state** from `SNAPSHOT_EVENTS` and drives the live `--aura`:
- **alert** (`--aura-alert`): any confirmed event with `severity >= 0.7` in the last 24h.
- **active** (`--aura-active`): otherwise, if there is meaningful recent activity (e.g. >= 8 events in the window, or any severity >= 0.45).
- **calm** (`--aura-calm`): otherwise.

On each snapshot load (and on a slow interval), it sets `document.documentElement.style.setProperty('--aura', color)`, recomputes `--aura-soft` from it, and sets `document.body.dataset.aura = state`. Transitions are smooth (CSS `transition` on the elements that consume `--aura`, ~1.2s ease). A slow **breathing** keyframe (`aura-breathe`, ~6s) gently varies the glow intensity of the atmosphere and the live badge so the instrument feels alive at rest.

The aura drives: the **globe atmosphere rim** (globe.gl `.atmosphereColor(--aura)`), the **wordmark underglow**, the **LIVE badge**, **focus rings**, **scrollbars**, the **loading bar**, and **panel/card accent borders**.

## Retheme targets (replace Meridian red chrome)
- Header wordmark → `--sig` gradient with `--aura` underglow.
- "LIVE" badge / dot → `--aura` (not red).
- Loading page bar → `--sig`; status text muted; wordmark already `AUSP<em>E</em>X` (the `E` accent → cyan).
- Globe atmosphere → `--aura`, breathing.
- Glass panels, hairlines, scrollbars, focus rings → neutral + `--aura` accent.
- Event markers/cards already use the peril/breakthrough scales — keep; ensure they read against the new chrome.
- News category pips (geo/mil/fin/…) are secondary; leave their semantics, but they must not dominate — the page's ambient accent is the aura, not red.

## Non-goals (this pass)
- Not redesigning the news/analyst features' internals.
- Breakthrough sense colors are defined here but wired in Plan 2.

## Done when
Opening the app, the dominant feel is a calm, breathing cyan/violet guardian — not a red war room —
and the accent visibly shifts toward cyan/red as world activity/severity rises. Red appears only on
genuine peril.
