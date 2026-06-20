import { describe, it, expect } from 'vitest';
import { extractCoords, detectCat, CITY_COORDS, COUNTRY_COORDS } from '../src/geolocate.js';

describe('extractCoords', () => {
  it('locates a story by a city named in the text', () => {
    expect(extractCoords('Explosion reported in central Kyiv overnight')).toEqual(CITY_COORDS['kyiv']);
  });

  it('falls back to a country/region when no city matches', () => {
    expect(extractCoords('Sanctions tighten on Iran amid talks')).toEqual(COUNTRY_COORDS['iran']);
  });

  it('prefers a city over a country when both appear', () => {
    // "london" (city) should win over "britain"/"uk" (country) given city map runs first
    expect(extractCoords('London markets react to UK budget')).toEqual(CITY_COORDS['london']);
  });

  it('returns null for unlocatable text', () => {
    expect(extractCoords('A quiet day with nothing of note')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(extractCoords('')).toBeNull();
  });
});

describe('detectCat', () => {
  it('classifies military stories', () => {
    expect(detectCat('Missile and airstrike hit the army base')).toBe('military');
  });

  it('classifies finance stories', () => {
    expect(detectCat('Central bank signals a rate hike as inflation cools')).toBe('finance');
  });

  it('classifies climate stories', () => {
    expect(detectCat('Record wildfire and drought driven by climate change')).toBe('climate');
  });

  it('classifies tech stories', () => {
    expect(detectCat('New AI model and semiconductor chip breakthrough')).toBe('tech');
  });

  it('defaults to geo when no keywords match', () => {
    expect(detectCat('A local festival drew large crowds downtown')).toBe('geo');
  });
});
