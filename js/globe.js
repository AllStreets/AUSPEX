'use strict';

// ═══════════════════════════════════════════
// GLOBE — TIME OF DAY, INIT, MARKERS, RENDERING
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// TIME OF DAY
// ═══════════════════════════════════════════
function getTod() {
  const h = new Date().getHours();
  if (h >= 5  && h < 7)  return 'dawn';
  if (h >= 7  && h < 18) return 'day';
  if (h >= 18 && h < 20) return 'dusk';
  return 'night';
}

function getTexture(tod) {
  return tod === 'day'
    ? '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
    : '//unpkg.com/three-globe/example/img/earth-night.jpg';
}

function getAtmos(tod) {
  return {night:'#0e2050',dawn:'#cc5522',day:'#3366cc',dusk:'#cc3311'}[tod]||'#0e2050';
}

const DND_ICONS = {
  night: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  dawn:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/></svg>`,
  day:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>`,
  dusk:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/></svg>`,
};
function getDndInfo(tod) {
  return {night:{icon:DND_ICONS.night,lbl:'NIGHT'},dawn:{icon:DND_ICONS.dawn,lbl:'DAWN'},day:{icon:DND_ICONS.day,lbl:'DAY'},dusk:{icon:DND_ICONS.dusk,lbl:'DUSK'}}[tod];
}

function applyTod(tod) {
  const info = getDndInfo(tod);
  document.getElementById('dnd-icon').innerHTML = info.icon;
  document.getElementById('dnd-lbl').textContent = info.lbl;
}

// ═══════════════════════════════════════════
// STAR FIELD
// ═══════════════════════════════════════════
function initStars() {
  const cv = document.getElementById('stars');
  const cx = cv.getContext('2d');
  const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
  resize(); window.addEventListener('resize', resize);
  const stars = Array.from({length:220}, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.0 + 0.15,
    a: Math.random() * 0.5 + 0.05,
    sp: Math.random() * 0.35 + 0.04,
    ph: Math.random() * Math.PI * 2,
  }));
  let t = 0;
  (function frame() {
    cx.clearRect(0, 0, cv.width, cv.height);
    stars.forEach(s => {
      const alpha = s.a * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      cx.beginPath();
      cx.arc(s.x * cv.width, s.y * cv.height, s.r, 0, Math.PI * 2);
      cx.fillStyle = `rgba(180,200,255,${alpha})`;
      cx.fill();
    });
    t += 0.016;
    requestAnimationFrame(frame);
  })();
}

// ═══════════════════════════════════════════
// ALL WORLD COUNTRIES — geographic centroids
// Fallback when Supabase countries table is empty or partial
// ═══════════════════════════════════════════
const _WORLD_COUNTRIES = [
  // North America
  {iso2:'US',name:'United States',lat:39.5,lng:-98.3,nuclear_armed:true,un_p5:true,nato_member:true,strategic_tier:1},
  {iso2:'CA',name:'Canada',lat:60.0,lng:-96.8,nato_member:true,strategic_tier:2},
  {iso2:'GL',name:'Greenland',lat:72.0,lng:-40.0,strategic_tier:2},
  {iso2:'MX',name:'Mexico',lat:23.6,lng:-102.5,strategic_tier:2},
  // Central America & Caribbean
  {iso2:'GT',name:'Guatemala',lat:15.8,lng:-90.2},{iso2:'BZ',name:'Belize',lat:17.2,lng:-88.5},
  {iso2:'HN',name:'Honduras',lat:15.2,lng:-86.2},{iso2:'SV',name:'El Salvador',lat:13.8,lng:-88.9},
  {iso2:'NI',name:'Nicaragua',lat:12.8,lng:-85.2},{iso2:'CR',name:'Costa Rica',lat:9.7,lng:-84.2},
  {iso2:'PA',name:'Panama',lat:8.4,lng:-80.1},{iso2:'CU',name:'Cuba',lat:22.0,lng:-79.5},
  {iso2:'JM',name:'Jamaica',lat:18.1,lng:-77.3},{iso2:'HT',name:'Haiti',lat:19.0,lng:-72.3,conflict_active:true},
  {iso2:'DO',name:'Dominican Rep.',lat:19.0,lng:-70.7},{iso2:'TT',name:'Trinidad & Tobago',lat:10.7,lng:-61.2},
  {iso2:'BB',name:'Barbados',lat:13.2,lng:-59.6},{iso2:'LC',name:'St. Lucia',lat:13.9,lng:-60.9},
  {iso2:'VC',name:'St. Vincent',lat:13.3,lng:-61.2},{iso2:'GD',name:'Grenada',lat:12.1,lng:-61.7},
  {iso2:'AG',name:'Antigua & Barbuda',lat:17.1,lng:-61.8},{iso2:'DM',name:'Dominica',lat:15.4,lng:-61.4},
  {iso2:'KN',name:'St. Kitts & Nevis',lat:17.4,lng:-62.8},{iso2:'BS',name:'Bahamas',lat:24.8,lng:-78.0},
  // South America
  {iso2:'CO',name:'Colombia',lat:4.0,lng:-72.0,strategic_tier:3},
  {iso2:'VE',name:'Venezuela',lat:8.0,lng:-66.0,sanctions_subject:true},
  {iso2:'GY',name:'Guyana',lat:5.0,lng:-59.0},{iso2:'SR',name:'Suriname',lat:4.0,lng:-56.0},
  {iso2:'BR',name:'Brazil',lat:-10.0,lng:-55.0,strategic_tier:2},
  {iso2:'EC',name:'Ecuador',lat:-1.8,lng:-78.2},{iso2:'PE',name:'Peru',lat:-10.0,lng:-76.0},
  {iso2:'BO',name:'Bolivia',lat:-17.0,lng:-65.0},{iso2:'PY',name:'Paraguay',lat:-23.0,lng:-58.0},
  {iso2:'AR',name:'Argentina',lat:-34.0,lng:-64.0,strategic_tier:2},
  {iso2:'CL',name:'Chile',lat:-35.0,lng:-71.0},{iso2:'UY',name:'Uruguay',lat:-33.0,lng:-56.0},
  // Europe — Western
  {iso2:'GB',name:'United Kingdom',lat:54.0,lng:-2.0,nuclear_armed:true,un_p5:true,nato_member:true,strategic_tier:1},
  {iso2:'FR',name:'France',lat:46.2,lng:2.2,nuclear_armed:true,un_p5:true,nato_member:true,strategic_tier:1},
  {iso2:'DE',name:'Germany',lat:51.2,lng:10.5,nato_member:true,strategic_tier:1},
  {iso2:'IT',name:'Italy',lat:42.8,lng:12.8,nato_member:true,strategic_tier:2},
  {iso2:'ES',name:'Spain',lat:40.0,lng:-4.0,nato_member:true,strategic_tier:2},
  {iso2:'PT',name:'Portugal',lat:39.6,lng:-8.0,nato_member:true},
  {iso2:'NL',name:'Netherlands',lat:52.3,lng:5.3,nato_member:true,strategic_tier:2},
  {iso2:'BE',name:'Belgium',lat:50.5,lng:4.5,nato_member:true},
  {iso2:'CH',name:'Switzerland',lat:46.8,lng:8.2},{iso2:'AT',name:'Austria',lat:47.5,lng:14.6},
  {iso2:'IE',name:'Ireland',lat:53.2,lng:-8.0},{iso2:'LU',name:'Luxembourg',lat:49.8,lng:6.1,nato_member:true},
  {iso2:'MC',name:'Monaco',lat:43.7,lng:7.4},{iso2:'LI',name:'Liechtenstein',lat:47.2,lng:9.5},
  {iso2:'AD',name:'Andorra',lat:42.5,lng:1.5},{iso2:'SM',name:'San Marino',lat:43.9,lng:12.5},
  {iso2:'MT',name:'Malta',lat:35.9,lng:14.4},
  // Europe — Nordic
  {iso2:'NO',name:'Norway',lat:64.0,lng:14.0,nato_member:true,strategic_tier:2},
  {iso2:'SE',name:'Sweden',lat:62.0,lng:16.0,nato_member:true},
  {iso2:'FI',name:'Finland',lat:64.5,lng:25.5,nato_member:true},
  {iso2:'DK',name:'Denmark',lat:56.0,lng:10.0,nato_member:true},
  {iso2:'IS',name:'Iceland',lat:64.9,lng:-18.5,nato_member:true},
  // Europe — Eastern
  {iso2:'PL',name:'Poland',lat:52.0,lng:20.0,nato_member:true,strategic_tier:2},
  {iso2:'CZ',name:'Czechia',lat:49.8,lng:15.5,nato_member:true},
  {iso2:'SK',name:'Slovakia',lat:48.7,lng:19.5,nato_member:true},
  {iso2:'HU',name:'Hungary',lat:47.2,lng:19.5,nato_member:true},
  {iso2:'RO',name:'Romania',lat:46.0,lng:25.0,nato_member:true},
  {iso2:'BG',name:'Bulgaria',lat:43.0,lng:25.5,nato_member:true},
  {iso2:'EE',name:'Estonia',lat:58.7,lng:25.0,nato_member:true},
  {iso2:'LV',name:'Latvia',lat:57.0,lng:25.0,nato_member:true},
  {iso2:'LT',name:'Lithuania',lat:55.7,lng:24.0,nato_member:true},
  {iso2:'BY',name:'Belarus',lat:53.5,lng:28.5,sanctions_subject:true},
  {iso2:'UA',name:'Ukraine',lat:49.0,lng:31.0,conflict_active:true,strategic_tier:2},
  {iso2:'MD',name:'Moldova',lat:47.5,lng:28.5},
  {iso2:'RU',name:'Russia',lat:55.0,lng:105.0,nuclear_armed:true,un_p5:true,conflict_active:true,sanctions_subject:true,strategic_tier:1},
  // Europe — Balkans
  {iso2:'GR',name:'Greece',lat:39.1,lng:21.8,nato_member:true},
  {iso2:'HR',name:'Croatia',lat:45.2,lng:15.5,nato_member:true},
  {iso2:'SI',name:'Slovenia',lat:46.1,lng:14.8,nato_member:true},
  {iso2:'BA',name:'Bosnia & Herz.',lat:44.0,lng:17.5},
  {iso2:'RS',name:'Serbia',lat:44.0,lng:21.0},
  {iso2:'ME',name:'Montenegro',lat:42.7,lng:19.4,nato_member:true},
  {iso2:'MK',name:'N. Macedonia',lat:41.6,lng:21.7,nato_member:true},
  {iso2:'AL',name:'Albania',lat:41.2,lng:20.2,nato_member:true},
  {iso2:'XK',name:'Kosovo',lat:42.6,lng:20.9},
  {iso2:'CY',name:'Cyprus',lat:35.1,lng:33.4},
  // Caucasus
  {iso2:'GE',name:'Georgia',lat:42.3,lng:43.4},{iso2:'AM',name:'Armenia',lat:40.1,lng:45.0},
  {iso2:'AZ',name:'Azerbaijan',lat:40.1,lng:47.6,conflict_active:true},
  // Middle East
  {iso2:'TR',name:'Turkey',lat:39.0,lng:35.0,nato_member:true,strategic_tier:2},
  {iso2:'SY',name:'Syria',lat:35.0,lng:38.0,conflict_active:true,sanctions_subject:true},
  {iso2:'LB',name:'Lebanon',lat:33.9,lng:35.5,conflict_active:true},
  {iso2:'JO',name:'Jordan',lat:31.0,lng:36.0},
  {iso2:'IL',name:'Israel',lat:31.8,lng:35.2,nuclear_armed:true,conflict_active:true,strategic_tier:2},
  {iso2:'PS',name:'Palestine',lat:31.9,lng:35.2,conflict_active:true},
  {iso2:'IQ',name:'Iraq',lat:33.0,lng:44.0,conflict_active:true},
  {iso2:'IR',name:'Iran',lat:32.5,lng:54.0,sanctions_subject:true,strategic_tier:2},
  {iso2:'SA',name:'Saudi Arabia',lat:24.7,lng:46.0,strategic_tier:2},
  {iso2:'YE',name:'Yemen',lat:15.5,lng:48.0,conflict_active:true},
  {iso2:'OM',name:'Oman',lat:22.0,lng:57.5},{iso2:'AE',name:'UAE',lat:24.0,lng:54.0,strategic_tier:2},
  {iso2:'QA',name:'Qatar',lat:25.3,lng:51.2},{iso2:'KW',name:'Kuwait',lat:29.3,lng:47.7},
  {iso2:'BH',name:'Bahrain',lat:26.0,lng:50.5},
  // Central Asia
  {iso2:'KZ',name:'Kazakhstan',lat:48.0,lng:68.0,strategic_tier:2},
  {iso2:'UZ',name:'Uzbekistan',lat:41.0,lng:64.0},{iso2:'TM',name:'Turkmenistan',lat:39.0,lng:59.0},
  {iso2:'TJ',name:'Tajikistan',lat:38.8,lng:71.0},{iso2:'KG',name:'Kyrgyzstan',lat:41.2,lng:74.5},
  {iso2:'AF',name:'Afghanistan',lat:33.9,lng:67.7,conflict_active:true},
  // South Asia
  {iso2:'PK',name:'Pakistan',lat:30.0,lng:70.0,nuclear_armed:true,conflict_active:true,strategic_tier:2},
  {iso2:'IN',name:'India',lat:22.0,lng:79.0,nuclear_armed:true,strategic_tier:1},
  {iso2:'BD',name:'Bangladesh',lat:24.0,lng:90.0},{iso2:'NP',name:'Nepal',lat:28.0,lng:84.0},
  {iso2:'BT',name:'Bhutan',lat:27.4,lng:90.4},{iso2:'LK',name:'Sri Lanka',lat:7.0,lng:81.0},
  {iso2:'MV',name:'Maldives',lat:3.2,lng:73.0},
  // East Asia
  {iso2:'CN',name:'China',lat:35.0,lng:105.0,nuclear_armed:true,un_p5:true,strategic_tier:1},
  {iso2:'JP',name:'Japan',lat:36.0,lng:138.0,strategic_tier:1},
  {iso2:'KR',name:'South Korea',lat:36.5,lng:128.0,strategic_tier:2},
  {iso2:'KP',name:'North Korea',lat:40.0,lng:127.0,nuclear_armed:true,sanctions_subject:true,strategic_tier:2},
  {iso2:'MN',name:'Mongolia',lat:46.5,lng:102.5},
  {iso2:'TW',name:'Taiwan',lat:23.7,lng:121.0,strategic_tier:2},
  // Southeast Asia
  {iso2:'PH',name:'Philippines',lat:12.0,lng:122.5,strategic_tier:2},
  {iso2:'VN',name:'Vietnam',lat:16.0,lng:106.0,strategic_tier:2},
  {iso2:'KH',name:'Cambodia',lat:12.5,lng:104.5},{iso2:'LA',name:'Laos',lat:17.5,lng:102.5},
  {iso2:'TH',name:'Thailand',lat:15.0,lng:101.0,strategic_tier:2},
  {iso2:'MM',name:'Myanmar',lat:19.5,lng:96.5,conflict_active:true,sanctions_subject:true},
  {iso2:'MY',name:'Malaysia',lat:2.5,lng:112.5,strategic_tier:2},
  {iso2:'SG',name:'Singapore',lat:1.3,lng:103.8,strategic_tier:2},
  {iso2:'ID',name:'Indonesia',lat:-5.0,lng:120.0,strategic_tier:2},
  {iso2:'BN',name:'Brunei',lat:4.5,lng:114.7},{iso2:'TL',name:'Timor-Leste',lat:-8.8,lng:125.7},
  // Oceania
  {iso2:'AU',name:'Australia',lat:-25.0,lng:133.0,strategic_tier:2},
  {iso2:'NZ',name:'New Zealand',lat:-41.5,lng:174.0},
  {iso2:'FJ',name:'Fiji',lat:-18.0,lng:178.0},{iso2:'PG',name:'Papua New Guinea',lat:-6.5,lng:147.0},
  {iso2:'SB',name:'Solomon Islands',lat:-8.0,lng:159.0},{iso2:'VU',name:'Vanuatu',lat:-15.5,lng:167.0},
  {iso2:'WS',name:'Samoa',lat:-13.8,lng:-172.0},{iso2:'TO',name:'Tonga',lat:-20.0,lng:-175.0},
  {iso2:'KI',name:'Kiribati',lat:1.4,lng:173.0},{iso2:'MH',name:'Marshall Islands',lat:9.0,lng:168.0},
  {iso2:'FM',name:'Micronesia',lat:7.0,lng:158.0},{iso2:'NR',name:'Nauru',lat:-0.5,lng:166.6},
  {iso2:'PW',name:'Palau',lat:7.5,lng:134.5},{iso2:'TV',name:'Tuvalu',lat:-8.0,lng:178.0},
  // Africa — North
  {iso2:'MA',name:'Morocco',lat:32.0,lng:-5.0,strategic_tier:2},
  {iso2:'DZ',name:'Algeria',lat:28.0,lng:2.0,strategic_tier:2},
  {iso2:'TN',name:'Tunisia',lat:34.0,lng:9.0},{iso2:'LY',name:'Libya',lat:27.0,lng:17.0,conflict_active:true},
  {iso2:'EG',name:'Egypt',lat:26.5,lng:29.5,strategic_tier:2},
  // Africa — West
  {iso2:'MR',name:'Mauritania',lat:20.0,lng:-12.0},{iso2:'ML',name:'Mali',lat:17.0,lng:-4.0,conflict_active:true},
  {iso2:'SN',name:'Senegal',lat:14.5,lng:-14.5},{iso2:'GM',name:'Gambia',lat:13.5,lng:-15.5},
  {iso2:'GW',name:'Guinea-Bissau',lat:12.0,lng:-15.0},{iso2:'GN',name:'Guinea',lat:11.0,lng:-11.5},
  {iso2:'SL',name:'Sierra Leone',lat:8.6,lng:-11.8},{iso2:'LR',name:'Liberia',lat:6.5,lng:-9.5},
  {iso2:'CI',name:"Côte d'Ivoire",lat:7.5,lng:-5.5},{iso2:'GH',name:'Ghana',lat:8.0,lng:-1.0},
  {iso2:'TG',name:'Togo',lat:8.0,lng:1.2},{iso2:'BJ',name:'Benin',lat:9.5,lng:2.3},
  {iso2:'BF',name:'Burkina Faso',lat:12.5,lng:-2.0,conflict_active:true},
  {iso2:'NE',name:'Niger',lat:17.0,lng:8.0,conflict_active:true},
  {iso2:'NG',name:'Nigeria',lat:10.0,lng:8.0,conflict_active:true,strategic_tier:2},
  {iso2:'CV',name:'Cape Verde',lat:16.0,lng:-24.0},
  // Africa — Central
  {iso2:'CM',name:'Cameroon',lat:5.0,lng:12.0},{iso2:'TD',name:'Chad',lat:15.0,lng:19.0,conflict_active:true},
  {iso2:'CF',name:'C. African Rep.',lat:7.0,lng:21.0,conflict_active:true},
  {iso2:'SD',name:'Sudan',lat:15.0,lng:30.0,conflict_active:true},
  {iso2:'SS',name:'South Sudan',lat:7.0,lng:30.0,conflict_active:true},
  {iso2:'ET',name:'Ethiopia',lat:8.0,lng:38.0,conflict_active:true,strategic_tier:2},
  {iso2:'ER',name:'Eritrea',lat:15.3,lng:39.0},{iso2:'DJ',name:'Djibouti',lat:11.8,lng:42.5},
  {iso2:'SO',name:'Somalia',lat:6.0,lng:46.0,conflict_active:true},
  {iso2:'GQ',name:'Equatorial Guinea',lat:2.0,lng:10.0},
  {iso2:'GA',name:'Gabon',lat:-1.0,lng:11.5},{iso2:'ST',name:'São Tomé & Príncipe',lat:0.2,lng:6.6},
  {iso2:'CG',name:'Congo',lat:-1.0,lng:15.0},{iso2:'CD',name:'DR Congo',lat:-4.0,lng:24.5,conflict_active:true,strategic_tier:2},
  // Africa — East & Southern
  {iso2:'KE',name:'Kenya',lat:-1.3,lng:37.0,strategic_tier:2},
  {iso2:'UG',name:'Uganda',lat:1.4,lng:32.0},{iso2:'RW',name:'Rwanda',lat:-2.0,lng:30.0},
  {iso2:'BI',name:'Burundi',lat:-3.4,lng:30.0,conflict_active:true},
  {iso2:'TZ',name:'Tanzania',lat:-6.0,lng:35.0,strategic_tier:2},
  {iso2:'MZ',name:'Mozambique',lat:-18.0,lng:35.0,conflict_active:true},
  {iso2:'MW',name:'Malawi',lat:-13.5,lng:34.0},{iso2:'ZM',name:'Zambia',lat:-15.0,lng:30.0},
  {iso2:'ZW',name:'Zimbabwe',lat:-20.0,lng:30.0,sanctions_subject:true},
  {iso2:'AO',name:'Angola',lat:-11.5,lng:17.5},{iso2:'NA',name:'Namibia',lat:-22.0,lng:17.0},
  {iso2:'BW',name:'Botswana',lat:-22.0,lng:24.0},{iso2:'ZA',name:'South Africa',lat:-30.0,lng:25.0,strategic_tier:2},
  {iso2:'SZ',name:'Eswatini',lat:-26.5,lng:31.5},{iso2:'LS',name:'Lesotho',lat:-29.5,lng:28.0},
  {iso2:'MG',name:'Madagascar',lat:-20.0,lng:47.0},{iso2:'KM',name:'Comoros',lat:-12.0,lng:44.0},
  {iso2:'SC',name:'Seychelles',lat:-4.5,lng:55.7},{iso2:'MU',name:'Mauritius',lat:-20.3,lng:57.6},
];

// ═══════════════════════════════════════════
// CITY MARKER — icon-based, Supabase-backed
// ═══════════════════════════════════════════
const _CITY_ICONS = {
  // Capital — the gold star (kept; user favourite), tightened points for clean small render.
  capital:    `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6,0.6 7.36,4.18 11.2,4.3 8.15,6.66 9.25,10.4 6,8.2 2.75,10.4 3.85,6.66 0.8,4.3 4.64,4.18" fill="currentColor"/></svg>`,
  // Financial — a tidy bar-chart with a baseline, reads as markets/exchange.
  financial:  `<svg viewBox="0 0 12 12" width="100%" height="100%"><line x1="1" y1="10.4" x2="11" y2="10.4" stroke="currentColor" stroke-width="0.9" opacity=".55"/><rect x="1.7" y="6.6" width="1.7" height="3.6" rx="0.4" fill="currentColor"/><rect x="4.4" y="4.4" width="1.7" height="5.8" rx="0.4" fill="currentColor"/><rect x="7.1" y="2.2" width="1.7" height="8" rx="0.4" fill="currentColor"/><path d="M2.4 6 L5 4 L7.8 5 L10.4 1.8" stroke="currentColor" stroke-width="0.85" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>`,
  // Tech — a crisp CPU / microchip with pins.
  tech:       `<svg viewBox="0 0 12 12" width="100%" height="100%"><rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1" fill="none"/><rect x="4.9" y="4.9" width="2.2" height="2.2" rx="0.4" fill="currentColor"/><g stroke="currentColor" stroke-width="0.95" stroke-linecap="round"><line x1="4.5" y1="3" x2="4.5" y2="1.4"/><line x1="6" y1="3" x2="6" y2="1.4"/><line x1="7.5" y1="3" x2="7.5" y2="1.4"/><line x1="4.5" y1="9" x2="4.5" y2="10.6"/><line x1="6" y1="9" x2="6" y2="10.6"/><line x1="7.5" y1="9" x2="7.5" y2="10.6"/><line x1="3" y1="4.5" x2="1.4" y2="4.5"/><line x1="3" y1="6" x2="1.4" y2="6"/><line x1="3" y1="7.5" x2="1.4" y2="7.5"/><line x1="9" y1="4.5" x2="10.6" y2="4.5"/><line x1="9" y1="6" x2="10.6" y2="6"/><line x1="9" y1="7.5" x2="10.6" y2="7.5"/></g></svg>`,
  // Tourism — a classical monument / landmark column, clearly "place to see".
  tourism:    `<svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 0.8 L10.3 3.6 H1.7 Z" fill="currentColor"/><rect x="2.2" y="3.9" width="7.6" height="0.9" rx="0.3" fill="currentColor"/><g fill="currentColor"><rect x="2.9" y="5" width="1.1" height="4.2"/><rect x="5.45" y="5" width="1.1" height="4.2"/><rect x="8" y="5" width="1.1" height="4.2"/></g><rect x="1.7" y="9.4" width="8.6" height="1" rx="0.3" fill="currentColor"/></svg>`,
  // Port — anchor (refined, even strokes for small sizes).
  port:       `<svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="2.4" r="1.3" stroke="currentColor" stroke-width="1.05" fill="none"/><line x1="6" y1="3.7" x2="6" y2="10.1" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/><line x1="3.7" y1="5.2" x2="8.3" y2="5.2" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/><path d="M2.3 7.3 c0.5 2.2 2.1 3.1 3.7 3.1 s3.2-0.9 3.7-3.1" stroke="currentColor" stroke-width="1.15" fill="none" stroke-linecap="round"/><line x1="1.9" y1="7.3" x2="3" y2="6.9" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/><line x1="10.1" y1="7.3" x2="9" y2="6.9" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/></svg>`,
  // Energy — lightning bolt (kept concept, balanced for small sizes).
  energy:     `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6.9,0.8 2.8,6.7 5.7,6.7 4.7,11.2 9.3,4.9 6.2,4.9" fill="currentColor"/></svg>`,
  // Megacity — a refined skyline cluster of towers.
  megacity:   `<svg viewBox="0 0 12 12" width="100%" height="100%"><g fill="currentColor"><rect x="1.2" y="6.2" width="2" height="4.6" rx="0.3"/><rect x="3.6" y="3.6" width="2.1" height="7.2" rx="0.3"/><rect x="6.2" y="1.6" width="2.2" height="9.2" rx="0.3"/><rect x="8.9" y="4.8" width="1.9" height="6" rx="0.3"/></g><path d="M7.3 1.6 V0.6" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/><g fill="#0a0c1e" opacity=".55"><rect x="6.8" y="3" width="0.6" height="0.8"/><rect x="7.7" y="3" width="0.6" height="0.8"/><rect x="6.8" y="4.6" width="0.6" height="0.8"/><rect x="7.7" y="4.6" width="0.6" height="0.8"/></g></svg>`,
  // City (generic default) — a crisp ringed dot, NOT the heavy lavender square.
  city:       `<svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="6" r="4.4" stroke="currentColor" stroke-width="1.1" fill="none" opacity=".7"/><circle cx="6" cy="6" r="1.9" fill="currentColor"/></svg>`,
  // ── Legacy event-marker types kept for backwards-compat ──
  military:   `<svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 1L1.5 3.5V7c0 2.2 2 4 4.5 4.5C10 11 10.5 9.2 10.5 7V3.5Z" fill="currentColor"/><path d="M4 6.2l1.5 1.5L8.5 4.5" stroke="#0a0c18" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
  naval:      `<svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 1v3M4.5 4h3M2.5 6.5l1 3.5h5l1-3.5C8.5 6 7 5.5 6 5.5S3.5 6 2.5 6.5z" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M1.5 10c1 .8 2 1 4.5 1s3.5-.2 4.5-1" stroke="currentColor" stroke-width="1" fill="none"/></svg>`,
  conflict:   `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6,1 11.5,11 0.5,11" fill="currentColor"/><text x="5.1" y="10.2" font-size="5.5" font-weight="bold" fill="#0a0c18" font-family="monospace">!</text></svg>`,
  diplomatic: `<svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" fill="none"/><ellipse cx="6" cy="6" rx="2.5" ry="5" stroke="currentColor" stroke-width="0.8" fill="none"/><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="0.8"/><line x1="1.8" y1="3.5" x2="10.2" y2="3.5" stroke="currentColor" stroke-width="0.6" opacity=".6"/><line x1="1.8" y1="8.5" x2="10.2" y2="8.5" stroke="currentColor" stroke-width="0.6" opacity=".6"/></svg>`,
};
const _CITY_COLORS = {
  capital:'#E8D5A3',  // warm gold star (kept)
  financial:'#FFD60A',// gold — markets
  tech:'#9D8CFF',     // cool cyan-violet — silicon
  tourism:'#FF8FA3',  // warm coral/pink — landmarks
  port:'#2DD4BF',     // teal — water/trade
  energy:'#FFB02E',   // amber — power
  megacity:'#9FB3C8', // soft slate — dense urban
  city:'#8FA0E8',     // calm periwinkle dot (lighter, not the heavy square)
  // legacy event types
  military:'#FF6D00', naval:'#2979FF', conflict:'#FF2D55', diplomatic:'#30D158',
};
function makeCityMarker(city) {
  const type   = city.icon_type || 'city';
  const color  = _CITY_COLORS[type] || '#6674CC';
  const tier   = city.strategic_tier || 3;
  const sz     = tier === 1 ? 18 : tier === 2 ? 15 : 13;
  const d      = document.createElement('div');
  d.className  = `cm cm-${type} cm-t${tier}`;
  d.style.cssText = `width:${sz}px;height:${sz}px;color:${color};transform:translate(-50%,-50%) scale(var(--gz-scale,1));transform-origin:center center;pointer-events:auto;cursor:pointer;filter:drop-shadow(0 0 ${tier===1?4:2}px ${color}99);position:relative;flex-shrink:0`;
  d.innerHTML  = (_CITY_ICONS[type] || _CITY_ICONS.city);
  // Label for all tiers — base size kept small; --gz-lbl-boost amplifies at close zoom
  const lbl = document.createElement('div');
  lbl.className = 'cm-lbl';
  const lblSize = tier === 1 ? 6.5 : 5.5;
  lbl.style.cssText = `position:absolute;top:${sz+3}px;left:50%;transform:translateX(-50%) scale(var(--gz-lbl-boost,1));transform-origin:top center;font-family:var(--f-mono);font-size:${lblSize}px;font-weight:600;color:${color};white-space:nowrap;letter-spacing:.07em;text-shadow:0 1px 3px rgba(0,0,0,1),0 0 8px rgba(0,0,0,1),0 0 14px rgba(0,0,0,.9);opacity:${tier===1?1:.88};pointer-events:none`;
  lbl.textContent = city.name.toUpperCase();
  d.appendChild(lbl);
  d.title = `${city.name}${city.country ? ', '+city.country : ''}${city.notes ? '\n'+city.notes : ''}`;
  d.addEventListener('click', e => { e.stopPropagation(); openCityPanel(city); });
  return d;
}

