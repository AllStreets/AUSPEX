# AUSPEX worker

The private, keyed half of AUSPEX. It senses the world server-side and serves a
CORS-clean feed to the static frontend, so the public side ships zero secrets.

## Endpoints

| Route            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `GET /snapshot.json` | Normalized, scored event snapshot (USGS + GDACS + space + breakthroughs). Always 200; empty `events` until the first poll lands. |
| `GET /news.json`     | Unified news feed (GDELT + NewsAPI), merged and deduped. 12-minute in-memory cache. |
| `GET /`              | Human-readable status page.                                        |

All responses send permissive CORS headers (see below). The worker listens on
**port 8801**.

## Environment variables

| Var              | Required | Purpose                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------- |
| `NEWS_API_KEY`   | optional | NewsAPI key. Without it, `/news.json` still works from GDELT alone.     |
| `AUSPEX_LLM_KEY` | optional | LLM key for the reasoning pass. Without it, reasoning degrades gracefully (events pass through unscored by the LLM). |
| `ALLOWED_ORIGIN` | optional | Production frontend origin to allow via CORS, e.g. `https://auspex.example.com`. `http://localhost:8800` is always allowed. |
| `NEWS_DEBUG`     | optional | Set to any value to log GDELT fetch/parse diagnostics.                  |

Locally these load from `worker/.env` (see `worker/.env.example`).

## Run locally

```bash
cd worker && npm install
node index.js          # http://localhost:8801
```

## Run in Docker

Build from the **repo root** — the worker imports from `../src`, so both
`worker/` and `src/` must be in the image:

```bash
docker build -f worker/Dockerfile -t auspex-worker .
docker run -p 8801:8801 --env-file worker/.env auspex-worker
```

## Deploy

Any container host works (Railway, Render, Fly.io). Point it at
`worker/Dockerfile` (build context = repo root), expose port 8801, and set the
env vars above — at minimum `ALLOWED_ORIGIN` (your frontend's URL) and, if you
want NewsAPI coverage, `NEWS_API_KEY`. Then set the frontend's `WORKER_BASE`
(see the root `README.md` Deploy section) to this worker's public URL.
