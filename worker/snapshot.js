import { writeFileSync } from 'fs';
import { validateSnapshotEvent } from '../src/normalize.js';
export function dedupeById(events) {
  const map = new Map();
  for (const e of events) if (!map.has(e.id)) map.set(e.id, e);
  return [...map.values()];
}
export function buildSnapshot(events) {
  return {
    generatedAt: new Date().toISOString(),
    version: 1,
    events: dedupeById(events).filter(validateSnapshotEvent),
  };
}
export function writeSnapshot(snapshot, filePath) {
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
}
