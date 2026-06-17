# MERIDIAN — Global Intelligence Network

A hyper-modern, real-time global news intelligence dashboard built on an interactive 3D globe. Stories are sourced live from NewsAPI, geo-located, and plotted as animated markers on a photorealistic Earth that transitions between day and night textures based on your local time.

![MERIDIAN Dashboard](https://raw.githubusercontent.com/AllStreets/MERIDIAN/main/.github/preview.png)

---

## Features

- **Live 3D Globe** — powered by [Globe.gl](https://globe.gl/) with photorealistic NASA Blue Marble and night-lights textures
- **Day/Night auto-switching** — globe texture and atmosphere update in real time based on your local hour
- **Live NewsAPI integration** — fetches top headlines across General, Business, Technology, and Science endpoints; caches for 30 min to stay within free-tier limits (~4 requests per session)
- **Auto geo-location** — extracts story coordinates from article text using a 90+ entry city/country lookup table
- **Category intelligence** — NLP keyword scoring auto-assigns stories to Geopolitical, Military, Finance, Climate, or Technology categories
- **Breaking news rings** — animated concentric rings pulse from stories published in the last 25 minutes
- **Arc connections** — animated arcs connect breaking news hotspots across the globe
- **Clickable ticker** — live scrolling headline bar; click any story to open the source article in a new tab
- **Intelligence Feed sidebar** — collapsible panel with full story cards and read-article links
- **Article deep-dive panel** — modal with full body text, metadata, and direct source link
- **Location picker** — when multiple stories share a location, a picker panel lists all stories before drilling in
- **Category filter rail** — filter the globe and feed by category with live story counts
- **Full-text search** — search across title, summary, region, and source in real time
- **30-min refresh countdown** — header indicator shows time until next API refresh, flashes on update
- **Star field background** — animated star field rendered on canvas
- **Scanline + vignette overlays** — cinematic atmosphere layers

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Globe | Globe.gl (Three.js) |
| News data | NewsAPI.org |
| Fonts | Syne · Fraunces · Manrope · IBM Plex Mono (Google Fonts) |
| Hosting | Static HTML — any CDN or static host |
| Runtime | Pure vanilla JS, no build step |

---

## Quick Start (Local)

```bash
git clone https://github.com/AllStreets/MERIDIAN.git
cd MERIDIAN
python3 -m http.server 8765
```

Open `http://localhost:8765` in your browser. NewsAPI CORS is permitted on `localhost` with a developer key.

> **Note:** The NewsAPI free tier only allows CORS requests from `localhost`. For production deployments, you need a paid plan or a backend proxy (see Deployment Guide).

---

## Configuration

The API key and cache TTL live at the top of the `<script>` block in `index.html`:

```js
const NEWS_API_KEY = 'your_key_here';
const NEWS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
```

---

## Project Structure

```
MERIDIAN/
├── index.html          # Entire application — self-contained single file
├── README.md           # This file
└── DEPLOYMENT.md       # Deployment guide (Vercel, Railway, Supabase)
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
