import express from 'express';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { pollAll } from './poller.js';

const SNAPSHOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../snapshot.json');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8800');
  next();
});

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>AUSPEX · snapshot worker</title>
<style>html,body{margin:0;height:100%}body{background:#04060d;color:#cfe0f5;display:flex;flex-direction:column;
align-items:center;justify-content:center;gap:14px;font:14px/1.6 ui-monospace,SFMono-Regular,monospace;text-align:center}
.k{letter-spacing:.34em;color:#7fe9ff;font-size:12px}.d{opacity:.62;font-size:12px}a{color:#7fe9ff;text-decoration:none;border-bottom:1px solid rgba(127,233,255,.3)}</style>
</head><body>
<div class="k">AUSPEX · SNAPSHOT WORKER</div>
<div>This is the data service, not the instrument.</div>
<div class="d">The app lives at <a href="http://localhost:8800">localhost:8800</a></div>
<div class="d">Live event feed: <a href="/snapshot.json">/snapshot.json</a></div>
</body></html>`);
});

app.get('/snapshot.json', (req, res) => {
  if (existsSync(SNAPSHOT_PATH)) return res.sendFile(SNAPSHOT_PATH);
  res.json({ generatedAt: new Date().toISOString(), version: 1, events: [] });
});

app.listen(8801, () => console.log('[AUSPEX worker] listening on :8801'));

pollAll();
setInterval(pollAll, 3 * 60 * 1000);
