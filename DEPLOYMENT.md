# MERIDIAN — Deployment Guide

This guide covers three deployment paths: static-only (Vercel), full-stack with an API proxy (Vercel + Railway), and the full production architecture with persistent storage (Vercel + Railway + Supabase).

---

## Option A — Vercel Static Deploy (Quickest)

Best for: personal use, demos, testing. Requires a **paid** NewsAPI plan for production CORS, or use the proxy approach in Option B.

### Steps

1. **Push to GitHub** (already done — `https://github.com/AllStreets/MERIDIAN`)

2. **Import project in Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select `AllStreets/MERIDIAN`
   - Framework preset: **Other** (it's a static file)
   - Build command: *(leave blank)*
   - Output directory: `.` (root)
   - Click **Deploy**

3. **Set environment variable** (if you extract the key out of `index.html`):
   - In Vercel project settings → Environment Variables
   - Add `NEWS_API_KEY` = your key

> Your site will be live at `https://meridian.vercel.app` (or similar).

**Limitation:** NewsAPI free tier blocks CORS from non-localhost origins. You must either upgrade to a paid NewsAPI plan or use Option B.

---

## Option B — Vercel Frontend + Railway API Proxy (Recommended)

This keeps your API key server-side, adds rate limiting, and enables richer backend processing (NLP, caching, aggregation).

### Architecture

```
Browser → Vercel (index.html)
             ↓ fetch /api/news
         Railway (Node.js proxy)
             ↓ server-side request
         NewsAPI.org
```

### 1. Create the Railway API service

```bash
mkdir meridian-api && cd meridian-api
npm init -y
npm install express node-fetch cors dotenv
```

**`server.js`**
```js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));

const CACHE = new Map();
const TTL = 30 * 60 * 1000;

app.get('/api/news', async (req, res) => {
  const cat = req.query.category || 'general';
  const cacheKey = cat;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) {
    return res.json({ articles: cached.articles, cached: true });
  }

  const url = `https://newsapi.org/v2/top-headlines?language=en&category=${cat}&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  CACHE.set(cacheKey, { ts: Date.now(), articles: data.articles || [] });
  res.json({ articles: data.articles || [] });
});

app.listen(process.env.PORT || 3001);
```

**`package.json`** — add `"type": "module"`

**`.env`**
```
NEWS_API_KEY=<YOUR_NEWS_API_KEY>
ALLOWED_ORIGIN=https://your-meridian.vercel.app
```

### 2. Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Note the Railway service URL (e.g. `https://meridian-api.up.railway.app`).

### 3. Update `index.html` to call your proxy

Replace the NewsAPI fetch endpoints:
```js
const BASE = 'https://meridian-api.up.railway.app';
const endpoints = [
  `${BASE}/api/news?category=general`,
  `${BASE}/api/news?category=business`,
  `${BASE}/api/news?category=technology`,
  `${BASE}/api/news?category=science`,
];
```

### 4. Deploy frontend to Vercel

```bash
vercel --prod
```

---

## Option C — Full Production Stack (Vercel + Railway + Supabase)

Adds: user accounts, saved watchlists, custom alerts, historical story archive, and real-time updates via Supabase Realtime.

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)

2. **Schema** — run in Supabase SQL editor:

```sql
-- Stories archive
create table stories (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  summary text,
  body text,
  url text,
  source text,
  category text,
  lat double precision,
  lng double precision,
  region text,
  is_breaking boolean default false,
  published_at timestamptz,
  fetched_at timestamptz default now()
);
create index on stories (category);
create index on stories (published_at desc);

-- User watchlists
create table watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  story_id uuid references stories,
  created_at timestamptz default now()
);

-- Region alerts
create table region_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  region text not null,
  category text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table watchlist_items enable row level security;
alter table region_alerts enable row level security;
create policy "users own their data" on watchlist_items for all using (auth.uid() = user_id);
create policy "users own their alerts" on region_alerts for all using (auth.uid() = user_id);
```

3. **Enable Supabase Realtime** on the `stories` table (Dashboard → Database → Replication → `stories`)

### Railway service — persist to Supabase

Add to `server.js`:
```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// After fetching stories, upsert to archive
await supabase.from('stories').upsert(stories, { onConflict: 'external_id' });
```

Add Railway env vars:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

### Frontend — Supabase Realtime

In `index.html`, add the Supabase JS client:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

```js
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to new stories in real time
sb.channel('stories')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, payload => {
    const story = payload.new;
    NEWS.unshift(story);
    applyColors([story]);
    renderFeed(NEWS);
    refreshGlobeData(NEWS);
  })
  .subscribe();
```

### User auth (Supabase Auth)

```js
// Sign in with magic link
await sb.auth.signInWithOtp({ email: 'user@example.com' });

// Bookmark a story
await sb.from('watchlist_items').insert({ story_id: story.id });
```

### Environment variables summary

| Variable | Used by |
|---------|---------|
| `NEWS_API_KEY` | Railway |
| `SUPABASE_URL` | Railway + Frontend |
| `SUPABASE_SERVICE_KEY` | Railway (server-side only) |
| `SUPABASE_ANON_KEY` | Frontend (public) |
| `ALLOWED_ORIGIN` | Railway CORS |

---

## Domain + SSL

Both Vercel and Railway provision TLS automatically. For a custom domain:

1. **Vercel** → Project Settings → Domains → add `meridian.yourdomain.com`
2. Add a CNAME record at your DNS registrar pointing to `cname.vercel-dns.com`

---

## Estimated Costs

| Stack | Monthly cost |
|-------|-------------|
| Option A (Vercel static) | Free |
| Option B (+ Railway) | ~$5/mo (Railway Hobby) |
| Option C (+ Supabase) | Free tier / $25/mo Pro |
| NewsAPI paid plan | $449/mo (Developer) or use proxied free tier |
