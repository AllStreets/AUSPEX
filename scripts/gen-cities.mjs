// scripts/gen-cities.mjs
// One-time generator. Requires GeoNames cities15000.txt (public domain, CC-BY).
import { readFileSync, writeFileSync } from 'fs';
const TSV = '/tmp/cities15000.txt';
// GeoNames "geoname" table columns (tab-separated):
// 1 name(idx1) asciiname(idx2), 4 latitude, 5 longitude, 7 feature code, 8 country code, 14 population
const FINANCIAL = new Set(['New York','London','Tokyo','Hong Kong','Singapore','Shanghai','Frankfurt','Zurich','Chicago','Toronto','Sydney','Shenzhen','Dubai']);
const PORTS     = new Set(['Rotterdam','Shanghai','Singapore','Busan','Hamburg','Antwerp','Los Angeles','Long Beach','Ningbo','Guangzhou','Jebel Ali','Tanjung Pelepas']);
const rows = readFileSync(TSV, 'utf8').split('\n').filter(Boolean).map(line => {
  const c = line.split('\t');
  return { name: c[2], lat: +c[4], lng: +c[5], fcode: c[7], iso2: c[8], population: +c[14] || 0 };
});
const capitals = rows.filter(r => r.fcode === 'PPLC');
const others   = rows.filter(r => r.fcode !== 'PPLC').sort((a, b) => b.population - a.population);
const chosen = [];
const seen = new Set();
for (const r of [...capitals, ...others]) {
  if (!r.name || seen.has(r.name)) continue;
  seen.add(r.name);
  chosen.push(r);
  if (chosen.length >= 1000) break;
}
function iconType(r) {
  if (r.fcode === 'PPLC') return 'capital';
  if (FINANCIAL.has(r.name)) return 'financial';
  if (PORTS.has(r.name)) return 'port';
  return 'city';
}
function tier(r) {
  if (r.fcode === 'PPLC' || r.population >= 5_000_000) return 1;
  if (r.population >= 1_000_000) return 2;
  return 3;
}
const out = chosen.map(r => ({
  name: r.name, country: r.iso2, iso2: r.iso2,
  lat: +r.lat.toFixed(4), lng: +r.lng.toFixed(4),
  population: r.population,
  is_capital: r.fcode === 'PPLC',
  is_financial: FINANCIAL.has(r.name),
  is_port: PORTS.has(r.name),
  strategic_tier: tier(r),
  icon_type: iconType(r),
}));
writeFileSync(new URL('../data/cities-1000.json', import.meta.url), JSON.stringify(out));
console.log(`wrote data/cities-1000.json (${out.length} cities)`);