// ═══════════════════════════════════════════
// GLOBE MARKER ELEMENT
// ═══════════════════════════════════════════
function makeMarker(story) {
  const d = document.createElement('div');
  const cat = story.cat || 'all';
  d.className = 'gm';
  d.style.color = story.color;
  const _canPulse = _pulseSet.has(story);
  d.innerHTML = `
    ${_canPulse ? `<div class="gm-ring cat-ring-${cat}" style="border-color:${story.color}"></div>` : ''}
    ${_canPulse && story.brk ? `<div class="gm-ring gm-ring2 cat-ring-${cat}" style="border-color:${story.color}"></div>` : ''}
    <div class="gm-core cat-core-${cat}" style="background:${story.color};box-shadow:0 0 ${story.brk?10:5}px ${story.color}99"></div>
    <div class="gm-tip">${story.title.length > 72 ? story.title.slice(0,70)+'…' : story.title}</div>
  `;
  d.addEventListener('pointerdown', e => e.stopPropagation());
  // Collect co-located stories: a single story opens its article directly,
  // multiple at the same place open the scrollable picker list.
  d.addEventListener('click', e => { e.stopPropagation(); handleLocationClick(story); });
  return d;
}

// ═══════════════════════════════════════════
// AUSPEX EVENT MARKER — holographic disaster/breakthrough sense
// ═══════════════════════════════════════════
function makeAuspexEventMarker(event) {
  const sev = event.severity ?? 0;
  // Color encodes TYPE (single source: auspexEventColor); severity still drives
  // SIZE and glow intensity below, so both dimensions stay legible at a glance.
  const color = (typeof auspexEventColor === 'function')
    ? auspexEventColor(event)
    : (event.polarity === 'breakthrough' ? '#5AC8FA' : '#FF8C66');
  const size = 8 + sev * 14;
  const glyph = size + 10; // glyph sits above the ring; large enough to read the shape
  const unconfirmed = event.confidence === 'unconfirmed';
  // Glyph fluid for any event kind (icon → type → sense → polarity fallback).
  const svg = (typeof auspexEventGlyph === 'function')
    ? auspexEventGlyph(event)
    : (typeof AUSPEX_EVENT_ICONS !== 'undefined')
      ? (AUSPEX_EVENT_ICONS[event.icon] || AUSPEX_EVENT_ICONS[event.type] || AUSPEX_EVENT_ICONS.default)
      : '';
  // Stroke is a brightened tint of the type color so the glyph reads against its
  // own colored halo (the bug that made launches look like a featureless orb).
  const glyphColor = (typeof auspexLiftColor === 'function') ? auspexLiftColor(color, 0.6) : color;
  const d = document.createElement('div');
  d.className = `auspex-m auspex-${event.type}${unconfirmed ? ' auspex-unconfirmed' : ''}`;
  d.style.cssText = `color:${color};position:relative;transform:translate(-50%,-50%)`;
  d.innerHTML =
    `<div class="auspex-ring" style="width:${size*2}px;height:${size*2}px;border:1px ${unconfirmed?'dashed':'solid'} ${color}${unconfirmed?'66':'99'};border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);animation:auspex-pulse 2.4s ease-out infinite"></div>` +
    `<div class="auspex-glyph" style="width:${glyph}px;height:${glyph}px;color:${glyphColor};display:flex;align-items:center;justify-content:center;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle, rgba(5,9,18,0.7) 0%, rgba(5,9,18,0.42) 50%, ${color}22 70%, transparent 82%);filter:drop-shadow(0 0 ${Math.round(sev*5)+2}px ${color}cc);opacity:${unconfirmed?0.7:1}">${svg}</div>` +
    `<div class="auspex-tip">${event.title}</div>`;
  d.addEventListener('click', e => { e.stopPropagation(); openAuspexEventCard(event); });
  return d;
}

