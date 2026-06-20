// ═══════════════════════════════════════════
// AUSPEX · GEOLOCATION + CATEGORY (server-side, pure)
// Shared by the scheduled refresh (api/refresh.mjs). Mirrors the browser copy
// in js/data.js — keep the two coordinate maps in sync (coordinates are static,
// so drift is rare). Pure functions, unit-tested in tests/geolocate.test.js.
// ═══════════════════════════════════════════

export const CITY_COORDS = {
  'new york':[40.71,-74.01],'los angeles':[34.05,-118.24],'chicago':[41.88,-87.63],
  'washington':[38.90,-77.04],'san francisco':[37.77,-122.41],'seattle':[47.61,-122.33],
  'boston':[42.36,-71.06],'miami':[25.77,-80.19],'houston':[29.76,-95.37],
  'london':[51.51,-0.13],'paris':[48.85,2.35],'berlin':[52.52,13.40],
  'madrid':[40.42,-3.70],'rome':[41.90,12.50],'amsterdam':[52.37,4.90],
  'brussels':[50.85,4.35],'vienna':[48.21,16.37],'stockholm':[59.33,18.07],
  'oslo':[59.91,10.75],'copenhagen':[55.68,12.57],'zurich':[47.38,8.54],
  'frankfurt':[50.11,8.68],'munich':[48.14,11.58],'warsaw':[52.23,21.01],
  'kyiv':[50.45,30.52],'moscow':[55.76,37.62],'st. petersburg':[59.95,30.32],
  'beijing':[39.90,116.41],'shanghai':[31.23,121.47],'hong kong':[22.32,114.17],
  'tokyo':[35.68,139.69],'seoul':[37.57,126.98],'singapore':[1.35,103.82],
  'dubai':[25.20,55.27],'riyadh':[24.69,46.72],'abu dhabi':[24.47,54.37],
  'tel aviv':[32.07,34.79],'jerusalem':[31.77,35.21],'amman':[31.95,35.93],
  'cairo':[30.04,31.24],'istanbul':[41.01,28.97],'ankara':[39.93,32.86],
  'mumbai':[19.08,72.88],'delhi':[28.61,77.21],'bangalore':[12.97,77.59],
  'sydney':[-33.87,151.21],'melbourne':[-37.81,144.96],'canberra':[-35.28,149.13],
  'toronto':[43.65,-79.38],'ottawa':[45.42,-75.69],'vancouver':[49.28,-123.12],
  'mexico city':[19.43,-99.13],'sao paulo':[-23.55,-46.63],'brasilia':[-15.78,-47.93],
  'buenos aires':[-34.60,-58.38],'bogota':[4.71,-74.07],'lima':[-12.05,-77.04],
  'nairobi':[-1.29,36.82],'johannesburg':[-26.20,28.04],'lagos':[6.45,3.40],
  'accra':[5.56,-0.20],'addis ababa':[9.03,38.74],'kinshasa':[-4.32,15.32],
  'tehran':[35.70,51.42],'kabul':[34.52,69.18],'karachi':[24.86,67.01],
  'taipei':[25.03,121.56],'hanoi':[21.03,105.84],'jakarta':[-6.21,106.85],
  'manila':[14.60,121.00],'bangkok':[13.76,100.50],'kuala lumpur':[3.14,101.69],
  'havana':[23.13,-82.38],'panama city':[8.99,-79.52],'san jose':[9.93,-84.08],
};

export const COUNTRY_COORDS = {
  'united states':[37.09,-95.71],'us':[37.09,-95.71],'usa':[37.09,-95.71],'america':[37.09,-95.71],
  'china':[35.86,104.19],'chinese':[35.86,104.19],
  'russia':[61.52,105.32],'russian':[61.52,105.32],
  'ukraine':[49.00,32.00],'ukrainian':[49.00,32.00],
  'uk':[55.38,-3.44],'britain':[55.38,-3.44],'british':[55.38,-3.44],'england':[51.5,-0.1],
  'france':[46.23,2.21],'french':[46.23,2.21],
  'germany':[51.17,10.45],'german':[51.17,10.45],
  'japan':[36.20,138.25],'japanese':[36.20,138.25],
  'south korea':[35.91,127.77],'korean':[35.91,127.77],
  'india':[20.59,78.96],'indian':[20.59,78.96],
  'israel':[31.05,34.85],'israeli':[31.05,34.85],
  'iran':[32.43,53.69],'iranian':[32.43,53.69],
  'taiwan':[23.70,120.96],'taiwanese':[23.70,120.96],
  'saudi arabia':[23.89,45.08],'saudi':[23.89,45.08],
  'turkey':[38.96,35.24],'turkish':[38.96,35.24],
  'brazil':[-14.24,-51.93],'brazilian':[-14.24,-51.93],
  'australia':[-25.27,133.78],'australian':[-25.27,133.78],
  'canada':[56.13,-106.35],'canadian':[56.13,-106.35],
  'nato':[50.88,4.70],'eu':[50.50,4.47],'europe':[54.53,15.26],'european':[54.53,15.26],
  'middle east':[29.31,42.46],'africa':[1.65,17.54],'asia':[34.05,100.62],
  'arctic':[78.22,15.65],'amazon':[-3.47,-62.22],'pacific':[0.00,-160.00],
  'red sea':[18.00,39.00],'black sea':[43.00,35.00],'south china sea':[15.00,115.00],
  'mediterranean':[35.00,18.00],'persian gulf':[26.00,53.00],'horn of africa':[11.00,49.00],
};

// Place a story by the first city, then country/region, named in its text.
export function extractCoords(text) {
  if (!text) return null;
  const lc = text.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lc.includes(city)) return coords;
  }
  for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
    if (lc.includes(country)) return coords;
  }
  return null;
}

// Category by keyword scoring — geo / military / finance / climate / tech.
export function detectCat(text) {
  if (!text) return 'geo';
  const lc = text.toLowerCase();
  const scores = { geo:0, military:0, finance:0, climate:0, tech:0 };
  const kw = {
    geo: ['diplomat','sanction','treaty','election','president','minister','summit','parliament','nato','cease','nuclear agreement','bilateral','un security','peace talk'],
    military: ['military','troops','missile','drone strike','airstrike','navy','army','combat','weapon','explosio','attack','warship','soldier','artillery','bombing'],
    finance: ['market','stock','gdp','inflation','rate cut','rate hike','central bank','fed ','ecb','bonds','yield','equity','earnings','tariff','trade war','crypto','bitcoin','ipo'],
    climate: ['climate','carbon','deforestation','wildfire','flood','drought','emission','renewable','solar','arctic','glacier','temperature','hurricane','typhoon','net.zero'],
    tech: ['artificial intelligence','ai model','chip','semiconductor','robot','autonomous','cyber','software','quantum','satellite','space','launch','tech company','startup','data breach'],
  };
  for (const [cat, words] of Object.entries(kw)) {
    for (const w of words) { if (lc.includes(w)) scores[cat] += 1; }
  }
  const top = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
  return top[1] > 0 ? top[0] : 'geo';
}
