import { fileURLToPath } from 'url';
import path from 'path';
import { fetchUSGSEvents } from './senses/usgs.js';
import { fetchGDACSEvents } from './senses/gdacs.js';
import { fetchSpaceEvents } from './senses/space.js';
import { deriveBreakthroughs } from './senses/breakthroughs.js';
import { getCachedArticles } from './news.js';
import { runReasoningPass } from './reason.js';
import { buildSnapshot, writeSnapshot } from './snapshot.js';
const SNAPSHOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../snapshot.json');
export async function pollAll() {
  console.log('[AUSPEX worker] polling senses...');
  const [usgs, gdacs, space] = await Promise.all([
    fetchUSGSEvents().catch(e => { console.warn('USGS failed:', e.message); return []; }),
    fetchGDACSEvents().catch(e => { console.warn('GDACS failed:', e.message); return []; }),
    fetchSpaceEvents().catch(e => { console.warn('Space failed:', e.message); return []; }),
  ]);
  // Breakthroughs ride the news cache (warmed by the server); no extra fetch.
  const brk = deriveBreakthroughs(getCachedArticles());
  console.log(`[AUSPEX worker] senses: usgs ${usgs.length}, gdacs ${gdacs.length}, space ${space.length}, breakthroughs ${brk.length}`);
  const events = await runReasoningPass([...usgs, ...gdacs, ...space, ...brk], process.env.AUSPEX_LLM_KEY ?? null);
  const snapshot = buildSnapshot(events);
  writeSnapshot(snapshot, SNAPSHOT_PATH);
  console.log(`[AUSPEX worker] wrote snapshot.json (${snapshot.events.length} events)`);
}
