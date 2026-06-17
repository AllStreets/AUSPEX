-- Migration: add US cities (West Coast, military, financial hubs)
-- Safe to run against existing data — uses ON CONFLICT DO NOTHING

INSERT INTO cities (name,country,iso2,continent,lat,lng,population,is_capital,is_financial,is_military,is_conflict,is_port,is_energy,gdp_billions,strategic_tier,icon_type,notes) VALUES
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
('Philadelphia','United States','US','North America',39.95,-75.16,1603797,false,false,false,false,true,false,NULL,3,'port','Philadelphia Naval Yard legacy; Delaware River port; pharma hub')
ON CONFLICT DO NOTHING;
