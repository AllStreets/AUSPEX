import { fileURLToPath } from 'url';
import path from 'path';
import { fetchUSGSEvents } from './senses/usgs.js';
import { fetchGDACSEvents } from './senses/gdacs.js';
import { runReasoningPass } from './reason.js';
import { buildSnapshot, writeSnapshot } from './snapshot.js';
const SNAPSHOT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../snapshot.json');
export async function pollAll() {
  console.log('[AUSPEX worker] polling senses...');
  const [usgs, gdacs] = await Promise.all([
    fetchUSGSEvents().catch(e => { console.warn('USGS failed:', e.message); return []; }),
    fetchGDACSEvents().catch(e => { console.warn('GDACS failed:', e.message); return []; }),
  ]);
  const events = await runReasoningPass([...usgs, ...gdacs], process.env.AUSPEX_LLM_KEY ?? null);
  const snapshot = buildSnapshot(events);
  writeSnapshot(snapshot, SNAPSHOT_PATH);
  console.log(`[AUSPEX worker] wrote snapshot.json (${snapshot.events.length} events)`);
}
