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
  capital:    `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6,0.5 7.4,4.2 11.3,4.2 8.2,6.5 9.4,10.3 6,8 2.6,10.3 3.8,6.5 0.7,4.2 4.6,4.2" fill="currentColor"/></svg>`,
  financial:  `<svg viewBox="0 0 12 12" width="100%" height="100%"><rect x="0.5" y="7.5" width="2.2" height="4" fill="currentColor"/><rect x="3.5" y="5" width="2.2" height="6.5" fill="currentColor"/><rect x="6.5" y="2.5" width="2.2" height="9" fill="currentColor"/><rect x="9.5" y="4.5" width="2" height="7" fill="currentColor"/></svg>`,
  military:   `<svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 1L1.5 3.5V7c0 2.2 2 4 4.5 4.5C10 11 10.5 9.2 10.5 7V3.5Z" fill="currentColor"/><path d="M4 6.2l1.5 1.5L8.5 4.5" stroke="#0a0c18" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`,
  naval:      `<svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 1v3M4.5 4h3M2.5 6.5l1 3.5h5l1-3.5C8.5 6 7 5.5 6 5.5S3.5 6 2.5 6.5z" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M1.5 10c1 .8 2 1 4.5 1s3.5-.2 4.5-1" stroke="currentColor" stroke-width="1" fill="none"/></svg>`,
  port:       `<svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="2.5" r="1.5" stroke="currentColor" stroke-width="1" fill="none"/><line x1="6" y1="4" x2="6" y2="10" stroke="currentColor" stroke-width="1.1"/><path d="M2.5 7.5c1 2 6 2 7 0" stroke="currentColor" stroke-width="1.1" fill="none"/><line x1="3" y1="5.5" x2="9" y2="5.5" stroke="currentColor" stroke-width="1"/></svg>`,
  conflict:   `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6,1 11.5,11 0.5,11" fill="currentColor"/><text x="5.1" y="10.2" font-size="5.5" font-weight="bold" fill="#0a0c18" font-family="monospace">!</text></svg>`,
  energy:     `<svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="7,0.5 3,6.5 6,6.5 5,11.5 9.5,5 6.5,5" fill="currentColor"/></svg>`,
  diplomatic: `<svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1" fill="none"/><ellipse cx="6" cy="6" rx="2.5" ry="5" stroke="currentColor" stroke-width="0.8" fill="none"/><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="0.8"/><line x1="1.8" y1="3.5" x2="10.2" y2="3.5" stroke="currentColor" stroke-width="0.6" opacity=".6"/><line x1="1.8" y1="8.5" x2="10.2" y2="8.5" stroke="currentColor" stroke-width="0.6" opacity=".6"/></svg>`,
  city:       `<svg viewBox="0 0 12 12" width="100%" height="100%"><rect x="1.5" y="5.5" width="9" height="6" fill="currentColor" opacity=".75"/><rect x="3.5" y="2.5" width="5" height="3" fill="currentColor"/><rect x="4.5" y="7" width="1.5" height="2.5" fill="#0a0c1e"/><rect x="6" y="7" width="1.5" height="2.5" fill="#0a0c1e"/></svg>`,
};
const _CITY_COLORS = {
  capital:'#E8D5A3', financial:'#FFD60A', military:'#FF6D00',
  naval:'#2979FF',   port:'#00BCD4',      conflict:'#FF2D55',
  energy:'#FF9F0A',  diplomatic:'#30D158', city:'#6674CC',
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
  d.addEventListener('click', e => { e.stopPropagation(); openArticle(story); });
  return d;
}

// ═══════════════════════════════════════════
// COUNTRY MARKER — nuclear/conflict/sanctions/P5 indicators
// ═══════════════════════════════════════════
function makeCountryMarker(country) {
  const icons = [];
  if (country.nuclear_armed)     icons.push(`<span class="ctry-ico ctry-nuclear" title="Nuclear armed">☢</span>`);
  if (country.conflict_active)   icons.push(`<span class="ctry-ico ctry-conflict" title="Active conflict">▲</span>`);
  if (country.sanctions_subject) icons.push(`<span class="ctry-ico ctry-sanction" title="Under sanctions">⊘</span>`);
  if (country.un_p5)             icons.push(`<span class="ctry-ico ctry-p5" title="UN Security Council P5">★</span>`);
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
    if (typeof pinGeoAsset === 'function') pinGeoAsset('country', country);
  });
  return d;
}