// ═══════════════════════════════════════════
// COUNTRY MARKER — nuclear/conflict/sanctions/P5 indicators
// ═══════════════════════════════════════════
function makeCountryMarker(country) {
  // Crisp inline-SVG glyphs (NOT unicode emoji — those render as inconsistent
  // colored emoji on phones/other platforms). Identical on every device.
  const icons = [];
  if (country.nuclear_armed)     icons.push(`<span class="ctry-ico ctry-nuclear" title="Nuclear armed"><svg viewBox="0 0 24 24" width="20" height="20" style="filter:drop-shadow(0 0 6px #FF9F0Acc)"><circle cx="12" cy="12" r="11.5" fill="#FF9F0A"/><g fill="#1c1206"><path d="M13.7 14.94 16.6 19.97 7.4 19.97 10.3 14.94Z"/><path d="M8.6 12 2.8 12 7.4 4.03 10.3 9.06Z"/><path d="M13.7 9.06 16.6 4.03 21.2 12 15.4 12Z"/><circle cx="12" cy="12" r="2.6"/></g></svg></span>`);
  if (country.conflict_active)   icons.push(`<span class="ctry-ico ctry-conflict" title="Active conflict"><svg viewBox="0 0 24 24" width="15" height="15" style="filter:drop-shadow(0 0 4px #FF2D5599)"><path d="M12 3 22 20 2 20Z" fill="#FF2D55"/></svg></span>`);
  if (country.sanctions_subject) icons.push(`<span class="ctry-ico ctry-sanction" title="Under sanctions"><svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#2979FF" stroke-width="2.6"/><line x1="5.2" y1="5.2" x2="18.8" y2="18.8" stroke="#2979FF" stroke-width="2.6"/></svg></span>`);
  if (country.un_p5)             icons.push(`<span class="ctry-ico ctry-p5" title="UN Security Council P5"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 2 14.9 8.6 22 9.3 16.5 14 18.2 21 12 17.3 5.8 21 7.5 14 2 9.3 9.1 8.6Z" fill="#E8B84B"/></svg></span>`);
  const d = document.createElement('div');
  d.className = 'ctry-marker';
  d.dataset.iso = country.iso2 || '';
  // Check if this country is currently pinned
  const _ctryKey = `country:${country.iso2 || country.name}:${(country.lat||0).toFixed(1)}`;
  const _isPinned = typeof _analystGeoMap !== 'undefined' && !!_analystGeoMap[_ctryKey];
  const _nameColor = _isPinned ? '#FF2D55' : '#4A8CA8';

  d.style.cssText = 'transform:translate(-50%,-50%) scale(var(--gz-scale,1));transform-origin:center center;pointer-events:auto;cursor:pointer';
  d.innerHTML = `${icons.length ? `<div class="ctry-icons">${icons.join('')}</div>` : ''}<div class="ctry-name" id="ctry-nm-${country.iso2||''}" style="color:${_nameColor}">${country.name.toUpperCase()}</div>`;
  d.title = [
    country.name,
    country.nuclear_armed     ? 'Nuclear Armed'     : '',
    country.conflict_active   ? 'Active Conflict'   : '',
    country.sanctions_subject ? 'Under Sanctions'   : '',
    country.un_p5             ? 'UN P5 Member'      : '',
    'Click to pin to Analyst Board',
  ].filter(Boolean).join(' · ');
  d.addEventListener('click', e => {
    e.stopPropagation();
    openCountryPanel(country);
  });
  return d;
}

