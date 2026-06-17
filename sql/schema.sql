-- ═══════════════════════════════════════════════════════════════
-- MERIDIAN — SUPABASE SCHEMA + SEED DATA
-- Run this entire file in Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── TABLES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stories (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title_key   TEXT        NOT NULL UNIQUE,
  title       TEXT        NOT NULL,
  summary     TEXT,
  body        TEXT,
  url         TEXT,
  src         TEXT,
  cat         TEXT,
  region      TEXT,
  lat         FLOAT,
  lng         FLOAT,
  brk         BOOLEAN     DEFAULT FALSE,
  pub_date      TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  url_to_image  TEXT
);
CREATE INDEX IF NOT EXISTS stories_cat       ON stories(cat);
CREATE INDEX IF NOT EXISTS stories_pub       ON stories(pub_date DESC);
CREATE INDEX IF NOT EXISTS stories_fetched   ON stories(fetched_at DESC);
CREATE INDEX IF NOT EXISTS stories_region    ON stories(region);
CREATE INDEX IF NOT EXISTS stories_title_tsr ON stories USING gin(to_tsvector('english', title));

CREATE TABLE IF NOT EXISTS cities (
  id               SERIAL PRIMARY KEY,
  name             TEXT    NOT NULL,
  country          TEXT    NOT NULL,
  iso2             CHAR(2),
  continent        TEXT    NOT NULL,
  lat              FLOAT   NOT NULL,
  lng              FLOAT   NOT NULL,
  population       BIGINT,
  is_capital       BOOLEAN DEFAULT FALSE,
  is_financial     BOOLEAN DEFAULT FALSE,
  is_military      BOOLEAN DEFAULT FALSE,
  is_conflict      BOOLEAN DEFAULT FALSE,
  is_port          BOOLEAN DEFAULT FALSE,
  is_energy        BOOLEAN DEFAULT FALSE,
  gdp_billions     FLOAT,
  strategic_tier   INT     DEFAULT 3,
  icon_type        TEXT    DEFAULT 'city',
  notes            TEXT
);
CREATE INDEX IF NOT EXISTS cities_tier ON cities(strategic_tier);
CREATE INDEX IF NOT EXISTS cities_cont ON cities(continent);

CREATE TABLE IF NOT EXISTS countries (
  iso2                TEXT PRIMARY KEY,
  iso3                TEXT,
  name                TEXT    NOT NULL,
  continent           TEXT,
  capital             TEXT,
  lat                 FLOAT,
  lng                 FLOAT,
  population          BIGINT,
  gdp_billions        FLOAT,
  mil_spend_billions  FLOAT,
  nuclear_armed       BOOLEAN DEFAULT FALSE,
  nato_member         BOOLEAN DEFAULT FALSE,
  un_p5               BOOLEAN DEFAULT FALSE,
  sanctions_subject   BOOLEAN DEFAULT FALSE,
  conflict_active     BOOLEAN DEFAULT FALSE,
  strategic_tier      INT     DEFAULT 3
);

