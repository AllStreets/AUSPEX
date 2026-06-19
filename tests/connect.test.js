import { describe, it, expect } from 'vitest';
import { computeLinks, linkedPairs, haversineKm } from '../src/connect.js';

// Helper: build a minimal placeable event.
function ev(id, lat, lng, occurredAt, sense = 'disaster') {
  return { id, lat, lng, occurredAt, sense, links: [] };
}

const BASE = '2026-06-18T00:00:00Z';
function plusHours(h) {
  return new Date(Date.parse(BASE) + h * 3600 * 1000).toISOString();
}

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm(40, -74, 40, -74)).toBeCloseTo(0, 5);
  });
  it('matches a known distance (NYC→LA ~3936 km)', () => {
    const d = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(3800);
    expect(d).toBeLessThan(4050);
  });
});

describe('computeLinks proximity', () => {
  it('links two events ~100km and 2h apart', () => {
    // ~111 km north (1 degree latitude), 2h apart, cross-sense.
    const a = ev('a', 40.0, -74.0, plusHours(0), 'disaster');
    const b = ev('b', 41.0, -74.0, plusHours(2), 'space');
    computeLinks([a, b]);
    expect(a.links).toContain('b');
    expect(b.links).toContain('a');
  });

  it('does NOT link two events ~5000km apart', () => {
    const a = ev('a', 40.7128, -74.006, plusHours(0));
    const b = ev('b', 51.5074, -0.1278, plusHours(1)); // London, ~5570 km
    computeLinks([a, b]);
    expect(a.links).toHaveLength(0);
    expect(b.links).toHaveLength(0);
  });

  it('does NOT link events 100km apart but 10 days apart', () => {
    const a = ev('a', 40.0, -74.0, plusHours(0));
    const b = ev('b', 41.0, -74.0, plusHours(24 * 10)); // 10 days later
    computeLinks([a, b]);
    expect(a.links).toHaveLength(0);
    expect(b.links).toHaveLength(0);
  });
});

describe('linkedPairs', () => {
  it('returns each unordered pair exactly once', () => {
    const a = ev('a', 40.0, -74.0, plusHours(0), 'disaster');
    const b = ev('b', 40.5, -74.0, plusHours(1), 'space');
    const c = ev('c', 40.2, -74.2, plusHours(2), 'news');
    const events = computeLinks([a, b, c]);
    const pairs = linkedPairs(events);
    const keys = pairs.map(p => (p.aId < p.bId ? `${p.aId}|${p.bId}` : `${p.bId}|${p.aId}`));
    // No duplicates / no reversed dupes.
    expect(new Set(keys).size).toBe(keys.length);
    // Each pair carries both endpoints' coords.
    for (const p of pairs) {
      expect(typeof p.aLat).toBe('number');
      expect(typeof p.bLng).toBe('number');
    }
  });

  it('returns [] before computeLinks populates links', () => {
    const a = ev('a', 40.0, -74.0, plusHours(0));
    const b = ev('b', 40.5, -74.0, plusHours(1));
    expect(linkedPairs([a, b])).toHaveLength(0);
  });
});

describe('caps', () => {
  it('respects per-event cap (<=2) and global pair cap', () => {
    // A tight cluster of 30 events all within range of each other.
    const events = [];
    for (let i = 0; i < 30; i++) {
      // tiny jitter (~1-2 km), staggered by minutes — all mutually in range.
      events.push(ev(`e${i}`, 40 + i * 0.01, -74 + i * 0.01, plusHours(i * 0.1),
        i % 2 === 0 ? 'disaster' : 'space'));
    }
    computeLinks(events);
    for (const e of events) {
      expect(e.links.length).toBeLessThanOrEqual(2);
    }
    const pairs = linkedPairs(events);
    expect(pairs.length).toBeLessThanOrEqual(24);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('prefers a cross-sense pair over an equally-close same-sense pair', () => {
    // Two candidate pairs at the SAME distance & time gap: one same-sense, one
    // cross-sense. With perEventCap 1 (one accepted pair per event) the
    // cross-sense pair must win the global ordering.
    const a1 = ev('a1', 40.0, -74.0, plusHours(0), 'disaster');
    const a2 = ev('a2', 40.05, -74.0, plusHours(1), 'disaster'); // same-sense pair
    const b1 = ev('b1', 10.0, 20.0, plusHours(0), 'disaster');
    const b2 = ev('b2', 10.05, 20.0, plusHours(1), 'space');     // cross-sense pair
    computeLinks([a1, a2, b1, b2], { perEventCap: 1, globalPairCap: 1 });
    // Only one global pair allowed; the cross-sense one outranks the same-sense one.
    expect(b1.links).toContain('b2');
    expect(a1.links).toHaveLength(0);
  });
});

describe('idempotency', () => {
  it('does not accumulate links across repeated calls', () => {
    const a = ev('a', 40.0, -74.0, plusHours(0), 'disaster');
    const b = ev('b', 40.5, -74.0, plusHours(1), 'space');
    computeLinks([a, b]);
    const firstLen = a.links.length;
    computeLinks([a, b]);
    expect(a.links.length).toBe(firstLen);
  });
});