// ── COUNTRY MARKER → country intelligence briefing ──
function openCountryPanel(country) {
  const col = '#30D158'; // Living Green
  const tierLbl = country.strategic_tier ? `TIER ${country.strategic_tier}` : '';
  const badges = [
    country.nuclear_armed     ? 'Nuclear-armed' : '',
    country.nato_member       ? 'NATO' : '',
    country.un_p5             ? 'UN P5' : '',
    country.sanctions_subject ? 'Sanctioned' : '',
    country.conflict_active   ? 'Active conflict' : '',
  ].filter(Boolean);
  const lines = [];
  if (country.capital)    lines.push(`Capital: ${country.capital}`);
  if (country.continent)  lines.push(`Continent: ${country.continent}`);
  if (country.population != null && !isNaN(country.population)) lines.push(`Population: ${Number(country.population).toLocaleString()} thousand`);
  if (country.gdp_billions)       lines.push(`GDP: $${Number(country.gdp_billions).toLocaleString()}B`);
  if (country.mil_spend_billions) lines.push(`Military spend: $${Number(country.mil_spend_billions).toLocaleString()}B`);
  lines.push(`Strategic tier: ${country.strategic_tier || '—'}`);

  const lead = badges.length
    ? `Status: ${badges.join(' · ')}.`
    : 'No special strategic designations on record.';

  openInfoPanel({
    cat: 'COUNTRY',
    catColor: col,
    brk: tierLbl,
    brkColor: col,
    title: `${country.name}${country.capital ? ' — ' + country.capital : ''}`,
    src: country.iso2 ? `ISO ${country.iso2}` : 'AUSPEX GEO-INTEL',
    time: '',
    region: (country.continent || country.name).toUpperCase(),
    lead,
    text: lines.join('\n'),
    color: col,
    lat: country.lat, lng: country.lng,
    button: {
      label: 'PIN TO ANALYST',
      onClick: () => { if (typeof pinGeoAsset === 'function') pinGeoAsset('country', country); },
    },
    relief: { type: 'geo', geoType: 'country', obj: country },
  });
}

// ═══════════════════════════════════════════
// REGION LABEL — text label at conflict zone center
// ═══════════════════════════════════════════
function makeRegionLabel(region) {
  const d = document.createElement('div');
  d.className = `rgn-label rgn-${region.threat_level || 'elevated'}`;
  const colMap = { critical:'#FF2D55', high:'#FF9F0A', elevated:'#B7950B' };
  const col = colMap[region.threat_level] || '#B7950B';
  d.style.cssText = `transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;color:${col}`;
  d.title = `${region.name} — ${(region.threat_level||'elevated').toUpperCase()} threat`;
  d.innerHTML = `<div class="rgn-lbl-txt">${region.name.toUpperCase()}</div>`;
  d.addEventListener('click', e => { e.stopPropagation(); openRegionPanel(region); });
  return d;
}

// ═══════════════════════════════════════════
// RELIEF MARKERS — food-security (Tool 5) + access/blackout (Tool 6)
// Rendered as globe.gl htmlElements, gated to the active RELIEF tool.
// Distinct from the analyst/event markers so the relief layer reads cleanly.
// ═══════════════════════════════════════════
// IPC-style phase ramp: 1 Minimal → 5 Famine
const _RELIEF_IPC_COL = { 1:'#34D399', 2:'#FACC15', 3:'#FB923C', 4:'#FF4D5E', 5:'#7F1D1D' };
const _RELIEF_IPC_LBL = { 1:'MINIMAL', 2:'STRESSED', 3:'CRISIS', 4:'EMERGENCY', 5:'FAMINE' };

function makeReliefFamineMarker(item) {
  const phase = Math.max(1, Math.min(5, item.phase || 1));
  const col = _RELIEF_IPC_COL[phase] || '#FACC15';
  const d = document.createElement('div');
  d.className = 'rl-famine-marker';
  d.style.cssText = `position:relative;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;--rfc:${col}`;
  d.title = `${item.name || 'Area'} — IPC PHASE ${phase} (${_RELIEF_IPC_LBL[phase]})`;
  d.innerHTML =
    `<div class="rlf-glow"></div>` +
    `<div class="rlf-hex"><span class="rlf-num">${phase}</span></div>` +
    `<div class="rlf-tip">${(item.name || 'AREA').toUpperCase()} · PHASE ${phase} ${_RELIEF_IPC_LBL[phase]}</div>`;
  d.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof reliefSelectTool === 'function') { if (typeof openRelief === 'function') openRelief(); reliefSelectTool('famine'); }
  });
  return d;
}

const _RELIEF_ACCESS_COL = { open:'#34D399', constrained:'#FB923C', sealed:'#FF4D5E' };
function makeReliefAccessMarker(item) {
  const status = (item.status || 'constrained').toLowerCase();
  const col = _RELIEF_ACCESS_COL[status] || '#FB923C';
  const d = document.createElement('div');
  d.className = `rl-access-marker rl-access-${status}`;
  d.style.cssText = `position:relative;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;--rac:${col}`;
  d.title = `${item.name || item.region || 'Zone'} — ACCESS ${status.toUpperCase()}`;
  const inner = status === 'sealed'
    ? '<div class="rla-bar"></div><div class="rla-bar rla-bar2"></div>'
    : status === 'constrained' ? '<div class="rla-dot"></div>' : '<div class="rla-open"></div>';
  d.innerHTML = `<div class="rla-ring"></div>${inner}<div class="rla-tip">${(item.name||item.region||'ZONE').toUpperCase()} · ${status.toUpperCase()}</div>`;
  d.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof reliefSelectTool === 'function') { if (typeof openRelief === 'function') openRelief(); reliefSelectTool('access'); }
  });
  return d;
}

// RELIEF health/outbreak marker (Tool 9) — distinct medical-cross style, phase-coloured.
const _RELIEF_HEALTH_COL = { 1:'#34D399', 2:'#FACC15', 3:'#FB923C', 4:'#FF4D5E' };
const _RELIEF_HEALTH_LBL = { 1:'WATCH', 2:'CONCERN', 3:'OUTBREAK', 4:'EMERGENCY' };
function makeReliefHealthMarker(item) {
  const phase = Math.max(1, Math.min(4, item.phase || 1));
  const col = _RELIEF_HEALTH_COL[phase] || '#FACC15';
  const d = document.createElement('div');
  d.className = 'rl-health-marker';
  d.style.cssText = `position:relative;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;--rhc:${col}`;
  d.title = `${item.name || 'Area'} — HEALTH ${_RELIEF_HEALTH_LBL[phase]} (phase ${phase})`;
  d.innerHTML =
    `<div class="rlh-glow"></div>` +
    `<div class="rlh-badge"><span class="rlh-cross-v"></span><span class="rlh-cross-h"></span></div>` +
    `<div class="rlh-tip">${(item.name || 'AREA').toUpperCase()} · ${_RELIEF_HEALTH_LBL[phase]}</div>`;
  d.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof reliefSelectTool === 'function') { if (typeof openRelief === 'function') openRelief(); reliefSelectTool('health'); }
  });
  return d;
}

// ═══════════════════════════════════════════
// GLOBE INIT
// ═══════════════════════════════════════════
function initGlobe() {
  const tod = getTod();
  lastTod = tod;

  G = Globe()
    .width(innerWidth).height(innerHeight)
    .backgroundColor('rgba(0,0,0,0)')
    .atmosphereColor(getAtmos(tod))
    .atmosphereAltitude(0.17)
    .globeImageUrl(getTexture(tod))
    .htmlElementsData([]).htmlElement(makeMarker).htmlAltitude(0.02)
    .ringsData([]).ringColor(s => (s.color||'#fff')+'55').ringMaxRadius(4.5).ringPropagationSpeed(1.4).ringRepeatPeriod(900).ringAltitude(0.006)
    .arcsData([]).arcStartLat('slat').arcStartLng('slng').arcEndLat('elat').arcEndLng('elng').arcColor(d=>[d.c1,d.c2]).arcDashLength(0.4).arcDashGap(0.18).arcDashAnimateTime(2400).arcStroke(0.3).arcAltitudeAutoScale(0.3)
    .pathsData([]).pathPoints(d=>d.pts).pathPointLat(p=>p[1]).pathPointLng(p=>p[0]).pathPointAlt(p=>p.length>2?p[2]:0).pathColor(d=>d.c1).pathStroke(1.0).pathDashLength(0.4).pathDashGap(0.12).pathDashAnimateTime(12000)
    .pointsData([]).pointLat('lat').pointLng('lng').pointAltitude(0.025).pointRadius(0.55).pointColor(()=>'rgba(0,0,0,0)')
    (document.getElementById('globe-wrap'));

  // Default view — Eurasian supercontinent
  G.pointOfView({ lat: 48, lng: 68, altitude: 1.8 });

  G.controls().autoRotate = true;
  G.controls().autoRotateSpeed = 0.32;
  G.controls().enableZoom = true;
  G.controls().minDistance = 110;
  G.controls().maxDistance = 900;
  // Disable inertial damping — eliminates the "lag behind cursor" feel
  G.controls().enableDamping = false;

  // Cap pixel ratio at 1.5 — Retina (2×) causes 4× fill rate for no visible benefit
  G.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // onGlobeMouseMove not used (coords display removed), guard for Globe.gl version compat
  if (typeof G.onGlobeMouseMove === 'function') {
    G.onGlobeMouseMove(() => {});
  }

  // Zoom-responsive scaling — city/country markers scale with camera altitude
  G.controls().addEventListener('change', () => {
    const alt   = G.pointOfView().altitude;
    const scale = Math.min(3.5, Math.max(0.55, 2.5 / alt));
    const lblBoost = Math.min(1.5, Math.max(1.0, scale * 0.43));
    document.documentElement.style.setProperty('--gz-scale', scale.toFixed(3));
    document.documentElement.style.setProperty('--gz-lbl-boost', lblBoost.toFixed(3));
  });

  // Arrow key navigation — left/right spin equator, up/down zoom
  window.addEventListener('keydown', e => {
    if (!G) return;
    // Don't steal keys when user is typing in an input or textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const pov = G.pointOfView();
    const step = 8; // degrees per keypress
    const zoomStep = 0.12; // altitude fraction per keypress
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      G.pointOfView({ lat: pov.lat, lng: pov.lng - step, altitude: pov.altitude }, 120);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      G.pointOfView({ lat: pov.lat, lng: pov.lng + step, altitude: pov.altitude }, 120);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newAlt = Math.max(0.12, pov.altitude - pov.altitude * zoomStep);
      G.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: newAlt }, 120);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newAlt = Math.min(8.0, pov.altitude + pov.altitude * zoomStep);
      G.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: newAlt }, 120);
    }
  });

  window.addEventListener('resize', () => G.width(innerWidth).height(innerHeight));

  // Textured Moon orbiting the Earth (globe.gl custom THREE layer + rAF orbit).
  initMoon(G);
}

// ═══════════════════════════════════════════
// MOON — real-textured sphere orbiting Earth
// ═══════════════════════════════════════════
// globe.gl bundles three (rev exposed via window.__THREE__). It does not expose
// the THREE namespace globally, so we load a matching ES-module build and add a
// sphere mesh through globe.gl's customLayer API. Globe internal radius = 100u.
const MOON_RADIUS      = 30;    // slightly larger than realistic (27u) for presence
const MOON_ORBIT_R     = 280;   // orbit radius around Earth's centre (units)
const MOON_ORBIT_SECS  = 80;    // one orbit ≈ 80s — clearly visible, not frantic
const MOON_INCLINATION = 0.32;  // ~18° orbital inclination (radians)
const MOON_TEX_URL     = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/moon_1024.jpg';
let _moonMesh = null;
let _moonRAF  = null;

