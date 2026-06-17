# MERIDIAN — Railway + Supabase Deployment

## Architecture Decision

**Frontend:** Railway (static file serving + API proxy in one service)  
**Backend DB + Auth + Realtime:** Supabase  
**Why not Vercel?** Railway's persistent process handles WebSocket connections for real-time updates, long-running cron jobs (story archiving every 30 min), and the Claude API proxy in a single deployable unit. Supabase handles everything that needs a database.

```
Browser
  │
  ├─→ Railway (:3000)
  │     ├── GET /         → serves index.html
  │     ├── GET /api/news → NewsAPI proxy (key stays server-side)
  │     ├── POST /api/synthesize → Claude API proxy
  │     └── SSE /api/stream → real-time story push
  │
  └─→ Supabase
        ├── PostgreSQL (story archive, watchlists, alerts)
        ├── Auth (user accounts)
        └── Realtime (WebSocket pub/sub for live story push)
```

---

## Part 1 — Supabase Setup

### Step 1: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Set project name: `meridian`, choose a region close to your users
3. Save your **Database Password** somewhere safe
4. Wait ~2 minutes for provisioning

### Step 2: Get your credentials

In the Supabase dashboard → **Project Settings** → **API**:
- Copy **Project URL** → `SUPABASE_URL`
- Copy **anon/public key** → `SUPABASE_ANON_KEY`
- Copy **service_role key** → `SUPABASE_SERVICE_KEY` *(server-side only, never expose client-side)*

### Step 3: Create database schema

Go to **SQL Editor** → **New query**, paste and run:

```sql
-- Story archive
create table if not exists stories (
  id          bigserial primary key,
  external_id text unique,
  title       text not null,
  summary     text,
  body        text,
  url         text,
  url_image   text,
  source      text,
  category    text check (category in ('geo','military','finance','climate','tech')),
  lat         double precision,
  lng         double precision,
  region      text,
  is_breaking boolean default false,
  published_at timestamptz,
  fetched_at  timestamptz default now()
);

create index on stories (category);
create index on stories (fetched_at desc);
create index on stories (is_breaking);

-- User watchlists
create table if not exists watchlist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  story_id   bigint references stories on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, story_id)
);

-- Region/keyword alerts
create table if not exists alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,
  keyword    text not null,
  category   text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table watchlist_items enable row level security;
alter table alerts enable row level security;

create policy "users own watchlist" on watchlist_items
  for all using (auth.uid() = user_id);

create policy "users own alerts" on alerts
  for all using (auth.uid() = user_id);

-- Enable Realtime on stories table
-- (also enable via Dashboard → Database → Replication → stories)
```

### Step 4: Enable Realtime

1. Supabase Dashboard → **Database** → **Replication**
2. Toggle on the `stories` table
3. Select **INSERT** events (new stories trigger browser updates)

---

## Part 2 — Railway Backend Service

### Step 1: Create the Node.js service

```bash
mkdir meridian-api && cd meridian-api
npm init -y
npm install express node-fetch cors @supabase/supabase-js dotenv
```

**`package.json`** — add:
```json
{
  "type": "module",
  "scripts": { "start": "node server.js" }
}
```

**`server.js`**
```js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ── Serve static frontend ──────────────────
app.get('/', (req, res) => res.sendFile('/app/public/index.html'));
app.use(express.static('public'));

// ── NewsAPI proxy ─────────────────────────
const NEWS_CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000;

app.get('/api/news', async (req, res) => {
  const cat = req.query.category || 'general';
  const cached = NEWS_CACHE.get(cat);
  if (cached && Date.now() - cached.ts < CACHE_TTL)
    return res.json({ articles: cached.articles, cached: true });

  const url = `https://newsapi.org/v2/top-headlines?language=en&category=${cat}&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  const articles = data.articles || [];
  NEWS_CACHE.set(cat, { ts: Date.now(), articles });
  res.json({ articles });
});

