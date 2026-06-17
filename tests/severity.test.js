import { describe, it, expect } from 'vitest';
import { quakeMagnitudeToSeverity, severityToBand, severityToColor, severityToRadius } from '../src/severity.js';
describe('quakeMagnitudeToSeverity', () => {
  it('clamps below 3 to 0', () => expect(quakeMagnitudeToSeverity(2)).toBe(0));
  it('M9 maps to 1.0', () => expect(quakeMagnitudeToSeverity(9)).toBe(1));
  it('M6 maps to 0.5', () => expect(quakeMagnitudeToSeverity(6)).toBe(0.5));
});
describe('severityToBand', () => {
  it('0.1 is minor', () => expect(severityToBand(0.1)).toBe('minor'));
  it('0.72 is major', () => expect(severityToBand(0.72)).toBe('major'));
  it('0.95 is great', () => expect(severityToBand(0.95)).toBe('great'));
});
describe('severityToColor', () => {
  it('high peril is red', () => expect(severityToColor(0.8, 'peril')).toBe('#FF2D55'));
  it('low breakthrough is blue', () => expect(severityToColor(0.3, 'breakthrough')).toBe('#007AFF'));
});
describe('severityToRadius', () => {
  it('0 severity is base radius', () => expect(severityToRadius(0)).toBe(1.5));
  it('1.0 severity is max radius', () => expect(severityToRadius(1)).toBe(7));
});
