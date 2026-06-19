import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const cities = JSON.parse(readFileSync(new URL('../data/cities-1000.json', import.meta.url)));
describe('cities-1000.json', () => {
  it('has at least 800 entries', () => expect(cities.length).toBeGreaterThan(800));
  it('every entry has valid fields', () => {
    const ALLOWED = ['capital','financial','tech','tourism','port','megacity','military','naval','energy','diplomatic','city'];
    cities.forEach(c => {
      expect(typeof c.lat).toBe('number');
      expect(typeof c.lng).toBe('number');
      expect(typeof c.name).toBe('string');
      expect(ALLOWED).toContain(c.icon_type);
      expect([1, 2, 3]).toContain(c.strategic_tier);
    });
  });
  it('includes capitals', () => expect(cities.some(c => c.is_capital)).toBe(true));
});
