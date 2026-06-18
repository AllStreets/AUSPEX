import { describe, it, expect } from 'vitest';
import { normalizeLaunch, validateSnapshotEvent } from '../src/normalize.js';

const sampleLaunch = {
  id: 'abc-123',
  name: 'Falcon 9 Block 5 | Starlink Group 10-1',
  net: '2026-06-18T04:30:00Z',
  url: 'https://ll.thespacedevs.com/2.2.0/launch/abc-123/',
  launch_service_provider: { name: 'SpaceX' },
  rocket: { configuration: { name: 'Falcon 9', full_name: 'Falcon 9 Block 5' } },
  mission: { description: 'A batch of Starlink satellites for the constellation.' },
  pad: { latitude: '28.6080585', longitude: '-80.6039558' },
};

describe('normalizeLaunch', () => {
  const e = normalizeLaunch(sampleLaunch);
  it('prefixes id with space:', () => expect(e.id).toBe('space:abc-123'));
  it('is a confirmed space launch breakthrough', () => {
    expect(e.sense).toBe('space');
    expect(e.type).toBe('launch');
    expect(e.polarity).toBe('breakthrough');
    expect(e.confidence).toBe('confirmed');
  });
  it('parses pad lat/lng to numbers', () => {
    expect(e.lat).toBeCloseTo(28.608, 3);
    expect(e.lng).toBeCloseTo(-80.604, 3);
  });
  it('carries the provider in the metric', () => expect(e.metric.value).toBe('SpaceX'));
  it('passes validation', () => expect(validateSnapshotEvent(e)).toBe(true));
  it('returns null when pad lat/lng is missing', () => {
    expect(normalizeLaunch({ ...sampleLaunch, pad: {} })).toBeNull();
  });
});