// ═══════════════════════════════════════════
// REGION LABEL — text label at conflict zone center
// ═══════════════════════════════════════════
function makeRegionLabel(region) {
  const d = document.createElement('div');
  d.className = `rgn-label rgn-${region.threat_level || 'elevated'}`;
  const colMap = { critical:'#FF2D55', high:'#FF9F0A', elevated:'#B7950B' };
  const col = colMap[region.threat_level] || '#B7950B';
  d.style.cssText = `transform:translate(-50%,-50%);pointer-events:none;color:${col}`;
  d.innerHTML = `<div class="rgn-lbl-txt">${region.name.toUpperCase()}</div>`;
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
  if (!G || satModeOn) return; // satellite mode overrides day/night texture
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

  const visual = stories.map(s => ({...s, _type:'story'}));
  if (eqVisible) EQ_DATA.forEach(e => visual.push(e));
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

  G.htmlElementsData(visual).htmlElement(item => {
    if (item._type === 'earthquake') return makeEqMarker(item);
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
      d.onclick = (e) => {
        e.stopPropagation();
        if (!_lnpActive) openLiveNews(null);
        switchBroadcaster(item.id);
        updateAllGlobeElements(); // refresh active state on all markers
      };
      return d;
    }
    if (item._type === 'blackout') {
      const d = document.createElement('div');
      d.className = 'bl-void';
      d.innerHTML = `<div class="bl-ring"></div><div class="bl-core"></div><div class="bl-tip">BLACKOUT: ${item.region||'UNKNOWN'}</div>`;
      return d;
    }
    if (item._type === 'city') return makeCityMarker(item);
    if (item._type === 'country') return makeCountryMarker(item);
    if (item._type === 'region_label') return makeRegionLabel(item);
    if (item._type === 'threat') {
      const d = document.createElement('div');
      d.style.cssText = 'position:relative;transform:translate(-50%,-50%);pointer-events:none';
      const rings = [28,48,68].map((r,i) => `<div style="position:absolute;top:50%;left:50%;width:${r}px;height:${r}px;border-radius:50%;border:1px solid ${item.color||'#FF9F0A'}${['44','28','14'][i]};transform:translate(-50%,-50%);animation:ring-out ${2+i*0.8}s ease-out infinite;animation-delay:${i*0.4}s"></div>`).join('');
      d.innerHTML = rings;
      return d;
    }
    return makeMarker(item);
  });

  const clickTargets = [...stories];
  if (eqVisible) EQ_DATA.forEach(e => clickTargets.push(e));
  G.pointsData(clickTargets)
    .pointLat('lat').pointLng('lng')
    .pointAltitude(0.025).pointRadius(0.55)
    .pointColor(() => 'rgba(0,0,0,0)')
    .onPointClick(item => {
      if (item._type === 'earthquake') showEqInfo(item);
      else handleLocationClick(item);
    })
    .onPointHover(item => { document.body.style.cursor = item ? 'pointer' : ''; });

  const _conflictRings = (threatsVisible && REGION_DATA.length)
    ? REGION_DATA
        .filter(r => r.threat_level === 'critical' || r.threat_level === 'high')
        .map(r => ({...r, _region: true}))
    : [];
  const _regionColors = { critical:'#FF2D55', high:'#FF9F0A', elevated:'#B7950B' };
  const _brkRings = [..._pulseSet].filter(s => s.brk);
  G.ringsData([..._brkRings, ...EQ_DATA.filter(e => e.mag >= 6.5), ..._conflictRings])
    .ringColor(r => {
      if (r._region) return (_regionColors[r.threat_level] || '#FF9F0A') + '30';
      // Finance + climate rings are muted — less visually dominant
      if (r.cat === 'finance') return (r.color || '#FFD60A') + '28';
      if (r.cat === 'climate') return (r.color || '#30D158') + '28';
      return (r.color || '#FF2D55') + '55';
    })
    .ringMaxRadius(r => {
      if (r._region) return Math.min(r.radius_km / 55, 18);
      if (r.cat === 'finance') return 2.8;
      if (r.cat === 'climate') return 2.8;
      return r.mag ? r.mag * 0.7 : 4.5;
    })
    .ringPropagationSpeed(r => {
      if (r._region) return 0.35;
      if (r.cat === 'finance') return 0.7;
      if (r.cat === 'climate') return 0.7;
      return r.mag ? r.mag * 0.25 : 1.4;
    })
    .ringRepeatPeriod(r => r._region ? 4000 : (r.cat === 'finance' || r.cat === 'climate') ? 1600 : 900)
    .ringAltitude(0.006);
}