// ── Claude synthesis proxy ────────────────
app.post('/api/synthesize', async (req, res) => {
  const { stories } = req.body;
  if (!stories?.length) return res.status(400).json({ error: 'No stories provided' });

  const prompt = `You are an intelligence analyst. Given these ${stories.length} news stories, write a concise intelligence brief (3-4 paragraphs) covering: key developments, shared entities/actors, potential implications, and the overall geopolitical/economic significance. Be direct and analytical.\n\nStories:\n${stories.map(s => `- [${s.cat.toUpperCase()}] ${s.title}: ${s.summary||''}`).join('\n')}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await resp.json();
  res.json({ brief: data.content?.[0]?.text || 'Synthesis unavailable.' });
});

// ── Archive stories to Supabase ───────────
app.post('/api/archive', async (req, res) => {
  const { stories } = req.body;
  if (!stories?.length) return res.status(400).json({ error: 'No stories' });

  const rows = stories.map(s => ({
    external_id: s.url || s.title?.slice(0,80),
    title: s.title, summary: s.summary, body: s.body,
    url: s.url, url_image: s.urlToImage, source: s.src,
    category: s.cat, lat: s.lat, lng: s.lng, region: s.region,
    is_breaking: s.brk, published_at: new Date().toISOString(),
  }));

  const { error } = await sb.from('stories').upsert(rows, { onConflict: 'external_id' });
  res.json({ ok: !error, error: error?.message });
});

// ── Real-time SSE stream ──────────────────
// Clients subscribe here; Railway service broadcasts new stories
const SSE_CLIENTS = new Set();
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  SSE_CLIENTS.add(res);
  res.write('data: {"type":"connected"}\n\n');
  req.on('close', () => SSE_CLIENTS.delete(res));
});

export function broadcastStories(stories) {
  const msg = `data: ${JSON.stringify({ type: 'stories', stories })}\n\n`;
  SSE_CLIENTS.forEach(client => client.write(msg));
}

// ── Cron: fetch + archive every 30 min ───
import { fetchAndArchive } from './cron.js';
setInterval(fetchAndArchive, 30 * 60 * 1000);

app.listen(process.env.PORT || 3000, () => console.log('MERIDIAN API running'));
```

**`cron.js`**
```js
import fetch from 'node-fetch';
import { broadcastStories } from './server.js';

export async function fetchAndArchive() {
  const categories = ['general','business','technology','science'];
  const results = [];
  for (const cat of categories) {
    const r = await fetch(`http://localhost:${process.env.PORT||3000}/api/news?category=${cat}`);
    const d = await r.json();
    results.push(...(d.articles||[]));
  }
  // Archive + broadcast processed stories
  // (your location extraction + category detection logic goes here or reuse the client-side version)
  console.log(`[cron] Archived ${results.length} articles`);
}
```

**`.env`**
```
NEWS_API_KEY=<YOUR_NEWS_API_KEY>
ANTHROPIC_API_KEY=your_claude_api_key_here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
ALLOWED_ORIGIN=https://your-meridian.up.railway.app
PORT=3000
```

### Step 2: Structure your project

```
meridian-api/
├── server.js
├── cron.js
├── package.json
├── .env             ← local only, never commit
├── .gitignore       ← include .env
└── public/
    └── index.html   ← copy from /meridian/index.html
```

---

## Part 3 — Railway Deployment (Step-by-Step)

### Step 1: Create a Railway account

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. Authorize Railway to access your GitHub account

### Step 2: Install Railway CLI

```bash
# macOS
brew install railway

# or npm
npm install -g @railway/cli

# Login
railway login
```

### Step 3: Initialize your Railway project

```bash
cd meridian-api

# Initialize (creates railway.toml)
railway init