async function initMoon(G) {
  if (_moonMesh) return;                       // guard against double-init
  try {
    const rev = window.__THREE__ || '183';
    const THREE = await import(`https://cdn.jsdelivr.net/npm/three@0.${rev}.0/build/three.module.js`);

    const geo = new THREE.SphereGeometry(MOON_RADIUS, 48, 48);
    const tex = new THREE.TextureLoader().load(MOON_TEX_URL);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    // Phong so the moon reads as a lit sphere; emissive floor guarantees it's
    // never fully black even if the globe scene has minimal lighting.
    const mat = new THREE.MeshPhongMaterial({
      map: tex,
      shininess: 2,
      emissive: new THREE.Color(0x222428),
      emissiveMap: tex,
      emissiveIntensity: 0.35,
    });
    _moonMesh = new THREE.Mesh(geo, mat);
    _moonMesh.name = 'auspex-moon';
    window._auspexMoon = _moonMesh;   // introspection hook (orbit/debug)

    // A soft directional light so the lit/shadow terminator is visible.
    const moonLight = new THREE.DirectionalLight(0xffffff, 0.9);
    moonLight.position.set(1, 0.4, 1);
    const moonGroup = new THREE.Group();
    moonGroup.name = 'auspex-moon-group';
    moonGroup.add(_moonMesh);
    moonGroup.add(moonLight);
    moonGroup.add(new THREE.AmbientLight(0xffffff, 0.25));

    // Mount via globe.gl's custom layer (single static datum; we animate the
    // mesh ourselves so depth/occlusion against the Earth stays correct).
    G.customLayerData([{}])
     .customThreeObject(() => moonGroup)
     .customThreeObjectUpdate(() => {});

    const t0 = performance.now();
    const animateMoon = (now) => {
      const t = (now - t0) / 1000;
      const a = (t / MOON_ORBIT_SECS) * Math.PI * 2;       // orbital angle
      const x = Math.cos(a) * MOON_ORBIT_R;
      const z = Math.sin(a) * MOON_ORBIT_R;
      const y = Math.sin(a) * MOON_ORBIT_R * Math.sin(MOON_INCLINATION);
      _moonMesh.position.set(x, y, z);
      _moonMesh.rotation.y += 0.0015;                       // slow tidal spin
      _moonRAF = requestAnimationFrame(animateMoon);
    };
    _moonRAF = requestAnimationFrame(animateMoon);
  } catch (err) {
    console.warn('[AUSPEX] Moon init failed:', err);
  }
}

function refreshGlobeData(stories) {
  updateAllGlobeElements();
  applyMeaningfulArcs(stories);
}

// ═══════════════════════════════════════════
// DAY / NIGHT TRANSITION

function checkDayNight(h) {
  if (h === lastHour) return;
  lastHour = h;
  const tod = getTod();
  if (tod === lastTod) return;
  lastTod = tod;
  applyTod(tod);
  if (!G) return;
  const wrap = document.getElementById('globe-wrap');
  wrap.classList.add('fading');
  setTimeout(() => {
    G.globeImageUrl(getTexture(tod));
    G.atmosphereColor(getAtmos(tod));
    wrap.classList.remove('fading');
  }, 1400);
}

// Cap story markers on the globe — the DB can accumulate thousands but the
// globe only needs the most recent 200 for a clean visual layer
const GLOBE_STORY_LIMIT = 200;

// Stories allowed to show pulse rings — one per category (most recent breaking, else most recent)
let _pulseSet = new Set();

// Debounce guard — coalesce rapid calls (e.g. zoom + category change firing together)
let _updateGlobeTimer = null;
function updateAllGlobeElements() {
  if (_updateGlobeTimer) return; // already queued
  _updateGlobeTimer = setTimeout(() => { _updateGlobeTimer = null; _updateAllGlobeElementsNow(); }, 50);
}

function _updateAllGlobeElementsNow() {
  if (!G) return;
  // While scrubbing the timeline (not live), the snapshot owns the globe layers.
  // A background news/poll update must not overwrite the displayed snapshot —
  // that race caused a flicker where live markers briefly replaced past ones.
  if (typeof scrubLive !== 'undefined' && !scrubLive) return;
  const allStories = activeCat === 'all' ? NEWS : NEWS.filter(s => s.cat === activeCat);
  // Show the N most recent stories as markers; the full pool is still searchable
  const stories = allStories.slice(0, GLOBE_STORY_LIMIT);
  // One pulse ring per category — prefer most recent breaking story, else most recent
  _pulseSet = new Set();
  const _pulseCatSeen = {};
  for (const s of stories) {
    if (s.brk && !_pulseCatSeen[s.cat]) { _pulseSet.add(s); _pulseCatSeen[s.cat] = true; }
  }
  for (const s of stories) {
    if (!_pulseCatSeen[s.cat]) { _pulseSet.add(s); _pulseCatSeen[s.cat] = true; }
  }

  // STORIES layer — geolocated, category-colored news dots (toggleable, on by default)
  const visual = (typeof storiesVisible === 'undefined' || storiesVisible)
    ? stories.map(s => ({...s, _type:'story'}))
    : [];
  if (typeof flightsVisible !== 'undefined' && flightsVisible && typeof flightData !== 'undefined')
    flightData.forEach(f => visual.push({...f, _type:'flight'}));
  if (typeof silenceVisible !== 'undefined' && silenceVisible && typeof _silenceAnomalies !== 'undefined')
    _silenceAnomalies.forEach(a => visual.push({...a, _type:'blackout'}));
  if (typeof threatsVisible !== 'undefined' && threatsVisible) {
    const hotspots = stories.filter(s => s.brk || s.cat === 'military' || s.cat === 'geo');
    hotspots.forEach(s => visual.push({...s, _type:'threat'}));
  }
  // City markers from Supabase (base intelligence layer)
  if (citiesVisible && CITY_DATA.length) {
    CITY_DATA.forEach(c => visual.push({...c, _type:'city'}));
  }
  // AUSPEX disaster/breakthrough events from snapshot worker
  if (snapshotVisible && SNAPSHOT_EVENTS.length) {
    SNAPSHOT_EVENTS.forEach(e => visual.push({ ...e, _type: 'auspex_event' }));
  }
  // Country markers — build merged list from Supabase + _WORLD_COUNTRIES fallback
  // Merge: Supabase data wins for attribute fields; _WORLD_COUNTRIES provides centroid lat/lng
  const _dbByIso = {};
  COUNTRY_DATA.forEach(c => { _dbByIso[c.iso2] = c; });

  // Always show nuclear-armed nations; show all others when COUNTRIES toggled on
  const _allToShow = countriesVisible
    ? _WORLD_COUNTRIES.map(wc => {
        const db = _dbByIso[wc.iso2] || {};
        return { ...wc, ...db, lat: wc.lat, lng: wc.lng, _type:'country' };
      })
    : _WORLD_COUNTRIES
        .filter(wc => wc.nuclear_armed || (_dbByIso[wc.iso2]?.nuclear_armed))
        .map(wc => {
          const db = _dbByIso[wc.iso2] || {};
          return { ...wc, ...db, lat: wc.lat, lng: wc.lng, _type:'country' };
        });

  _allToShow.forEach(c => visual.push(c));
  // Region labels — shown when threats overlay is active
  if (typeof threatsVisible !== 'undefined' && threatsVisible && REGION_DATA.length) {
    REGION_DATA.filter(r => r.threat_level === 'critical' || r.threat_level === 'high')
      .forEach(r => visual.push({...r, _type:'region_label'}));
  }
  // Broadcaster city markers — shown when BROADCAST panel is active
  try { if (_lnpActive) { BROADCASTERS.forEach(b => visual.push({...b, lat: b.lat, lng: b.lng, _type:'broadcaster'})); } } catch(e) {}
  // RELIEF food-security markers (Tool 5) — gated to the Famine Watch tool.
  try {
    if (typeof reliefFamineMarkers !== 'undefined' && reliefFamineMarkers.length)
      reliefFamineMarkers.forEach(m => visual.push({ ...m, _type: 'relief_famine' }));
  } catch (e) {}
  // RELIEF humanitarian-access markers (Tool 6) — gated to the Access & Blackout tool.
  try {
    if (typeof reliefAccessMarkers !== 'undefined' && reliefAccessMarkers.length)
      reliefAccessMarkers.forEach(m => visual.push({ ...m, _type: 'relief_access' }));
  } catch (e) {}
  // RELIEF health/outbreak markers (Tool 9) — gated to the Health & Outbreak Watch tool.
  try {
    if (typeof reliefHealthMarkers !== 'undefined' && reliefHealthMarkers.length)
      reliefHealthMarkers.forEach(m => visual.push({ ...m, _type: 'relief_health' }));
  } catch (e) {}

  G.htmlElementsData(visual).htmlElement(item => {
    if (item._type === 'flight') return makeFlightMarker(item);
    if (item._type === 'broadcaster') {
      const d = document.createElement('div');
      d.className = 'bcast-marker';
      d.style.setProperty('--bc', item.color);
      const isActive = item.id === _lnpCurrentId;
      d.innerHTML = `<div class="bcast-box" style="${isActive ? `box-shadow:0 0 10px ${item.color}55,0 0 20px ${item.color}22` : ''}">
        <div class="bcast-sig" style="${isActive ? '' : 'animation:none;opacity:.5'}"></div>
        <div class="bcast-name">${item.name}</div>
        <div class="bcast-city">${item.city}</div>
      </div><div class="bcast-stem"></div><div class="bcast-tip"></div>`;
      d.style.cursor = 'pointer';
      d.onclick = (e) => {
        e.stopPropagation();
        openBroadcasterPanel(item);
      };
      return d;
    }
    if (item._type === 'blackout') {
      const d = document.createElement('div');
      d.className = 'bl-void';
      d.style.cursor = 'pointer';
      d.style.pointerEvents = 'auto';
      d.innerHTML = `<div class="bl-ring"></div><div class="bl-core"></div><div class="bl-tip">BLACKOUT: ${item.region||'UNKNOWN'}</div>`;
      d.addEventListener('click', e => { e.stopPropagation(); openSilencePanel(item); });
      return d;
    }
    if (item._type === 'relief_famine') return makeReliefFamineMarker(item);
    if (item._type === 'relief_access') return makeReliefAccessMarker(item);
    if (item._type === 'relief_health') return makeReliefHealthMarker(item);
    if (item._type === 'city') return makeCityMarker(item);
    if (item._type === 'auspex_event') return makeAuspexEventMarker(item);
    if (item._type === 'country') return makeCountryMarker(item);
    if (item._type === 'region_label') return makeRegionLabel(item);
    if (item._type === 'threat') {
      const d = document.createElement('div');
      d.style.cssText = 'position:relative;transform:translate(-50%,-50%);pointer-events:none';
      const rings = [28,48,68].map((r,i) => `<div style="position:absolute;top:50%;left:50%;width:${r}px;height:${r}px;border-radius:50%;border:1px solid ${item.color||'#FF9F0A'}${['44','28','14'][i]};transform:translate(-50%,-50%);animation:ring-out ${2+i*0.8}s ease-out infinite;animation-delay:${i*0.4}s"></div>`).join('');
      // Invisible central hit target so the ranked threat is clickable
      const hit = `<div class="threat-hit" title="${(item.title||'').replace(/"/g,'&quot;')}" style="position:absolute;top:50%;left:50%;width:30px;height:30px;border-radius:50%;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer"></div>`;
      d.innerHTML = rings + hit;
      d.querySelector('.threat-hit').addEventListener('click', e => { e.stopPropagation(); openThreatPanel(item); });
      return d;
    }
    return makeMarker(item);
  });

  // Invisible hit targets collect co-located stories on click — only when the
  // STORIES layer is visible, so hidden dots aren't secretly clickable.
  const clickTargets = (typeof storiesVisible === 'undefined' || storiesVisible) ? [...stories] : [];
  G.pointsData(clickTargets)
    .pointLat('lat').pointLng('lng')
    .pointAltitude(0.025).pointRadius(0.55)
    .pointColor(() => 'rgba(0,0,0,0)')
    .onPointClick(item => {
      handleLocationClick(item);
    })
    .onPointHover(item => { document.body.style.cursor = item ? 'pointer' : ''; });

  const _conflictRings = (threatsVisible && REGION_DATA.length)
    ? REGION_DATA
        .filter(r => r.threat_level === 'critical' || r.threat_level === 'high')
        .map(r => ({...r, _region: true}))
    : [];
  const _regionColors = { critical:'#FF2D55', high:'#FF9F0A', elevated:'#B7950B' };
  const _brkRings = [..._pulseSet].filter(s => s.brk);
  // AUSPEX severe events get a secondary glow ring (markers are primary)
  const _auspexSevColor = (sev, polarity) => polarity === 'breakthrough'
    ? (sev > 0.7 ? '#5AC8FA' : '#007AFF')
    : (sev > 0.7 ? '#FF2D55' : sev > 0.4 ? '#FF9F0A' : '#FFD60A');
  const _auspexRings = snapshotVisible
    ? SNAPSHOT_EVENTS.filter(e => (e.severity ?? 0) >= 0.5).map(e => ({ ...e, _auspex: true }))
    : [];
  G.ringsData([..._brkRings, ..._conflictRings, ..._auspexRings])
    .ringColor(r => {
      if (r._auspex) return _auspexSevColor(r.severity ?? 0, r.polarity) + '44';
      if (r._region) return (_regionColors[r.threat_level] || '#FF9F0A') + '30';
      // Finance + climate rings are muted — less visually dominant
      if (r.cat === 'finance') return (r.color || '#FFD60A') + '28';
      if (r.cat === 'climate') return (r.color || '#30D158') + '28';
      return (r.color || '#FF2D55') + '55';
    })
    .ringMaxRadius(r => {
      if (r._auspex) return 2 + (r.severity ?? 0) * 4;
      if (r._region) return Math.min(r.radius_km / 55, 18);
      if (r.cat === 'finance') return 2.8;
      if (r.cat === 'climate') return 2.8;
      return r.mag ? r.mag * 0.7 : 4.5;
    })
    .ringPropagationSpeed(r => {
      if (r._auspex) return 0.8;
      if (r._region) return 0.35;
      if (r.cat === 'finance') return 0.7;
      if (r.cat === 'climate') return 0.7;
      return r.mag ? r.mag * 0.25 : 1.4;
    })
    .ringRepeatPeriod(r => r._auspex ? 1400 : r._region ? 4000 : (r.cat === 'finance' || r.cat === 'climate') ? 1600 : 900)
    .ringAltitude(0.006);

  // Refresh arcs so honest connection links (computeAuspexLinkArcs) appear/update
  // whenever events change — e.g. after the snapshot loads asynchronously. This
  // merges with the existing meaningful/overlay arcs; it does not replace them.
  if (typeof refreshArcs === 'function') refreshArcs();
}

