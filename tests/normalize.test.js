import { describe, it, expect } from 'vitest';
import { normalizeUSGSFeature, normalizeGDACSItem, validateSnapshotEvent } from '../src/normalize.js';
const usgsFeature = {
  id: 'us7000abcd',
  properties: { mag: 6.4, time: 1718000000000, place: '28 km W of Coastline' },
  geometry: { coordinates: [-71.9, -33.1, 10] },
};
describe('normalizeUSGSFeature', () => {
  const e = normalizeUSGSFeature(usgsFeature);
  it('prefixes id with usgs:', () => expect(e.id).toBe('usgs:us7000abcd'));
  it('maps lat/lng from [lng,lat,depth]', () => { expect(e.lat).toBe(-33.1); expect(e.lng).toBe(-71.9); });
  it('is a confirmed disaster earthquake', () => {
    expect(e.sense).toBe('disaster'); expect(e.type).toBe('earthquake');
    expect(e.polarity).toBe('peril'); expect(e.confidence).toBe('confirmed');
  });
  it('severity within 0..1', () => { expect(e.severity).toBeGreaterThanOrEqual(0); expect(e.severity).toBeLessThanOrEqual(1); });
  it('passes validation', () => expect(validateSnapshotEvent(e)).toBe(true));
});
const gdacsItem = {
  properties: { eventid: 'TC123', eventtype: 'TC', name: 'Cyclone Test', alertscore: 80,
    fromdate: '2026-06-17T00:00:00Z', description: 'A tropical cyclone.', url: { report: 'https://gdacs.org/x' } },
  geometry: { coordinates: [120.0, 14.0] },
};
describe('normalizeGDACSItem', () => {
  const e = normalizeGDACSItem(gdacsItem);
  it('maps eventtype TC to cyclone', () => expect(e.type).toBe('cyclone'));
  it('clamps severity to 0..1', () => { expect(e.severity).toBeGreaterThanOrEqual(0); expect(e.severity).toBeLessThanOrEqual(1); });
  it('passes validation', () => expect(validateSnapshotEvent(e)).toBe(true));
});
describe('validateSnapshotEvent', () => {
  it('rejects NaN coordinates', () => expect(validateSnapshotEvent({ ...normalizeUSGSFeature(usgsFeature), lat: NaN })).toBe(false));
});
