import { fileURLToPath } from 'url';
import path from 'path';
import { fetchUSGSEvents } from './senses/usgs.js';
import { fetchGDACSEvents } from './senses/gdacs.js';
import { fetchEONETEvents } from './senses/eonet.js';
import { fetchFIRMSEvents } from './senses/firms.js';
import { fetchSpaceEvents } from './senses/space.js';
import { deriveBreakthroughs } from './senses/breakthroughs.js';
import { getCachedArticles } from './news.js';
import { runReasoningPass } from './reason.js';
import { computeLinks } from '../src/connect.js';
import { buildSnapshot, writeSnapshot } from './snapshot.js';
const SNAPSHOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../snapshot.json');
export async function pollAll() {
  console.log('[AUSPEX worker] polling senses...');
  const [usgs, gdacs, eonet, firms, space] = await Promise.all([
    fetchUSGSEvents().catch(e => { console.warn('USGS failed:', e.message); return []; }),
    fetchGDACSEvents().catch(e => { console.warn('GDACS failed:', e.message); return []; }),
    fetchEONETEvents().catch(e => { console.warn('EONET failed:', e.message); return []; }),
    fetchFIRMSEvents().catch(e => { console.warn('FIRMS failed:', e.message); return []; }),
    fetchSpaceEvents().catch(e => { console.warn('Space failed:', e.message); return []; }),
  ]);
  // Breakthroughs ride the news cache (warmed by the server); no extra fetch.
  const brk = deriveBreakthroughs(getCachedArticles());
  console.log(`[AUSPEX worker] senses: usgs ${usgs.length}, gdacs ${gdacs.length}, eonet ${eonet.length}, firms ${firms.length}, space ${space.length}, breakthroughs ${brk.length}`);
  // FIRMS = authoritative global fire layer; when live, drop GDACS's coarser fires.
  const gd = firms.length ? gdacs.filter(e => e.type !== 'fire') : gdacs;
  const events = await runReasoningPass([...usgs, ...gd, ...eonet, ...firms, ...space, ...brk], process.env.AUSPEX_LLM_KEY ?? null);
  // Draw honest connections: link events close in space & time so snapshot.json
  // events carry `links` ids for the globe to render as subtle arcs.
  computeLinks(events);
  const snapshot = buildSnapshot(events);
  writeSnapshot(snapshot, SNAPSHOT_PATH);
  console.log(`[AUSPEX worker] wrote snapshot.json (${snapshot.events.length} events)`);
}