// ═══════════════════════════════════════════
// AUSPEX EVENT CARD — honest: confidence chip + brief + sources
// ═══════════════════════════════════════════
function openAuspexEventCard(event) {
  const panel = document.getElementById('art-panel');
  if (!panel) return;
  const sev = event.severity ?? 0;
  // Type-distinct color (with high-severity peril red override) — matches the
  // globe marker and the live map key.
  const sevColor = (typeof auspexEventColor === 'function')
    ? auspexEventColor(event)
    : (event.polarity === 'breakthrough' ? '#5AC8FA' : '#FF8C66');
  const confirmed = event.confidence === 'confirmed';
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  if (G && event.lat != null && event.lng != null && !isNaN(event.lat) && !isNaN(event.lng)) {
    G.controls().autoRotate = false;
    G.pointOfView({ lat: event.lat, lng: event.lng, altitude: 1.55 }, 1400);
  }
  panel.classList.add('art-panel--event');
  const _glyph = (typeof AUSPEX_EVENT_ICONS !== 'undefined')
    ? (AUSPEX_EVENT_ICONS[event.icon] || AUSPEX_EVENT_ICONS[event.type] || AUSPEX_EVENT_ICONS.default)
    : '';
  set('ap-cat', `<span class="ap-cat-glyph" style="display:inline-flex;width:13px;height:13px;vertical-align:-2px;margin-right:5px">${_glyph}</span>${(event.type || '').toUpperCase()}`);
  const catEl = document.getElementById('ap-cat');
  if (catEl) catEl.style.cssText = `color:${sevColor};background:${sevColor}18`;
  const brk = document.getElementById('ap-brk');
  if (brk) { brk.textContent = confirmed ? 'CONFIRMED' : 'UNCONFIRMED'; brk.style.color = confirmed ? '#30D158' : '#FF9F0A'; brk.style.display = 'inline-flex'; }
  set('ap-title', event.title || '');
  set('ap-src', (event.sources || []).map(s => s.name).join(' · '));
  set('ap-time', event.occurredAt ? new Date(event.occurredAt).toLocaleString() : '');
  set('ap-region', `${event.metric?.label ?? ''}: ${event.metric?.value ?? ''} (${event.metric?.band ?? ''})`);
  set('ap-lead', event.brief || '');
  // Connected events — honest "nearby in space & time" links, clickable.
  const _connected = (Array.isArray(event.links) ? event.links : [])
    .map(id => SNAPSHOT_EVENTS.find(e => e.id === id))
    .filter(Boolean);
  if (_connected.length) {
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const items = _connected.map(e =>
      `<span class="ap-conn-item" role="button" tabindex="0" data-eid="${esc(e.id)}" style="display:block;text-align:left;border-left:2px solid ${_connectionColor()}66;padding:4px 0 4px 9px;margin:3px 0;cursor:pointer;opacity:.85">${esc(e.title || e.type || 'Event')}</span>`
    ).join('');
    set('ap-text',
      `<span class="ap-conn" style="display:block;margin-top:12px">
        <span style="display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:5px">Nearby in space &amp; time</span>
        ${items}
      </span>`);
    const txtEl = document.getElementById('ap-text');
    if (txtEl) txtEl.querySelectorAll('.ap-conn-item').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        const target = SNAPSHOT_EVENTS.find(e => e.id === btn.getAttribute('data-eid'));
        if (target) openAuspexEventCard(target);
      });
    });
  } else {
    set('ap-text', '');
  }
  const cdot = document.getElementById('ap-cdot'); if (cdot) cdot.style.background = sevColor;
  const coords = document.getElementById('ap-coords');
  if (coords && event.lat != null && !isNaN(event.lat)) {
    const la = event.lat >= 0 ? event.lat.toFixed(3)+'°N' : Math.abs(event.lat).toFixed(3)+'°S';
    const ln = event.lng >= 0 ? event.lng.toFixed(3)+'°E' : Math.abs(event.lng).toFixed(3)+'°W';
    coords.textContent = `${la}, ${ln}`;
  } else if (coords) { coords.textContent = ''; }
  const link = document.getElementById('ap-link');
  if (link && event.sources?.[0]) { link.href = event.sources[0].url; link.textContent = 'SOURCES ›'; link.style.display = 'inline-flex'; }
  else if (link) { link.style.display = 'none'; }
  // PIN TO ANALYST (story) + PIN TO RELIEF (own pool) for this sensed event.
  const pinBtn = document.getElementById('ap-pin-btn');
  if (pinBtn) {
    if (pinBtn._infoHandler) { pinBtn.removeEventListener('click', pinBtn._infoHandler); pinBtn._infoHandler = null; }
    const evPinned = (typeof analystAssets !== 'undefined') && event.id != null && analystAssets.includes(event.id);
    const lblEl = document.getElementById('ap-pin-lbl');
    if (lblEl) lblEl.textContent = evPinned ? 'PINNED ✓' : 'PIN TO ANALYST';
    pinBtn.onclick = null;
    pinBtn._infoHandler = (e) => {
      e.stopPropagation();
      if (typeof pinStory === 'function') pinStory(event.id);
      if (lblEl) lblEl.textContent = (analystAssets.includes(event.id)) ? 'PINNED ✓' : 'PIN TO ANALYST';
    };
    pinBtn.addEventListener('click', pinBtn._infoHandler);
    pinBtn.style.display = 'inline-flex';
  }
  _setReliefPanelButton({ type: 'story', story: event });
  panel.classList.add('on');
  document.getElementById('art-bd').classList.add('on');
}

// ═══════════════════════════════════════════
// GENERIC INFO PANEL — reuses #art-panel for non-article markers
// (region labels, threat rings, silence anomalies). Honest, not decorative.
// opts: { cat, catColor, brk, brkColor, title, src, time, region, lead,
//         text, color, lat, lng, link:{href,label}, button:{label,onClick} }
// ═══════════════════════════════════════════
function openInfoPanel(opts) {
  const panel = document.getElementById('art-panel');
  if (!panel) return;
  _apStoryId = null; // not a pinnable story
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  if (G && opts.lat != null && opts.lng != null && !isNaN(opts.lat) && !isNaN(opts.lng)) {
    G.controls().autoRotate = false;
    G.pointOfView({ lat: opts.lat, lng: opts.lng, altitude: 1.7 }, 1400);
  }
  const color = opts.color || '#30D158';
  const catEl = document.getElementById('ap-cat');
  if (catEl) { catEl.textContent = opts.cat || ''; catEl.style.cssText = `color:${opts.catColor||color};background:${(opts.catColor||color)}18`; }
  const brk = document.getElementById('ap-brk');
  if (brk) {
    if (opts.brk) { brk.textContent = opts.brk; brk.style.color = opts.brkColor || color; brk.style.display = 'inline-flex'; }
    else { brk.style.display = 'none'; }
  }
  set('ap-title', opts.title || '');
  set('ap-src', opts.src || 'AUSPEX');
  set('ap-time', opts.time || '');
  set('ap-region', opts.region || '');
  set('ap-lead', opts.lead || '');
  set('ap-text', opts.text || '');
  const cdot = document.getElementById('ap-cdot'); if (cdot) cdot.style.background = color;
  const coords = document.getElementById('ap-coords');
  if (coords) {
    if (opts.lat != null && !isNaN(opts.lat)) {
      const la = opts.lat >= 0 ? opts.lat.toFixed(3)+'°N' : Math.abs(opts.lat).toFixed(3)+'°S';
      const ln = opts.lng >= 0 ? opts.lng.toFixed(3)+'°E' : Math.abs(opts.lng).toFixed(3)+'°W';
      coords.textContent = `${la}, ${ln}`;
    } else { coords.textContent = opts.region || ''; }
  }
  // External link — keep the leading SVG icon, set the trailing label text node
  const link = document.getElementById('ap-link');
  if (link) {
    if (opts.link && opts.link.href) {
      link.href = opts.link.href;
      // Remove any existing trailing text nodes, then append the new label
      Array.from(link.childNodes).forEach(n => { if (n.nodeType === 3) link.removeChild(n); });
      link.appendChild(document.createTextNode(' ' + (opts.link.label || 'OPEN')));
      link.style.display = 'inline-flex';
    } else { link.style.display = 'none'; }
  }
  // Repurpose the pin button as an optional action button, else hide it
  const pinBtn = document.getElementById('ap-pin-btn');
  if (pinBtn) {
    pinBtn._infoHandler && pinBtn.removeEventListener('click', pinBtn._infoHandler);
    pinBtn._infoHandler = null;
    if (opts.button && typeof opts.button.onClick === 'function') {
      const lblEl = document.getElementById('ap-pin-lbl');
      if (lblEl) lblEl.textContent = opts.button.label || 'OPEN';
      pinBtn.onclick = null; // override the inline pinStoryFromArticle handler
      pinBtn._infoHandler = (e) => { e.stopPropagation(); opts.button.onClick(); };
      pinBtn.addEventListener('click', pinBtn._infoHandler);
      pinBtn.style.display = 'inline-flex';
    } else {
      pinBtn.style.display = 'none';
    }
  }
  // Optional Pin-to-RELIEF button — its own pool, never touches Analyst.
  _setReliefPanelButton(opts.relief || null);
  panel.classList.add('art-panel--event');
  panel.classList.add('on');
  document.getElementById('art-bd').classList.add('on');
}

