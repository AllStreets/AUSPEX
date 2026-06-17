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

app.get('/snapshot.json', (req, res) => {
  if (existsSync(SNAPSHOT_PATH)) return res.sendFile(SNAPSHOT_PATH);
  res.json({ generatedAt: new Date().toISOString(), version: 1, events: [] });
});

app.listen(8801, () => console.log('[AUSPEX worker] listening on :8801'));

pollAll();
setInterval(pollAll, 3 * 60 * 1000);