# Select: Create new project
# Name it: meridian
```

### Step 4: Set environment variables

```bash
railway variables set NEWS_API_KEY=<YOUR_NEWS_API_KEY>
railway variables set ANTHROPIC_API_KEY=your_key_here
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_SERVICE_KEY=your_service_role_key
```

Or set them via Railway Dashboard → **Your Project** → **Variables** (cleaner UI).

### Step 5: Deploy

```bash
# Deploy current directory
railway up

# Watch logs
railway logs
```

Railway auto-detects Node.js and runs `npm start`. Your service will be live at something like `https://meridian-api.up.railway.app`.

### Step 6: Get your deployment URL

```bash
railway status
# or
railway open
```

Copy the public URL (e.g. `https://meridian-abc123.up.railway.app`).

### Step 7: Update frontend to use Railway endpoints

In `index.html`, replace the NewsAPI direct calls with your Railway proxy:

```js
// Replace this in fetchNews():
const BASE = 'https://meridian-abc123.up.railway.app';
const endpoints = [
  `${BASE}/api/news?category=general`,
  `${BASE}/api/news?category=business`,
  `${BASE}/api/news?category=technology`,
  `${BASE}/api/news?category=science`,
];
```

And in `synthesizeBrief()`, make the AI synthesis call real:
```js
async function synthesizeBrief() {
  // ... existing client-side synthesis as fallback ...

  // If Railway configured, call Claude:
  const RAILWAY_BASE = 'https://meridian-abc123.up.railway.app';
  try {
    const r = await fetch(`${RAILWAY_BASE}/api/synthesize`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ stories: pinned })
    });
    const d = await r.json();
    if (d.brief) { /* render AI-generated brief */ }
  } catch(e) { /* fall back to client-side synthesis */ }
}
```

### Step 8: Connect to custom domain (optional)

Railway Dashboard → **Your Service** → **Settings** → **Domains** → **Add Custom Domain**

Add a CNAME pointing to your Railway URL at your DNS provider.

---

## Part 4 — Supabase Realtime in the Frontend

Add to `index.html` (after Globe.gl script tag):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Then in your JS:
```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON = 'your-anon-key';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Subscribe to new stories as they're archived
sb.channel('new-stories')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'stories'
  }, payload => {
    const story = mapDbRowToStory(payload.new);
    applyColors([story]);
    NEWS.unshift(story);
    NEWS = NEWS.slice(0, 60); // keep most recent 60
    renderFeed(getActiveFeedStories());
    updateAllGlobeElements();
    initTicker();
    // Flash the refresh indicator
    const ind = document.getElementById('refresh-ind');
    ind.classList.add('refreshing');
    document.getElementById('refresh-lbl').textContent = 'NEW';
    setTimeout(() => { ind.classList.remove('refreshing'); document.getElementById('refresh-lbl').textContent = 'LIVE'; }, 2000);
  })
  .subscribe();

function mapDbRowToStory(row) {
  return {
    id: row.id, lat: row.lat, lng: row.lng, cat: row.category,
    src: row.source, time: 'just now', brk: row.is_breaking,
    region: row.region, title: row.title, summary: row.summary,
    body: row.body, url: row.url,
  };
}
```

---

## Cost Estimate

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Railway | Hobby | $5/mo (includes 500h compute) |
| Supabase | Free | $0 (500MB DB, 2GB bandwidth) |
| Supabase | Pro | $25/mo (8GB DB, 250GB bandwidth) |
| NewsAPI | Developer | Free (100 req/day, localhost only) |
| NewsAPI | Business | $449/mo (unlimited) or use Railway proxy to stay on free tier |
| Anthropic API | Pay-per-use | ~$0.01-0.05 per synthesis |

**Total for personal use:** ~$5/mo (Railway Hobby + Supabase Free)

---

## Quick Reference Commands

```bash
# Deploy updated code
railway up

# View live logs
railway logs --tail

# SSH into container
railway shell

# Set a variable
railway variables set KEY=value

# List all variables
railway variables

# Open dashboard
railway open

# Check service status
railway status
```