// ── Pin-to-RELIEF button (shared #art-panel) ──────────────────────────────
// Configures the secondary RELIEF pin button for the currently open panel.
// cfg is { type:'geo', geoType, obj } | { type:'story', story } | null.
function _setReliefPanelButton(cfg) {
  window._apReliefTarget = cfg || null;
  const btn = document.getElementById('ap-relief-btn');
  const lbl = document.getElementById('ap-relief-lbl');
  if (!btn) return;
  if (!cfg) { btn.style.display = 'none'; return; }
  let pinned = false;
  if (cfg.type === 'geo' && typeof reliefIsGeoPinned === 'function') pinned = reliefIsGeoPinned(cfg.geoType, cfg.obj);
  if (cfg.type === 'story' && typeof reliefIsStoryPinned === 'function') pinned = reliefIsStoryPinned(cfg.story);
  if (lbl) lbl.textContent = pinned ? 'PINNED TO RELIEF' : 'PIN TO RELIEF';
  btn.style.background = pinned ? 'rgba(52,211,153,.14)' : 'rgba(52,211,153,.05)';
  btn.style.borderColor = pinned ? 'rgba(52,211,153,.5)' : 'rgba(52,211,153,.2)';
  btn.style.color = pinned ? '#34D399' : 'rgba(52,211,153,.8)';
  btn.style.display = 'inline-flex';
}

// Toggle the current panel's object in the RELIEF pool.
function reliefPinFromPanel() {
  const cfg = window._apReliefTarget;
  if (!cfg) return;
  if (cfg.type === 'geo' && typeof pinToRelief === 'function') pinToRelief(cfg.geoType, cfg.obj);
  if (cfg.type === 'story' && typeof pinStoryToRelief === 'function') pinStoryToRelief(cfg.story);
  _setReliefPanelButton(cfg); // refresh label/state
}

// Restore the pin button + read-link to their default article behaviour when
// an article (not an info panel) is opened after an info panel was shown.
function _restorePinButton() {
  const pinBtn = document.getElementById('ap-pin-btn');
  if (pinBtn) {
    if (pinBtn._infoHandler) { pinBtn.removeEventListener('click', pinBtn._infoHandler); pinBtn._infoHandler = null; }
    pinBtn.onclick = () => { if (typeof pinStoryFromArticle === 'function') pinStoryFromArticle(); };
    pinBtn.style.display = 'inline-flex';
    const lblEl = document.getElementById('ap-pin-lbl');
    if (lblEl) lblEl.textContent = 'PIN TO ANALYST';
  }
  const link = document.getElementById('ap-link');
  if (link) {
    Array.from(link.childNodes).forEach(n => { if (n.nodeType === 3) link.removeChild(n); });
    link.appendChild(document.createTextNode(' READ FULL ARTICLE'));
  }
}

// ── REGION LABEL → threat-zone briefing ──
function openRegionPanel(region) {
  const colMap = { critical:'#FF2D55', high:'#FF9F0A', elevated:'#B7950B' };
  const col = colMap[region.threat_level] || '#B7950B';
  const lvl = (region.threat_level || 'elevated').toUpperCase();
  const typeStr = region.type ? region.type.toUpperCase() : 'CONFLICT ZONE';
  openInfoPanel({
    cat: 'REGION',
    catColor: col,
    brk: lvl + ' THREAT',
    brkColor: col,
    title: region.name,
    src: 'AUSPEX GEO-INTEL',
    time: '',
    region: typeStr,
    lead: region.description || `Designated ${lvl.toLowerCase()}-threat region under continuous AUSPEX monitoring.`,
    text: region.notes || `Threat level: ${lvl}. ${region.radius_km ? 'Monitored radius ~' + Math.round(region.radius_km) + ' km. ' : ''}Region labels appear while the THREATS overlay is active and reflect aggregated instability across news, military and geopolitical signals.`,
    color: col,
    lat: region.lat, lng: region.lng,
    button: {
      label: 'PIN TO ANALYST',
      onClick: () => { if (typeof pinGeoAsset === 'function') pinGeoAsset('region', region); },
    },
    relief: { type: 'geo', geoType: 'region', obj: region },
  });
}

// ── THREAT RING → ranked threat briefing ──
function openThreatPanel(threat) {
  const col = threat.color || '#FF9F0A';
  const cfg = (typeof CATS !== 'undefined' && CATS[threat.cat]) || { label: (threat.cat||'THREAT').toUpperCase() };
  // Stories behind this threat: same category, nearby, recent — for honest context
  const pool = (typeof NEWS !== 'undefined' ? NEWS : []);
  const related = pool.filter(s =>
    s !== threat && s.cat === threat.cat &&
    typeof s.lat === 'number' && typeof threat.lat === 'number' &&
    Math.abs(s.lat - threat.lat) < 12 && Math.abs((s.lng||0) - (threat.lng||0)) < 18
  ).slice(0, 5);
  const storyLines = [threat.title, ...related.map(s => s.title)].map(t => '• ' + t).join('\n');
  openInfoPanel({
    cat: cfg.label || 'THREAT',
    catColor: col,
    brk: threat.brk ? 'BREAKING THREAT' : 'ELEVATED',
    brkColor: col,
    title: threat.title,
    src: threat.src || 'AUSPEX THREAT MODEL',
    time: threat.time || '',
    region: threat.region || '',
    lead: threat.summary || 'Ranked threat surfaced by AUSPEX from breaking, military and geopolitical signals.',
    text: `Stories behind this threat ring:\n${storyLines}`,
    color: col,
    lat: threat.lat, lng: threat.lng,
    link: threat.url ? { href: threat.url, label: 'READ SOURCE' } : null,
    button: (threat.id != null) ? {
      label: 'PIN TO ANALYST',
      onClick: () => { if (typeof pinStory === 'function') pinStory(threat.id); },
    } : null,
    relief: (threat.id != null)
      ? { type: 'story', story: threat }
      : { type: 'geo', geoType: 'region', obj: { name: threat.title || threat.region || 'Threat', lat: threat.lat, lng: threat.lng, threat_level: 'high', region: threat.region } },
  });
}

// ── SILENCE ANOMALY → information-blackout briefing ──
function openSilencePanel(anomaly) {
  const col = anomaly.severity === 'HIGH' ? '#FF2D55' : '#FF9F0A';
  openInfoPanel({
    cat: 'SILENCE',
    catColor: col,
    brk: anomaly.severity + ' BLACKOUT',
    brkColor: col,
    title: 'INFORMATION BLACKOUT',
    src: 'AUSPEX SILENCE MONITOR',
    time: '',
    region: (anomaly.region || 'UNKNOWN').toUpperCase(),
    lead: anomaly.reason || 'Coverage for this region has dropped sharply or gone dark.',
    text: 'AUSPEX flags a region as silent when its news coverage falls far below its 7-day baseline, or when a known conflict zone reports nothing at all. Sudden silence can itself be a signal — disruption, censorship, or loss of access on the ground.',
    color: col,
    lat: anomaly.lat, lng: anomaly.lng,
    button: {
      label: 'PIN TO ANALYST',
      onClick: () => { if (typeof pinGeoAsset === 'function') pinGeoAsset('region', { name: anomaly.region || 'Blackout zone', lat: anomaly.lat, lng: anomaly.lng }); },
    },
    relief: { type: 'geo', geoType: 'region', obj: { name: anomaly.region || 'Blackout zone', lat: anomaly.lat, lng: anomaly.lng, region: anomaly.region, threat_level: anomaly.severity === 'HIGH' ? 'critical' : 'high' } },
  });
}

// ── BROADCASTER → coverage briefing + open live stream ──
function openBroadcasterPanel(b) {
  const col = b.color || '#30D158';
  const cats = (b.cats || []).map(c => {
    const cfg = (typeof CATS !== 'undefined' && CATS[c]) || (typeof CATS !== 'undefined' && CATS[c==='mil'?'military':c]);
    return cfg ? cfg.label : c.toUpperCase();
  }).join(' · ');
  const regions = (b.regions || []).slice(0, 10).map(r => r.replace(/\b\w/g, m => m.toUpperCase())).join(', ');
  openInfoPanel({
    cat: 'BROADCAST',
    catColor: col,
    brk: 'LIVE',
    brkColor: col,
    title: b.name,
    src: b.city ? b.city.toUpperCase() : 'BROADCASTER',
    time: '',
    region: b.cover || '',
    lead: b.desc || `Live broadcaster covering ${b.cover || 'global'} affairs.`,
    text: `Coverage area: ${b.desc || b.cover || '—'}.\nFocus regions: ${regions || '—'}.\nCategories: ${cats || '—'}.`,
    color: col,
    lat: b.lat, lng: b.lng,
    button: {
      label: 'OPEN LIVE STREAM',
      onClick: () => {
        if (!_lnpActive && typeof openLiveNews === 'function') openLiveNews(null);
        if (typeof switchBroadcaster === 'function') switchBroadcaster(b.id);
        if (typeof updateAllGlobeElements === 'function') updateAllGlobeElements();
        closeArticle();
      },
    },
    relief: { type: 'geo', geoType: 'city', obj: { name: b.name, country: b.cover || b.city || '', lat: b.lat, lng: b.lng, icon_type: 'city' } },
  });
}

// ═══════════════════════════════════════════
// MEANINGFUL ARCS — entity-based connections
// ═══════════════════════════════════════════
const SHARED_ENTITIES = [
  'US','China','Russia','NATO','EU','Iran','Ukraine','Israel','Taiwan','India',
  'Saudi','Japan','Korea','UK','France','Germany','Turkey','Pakistan',
  'Fed','ECB','OPEC','IMF','UN','WTO',
  'Oil','Dollar','Bitcoin','Gold','Rate','Inflation',
  'AI','Chip','Semiconductor','Nuclear','Climate','Election',
];

let _arcCacheKey = '';
let _arcCacheResult = [];

function computeMeaningfulArcs(stories) {
  // Cache by story ID list — skip expensive O(n²) recompute if stories unchanged
  const cacheKey = stories.map(s => s.id).join(',');
  if (cacheKey === _arcCacheKey) return _arcCacheResult;
  _arcCacheKey = cacheKey;

  const storyEnts = stories.map(s => ({
    s,
    ents: SHARED_ENTITIES.filter(e =>
      s.title.toLowerCase().includes(e.toLowerCase()) ||
      (s.summary||'').toLowerCase().includes(e.toLowerCase())
    ),
  }));
  const arcs = [];
  for (let i = 0; i < storyEnts.length; i++) {
    for (let j = i+1; j < storyEnts.length; j++) {
      const shared = storyEnts[i].ents.filter(e => storyEnts[j].ents.includes(e));
      if (!shared.length) continue;
      // Don't arc stories at same location
      const dist = Math.sqrt(Math.pow(storyEnts[i].s.lat - storyEnts[j].s.lat, 2) + Math.pow(storyEnts[i].s.lng - storyEnts[j].s.lng, 2));
      if (dist < 1) continue;
      arcs.push({
        slat: storyEnts[i].s.lat, slng: storyEnts[i].s.lng,
        elat: storyEnts[j].s.lat, elng: storyEnts[j].s.lng,
        c1: storyEnts[i].s.color + '45', c2: storyEnts[j].s.color + '00',
        strength: shared.length, label: shared.slice(0,2).join(', '),
        _s1id: storyEnts[i].s.id, _s2id: storyEnts[j].s.id,
      });
    }
  }
  _arcCacheResult = arcs.sort((a,b) => b.strength - a.strength).slice(0, 18);
  return _arcCacheResult;
}

// ═══════════════════════════════════════════
// CONNECTION ARCS — honest links between AUSPEX events
// Events carry `.links` (ids of events nearby in space & time, set by the
// worker via src/connect.js). We draw each unordered pair once, as a quiet,
// thin, low-opacity arc in the aura/connection colour. They whisper, not shout.
// ═══════════════════════════════════════════
function _connectionColor() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--aura').trim();
    if (v) return v;
  } catch (e) {}
  return '#34E08A'; // soft cyan-green fallback
}