CREATE TABLE IF NOT EXISTS regions (
  id            SERIAL PRIMARY KEY,
  name          TEXT    NOT NULL,
  type          TEXT,
  lat           FLOAT   NOT NULL,
  lng           FLOAT   NOT NULL,
  radius_km     FLOAT   DEFAULT 400,
  description   TEXT,
  threat_level  TEXT    DEFAULT 'elevated',
  active        BOOLEAN DEFAULT TRUE
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────

ALTER TABLE stories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON stories;
DROP POLICY IF EXISTS "anon_insert" ON stories;
DROP POLICY IF EXISTS "anon_select" ON cities;
DROP POLICY IF EXISTS "anon_select" ON countries;
DROP POLICY IF EXISTS "anon_select" ON regions;

CREATE POLICY "anon_select" ON stories  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON stories  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select" ON cities   FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select" ON countries FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select" ON regions  FOR SELECT TO anon USING (true);

-- ─── SEED: CITIES ────────────────────────────────────────────
-- icon_type: capital | financial | military | port | conflict | energy | diplomatic | naval

INSERT INTO cities (name,country,iso2,continent,lat,lng,population,is_capital,is_financial,is_military,is_conflict,is_port,is_energy,gdp_billions,strategic_tier,icon_type,notes) VALUES

-- NORTH AMERICA
('Washington DC','United States','US','North America',38.91,-77.04,689545,true,false,true,false,false,false,NULL,1,'capital','US federal capital; Pentagon nearby; NORAD command'),
('New York','United States','US','North America',40.71,-74.01,8336817,false,true,false,false,true,false,1810,1,'financial','Global financial capital; NYSE; UN HQ; largest US city'),
('Los Angeles','United States','US','North America',34.05,-118.24,3979576,false,false,false,false,true,false,NULL,2,'port','Largest US Pacific port; aerospace hub; PACOM gateway'),
('Chicago','United States','US','North America',41.88,-87.63,2693976,false,true,false,false,false,false,NULL,2,'financial','CME commodities exchange; Midwest financial hub'),
('Houston','United States','US','North America',29.76,-95.37,2304580,false,false,false,false,true,true,NULL,2,'energy','Global energy trading hub; largest US oil refining center'),
('Miami','United States','US','North America',25.77,-80.19,467963,false,true,false,false,true,false,NULL,2,'port','Latin America financial gateway; PortMiami'),
('Norfolk','United States','US','North America',36.85,-76.29,242803,false,false,true,false,true,false,NULL,2,'naval','Largest US naval base in the world; NATO command'),
('San Diego','United States','US','North America',32.72,-117.16,1386932,false,false,true,false,true,false,NULL,2,'naval','Major US Pacific Fleet base; SEAL training HQ'),
('San Francisco','United States','US','North America',37.77,-122.42,873965,false,true,false,false,true,false,592,1,'financial','Global tech capital; Silicon Valley gateway; Fed SF; major Pacific port'),
('Seattle','United States','US','North America',47.61,-122.33,737255,false,true,false,false,true,false,NULL,2,'port','Boeing HQ; Amazon/Microsoft corridor; largest US Pacific NW port'),
('Portland','United States','US','North America',45.52,-122.68,652503,false,false,false,false,true,false,NULL,3,'port','Columbia River port; Pacific Northwest trade hub'),
('Las Vegas','United States','US','North America',36.17,-115.14,641903,false,false,false,false,false,false,NULL,3,'city','Nellis AFB and Nevada Test Site proximity; defense contractor hub'),
('Phoenix','United States','US','North America',33.45,-112.07,1608139,false,false,true,false,false,false,NULL,2,'military','Luke AFB; 56th Fighter Wing; fastest-growing US metro'),
('Denver','United States','US','North America',39.74,-104.98,715522,false,false,true,false,false,true,NULL,2,'military','NORAD/NORTHCOM at Peterson; Schriever Space Force; Buckley SFB'),
('Salt Lake City','United States','US','North America',40.76,-111.89,199723,false,false,true,false,false,false,NULL,3,'military','Hill AFB; Utah Test and Training Range; NSA data center'),
('Honolulu','United States','US','North America',21.31,-157.86,345064,false,false,true,false,true,false,NULL,1,'naval','Pearl Harbor; INDOPACOM HQ; US Pacific strategic anchor'),
('Anchorage','United States','US','North America',61.22,-149.90,291538,false,false,true,false,false,true,NULL,2,'military','Elmendorf-Richardson joint base; Arctic gateway; NORAD radar'),
('Dallas','United States','US','North America',32.78,-96.80,1304379,false,true,false,false,false,true,NULL,2,'financial','Fed Dallas; energy sector HQ; largest inland US metro'),
('Atlanta','United States','US','North America',33.75,-84.39,498715,false,true,false,false,false,false,NULL,2,'financial','Fed Atlanta; busiest airport; CDC HQ; logistics hub'),
('Boston','United States','US','North America',42.36,-71.06,675647,false,true,false,false,true,false,NULL,2,'financial','Fed Boston; biotech corridor; MIT/Harvard R&D; defense tech'),
('Philadelphia','United States','US','North America',39.95,-75.16,1603797,false,false,false,false,true,false,NULL,3,'port','Philadelphia Naval Yard legacy; Delaware River port; pharma hub'),
('Ottawa','Canada','CA','North America',45.42,-75.69,994837,true,false,false,false,false,false,NULL,2,'capital','Canadian capital; Five Eyes signals intelligence'),
('Toronto','Canada','CA','North America',43.65,-79.38,2731571,false,true,false,false,false,false,NULL,2,'financial','Canadian financial center; TSX exchange'),
('Mexico City','Mexico','MX','North America',19.43,-99.13,9209944,true,false,false,false,false,false,NULL,2,'capital','Largest N. American city by pop; cartel conflict zone'),
('Panama City','Panama','PA','North America',8.99,-79.52,880691,true,false,false,false,true,false,NULL,2,'port','Panama Canal control; global maritime chokepoint'),
('Havana','Cuba','CU','North America',23.13,-82.38,2141993,true,false,false,false,false,false,NULL,2,'capital','Strategic Cold War relic; US sanctions target; SIGINT base'),

-- SOUTH AMERICA
('Brasilia','Brazil','BR','South America',-15.78,-47.93,3015268,true,false,false,false,false,false,NULL,2,'capital','Brazilian capital; BRICS member'),
('São Paulo','Brazil','BR','South America',-23.55,-46.63,12325232,false,true,false,false,false,false,700,1,'financial','Largest S. American financial center; Bovespa exchange'),
('Rio de Janeiro','Brazil','BR','South America',-22.91,-43.17,6747815,false,false,false,false,true,true,NULL,2,'port','Major port; pre-salt oil hub; Petrobras HQ'),
('Buenos Aires','Argentina','AR','South America',-34.61,-58.38,3054300,true,true,false,false,true,false,NULL,2,'capital','Argentine capital; Merval exchange; IMF debtor'),
('Lima','Peru','PE','South America',-12.04,-77.04,9751717,true,false,false,false,false,false,NULL,2,'capital','Peruvian capital; Pacific Alliance hub; copper mining'),
('Bogotá','Colombia','CO','South America',4.71,-74.07,7412566,true,false,false,false,false,false,NULL,2,'capital','Colombian capital; narco-conflict proximity; US partner'),
('Santiago','Chile','CL','South America',-33.47,-70.64,6310000,true,false,false,false,false,false,NULL,2,'capital','Chilean capital; copper export hub; Pacific Alliance'),
('Caracas','Venezuela','VE','South America',10.48,-66.88,2900000,true,false,false,false,false,true,NULL,2,'capital','Venezuelan capital; US-sanctioned; massive oil reserves'),

-- EUROPE
('London','United Kingdom','GB','Europe',51.51,-0.13,8982000,true,true,false,false,true,false,731,1,'financial','Global financial capital; SWIFT; NATO member; Five Eyes'),
('Paris','France','FR','Europe',48.85,2.35,2161000,true,true,false,false,false,false,null,1,'capital','French capital; EU power; UN P5; nuclear armed; NATO'),
('Berlin','Germany','DE','Europe',52.52,13.40,3645000,true,false,false,false,false,false,null,1,'capital','German capital; EU economic engine; NATO HQ proximity'),
('Brussels','Belgium','BE','Europe',50.85,4.35,1208542,true,false,false,false,false,false,null,1,'diplomatic','NATO HQ; EU Commission HQ; Western alliance nerve center'),
('Moscow','Russia','RU','Europe',55.76,37.62,12506468,true,false,true,false,false,false,null,1,'capital','Russian capital; nuclear arsenal; P5; Ukraine war command'),
('Kyiv','Ukraine','UA','Europe',50.45,30.52,2962180,true,false,true,true,false,false,null,1,'conflict','Ukrainian capital; active war zone; NATO aid destination'),
('Warsaw','Poland','PL','Europe',52.23,21.01,1765000,true,false,true,false,false,false,null,2,'military','Polish capital; NATO eastern flank; major US troop presence'),
('Stockholm','Sweden','SE','Europe',59.33,18.07,975551,true,false,false,false,false,false,null,2,'capital','Swedish capital; new NATO member; Saab defense; IKEA'),
('Helsinki','Finland','FI','Europe',60.17,24.94,658457,true,false,false,false,false,false,null,2,'capital','Finnish capital; new NATO member; Russia border; intel hub'),
('Rome','Italy','IT','Europe',41.90,12.50,2872800,true,false,false,false,false,false,null,2,'capital','Italian capital; G7 member; Vatican City; NATO member'),
('Madrid','Spain','ES','Europe',40.42,-3.70,3266126,true,false,false,false,false,false,null,2,'capital','Spanish capital; NATO member; Atlantic & Mediterranean bridge'),
('Frankfurt','Germany','DE','Europe',50.11,8.68,753056,false,true,false,false,false,false,null,2,'financial','ECB HQ; Bundesbank; Euro financial center; EU banking hub'),
('Amsterdam','Netherlands','NL','Europe',52.37,4.90,905234,false,true,false,false,true,false,null,2,'financial','Port of Rotterdam gateway; Euronext; Shell HQ; NATO ally'),
('Geneva','Switzerland','CH','Europe',46.20,6.15,201818,false,false,false,false,false,false,null,2,'diplomatic','UN European HQ; WHO; WTO; Red Cross; diplomatic capital'),
('Zurich','Switzerland','CH','Europe',47.38,8.54,415367,false,true,false,false,false,false,null,2,'financial','Swiss banking secrecy hub; UBS; Credit Suisse legacy'),
('Vienna','Austria','AT','Europe',48.21,16.37,1897491,true,false,false,false,false,false,null,2,'diplomatic','OPEC HQ; IAEA HQ; OSCE HQ; historic neutral ground talks'),
('Istanbul','Turkey','TR','Europe',41.01,28.98,15462452,false,true,false,false,true,false,null,1,'port','Bosphorus Strait control; NATO''s largest military; trade hub'),
('Ankara','Turkey','TR','Europe',39.93,32.86,5663322,true,false,true,false,false,false,null,2,'military','Turkish capital; NATO member; controls Bosphorus/Dardanelles'),
('Athens','Greece','GR','Europe',37.98,23.73,664046,true,false,true,false,true,false,null,2,'naval','NATO SE flank; Mediterranean naval hub; Piraeus port'),
('Minsk','Belarus','BY','Europe',53.90,27.56,1996553,true,false,false,false,false,false,null,2,'capital','Belarusian capital; Russia ally; Wagner staging; Lukashenko'),
('Bucharest','Romania','RO','Europe',44.44,26.10,1820000,true,false,true,false,false,false,null,2,'military','NATO eastern flank; US missile defense; Black Sea gateway'),
('Belgrade','Serbia','RS','Europe',44.82,20.46,1688667,true,false,false,false,false,false,null,2,'capital','Serbian capital; non-NATO; Russian influence; Balkans hub'),
('Tbilisi','Georgia','GE','Europe',41.69,44.83,1171100,true,false,false,false,false,false,null,2,'capital','Georgian capital; Russia border; energy corridor (BTC pipeline)'),
('Baku','Azerbaijan','AZ','Europe',40.41,49.87,2300500,true,false,false,false,false,true,null,2,'energy','Azeri capital; Caspian oil & gas; BTC pipeline terminus'),
('Riga','Latvia','LV','Europe',56.95,24.11,614618,true,false,true,false,false,true,null,2,'military','NATO eastern flank; Baltic Sea hub; Russia border'),

-- MIDDLE EAST
('Tel Aviv','Israel','IL','Middle East',32.09,34.79,460613,false,true,false,false,true,false,null,1,'financial','Israeli financial center; tech hub; Mossad HQ proximity'),
('Jerusalem','Israel','IL','Middle East',31.78,35.22,919438,true,false,false,true,false,false,null,1,'conflict','Contested capital; Temple Mount; West Bank conflict nexus'),
('Baghdad','Iraq','IQ','Middle East',33.34,44.40,7216000,true,false,false,true,false,true,null,2,'conflict','Iraqi capital; post-ISIS stabilization; US troops; oil proximity'),
('Tehran','Iran','IR','Middle East',35.69,51.39,9259009,true,false,true,false,false,true,null,1,'capital','Iranian capital; nuclear program; IRGC HQ; US sanctioned'),
('Riyadh','Saudi Arabia','SA','Middle East',24.69,46.72,7676654,true,false,true,false,false,true,null,1,'energy','Saudi capital; Aramco HQ; OPEC swing producer; petrodollar'),
('Dubai','United Arab Emirates','AE','Middle East',25.20,55.27,3331420,false,true,false,false,true,false,null,1,'financial','Global trade hub; Jebel Ali port; DP World; DIFC exchange'),
('Abu Dhabi','United Arab Emirates','AE','Middle East',24.45,54.37,1483000,true,false,true,false,false,true,null,2,'energy','UAE capital; ADNOC oil; US Al Dhafra air base; ADIA sovereign fund'),
('Doha','Qatar','QA','Middle East',25.29,51.53,2382000,true,false,true,false,false,true,null,2,'diplomatic','Al Udeid US air base (largest in CENTCOM); LNG exporter; Al Jazeera'),
('Kuwait City','Kuwait','KW','Middle East',29.37,47.98,2380000,true,false,true,false,false,true,null,2,'energy','Kuwaiti capital; US ally; Camp Arifjan; 7th largest oil reserves'),
('Beirut','Lebanon','LB','Middle East',33.89,35.50,2200000,true,false,false,true,true,false,null,2,'conflict','Lebanese capital; Hezbollah stronghold; economic collapse; port blast'),
('Damascus','Syria','SY','Middle East',33.51,36.29,2079000,true,false,false,true,false,false,null,2,'conflict','Syrian capital; Assad regime; Russian airbase at Latakia; reconstruction'),
('Amman','Jordan','JO','Middle East',31.96,35.95,4007526,true,false,false,false,false,false,null,2,'capital','Jordanian capital; US ally; refugee crisis; Israel border stabilizer'),
('Sanaa','Yemen','YE','Middle East',15.35,44.21,3937500,true,false,false,true,false,false,null,2,'conflict','Houthi-controlled capital; Saudi airstrike target; Red Sea threat HQ'),
('Muscat','Oman','OM','Middle East',23.61,58.59,1560330,true,false,false,false,true,false,null,2,'port','Omani capital; strategic Gulf of Oman port; back-channel diplomacy'),

-- SOUTH & CENTRAL ASIA
('Islamabad','Pakistan','PK','Asia',33.72,73.04,1015000,true,false,true,false,false,false,null,2,'capital','Pakistani capital; nuclear armed; ISI intelligence; Taliban border'),
('Karachi','Pakistan','PK','Asia',24.86,67.01,14910352,false,false,false,false,true,false,null,2,'port','Pakistan''s largest city; Arabian Sea port; CPEC gateway'),
('New Delhi','India','IN','Asia',28.61,77.21,32941000,true,false,true,false,false,false,null,1,'capital','Indian capital; nuclear armed; Quad member; 5th largest economy'),
('Mumbai','India','IN','Asia',19.08,72.88,20667656,false,true,false,false,true,false,380,1,'financial','Indian financial capital; BSE; Western Naval Command; port hub'),
('Kabul','Afghanistan','AF','Asia',34.53,69.17,4601789,true,false,false,true,false,false,null,2,'conflict','Taliban capital; post-US withdrawal; terrorist sanctuary; opium hub'),
('Astana','Kazakhstan','KZ','Asia',51.18,71.45,1136027,true,false,false,false,false,true,null,2,'energy','Kazakh capital (Nur-Sultan); oil wealth; Russia-China balancer'),
('Tashkent','Uzbekistan','UZ','Asia',41.30,69.24,2571668,true,false,false,false,false,false,null,2,'capital','Uzbek capital; Central Asia largest city; SCO member'),
('Colombo','Sri Lanka','LK','Asia',6.93,79.84,752993,false,false,false,false,true,false,null,2,'port','Sri Lankan port; Chinese debt trap precedent; Indian Ocean node'),

-- EAST & SOUTHEAST ASIA
('Beijing','China','CN','Asia',39.91,116.39,21893095,true,false,true,false,false,false,null,1,'capital','Chinese capital; CCP HQ; PLA command; P5; nuclear arsenal'),
('Shanghai','China','CN','Asia',31.23,121.47,24870895,false,true,false,false,true,false,3600,1,'financial','Chinese financial capital; SSE; largest global port by tonnage'),
('Hong Kong','China','CN','Asia',22.32,114.17,7413070,false,true,false,false,true,false,370,1,'financial','HK exchange; Asia financial hub; post-NSL autonomy erosion'),
('Shenzhen','China','CN','Asia',22.54,114.06,17494398,false,true,false,false,false,false,null,2,'financial','Chinese tech capital; Huawei HQ; Foxconn; SZSE exchange'),
('Tokyo','Japan','JP','Asia',35.69,139.69,13960000,true,true,true,false,true,false,1142,1,'financial','Japanese capital; 3rd largest economy; US alliance; Yokosuka naval base'),
('Osaka','Japan','JP','Asia',34.69,135.50,2691185,false,true,false,false,true,false,null,2,'port','Japanese industrial & port hub; 2nd economy center'),
('Seoul','South Korea','KR','Asia',37.57,126.98,9776000,true,true,true,false,false,false,700,1,'financial','S. Korean capital; USFK HQ; Samsung HQ; 40 miles from NK border'),
('Pyongyang','North Korea','KP','Asia',39.02,125.75,3255388,true,false,true,false,false,false,null,1,'military','DPRK capital; Kim regime; nuclear ICBM program; most sanctioned'),
('Taipei','Taiwan','TW','Asia',25.03,121.56,2646204,true,true,false,false,false,false,null,1,'conflict','Taiwan capital; TSMC semiconductor chokepoint; China invasion threat'),
('Singapore','Singapore','SG','Asia',1.35,103.82,5850342,true,true,true,false,true,false,500,1,'financial','City-state; US naval hub; global finance; Malacca Strait control'),
('Bangkok','Thailand','TH','Asia',13.75,100.52,10540000,true,false,false,false,true,false,null,2,'port','Thai capital; ASEAN hub; major port; US treaty ally'),
('Manila','Philippines','PH','Asia',14.60,120.98,13923452,true,false,true,false,true,false,null,2,'military','Philippine capital; US treaty ally; South China Sea dispute frontline'),
('Hanoi','Vietnam','VN','Asia',21.03,105.85,8435700,true,false,false,false,false,false,null,2,'capital','Vietnamese capital; US-Vietnam strategic partnership; South China Sea dispute'),
('Ho Chi Minh City','Vietnam','VN','Asia',10.82,106.63,9096515,false,true,false,false,true,false,null,2,'port','Vietnamese financial hub; Saigon port; manufacturing surge'),
('Jakarta','Indonesia','ID','Asia',-6.21,106.85,10770487,true,false,false,false,true,false,null,2,'port','Indonesian capital (moving to Nusantara); G20 member; Malacca approach'),
('Kuala Lumpur','Malaysia','MY','Asia',3.14,101.69,1768000,true,true,false,false,false,false,null,2,'financial','Malaysian capital; Petronas (oil); Belt and Road recipient'),
('Ulaanbaatar','Mongolia','MN','Asia',47.91,106.89,1625000,true,false,false,false,false,false,null,2,'capital','Mongolian capital; landlocked buffer between Russia & China'),
('Guam','United States','US','Asia',13.46,144.79,168801,false,false,true,false,false,false,null,1,'military','US Pacific territory; Anderson AFB; key deterrence vs China/NK'),
('Diego Garcia','United Kingdom','GB','Asia',-7.32,72.42,4000,false,false,true,false,false,false,null,1,'naval','British Indian Ocean Territory; critical US B-2 bomber staging base'),

-- AFRICA
('Cairo','Egypt','EG','Africa',30.06,31.25,21750000,true,false,true,false,true,false,null,1,'capital','Egyptian capital; Suez Canal control; Arab League HQ; US aid recipient'),
('Nairobi','Kenya','KE','Africa',-1.29,36.82,4922359,true,false,false,false,false,false,null,2,'capital','Kenyan capital; UN HABITAT HQ; East Africa economic hub; US AFRICOM partner'),
('Lagos','Nigeria','NG','Africa',6.45,3.40,15388000,false,true,false,false,true,true,null,1,'financial','Nigeria''s financial capital; largest African economy; oil hub; Bight of Benin'),
('Abuja','Nigeria','NG','Africa',9.07,7.40,3552071,true,false,false,false,false,false,null,2,'capital','Nigerian capital; G20 Africa member; AU member'),
('Addis Ababa','Ethiopia','ET','Africa',9.03,38.74,5461756,true,false,false,false,false,false,null,2,'diplomatic','African Union HQ; UNECA; Horn of Africa hub; Tigray conflict aftermath'),
('Johannesburg','South Africa','ZA','Africa',-26.20,28.04,5635127,false,true,false,false,false,false,null,2,'financial','SA financial capital; JSE exchange; BRICS member; gold mining hub'),
('Cape Town','South Africa','ZA','Africa',-33.93,18.42,4618000,false,false,false,false,true,false,null,2,'port','SA legislative capital; Cape of Good Hope; strategic Atlantic-Indian junction'),
('Kinshasa','DRC','CD','Africa',-4.32,15.32,15628085,true,false,false,true,false,false,null,2,'conflict','DRC capital; cobalt/coltan nexus; M23 conflict; Chinese mining presence'),
('Khartoum','Sudan','SD','Africa',15.55,32.53,6160000,true,false,false,true,false,false,null,2,'conflict','Sudanese capital; civil war; RSF vs SAF; humanitarian crisis 2023-present'),
('Mogadishu','Somalia','SO','Africa',2.05,45.34,2587000,true,false,false,true,true,false,null,2,'conflict','Somali capital; al-Shabaab threat; US drone strikes; piracy history'),
('Tripoli','Libya','LY','Africa',32.90,13.18,1150989,true,false,false,true,true,true,null,2,'conflict','Libyan capital; split government; Wagner forces; Mediterranean migration hub'),
('Tunis','Tunisia','TN','Africa',36.82,10.17,2693021,true,false,false,false,false,false,null,2,'capital','Tunisian capital; Arab Spring birthplace; Mediterranean migration transit'),
('Casablanca','Morocco','MA','Africa',33.59,-7.62,3752000,false,true,false,false,true,false,null,2,'port','Moroccan economic capital; Port of Casablanca; Abraham Accords participant'),
('Accra','Ghana','GH','Africa',5.56,-0.20,2514000,true,false,false,false,false,false,null,2,'capital','Ghanaian capital; stable democracy; West Africa''s gold hub'),
('Dakar','Senegal','SN','Africa',14.72,-17.47,3137196,true,false,false,false,true,false,null,2,'port','Senegalese capital; westernmost Africa port; French military base'),
('Djibouti City','Djibouti','DJ','Africa',11.59,43.15,623891,true,false,true,false,true,false,null,1,'military','US Camp Lemonnier; French base; Chinese first overseas naval base; Bab-el-Mandeb'),

-- AUSTRALIA / PACIFIC
('Canberra','Australia','AU','Australia',-35.28,149.13,462213,true,false,true,false,false,false,null,2,'capital','Australian capital; Five Eyes; Pine Gap NSA facility; AUKUS partner'),
('Sydney','Australia','AU','Australia',-33.87,151.21,5312437,false,true,false,false,true,false,null,2,'financial','Australian financial hub; ASX; major Pacific naval port'),
('Melbourne','Australia','AU','Australia',-37.81,144.96,5031195,false,true,false,false,false,false,null,2,'financial','Australian second city; ASX presence; university & defense industry'),
('Wellington','New Zealand','NZ','Australia',-41.29,174.78,215100,true,false,false,false,false,false,null,2,'capital','NZ capital; Five Eyes; ANZUS treaty; Pacific island policy hub'),
('Auckland','New Zealand','NZ','Australia',-36.85,174.76,1657200,false,true,false,false,true,false,null,2,'port','NZ financial hub; Pacific maritime hub'),
('Port Moresby','Papua New Guinea','PG','Australia',-9.45,147.19,364145,true,false,false,false,false,false,null,2,'capital','PNG capital; US/Australian strategic interest; China influence contest'),
('Suva','Fiji','FJ','Australia',-18.14,178.44,93970,true,false,false,false,false,false,null,2,'capital','Fijian capital; Pacific Islands Forum HQ; China-Taiwan soft power contest'),
('Honolulu','United States','US','Australia',21.31,-157.86,347397,false,false,true,false,true,false,null,1,'military','INDOPACOM HQ; Pearl Harbor naval base; Pacific command nerve center')

ON CONFLICT DO NOTHING;

-- ─── SEED: COUNTRIES ─────────────────────────────────────────

INSERT INTO countries (iso2,iso3,name,continent,capital,lat,lng,population,gdp_billions,mil_spend_billions,nuclear_armed,nato_member,un_p5,sanctions_subject,conflict_active,strategic_tier) VALUES
('US','USA','United States','North America','Washington DC',38.89,-77.04,335000000,27360,877,true,true,true,false,false,1),
('CN','CHN','China','Asia','Beijing',39.91,116.39,1412000000,17700,296,true,false,true,false,false,1),
('RU','RUS','Russia','Europe','Moscow',55.76,37.62,144000000,2240,86,true,false,true,true,true,1),
('GB','GBR','United Kingdom','Europe','London',51.51,-0.13,67000000,3090,69,true,true,true,false,false,1),
('FR','FRA','France','Europe','Paris',48.85,2.35,68000000,2780,54,true,true,true,false,false,1),
('DE','DEU','Germany','Europe','Berlin',52.52,13.40,84000000,4430,66,false,true,false,false,false,1),
('JP','JPN','Japan','Asia','Tokyo',35.69,139.69,124000000,4410,44,false,false,false,false,false,1),
('IN','IND','India','Asia','New Delhi',28.61,77.21,1428000000,3550,83,true,false,false,false,false,1),
('KR','KOR','South Korea','Asia','Seoul',37.57,126.98,52000000,1710,46,false,false,false,false,false,2),
('IL','ISR','Israel','Middle East','Jerusalem',31.78,35.22,9700000,525,24,true,false,false,false,true,2),
('SA','SAU','Saudi Arabia','Middle East','Riyadh',24.69,46.72,35000000,1100,75,false,false,false,false,false,2),
('TR','TUR','Turkey','Europe','Ankara',39.93,32.86,85000000,1155,26,false,true,false,false,false,2),
('IR','IRN','Iran','Middle East','Tehran',35.69,51.39,87000000,401,10,false,false,false,true,true,2),
('KP','PRK','North Korea','Asia','Pyongyang',39.02,125.75,25990000,30,4,true,false,false,true,false,2),
('PK','PAK','Pakistan','Asia','Islamabad',33.72,73.04,231000000,340,10,true,false,false,false,true,2),
('UA','UKR','Ukraine','Europe','Kyiv',50.45,30.52,37000000,178,11,false,false,false,false,true,1),
('BR','BRA','Brazil','South America','Brasilia',-15.78,-47.93,215000000,2080,20,false,false,false,false,false,2),
('AU','AUS','Australia','Australia','Canberra',-35.28,149.13,26000000,1690,32,false,false,false,false,false,2),
('CA','CAN','Canada','North America','Ottawa',45.42,-75.69,38000000,2140,27,false,true,false,false,false,2),
('MX','MEX','Mexico','North America','Mexico City',19.43,-99.13,128000000,1327,9,false,false,false,false,false,2),
('IT','ITA','Italy','Europe','Rome',41.90,12.50,59000000,2170,33,false,true,false,false,false,2),
('PL','POL','Poland','Europe','Warsaw',52.23,21.01,38000000,748,32,false,true,false,false,false,2),
('SE','SWE','Sweden','Europe','Stockholm',59.33,18.07,10000000,598,12,false,true,false,false,false,2),
('NO','NOR','Norway','Europe','Oslo',59.91,10.75,5400000,579,9,false,true,false,false,false,2),
('BY','BLR','Belarus','Europe','Minsk',53.90,27.56,9400000,70,1,false,false,false,true,false,2),
('SY','SYR','Syria','Middle East','Damascus',33.51,36.29,22000000,60,1,false,false,false,true,true,2),
('IQ','IRQ','Iraq','Middle East','Baghdad',33.34,44.40,42000000,264,4,false,false,false,false,true,2),
('YE','YEM','Yemen','Middle East','Sanaa',15.35,44.21,34000000,21,1,false,false,false,false,true,2),
('LY','LBY','Libya','Africa','Tripoli',32.90,13.18,7000000,44,1,false,false,false,false,true,2),
('SD','SDN','Sudan','Africa','Khartoum',15.55,32.53,46000000,28,1,false,false,false,false,true,2),
('ET','ETH','Ethiopia','Africa','Addis Ababa',9.03,38.74,124000000,156,1,false,false,false,false,true,2),
('VE','VEN','Venezuela','South America','Caracas',10.48,-66.88,29000000,92,2,false,false,false,true,false,2),
('CU','CUB','Cuba','North America','Havana',23.13,-82.38,11000000,107,1,false,false,false,true,false,2),
('SG','SGP','Singapore','Asia','Singapore',1.35,103.82,5900000,497,12,false,false,false,false,false,2),
('AE','ARE','UAE','Middle East','Abu Dhabi',24.45,54.37,10000000,507,22,false,false,false,false,false,2),
('QA','QAT','Qatar','Middle East','Doha',25.29,51.53,3000000,235,3,false,false,false,false,false,2),
('TW','TWN','Taiwan','Asia','Taipei',25.03,121.56,23000000,785,19,false,false,false,false,false,1),
('GE','GEO','Georgia','Europe','Tbilisi',41.69,44.83,3700000,26,1,false,false,false,false,true,3),
('AZ','AZE','Azerbaijan','Europe','Baku',40.41,49.87,10000000,78,3,false,false,false,false,false,3),
('KZ','KAZ','Kazakhstan','Asia','Astana',51.18,71.45,19000000,261,3,false,false,false,false,false,3),
('NG','NGA','Nigeria','Africa','Abuja',9.07,7.40,220000000,477,5,false,false,false,false,true,2),
('ZA','ZAF','South Africa','Africa','Pretoria',-25.74,28.18,60000000,405,5,false,false,false,false,false,2),
('EG','EGY','Egypt','Africa','Cairo',30.06,31.25,105000000,475,5,false,false,false,false,false,2),
('AF','AFG','Afghanistan','Asia','Kabul',34.53,69.17,40000000,15,0,false,false,false,true,true,2)

ON CONFLICT DO NOTHING;

-- ─── SEED: REGIONS ───────────────────────────────────────────

INSERT INTO regions (name,type,lat,lng,radius_km,description,threat_level,active) VALUES
('South China Sea','conflict_zone',15.0,114.0,1200,'Disputed waters; China island-building; FONOPS; Taiwan invasion route','critical',true),
('Taiwan Strait','conflict_zone',24.5,120.5,250,'189km strait; PLA military exercises; China reunification flashpoint','critical',true),
('Korean Peninsula','conflict_zone',37.5,127.5,500,'DPRK nuclear/ICBM program; 28,500 US troops; DMZ stalemate','critical',true),
('Persian Gulf','chokepoint',26.5,53.5,600,'40% world oil transit; Strait of Hormuz; Iran vs US-Gulf coalition','critical',true),
('Strait of Hormuz','chokepoint',26.6,56.3,150,'21M barrels/day oil chokepoint; Iran seizure threat; tanker incidents','critical',true),
('Suez Canal Zone','chokepoint',30.4,32.3,200,'12% world trade; 2021 Ever Given; Egypt control; Houthi Red Sea threat','high',true),
('Red Sea / Bab-el-Mandeb','conflict_zone',13.5,43.5,500,'Houthi missile/drone attacks on shipping since Oct 2023; US-UK strikes','critical',true),
('Eastern Ukraine / Donbas','conflict_zone',48.5,37.5,400,'Active war zone; Russia occupation of ~20% Ukrainian territory; trench warfare','critical',true),
('Gaza Strip','conflict_zone',31.35,34.35,50,'Active Israel-Hamas conflict since Oct 7 2023; humanitarian crisis; 2.3M civilians','critical',true),
('Lebanon-Israel Border','conflict_zone',33.2,35.5,150,'Hezbollah-Israel exchange; IDF operations; UNIFIL presence; escalation risk','high',true),
('NATO Eastern Flank','alliance_bloc',54.0,25.0,800,'Baltic states + Poland; 300k+ NATO troops; Russia threat; Article 5 tripwire','high',true),
('Arctic Circle','strategic_zone',75.0,30.0,2000,'Melting ice opens new routes; Russia Arctic buildup; NATO-Russia competition','elevated',true),
('Black Sea','strategic_zone',43.0,34.0,600,'Russia Black Sea Fleet; Ukraine naval drones; Bosphorus chokepoint; grain exports','high',true),
('Baltic Sea','strategic_zone',58.0,20.0,500,'New NATO members Finland/Sweden; Russian Kaliningrad exclave; undersea cables','high',true),
('Sahel Region','conflict_zone',14.0,2.0,1500,'Wagner/Africa Corps presence; coup belt (Mali/Niger/Burkina); France withdrawal; jihadist expansion','high',true),
('Horn of Africa','conflict_zone',8.0,46.0,800,'Al-Shabaab; Somalia conflict; Djibouti foreign bases; Eritrea-Ethiopia tension','high',true),
('Kashmir','conflict_zone',34.0,75.5,300,'India-Pakistan nuclear-armed dispute; LoC violations; terrorism; Article 370 revocation','elevated',true),
('Strait of Malacca','chokepoint',2.5,101.5,400,'40% global trade; 80% Asian oil imports; piracy history; China chokepoint anxiety','elevated',true),
('Eastern Mediterranean','strategic_zone',35.0,31.0,700,'Gas field disputes (Turkey/Greece/Cyprus/Israel/Lebanon); NATO tensions; Russia naval access','elevated',true),
('West Africa Gulf of Guinea','strategic_zone',3.0,2.0,800,'Piracy hotspot; Nigerian oil; French military drawdown; Chinese port investment','elevated',true),
('Xinjiang','conflict_zone',41.0,87.0,800,'Uyghur detention; genocide allegations; Belt and Road hub; Russia/Central Asia pipeline','high',true),
('Venezuela-Guyana Border','conflict_zone',6.5,-61.5,300,'Venezuela claims Essequibo (2/3 of Guyana); oil discovery; military posturing 2023','elevated',true),
('Mozambique Channel','chokepoint',-17.0,40.0,500,'LNG development; ISIS-linked insurgency; strategic Africa-Europe sea lane','elevated',true),
('Caucasus','conflict_zone',41.5,44.5,400,'Armenia-Azerbaijan; Nagorno-Karabakh; Russia-Georgia tension; South Ossetia','elevated',true),
('Philippine Sea','strategic_zone',15.0,130.0,1000,'US-China military competition; Guam defense perimeter; carrier operations','high',true)

ON CONFLICT DO NOTHING;
