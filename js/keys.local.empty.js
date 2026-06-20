// AUSPEX · keys.local fallback (committed, secret-free)
// On Vercel the real js/keys.local.js is absent (gitignored + .vercelignored),
// so vercel.json rewrites /js/keys.local.js to this empty, valid-MIME module.
// It sets nothing — js/keys.js then falls back to empty keys, and the public
// app runs keyless. Locally, the real js/keys.local.js is served directly.
