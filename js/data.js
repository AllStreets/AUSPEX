'use strict';
// ═══════════════════════════════════════════
// NEWS DATA  (seeded fallback — replaced by live API data at boot)
// ═══════════════════════════════════════════
const FALLBACK_NEWS = [
  {id:1, lat:50.45,  lng:30.52,  cat:'geo',      src:'Reuters',     time:'2 min ago',  brk:true,
   region:'Kyiv / Warsaw',
   title:'Ukrainian Diplomatic Summit Convenes in Warsaw',
   summary:'Foreign ministers from 14 NATO and partner nations gather to negotiate a comprehensive ceasefire framework amid stalled battlefield negotiations.',
   body:'A high-level diplomatic conference convened in Warsaw as foreign ministers from across NATO and partner nations assembled to discuss a comprehensive ceasefire framework. The summit comes amid increasingly stalled battlefield negotiations and mounting international pressure for a negotiated settlement. Delegations from the United States, Germany, France, and the United Kingdom were joined by representatives from Turkey, Hungary, and several non-aligned nations in what organizers described as a "last serious attempt" at de-escalation before the summer campaign season begins. Two parallel working groups are addressing military verification mechanisms and humanitarian corridor access.'},

  {id:2, lat:35.68,  lng:139.69, cat:'geo',      src:'AP',          time:'8 min ago',  brk:false,
   region:'Tokyo, Japan',
   title:'G7 Finance Ministers Announce Coordinated Sanctions Package',
   summary:'Finance ministers reach landmark agreement on sweeping new economic measures targeting critical supply chains and dual-use technologies.',
   body:'Finance ministers from the Group of Seven industrialized nations reached agreement Tuesday on a coordinated package of economic sanctions targeting critical dual-use technologies and financial corridors. The announcement follows three days of intensive closed-door negotiations in Tokyo. Officials described the package as "the most comprehensive coordinated action since 2022," with provisions covering semiconductor exports, energy financing, and cross-border banking restrictions that will take effect within 90 days pending legislative ratification in member states.'},

  {id:3, lat:23.70,  lng:120.96, cat:'geo',      src:'FT',          time:'15 min ago', brk:true,
   region:'Taiwan Strait',
   title:'Taiwan Strait: PLA Naval Exercises Enter Day Three',
   summary:'Satellite imagery confirms unprecedented deployment of carrier strike group and amphibious assault vessels in restricted maritime zones.',
   body:"People's Liberation Army naval exercises in the Taiwan Strait entered their third consecutive day, with commercial satellite imagery confirming the presence of a carrier strike group and multiple amphibious assault vessels in previously restricted maritime zones. Taiwan's Ministry of National Defense activated additional air defense units and scrambled F-16V fighters in response to 47 PLA aircraft crossings of the median line. Washington dispatched the USS Ronald Reagan carrier strike group from Yokosuka as a demonstration of commitment to the region's security architecture."},

  {id:4, lat:31.95,  lng:35.93,  cat:'geo',      src:'BBC',         time:'22 min ago', brk:false,
   region:'Amman, Jordan',
   title:'Middle East Peace Talks Resume in Amman',
   summary:'US-brokered negotiations reach critical juncture as parties reconvene for fifth round of discussions.',
   body:'Senior diplomats reconvened in Amman for the fifth round of US-brokered negotiations. American envoys expressed cautious optimism following a 72-hour breakthrough in back-channel communications. The talks focus on a proposed 90-day cessation of hostilities linked to a phased prisoner exchange and expanded humanitarian access to contested urban areas. The Jordanian foreign ministry is hosting the talks on behalf of the broader international mediation coalition, which includes Egypt, Qatar, and three European nations.'},

  {id:5, lat:55.76,  lng:37.62,  cat:'geo',      src:'Guardian',    time:'34 min ago', brk:false,
   region:'Moscow, Russia',
   title:'Kremlin Issues Response to NATO Eastern Expansion',
   summary:"Official statement warns of 'asymmetric countermeasures' following alliance's decision to increase forward-deployed forces.",
   body:'The Kremlin issued an unusually direct statement warning of "asymmetric countermeasures proportionate to the threat" following NATO\'s announcement of increased forward-deployed troop levels in the Baltic states and Poland. The statement specifically cited the planned deployment of an additional armored brigade to Estonia and Latvia. Defense analysts noted the language as escalatory but within established parameters of Russian strategic communication, suggesting the response is intended primarily for domestic audiences ahead of parliamentary budget season.'},

  {id:6, lat:15.37,  lng:44.19,  cat:'military', src:'DefenseOne',  time:'5 min ago',  brk:true,
   region:'Red Sea / Bab-el-Mandeb',
   title:'Red Sea: 12th Coalition Drone Interdiction This Month',
   summary:'US-led naval task force neutralizes sophisticated multi-vector drone attack in the strategic Bab-el-Mandeb strait.',
   body:'A US-led coalition naval task force intercepted and neutralized a sophisticated drone attack in the Bab-el-Mandeb strait, marking the 12th successful interdiction this month. The USS Gravely and HMS Diamond engaged multiple low-observable aerial vehicles launched from Yemeni territory. Commercial shipping traffic through the corridor has declined 34% from pre-conflict levels, with several major carriers diverting vessels around the Cape of Good Hope at significant cost to global supply chains. The coalition is evaluating requests from six additional flag states to join the escort mission.'},

  {id:7, lat:13.51,  lng:2.11,   cat:'military', src:"Jane's",      time:'19 min ago', brk:false,
   region:'Sahel Region, Africa',
   title:'Sahel Alliance Conducts Joint Counter-Insurgency Operation',
   summary:'Multi-national force deploys across 400km front in coordinated push against militant logistics networks.',
   body:"The Sahel Alliance joint task force launched a major coordinated operation spanning a 400-kilometer front across the tri-border region of Mali, Niger, and Burkina Faso. The operation, code-named FERRIC DAWN, involves ground forces from five nations supported by French special operations advisors and American ISR platforms. Military spokespeople reported significant disruption to logistics networks serving militant networks in the region, with 14 resupply routes interdicted in the opening 48 hours."},

  {id:8, lat:34.56,  lng:69.21,  cat:'military', src:'UN News',     time:'41 min ago', brk:false,
   region:'Central Asia',
   title:'UN Security Council Extends Peacekeeping Mandate',
   summary:'Resolution 2891 passes 13-2; expanded rules of engagement authorized for protection of civilian populations.',
   body:'The United Nations Security Council voted 13-2 to extend the peacekeeping mission mandate through the end of 2027, with China and Russia casting the dissenting votes. The resolution additionally authorized expanded rules of engagement permitting active defense of civilian populations and critical infrastructure. The current force of 8,400 personnel will be augmented by an additional 2,200 troops from contributing nations, with the Netherlands, Canada, and South Korea pledging the largest contingents.'},

  {id:9, lat:40.71,  lng:-74.01, cat:'finance',  src:'WSJ',         time:'1 min ago',  brk:true,
   region:'New York, USA',
   title:'Fed Signals Prolonged Rate Hold; Markets Volatile',
   summary:"FOMC minutes reveal deep internal division; S&P 500 swings 1.8% as rate cut expectations collapse.",
   body:'Minutes from the Federal Open Market Committee\'s most recent meeting revealed significant internal division over the appropriate trajectory of monetary policy, with five members favoring an immediate rate cut and three advocating for further tightening. The Fed signaled a rate hold in the near term, citing persistent services inflation and a resilient labor market. Equity markets responded with volatility, with the S&P 500 swinging within a 1.8% range. Fed funds futures now price just one cut through year-end, down from three at the start of the quarter.'},

  {id:10,lat:51.51,  lng:-0.13,  cat:'finance',  src:'FT',          time:'7 min ago',  brk:false,
   region:'London, UK',
   title:'FTSE 100 Surges 2.3% on Bank of England Pivot Bets',
   summary:'Banking stocks lead broad rally; sterling strengthens as traders price 68% probability of MPC rate cut.',
   body:"The FTSE 100 surged 2.3% as traders increased bets on an imminent Bank of England rate pivot following weaker-than-expected CPI data. Banking stocks led the advance, with Barclays and Lloyds each gaining over 4%. Sterling strengthened against both the dollar and euro as markets priced in a 68% probability of a rate cut at the next MPC meeting. Bond markets saw significant buying across the yield curve, compressing the 10-year gilt yield by 18 basis points to its lowest level since February."},

  {id:11,lat:31.23,  lng:121.47, cat:'finance',  src:'Caixin',      time:'23 min ago', brk:false,
   region:'Shanghai, China',
   title:'PBOC Injects ¥800B via Targeted Reserve Ratio Cut',
   summary:"Move signals Beijing's commitment to stabilizing property sector; economists describe it as precision easing.",
   body:"The People's Bank of China announced a targeted reserve requirement ratio cut, freeing an estimated ¥800 billion in liquidity primarily directed at the real estate sector and small-to-medium enterprise financing. The move comes after official data showed property investment contracting for the 24th consecutive month. Economists interpreted the action as measured stimulus rather than broad monetary easing, consistent with Beijing's stated preference for precision policy tools. Three major state banks confirmed expanded lending windows effective immediately."},

  {id:12,lat:50.11,  lng:8.68,   cat:'finance',  src:'Bloomberg',   time:'38 min ago', brk:false,
   region:'Frankfurt, Germany',
   title:"ECB's Lagarde: 'Vigilance Required' on Euro Zone Outlook",
   summary:"Hawkish press conference triggers bond market volatility; Bund yields reach six-week high.",
   body:"European Central Bank President Christine Lagarde struck a notably hawkish tone at Wednesday's press conference, stating that 'vigilance remains required' regarding euro zone growth prospects and upside inflation risks. The remarks triggered immediate bond market volatility, with 10-year Bund yields jumping 12 basis points to a six-week high. The euro gained 0.4% against the dollar as traders recalibrated rate cut expectations for the second half of the year, pushing back the anticipated first cut by approximately six weeks."},

  {id:13,lat:-33.87, lng:151.21, cat:'finance',  src:'AFR',         time:'52 min ago', brk:false,
   region:'Sydney, Australia',
   title:'RBA Surprises Markets with Emergency Rate Cut',
   summary:"Australian dollar falls 1.4% as central bank cites materially deteriorated global outlook.",
   body:"The Reserve Bank of Australia shocked financial markets with an unscheduled 25 basis point rate cut, citing 'materially deteriorated' global growth conditions and a sharper-than-expected domestic economic slowdown. The Australian dollar fell 1.4% against the US dollar immediately following the announcement. Governor Michele Bullock indicated the board stood ready for further action if conditions warranted, signaling the potential beginning of an extended easing cycle that markets now price at three additional cuts over 12 months."},

  {id:14,lat:-3.47,  lng:-62.22, cat:'climate',  src:'Nature',      time:'1 hr ago',   brk:false,
   region:'Amazon Basin, Brazil',
   title:'Amazon Deforestation Rate Falls 31% — Historic Low',
   summary:"Satellite monitoring confirms dramatic reversal; Brazil credits unprecedented enforcement and indigenous land programs.",
   body:"Brazil's National Institute for Space Research released data showing a 31% year-on-year reduction in Amazon deforestation rates, the lowest recorded figure since satellite monitoring began in 1988. Environment Minister Marina Silva credited a combination of aggressive enforcement operations, the expansion of indigenous land recognition programs, and improved international cooperation on illegal timber and agricultural supply chains. Scientists cautioned that the gains remained fragile and dependent on continued political will, particularly heading into an election cycle in which environmental policy is a central issue."},

  {id:15,lat:78.22,  lng:15.65,  cat:'climate',  src:'NSIDC',       time:'2 hr ago',   brk:true,
   region:'Arctic Ocean / Svalbard',
   title:"Arctic Sea Ice Hits Record Minimum — 23% Below Average",
   summary:"Scientists warn of 'blue ocean event' possible by 2028 as Svalbard monitoring records unprecedented thinning.",
   body:"The National Snow and Ice Data Center reported that Arctic sea ice extent reached its lowest recorded minimum since satellite measurement began, 23% below the 1981-2010 average. Researchers at the Svalbard monitoring station documented ice thickness reductions of up to 40% compared to five-year averages. Three prominent climate scientists warned in an accompanying commentary that a 'blue ocean event' — effectively ice-free summer Arctic conditions — could occur as early as 2028, a full decade earlier than previous IPCC projections, with significant consequences for global weather systems and permafrost stability."},

  {id:16,lat:1.35,   lng:103.82, cat:'climate',  src:'ClimateHome', time:'3 hr ago',   brk:false,
   region:'Singapore',
   title:'COP32 Host Singapore Pledges Net-Zero Grid by 2035',
   summary:'S$14 billion investment package covering offshore solar, green hydrogen, and grid-scale battery storage announced.',
   body:"Singapore announced a commitment to achieve a net-zero electricity grid by 2035, a decade ahead of its previously stated target. Prime Minister Lawrence Wong unveiled a S$14 billion investment package covering offshore solar expansion, regional green hydrogen procurement agreements, and grid-scale battery storage deployment. The announcement was welcomed by climate advocates as a significant demonstration of ambition from a high-income, small-nation economy, and is expected to exert upward pressure on other ASEAN nations' NDC commitments ahead of November's COP summit."},

  {id:17,lat:37.34,  lng:-121.89,cat:'tech',     src:'WSJ',         time:'3 min ago',  brk:true,
   region:'Silicon Valley, USA',
   title:'AI Chip Export Controls Significantly Tightened',
   summary:'Commerce Dept expands Entity List; Nvidia H100 and AMD MI300 face new restrictions; shares swing in pre-market.',
   body:"The US Department of Commerce announced sweeping new export controls on advanced semiconductor and AI accelerator chips, significantly expanding the Entity List and lowering the performance thresholds triggering licensing requirements. Nvidia's A100 and H100 chips, along with AMD's MI300 series, face new restrictions on sale to additional countries. The announcement sent Nvidia shares down 6% in extended trading before recovering on analyst commentary suggesting the restrictions target a smaller market segment than initially feared. TSMC and Samsung's US-based fabrication facilities are exempted."},

  {id:18,lat:37.57,  lng:126.98, cat:'tech',     src:'AnandTech',   time:'28 min ago', brk:false,
   region:'Seoul, South Korea',
   title:'Samsung Unveils 2nm GAA Process for Mass Production',
   summary:"Foundry division claims 18-month production lead over TSMC; first customer tape-outs scheduled for Q3.",
   body:"Samsung Foundry announced it had achieved commercially viable yields on its 2-nanometer Gate-All-Around logic process, positioning itself for mass production by the third quarter of this year. The announcement, made at Samsung's annual Foundry Forum in Seoul, included commitments from three undisclosed customers for initial tape-outs. Samsung executives claimed an 18-month production lead over TSMC on the node, though industry analysts were cautious about yield-to-cost comparisons before independent benchmarking. Memory division chief also previewed HBM4E specification details for AI accelerator integration."},

  {id:19,lat:51.51,  lng:-0.13,  cat:'tech',     src:'WIRED',       time:'45 min ago', brk:false,
   region:'London, UK',
   title:'UK AI Safety Institute Releases Frontier Model Audit',
   summary:"Parliamentary-commissioned review recommends mandatory red-teaming and pre-deployment safety certification.",
   body:"The UK AI Safety Institute released its first comprehensive audit of frontier AI models, a Parliamentary-commissioned review evaluating models from five major labs across dimensions of capability, controllability, and societal risk. The report recommended mandatory pre-deployment red-teaming with independent auditors, a new classification system for 'socially disruptive capability thresholds,' and international coordination on safety standards via the Bletchley Park process. The report explicitly cited the Meridian-class capability threshold — referring to models demonstrating cross-domain strategic reasoning — as requiring the highest oversight tier."},

  {id:20,lat:39.90,  lng:116.41, cat:'tech',     src:'TechCrunch',  time:'1 hr ago',   brk:false,
   region:'Beijing, China',
   title:'Baidu Deploys Driverless Robotaxi Fleet Across 12 Chinese Cities',
   summary:'Largest commercial AV rollout in history; 2,400 vehicles operating without safety drivers across major urban areas.',
   body:"Baidu's Apollo robotaxi service launched fully driverless operations across 12 Chinese cities, in what the company described as the largest commercial autonomous vehicle deployment in history. The fleet of 2,400 vehicles operates without safety drivers across urban areas including Beijing, Shanghai, and Shenzhen. The announcement coincides with Waymo's expansion to its fourth US city, intensifying the global competition to establish the first at-scale autonomous mobility service. Baidu reported a 94.7% ride completion rate in the first 24 hours, with zero safety interventions required."},
];

