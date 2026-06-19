// scripts/reclassify-cities.mjs
// Re-classifies data/cities-1000.json with a richer icon_type for visual variety.
//
// Priority order (first match wins):
//   capital → financial → tech → tourism → port → energy → megacity → city
// Capitals keep their `is_capital` → `capital` mapping. Everything else is
// matched against curated, case-insensitive name-sets. Whatever is left over
// falls back to population thresholds (megacity ≥ 8M, else city).
//
// Run:  node scripts/reclassify-cities.mjs
import { readFileSync, writeFileSync } from 'fs';

const FILE = new URL('../data/cities-1000.json', import.meta.url);

// ── Curated name-sets (case-insensitive). Aliases included where common. ──
// Expanded sensibly so the distribution reads with real variety; names below
// were cross-checked against the bundled cities-1000 dataset.
const FINANCIAL = [
  'New York','New York City','London','Tokyo','Hong Kong','Singapore','Shanghai',
  'Frankfurt','Zurich','Chicago','Toronto','Sydney','Shenzhen','Dubai','Mumbai',
  'Sao Paulo','São Paulo','Johannesburg','Geneva','Luxembourg','Milan','Milano',
  'Boston','Dallas','Charlotte','Seoul','Osaka','Amsterdam','Paris','Madrid',
  'Brooklyn','Manhattan','Saint Petersburg','Melbourne','Mexico City','Shanghai',
  'Guangzhou','Mumbai','Rio de Janeiro','Belo Horizonte','Pudong','Minhang',
  'Nanjing','Hangzhou','Bursa','Izmir','Jeddah','Bandar Seri Begawan',
];
const TECH = [
  'San Jose','San Francisco','Seattle','Austin','Bengaluru','Bangalore',
  'Shenzhen','Hangzhou','Tel Aviv','Tallinn','Dublin','Stockholm','Hsinchu',
  'Cambridge','Raleigh','Helsinki','Beijing','Suzhou','Chengdu','Munich',
  'München','San Diego','Portland','Denver','Atlanta','Wuhan','Xi\'an','Nanjing',
  'Hyderabad','Pune','Chennai','Dongguan','Foshan','Wuxi','Dalian','Xiamen',
  'Incheon','Yokohama','Taichung','New Taipei City','Changchun','Zhongshan',
];
const TOURISM = [
  'Venice','Venezia','Florence','Firenze','Rome','Roma','Paris','Barcelona',
  'Amsterdam','Prague','Praha','Vienna','Wien','Dubrovnik','Bali','Denpasar',
  'Phuket','Cancun','Cancún','Marrakech','Marrakesh','Kyoto','Queenstown',
  'Cape Town','Reykjavik','Reykjavík','Cusco','Cuzco','Siem Reap','Honolulu',
  'Las Vegas','Orlando','Male','Malé','Nice','Bruges','Brugge','Salzburg',
  'Athens','Athína','Istanbul','Edinburgh','Lisbon','Lisboa','Santorini',
  'Maldives','Agra','Hoi An','Giza','Alexandria','Salvador','Guayaquil',
  'Brisbane','Surabaya','Bandung','Casablanca','Antalya','Da Nang','Haikou',
];
const PORT = [
  'Rotterdam','Busan','Hamburg','Antwerp','Antwerpen','Los Angeles',
  'Long Beach','Ningbo','Guangzhou','Valencia','Piraeus','Felixstowe','Santos',
  'Durban','Mombasa','Colombo','Tanjung Pelepas','Jakarta','Genoa','Genova',
  'Marseille','Jebel Ali','Qingdao','Tianjin','Kaohsiung','Klang','Port Klang',
  'Laem Chabang','Bremerhaven','Le Havre','Karachi','Chattogram','Chittagong',
  'Haiphong','Yangon','Dar es Salaam','Surat','Abidjan','Lagos','Bao\'an',
  'Fuzhou','Wenzhou','Shantou','Medan','Bekasi','Yokohama','Chennai','Kolkata',
];
const ENERGY = [
  'Houston','Riyadh','Abu Dhabi','Dhahran','Doha','Kuwait City','Baku',
  'Stavanger','Aberdeen','Calgary','Perth','Astana','Nur-Sultan','Atyrau',
  'Port Harcourt','Dammam','Basra','Basrah','Luanda','Maracaibo','Tyumen',
  'Edmonton','Midland','Kano','Faisalabad','Gujranwala','Rawalpindi','Peshawar',
  'Lahore','Lanzhou','Taiyuan','Tangshan','Zibo','Guiyang','Kunming','Urumqi',
  'UEruemqi','Shiyan','Puyang','Yunfu',
];

const norm = s => (s || '').toLowerCase().normalize('NFC').trim();
const toSet = arr => new Set(arr.map(norm));
const SETS = [
  ['financial', toSet(FINANCIAL)],
  ['tech',      toSet(TECH)],
  ['tourism',   toSet(TOURISM)],
  ['port',      toSet(PORT)],
  ['energy',    toSet(ENERGY)],
];

const MEGACITY_POP = 8_000_000;

function classify(city) {
  if (city.is_capital) return 'capital';
  const name = norm(city.name);
  for (const [type, set] of SETS) {
    if (set.has(name)) return type;
  }
  if ((city.population || 0) >= MEGACITY_POP) return 'megacity';
  return 'city';
}

const cities = JSON.parse(readFileSync(FILE, 'utf8'));
const before = {};
const after  = {};
for (const c of cities) {
  before[c.icon_type] = (before[c.icon_type] || 0) + 1;
  c.icon_type = classify(c);
  // keep the boolean flags coherent with the curated sets
  c.is_financial = c.icon_type === 'financial' || !!c.is_financial;
  c.is_port      = c.icon_type === 'port'      || !!c.is_port;
  after[c.icon_type] = (after[c.icon_type] || 0) + 1;
}

writeFileSync(FILE, JSON.stringify(cities));

const fmt = d => Object.entries(d).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `  ${k.padEnd(10)} ${v}`).join('\n');
console.log(`Re-classified ${cities.length} cities → data/cities-1000.json\n`);
console.log('BEFORE:\n' + fmt(before));
console.log('\nAFTER:\n'  + fmt(after));
