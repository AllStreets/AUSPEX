import { describe, it, expect } from 'vitest';
import { deriveBreakthroughs } from '../worker/senses/breakthroughs.js';
import { validateSnapshotEvent } from '../src/normalize.js';

const medical = {
  title: 'New gene therapy shows cure for inherited blindness in trial',
  description: 'Researchers report a durable cure.',
  url: 'https://example.com/gene-therapy-cure',
  source: 'Wire', publishedAt: '2026-06-17T12:00:00Z',
  sourcecountry: 'United States',
};
const war = {
  title: 'Dozens killed as war escalates near the border',
  description: 'Heavy fighting reported.',
  url: 'https://example.com/war',
  source: 'Wire', publishedAt: '2026-06-17T12:00:00Z',
  sourcecountry: 'Ukraine',
};

describe('deriveBreakthroughs', () => {
  it('tags a clear medical breakthrough as sense medical, polarity breakthrough', () => {
    const out = deriveBreakthroughs([medical]);
    expect(out).toHaveLength(1);
    expect(out[0].sense).toBe('medical');
    expect(out[0].polarity).toBe('breakthrough');
    expect(out[0].confidence).toBe('unconfirmed');
  });

  it('does NOT tag a war headline', () => {
    expect(deriveBreakthroughs([war])).toHaveLength(0);
  });

  it('emits events that pass validateSnapshotEvent', () => {
    const out = deriveBreakthroughs([medical]);
    expect(out.every(validateSnapshotEvent)).toBe(true);
  });

  it('skips unplaceable articles (no coords, no known country)', () => {
    expect(deriveBreakthroughs([{ ...medical, sourcecountry: 'Atlantis', lat: undefined, lng: undefined }])).toHaveLength(0);
  });

  it('uses pipeline coords when present', () => {
    const out = deriveBreakthroughs([{ ...medical, sourcecountry: null, lat: 12.3, lng: 45.6 }]);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBe(12.3);
    expect(out[0].lng).toBe(45.6);
  });
});
