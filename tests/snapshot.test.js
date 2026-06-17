import { describe, it, expect } from 'vitest';
import { buildSnapshot, dedupeById } from '../worker/snapshot.js';
const goodEvent = {
  id: 'usgs:us7000test', sense: 'disaster', type: 'earthquake', polarity: 'peril',
  title: 'M5.5 earthquake', lat: 35.0, lng: 139.0,
  metric: { label: 'magnitude', value: 5.5, band: 'moderate' },
  severity: 0.42, confidence: 'confirmed',
  occurredAt: new Date().toISOString(), brief: 'Test event.',
  sources: [], links: [], icon: 'earthquake',
};
describe('buildSnapshot', () => {
  it('includes valid events and sets version/generatedAt', () => {
    const snap = buildSnapshot([goodEvent]);
    expect(snap.events).toHaveLength(1);
    expect(snap.version).toBe(1);
    expect(typeof snap.generatedAt).toBe('string');
  });
  it('excludes invalid events', () => {
    const snap = buildSnapshot([{ ...goodEvent, lat: NaN }]);
    expect(snap.events).toHaveLength(0);
  });
});
describe('dedupeById', () => {
  it('keeps one event per id', () => {
    expect(dedupeById([goodEvent, { ...goodEvent }, { ...goodEvent, id: 'gdacs:x' }])).toHaveLength(2);
  });
});
