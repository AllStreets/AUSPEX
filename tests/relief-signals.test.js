import { describe, it, expect } from 'vitest';
import {
  healthScoreToPhase, hasHealthSignal, healthStoryPoints,
  classifyProtection, PROTECTION_SIGNALS, isPlaceName,
} from '../src/relief-signals.js';

describe('isPlaceName', () => {
  it('accepts real place names', () => {
    expect(isPlaceName('Eastern Ukraine / Donbas'.split('/')[0].trim())).toBe(true);
    expect(isPlaceName('Sudan')).toBe(true);
    expect(isPlaceName('Gaza')).toBe(true);
  });
  it('rejects source domains and urls', () => {
    expect(isPlaceName('Abcnews.com')).toBe(false);
    expect(isPlaceName('The-independent.com')).toBe(false);
    expect(isPlaceName('plos.org')).toBe(false);
    expect(isPlaceName('https://x.y/z')).toBe(false);
    expect(isPlaceName('')).toBe(false);
  });
});

describe('healthScoreToPhase', () => {
  it('maps low scores to WATCH (1)', () => {
    expect(healthScoreToPhase(0)).toBe(1);
    expect(healthScoreToPhase(0.9)).toBe(1);
  });
  it('maps the 1.0 / 2.0 / 3.2 thresholds correctly', () => {
    expect(healthScoreToPhase(1.0)).toBe(2);
    expect(healthScoreToPhase(1.9)).toBe(2);
    expect(healthScoreToPhase(2.0)).toBe(3);
    expect(healthScoreToPhase(3.1)).toBe(3);
    expect(healthScoreToPhase(3.2)).toBe(4);
    expect(healthScoreToPhase(99)).toBe(4);
  });
  it('is robust to non-numeric input', () => {
    expect(healthScoreToPhase(undefined)).toBe(1);
    expect(healthScoreToPhase('x')).toBe(1);
  });
});

describe('hasHealthSignal / healthStoryPoints', () => {
  it('detects disease keywords', () => {
    expect(hasHealthSignal('Cholera outbreak spreads in camps')).toBe(true);
    expect(hasHealthSignal('Stock market rallies on earnings')).toBe(false);
  });
  it('scores a base health story at 1.0', () => {
    expect(healthStoryPoints('measles cases reported')).toBeCloseTo(1.0);
  });
  it('lifts score for acute language and breaking', () => {
    expect(healthStoryPoints('cholera deaths surge', false)).toBeCloseTo(1.8);
    expect(healthStoryPoints('cholera deaths surge', true)).toBeCloseTo(2.2);
  });
  it('scores 0 for a non-health story', () => {
    expect(healthStoryPoints('new bridge opens', true)).toBe(0);
  });
});

describe('classifyProtection', () => {
  it('classifies civilian casualties', () => {
    expect(classifyProtection('dozens of civilians killed in strike')).toContain('casualties');
  });
  it('classifies attacks on hospitals', () => {
    expect(classifyProtection('attack on hospital leaves staff trapped')).toContain('health_ed');
  });
  it('classifies siege / blockade of aid', () => {
    expect(classifyProtection('aid blocked as besieged town runs dry')).toEqual(
      expect.arrayContaining(['siege'])
    );
  });
  it('returns empty for a neutral story', () => {
    expect(classifyProtection('weather is mild today')).toEqual([]);
  });
  it('can match multiple concerns at once', () => {
    const ids = classifyProtection('war crime alleged as civilians killed and arbitrarily detained');
    expect(ids).toEqual(expect.arrayContaining(['casualties', 'rights', 'detention']));
  });
  it('does NOT false-positive on non-humanitarian uses of loose words', () => {
    // These tripped the old broad keyword list; the tightened taxonomy must ignore them.
    expect(classifyProtection('US lifts naval blockade on the strait')).toEqual([]);
    expect(classifyProtection("Entry-level work didn't disappear, PwC finds")).toEqual([]);
    expect(classifyProtection('refugee stars play in the cup final')).toEqual([]);
  });
  it('every taxonomy entry has id, label and keywords', () => {
    for (const s of PROTECTION_SIGNALS) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(Array.isArray(s.kw) && s.kw.length).toBeTruthy();
    }
  });
});