let NEWS = [...FALLBACK_NEWS];
function applyColors(arr) { arr.forEach(s => s.color = CATS[s.cat].color); }
applyColors(NEWS);

// ═══════════════════════════════════════════
// LOCATION LOOKUP
// ═══════════════════════════════════════════
const CITY_COORDS = {
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
const COUNTRY_COORDS = {
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
  'brazil':[14.24,-51.93],'brazilian':[-14.24,-51.93],
  'australia':[-25.27,133.78],'australian':[-25.27,133.78],
  'canada':[56.13,-106.35],'canadian':[56.13,-106.35],
  'nato':[50.88,4.70],'eu':[50.50,4.47],'europe':[54.53,15.26],'european':[54.53,15.26],
  'middle east':[29.31,42.46],'africa':[1.65,17.54],'asia':[34.05,100.62],
  'arctic':[78.22,15.65],'amazon':[-3.47,-62.22],'pacific':[0.00,-160.00],
  'red sea':[18.00,39.00],'black sea':[43.00,35.00],'south china sea':[15.00,115.00],
  'mediterranean':[35.00,18.00],'persian gulf':[26.00,53.00],'horn of africa':[11.00,49.00],
};

function extractCoords(text) {
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

function detectCat(text) {
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

// ═══════════════════════════════════════════
// NEWS API  — token-efficient: 4 req on load, 30-min cache
