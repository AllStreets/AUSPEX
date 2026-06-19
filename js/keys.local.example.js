'use strict';

// ═══════════════════════════════════════════
// LOCAL KEYS TEMPLATE — copy to js/keys.local.js (gitignored) and fill in.
// This file is loaded BEFORE js/keys.js, setting window.AUSPEX_KEYS so the
// safe js/keys.js picks up real values in local dev. In production (Vercel)
// keys.local.js is absent, so all keys default to '' and keyed features
// degrade gracefully. Browser-side keys only — never put server secrets here.
// ═══════════════════════════════════════════
window.AUSPEX_KEYS = {
  NEWS_API_KEY:  '<YOUR_NEWS_API_KEY>',
  WINDY_KEY:     '<YOUR_WINDY_KEY>',
  OPENAI_KEY:    '<YOUR_OPENAI_KEY>',
  OPENSKY_ID:    '<YOUR_OPENSKY_CLIENT_ID>',
  OPENSKY_SEC:   '<YOUR_OPENSKY_SECRET>',
  AISSTREAM_KEY: '<YOUR_AISSTREAM_KEY>',
};

// Server-only secrets (set in the Vercel project env, NOT in the browser):
//   NEWS_API_KEY     — enables the keyed NewsAPI source in api/news.mjs
//   AUSPEX_LLM_KEY   — enables the optional reasoning pass in api/snapshot.mjs
