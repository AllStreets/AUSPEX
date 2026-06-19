'use strict';

// ═══════════════════════════════════════════
// API KEYS — SAFE, SECRET-FREE, COMMITTED
// This file ships in the public bundle and contains NO secrets. Real values
// (for local dev) live in js/keys.local.js (gitignored), which sets
// window.AUSPEX_KEYS and is loaded BEFORE this file in index.html. In a deploy
// where keys.local.js is absent, every key below resolves to '' and all keyed
// features degrade to their existing "unavailable" paths without throwing.
// See js/keys.local.example.js for the window.AUSPEX_KEYS shape.
// ═══════════════════════════════════════════
const _K = (typeof window !== 'undefined' && window.AUSPEX_KEYS) || {};
const NEWS_API_KEY   = _K.NEWS_API_KEY   || '';
const WINDY_KEY      = _K.WINDY_KEY      || '';
const OPENAI_KEY     = _K.OPENAI_KEY     || '';
const OPENSKY_ID     = _K.OPENSKY_ID     || '';
const OPENSKY_SEC    = _K.OPENSKY_SEC    || '';
const AISSTREAM_KEY  = _K.AISSTREAM_KEY  || '';
