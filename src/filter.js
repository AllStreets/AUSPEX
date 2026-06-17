// src/filter.js — pure, no I/O, no globals
export function buildFilterPredicate(f = {}) {
  const { senses, minSeverity = 0, confirmedOnly = false, timeWindowHours } = f;
  // Time window is only applied when explicitly provided; otherwise no time bound.
  const cutoff = timeWindowHours == null ? null : Date.now() - timeWindowHours * 3600_000;
  return (event) => {
    if (senses?.length && !senses.includes(event.sense)) return false;
    if ((event.severity ?? 0) < minSeverity) return false;
    if (confirmedOnly && event.confidence !== 'confirmed') return false;
    if (cutoff != null && new Date(event.occurredAt).getTime() < cutoff) return false;
    return true;
  };
}
export function applyFilter(events, filterState) {
  return events.filter(buildFilterPredicate(filterState));
}
export function deriveMapKeyRows(events, cities = [], activeFilters = {}) {
  const rows = [];
  const visible = events.filter(buildFilterPredicate(activeFilters));
  const seenSenses = new Set(visible.map(e => e.sense));
  const seenTypes = [...new Set(visible.map(e => e.type))].sort();
  const hasUnconfirmed = visible.some(e => e.confidence === 'unconfirmed');
  if (seenSenses.has('disaster')) rows.push({ section: 'DISASTER EVENTS' });
  seenTypes.forEach(t => rows.push({ icon: t, sense: 'disaster' }));
  if (hasUnconfirmed) rows.push({ special: 'unconfirmed' });
  if (cities.length) {
    rows.push({ section: 'CITY LAYER' });
    [...new Set(cities.map(c => c.icon_type))].forEach(t => rows.push({ cityType: t }));
  }
  return rows;
}