function showEqInfo(eq) {
  // Group nearby quakes within 3° and show picker if multiple
  const nearby = EQ_DATA.filter(e =>
    Math.abs(e.lat - eq.lat) < 3 && Math.abs(e.lng - eq.lng) < 3
  ).sort((a, b) => b.mag - a.mag);

  if (nearby.length > 1) {
    // Reuse picker panel with earthquake data
    if (G) { G.controls().autoRotate = false; G.pointOfView({ lat: eq.lat, lng: eq.lng, altitude: 2.0 }, 1000); }
    document.getElementById('pk-loc').textContent = `SEISMIC CLUSTER`;
    document.getElementById('pk-count').textContent = `${nearby.length} EVENTS IN AREA`;
    document.getElementById('pk-list').innerHTML = nearby.map(e => `
      <div class="pk-item" data-eq-id="${e.id}">
        <div class="pk-accent" style="background:${e.color}"></div>
        <div class="pk-info">
          <div class="pk-cat" style="color:${e.color}">M${e.mag.toFixed(1)} EARTHQUAKE${e.mag >= 6.0 ? ' · <span style="color:var(--brk)">SIGNIFICANT</span>' : ''}</div>
          <div class="pk-title">${e.place}</div>
          <div class="pk-src">USGS · Depth ${e.depth}km · ${e.time}</div>
        </div>
        <span class="pk-arrow">›</span>
      </div>`).join('');
    document.getElementById('pk-list').querySelectorAll('.pk-item').forEach(el => {
      const e = EQ_DATA.find(eq => eq.id === el.dataset.eqId);
      if (e) el.addEventListener('click', () => { closePicker(); openSingleEq(e); });
    });
    document.getElementById('art-bd').classList.add('on');
    document.getElementById('picker').classList.add('on');
    return;
  }
  openSingleEq(eq);
}

function openSingleEq(eq) {
  if (G) {
    G.controls().autoRotate = false;
    G.pointOfView({ lat: eq.lat, lng: eq.lng, altitude: 1.8 }, 1200);
  }
  document.getElementById('ap-cat').textContent = `M${eq.mag.toFixed(1)}`;
  document.getElementById('ap-cat').style.cssText = `color:${eq.color};background:${eq.color}20`;
  document.getElementById('ap-brk').style.display = eq.mag >= 6 ? 'inline-flex' : 'none';
  document.getElementById('ap-title').textContent = eq.place;
  document.getElementById('ap-src').textContent = 'USGS';
  document.getElementById('ap-time').textContent = eq.time;
  document.getElementById('ap-region').textContent = `Depth: ${eq.depth}km`;
  document.getElementById('ap-lead').textContent = `Magnitude ${eq.mag.toFixed(1)} earthquake detected. Focal depth: ${eq.depth}km.`;
  document.getElementById('ap-text').textContent = `This seismic event was recorded by the USGS National Earthquake Information Center. Events above M6.0 have potential for significant shaking at the epicenter.`;
  document.getElementById('ap-link').style.display = 'inline-flex';
  document.getElementById('ap-link').href = `https://earthquake.usgs.gov/earthquakes/eventpage/${eq.id}/executive`;
  document.getElementById('ap-cdot').style.background = eq.color;
  const la = eq.lat >= 0 ? eq.lat.toFixed(3)+'°N' : Math.abs(eq.lat).toFixed(3)+'°S';
  const ln = eq.lng >= 0 ? eq.lng.toFixed(3)+'°E' : Math.abs(eq.lng).toFixed(3)+'°W';
  document.getElementById('ap-coords').textContent = `${la}, ${ln}`;
  document.getElementById('art-panel').classList.add('on');
  document.getElementById('art-bd').classList.add('on');
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

function applyMeaningfulArcs(stories) {
  if (!G) return;
  // Delegate to refreshArcs so overlay arcs (cables, divergence, cascade, wargame) are preserved
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
      console.log('[MERIDIAN] Border topojson loaded');
    } catch(e) {
      console.warn('[MERIDIAN] Border topojson unavailable:', e.message);
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
  console.log('[MERIDIAN] Border paths built:', borderPaths.length, 'segments');
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
      console.log('[MERIDIAN] Weekly conflict data refresh complete');
    }
  } catch(e) { console.warn('[MERIDIAN] Weekly refresh error:', e.message); }
}, 7 * 24 * 60 * 60 * 1000);

// ═══════════════════════════════════════════
// SENTIMENT PULSE
