import { describe, it, expect } from 'vitest';
import { buildFilterPredicate, applyFilter, deriveMapKeyRows } from '../src/filter.js';
const now = Date.now();
const events = [
  { id:'a', sense:'disaster', type:'earthquake', severity:0.8, confidence:'confirmed', occurredAt:new Date(now-3600_000).toISOString() },
  { id:'b', sense:'disaster', type:'flood',      severity:0.2, confidence:'unconfirmed', occurredAt:new Date(now-3600_000).toISOString() },
  { id:'c', sense:'space',    type:'launch',     severity:0.9, confidence:'confirmed', occurredAt:new Date(now-1000*3600*100).toISOString() },
];
describe('applyFilter', () => {
  it('confirmedOnly removes unconfirmed', () => expect(applyFilter(events, { confirmedOnly:true }).map(e=>e.id)).toEqual(['a','c']));
  it('minSeverity removes low severity', () => expect(applyFilter(events, { minSeverity:0.5 }).map(e=>e.id)).toEqual(['a','c']));
  it('senses filter keeps only listed senses', () => expect(applyFilter(events, { senses:['disaster'] }).map(e=>e.id)).toEqual(['a','b']));
  it('timeWindowHours removes old events', () => expect(applyFilter(events, { timeWindowHours:48 }).map(e=>e.id)).toEqual(['a','b']));
});
describe('deriveMapKeyRows', () => {
  const rows = deriveMapKeyRows(events, [{ icon_type:'capital' }], { senses:['disaster'], timeWindowHours:48 });
  it('includes a disaster section', () => expect(rows.some(r=>r.section==='DISASTER EVENTS')).toBe(true));
  it('includes earthquake and flood types only', () => {
    const types = rows.filter(r=>r.icon).map(r=>r.icon).sort();
    expect(types).toEqual(['earthquake','flood']);
  });
  it('flags unconfirmed when present', () => expect(rows.some(r=>r.special==='unconfirmed')).toBe(true));
  it('includes a city section when cities present', () => expect(rows.some(r=>r.section==='CITY LAYER')).toBe(true));
});