function computeAuspexLinkArcs() {
  if (!snapshotVisible || !SNAPSHOT_EVENTS.length) return [];
  const byId = new Map();
  SNAPSHOT_EVENTS.forEach(e => { if (e && typeof e.id === 'string') byId.set(e.id, e); });
  const seen = new Set();
  const col = _connectionColor();
  const arcs = [];
  for (const a of SNAPSHOT_EVENTS) {
    if (!a || !Array.isArray(a.links)) continue;
    for (const bId of a.links) {
      const b = byId.get(bId);
      if (!b) continue;
      const key = a.id < bId ? `${a.id}|${bId}` : `${bId}|${a.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      arcs.push({
        slat: a.lat, slng: a.lng, elat: b.lat, elng: b.lng,
        // Low-alpha, fade toward the far end — subtle thread, not a beam.
        c1: col + '4D', c2: col + '0D',
        _link: true,
      });
    }
  }
  return arcs;
}

function applyMeaningfulArcs(stories) {
  if (!G) return;
  // Delegate to refreshArcs so overlay arcs (cables, divergence, cascade) are preserved
  if (typeof refreshArcs === 'function') { refreshArcs(); return; }
  // Fallback if refreshArcs not yet defined (early boot)
  const arcs = computeMeaningfulArcs(stories);
  G.arcsData(arcs)
    .arcStartLat('slat').arcStartLng('slng').arcEndLat('elat').arcEndLng('elng')
    .arcColor(d => [d.c1, d.c2])
    .arcDashLength(0.4).arcDashGap(0.18)
    .arcDashAnimateTime(d => 2000 + d.strength * 300)
    .arcStroke(d => 0.2 + d.strength * 0.1)
    .arcAltitudeAutoScale(0.3);
}

// ═══════════════════════════════════════════
// COUNTRY BORDER LAYER + DISPUTED BORDERS / DMZ LINES
// Renders as globe.gl pathsData (lightweight lines, no polygon triangulation)
// Green = at peace  |  Red = active conflict  |  Amber-black = disputed/DMZ
// Data source: world-atlas 110m topojson via topojson.mesh()
// Updated weekly via Supabase country data refresh
// ═══════════════════════════════════════════

// UN M49 numeric IDs for countries with active armed conflict
// These match world-atlas topojson feature.id values (ISO 3166-1 numeric)
const _CONFLICT_NUM_IDS = new Set([
  4,   // AF — Afghanistan
  31,  // AZ — Azerbaijan
  104, // MM — Myanmar
  108, // BI — Burundi
  140, // CF — Central African Rep.
  148, // TD — Chad
  180, // CD — DR Congo
  231, // ET — Ethiopia
  275, // PS — Palestine
  332, // HT — Haiti
  368, // IQ — Iraq
  376, // IL — Israel
  422, // LB — Lebanon
  434, // LY — Libya
  466, // ML — Mali
  508, // MZ — Mozambique
  562, // NE — Niger
  566, // NG — Nigeria
  586, // PK — Pakistan
  643, // RU — Russia
  706, // SO — Somalia
  728, // SS — South Sudan
  729, // SD — Sudan
  760, // SY — Syria
  804, // UA — Ukraine
  854, // BF — Burkina Faso
  887, // YE — Yemen
]);

// Disputed borders & DMZ lines as [lng, lat, alt] path points
// class: 'conflict' = active front line  |  'disputed' = frozen/contested
const _DMZ_LINES = [
  { label:'Korean DMZ', class:'conflict',
    pts:[[124.6,38.3,0.006],[125.0,38.1,0.006],[125.5,37.9,0.006],[126.0,37.9,0.006],[126.6,38.0,0.006],[127.0,38.1,0.006],[127.5,38.1,0.006],[128.0,38.1,0.006],[128.5,38.2,0.006],[129.0,38.3,0.006]] },
  { label:'Ukraine-Russia Contact Line', class:'conflict',
    pts:[[33.5,45.3,0.006],[34.0,45.6,0.006],[34.5,45.9,0.006],[35.0,46.1,0.006],[35.5,47.1,0.006],[36.0,47.9,0.006],[36.5,48.1,0.006],[37.0,47.9,0.006],[37.5,47.6,0.006],[38.0,47.5,0.006],[38.5,47.9,0.006],[39.0,48.1,0.006],[39.5,48.0,0.006]] },
  { label:'Gaza-Israel Border', class:'conflict',
    pts:[[34.22,31.20,0.006],[34.28,31.32,0.006],[34.38,31.52,0.006],[34.36,31.72,0.006]] },
  { label:'Yemen Front Lines', class:'conflict',
    pts:[[43.8,13.8,0.006],[44.3,14.2,0.006],[44.8,14.0,0.006],[45.3,13.6,0.006],[45.8,14.1,0.006],[46.3,14.6,0.006],[47.0,15.0,0.006]] },
  { label:'Sudan-RSF Line', class:'conflict',
    pts:[[32.5,15.6,0.006],[32.8,15.2,0.006],[33.2,14.8,0.006],[33.6,14.5,0.006],[34.0,14.2,0.006]] },
  { label:'Myanmar-Arakan Front', class:'conflict',
    pts:[[92.5,21.0,0.006],[93.0,21.5,0.006],[93.5,22.0,0.006],[94.0,22.3,0.006],[94.5,22.0,0.006]] },
  { label:'Kashmir Line of Control', class:'disputed',
    pts:[[73.9,36.8,0.006],[74.5,36.2,0.006],[75.0,35.5,0.006],[75.5,34.9,0.006],[76.0,34.5,0.006],[76.5,34.1,0.006],[77.0,33.5,0.006]] },
  { label:'Crimea Admin Line', class:'disputed',
    pts:[[33.6,46.2,0.006],[34.1,46.1,0.006],[34.6,46.2,0.006],[35.1,46.2,0.006],[35.6,46.0,0.006],[36.1,45.6,0.006]] },
  { label:'West Bank Barrier', class:'disputed',
    pts:[[34.9,31.5,0.006],[35.0,31.8,0.006],[35.1,32.1,0.006],[35.0,32.4,0.006],[35.1,32.7,0.006],[35.2,33.0,0.006]] },
  { label:'Cyprus Green Line', class:'disputed',
    pts:[[32.5,35.12,0.006],[32.8,35.17,0.006],[33.1,35.2,0.006],[33.4,35.16,0.006],[33.7,35.08,0.006]] },
  { label:'Taiwan Median Line', class:'disputed',
    pts:[[120.1,22.0,0.006],[120.2,23.0,0.006],[120.4,24.0,0.006],[120.5,25.0,0.006],[120.6,26.0,0.006]] },
  { label:'Abkhazia Admin Line', class:'disputed',
    pts:[[40.0,42.8,0.006],[40.5,43.0,0.006],[41.0,43.1,0.006],[41.5,43.0,0.006],[42.0,42.7,0.006]] },
  { label:'S.Ossetia Admin Line', class:'disputed',
    pts:[[43.8,42.2,0.006],[44.1,42.4,0.006],[44.4,42.5,0.006],[44.6,42.3,0.006]] },
  { label:'W.Sahara Berm', class:'disputed',
    pts:[[-14.4,27.7,0.006],[-13.0,26.1,0.006],[-12.0,24.2,0.006],[-11.5,22.5,0.006],[-11.0,21.0,0.006],[-12.0,20.0,0.006]] },
  { label:'Nagorno-Karabakh', class:'disputed',
    pts:[[46.6,39.5,0.006],[47.0,39.8,0.006],[47.5,40.0,0.006],[48.0,40.2,0.006]] },
  { label:'Kosovo Admin Boundary', class:'disputed',
    pts:[[20.0,42.0,0.006],[20.5,42.3,0.006],[21.0,42.5,0.006],[21.5,42.3,0.006],[22.0,42.0,0.006]] },
  { label:'Transnistria Line', class:'disputed',
    pts:[[28.4,46.8,0.006],[28.8,47.0,0.006],[29.2,47.5,0.006],[29.6,47.7,0.006]] },
];

function _buildDMZPaths() {
  return _DMZ_LINES.map(d => ({
    pts: d.pts,
    c1: d.class === 'conflict'
      ? ['#330000ee', '#FF2D55ee', '#330000ee', '#FF2D55ee', '#330000ee']
      : ['#1a1000ee', '#FF9F0Aee', '#1a1000ee', '#FF9F0Aee', '#1a1000ee'],
    _dmz: true, _dmzLabel: d.label,
  }));
}
let _dmzGlobePaths = _buildDMZPaths();

// Merges Supabase COUNTRY_DATA conflict flags into _CONFLICT_NUM_IDS
// (Supabase numeric→iso2 mapping kept simple; missing = rely on hardcoded set)
let _borderTopoJSON = null;

function _applySupabaseConflictOverrides() {
  // Build iso2→numeric reverse lookup from a compact table
  const _ISO2_TO_NUM = {
    'AF':4,'AZ':31,'MM':104,'BI':108,'CF':140,'TD':148,'CD':180,'ET':231,
    'PS':275,'HT':332,'IQ':368,'IL':376,'LB':422,'LY':434,'ML':466,'MZ':508,
    'NE':562,'NG':566,'PK':586,'RU':643,'SO':706,'SS':728,'SD':729,'SY':760,
    'UA':804,'BF':854,'YE':887,
    // Additional countries that might be added by Supabase
    'LR':430,'SL':694,'GN':324,'GW':624,'NI':558,'VE':862,'KP':408,'ZW':716,
    'SS':728,'CM':120,'MG':450,'MW':454,'ZM':894,'AO':24,'TD':148,
  };
  COUNTRY_DATA.forEach(c => {
    const num = _ISO2_TO_NUM[c.iso2];
    if (!num) return;
    if (c.conflict_active) _CONFLICT_NUM_IDS.add(num);
    // Only remove from set if Supabase explicitly marks it NOT in conflict
    // and it's not in the hardcoded list (avoid false negatives from incomplete data)
  });
}

// Convert topojson.mesh result (MultiLineString) → globe.gl path objects
function _meshToPaths(mesh, color) {
  if (!mesh?.coordinates?.length) return [];
  return mesh.coordinates
    .filter(line => line.length >= 2)
    .map(line => ({ pts: line, c1: color, _border: true }));
}

async function initCountryBorders() {
  if (!G) return;
  _applySupabaseConflictOverrides();

  if (!_borderTopoJSON) {
    try {
      // world-atlas 110m topojson is ~100KB — fast parse, no polygon triangulation
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _borderTopoJSON = await res.json();
      console.log('[AUSPEX] Border topojson loaded');
    } catch(e) {
      console.warn('[AUSPEX] Border topojson unavailable:', e.message);
      return;
    }
  }

  _rebuildBorderPaths();
}

function _rebuildBorderPaths() {
  if (!_borderTopoJSON || typeof topojson === 'undefined') return;
  _applySupabaseConflictOverrides();

  const obj = _borderTopoJSON.objects.countries;

  // Conflict country coastlines (outer borders touching ocean)
  const redCoast    = topojson.mesh(_borderTopoJSON, obj, (a, b) => a === b && _CONFLICT_NUM_IDS.has(a.id));
  // Non-conflict country coastlines
  const greenCoast  = topojson.mesh(_borderTopoJSON, obj, (a, b) => a === b && !_CONFLICT_NUM_IDS.has(a.id));
  // Shared borders adjacent to at least one conflict country
  const redShared   = topojson.mesh(_borderTopoJSON, obj, (a, b) => a !== b && (_CONFLICT_NUM_IDS.has(a.id) || _CONFLICT_NUM_IDS.has(b.id)));
  // Shared borders between two non-conflict countries
  const greenShared = topojson.mesh(_borderTopoJSON, obj, (a, b) => a !== b && !_CONFLICT_NUM_IDS.has(a.id) && !_CONFLICT_NUM_IDS.has(b.id));

  borderPaths = [
    ..._meshToPaths(redCoast,    'rgba(255,45,85,0.60)'),
    ..._meshToPaths(redShared,   'rgba(255,45,85,0.55)'),
    ..._meshToPaths(greenCoast,  'rgba(100,180,255,0.85)'),
    ..._meshToPaths(greenShared, 'rgba(100,180,255,0.70)'),
  ];

  if (typeof refreshAllPaths === 'function') refreshAllPaths();
  console.log('[AUSPEX] Border paths built:', borderPaths.length, 'segments');
}

// Called after fresh Supabase COUNTRY_DATA arrives
function updateConflictBorders() {
  _rebuildBorderPaths();
  updateAllGlobeElements();
}

// Weekly auto-refresh of conflict data
setInterval(async () => {
  try {
    if (typeof sbClearCountriesCache === 'function') sbClearCountriesCache();
    const fresh = await sbFetchCountries();
    if (fresh.length) {
      COUNTRY_DATA = fresh;
      updateConflictBorders();
      console.log('[AUSPEX] Weekly conflict data refresh complete');
    }
  } catch(e) { console.warn('[AUSPEX] Weekly refresh error:', e.message); }
}, 7 * 24 * 60 * 60 * 1000);

// ═══════════════════════════════════════════
// SENTIMENT PULSE
