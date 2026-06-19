// ═══════════════════════════════════════════
// AUSPEX · NEWS JUNK FILTER (canonical, shared)
// One predicate, used server-side (worker/news.js) AND mirrored in the
// browser pipeline (js/news.js). Drops advertisements, PR/marketing fluff,
// and pop-culture / celebrity / entertainment noise — WITHOUT dropping
// legitimate news.
//
// Accuracy rule: PRIORITY_RE (hard geopolitical / economic / disaster /
// science / health signals) OVERRIDES junk so genuine stories are never
// dropped. We deliberately use specific MULTI-WORD ad/PR/pop phrases rather
// than broad single words, so legitimate uses of "deal" (trade/peace/nuclear
// deal), "launch" (missile/rocket/policy launch), "record" (record drought),
// "star" (a real person/country) do NOT trigger removal.
// ═══════════════════════════════════════════

// Hard-signal allowlist. If a story matches this, it is KEPT no matter what.
export const PRIORITY_RE = /\b(war|warfare|military|troops?|missile|drone strike|airstrike|nuclear|nato|sanctions?|election|coup|protest|invasion|ceasefire|parliament|president|prime minister|secretary of state|foreign minister|geopolit|diplomacy|terrorism|insurgency|conflict|crisis|threat|intelligence|espionage|submarine|aircraft carrier|destroyer|battalion|casualt|offensive|siege|blockade|escalat|deescalat|treaty|bilateral|summit|security council|un resolution|iaea|pentagon|kremlin|white house|state department|tariff|inflation|interest rate|recession|gdp|central bank|federal reserve|\bfed\b|supreme court|earthquake|hurricane|wildfire|flood|drought|famine|outbreak|pandemic|epidemic|vaccine|wildfire|tsunami|eruption|refinery|pipeline|oil price|gas price|rocket launch|space launch|satellite|spacex|nasa|cyberattack|data breach|genocide|refugee|humanitarian|aid convoy|hostage|drought|climate)\b/i;

// Junk denylist. Specific multi-word ad/PR/pop phrases.
export const JUNK_RE = new RegExp([
  // ── Pop-culture / celebrity / entertainment ──
  '\\b(celebrit(y|ies)|kardashian|taylor swift|beyonc[eé]|grammy|box office|movie review|',
  'film review|album review|netflix series|hulu|disney\\+|spotify playlist|tiktok|',
  'viral video|social media trend|influencer|reality tv|reality show|bachelor|',
  'bachelorette|america\'?s got talent|dancing with the stars|the voice|american idol|',
  'survivor cast|big brother|drag race|met gala|golden globe|emmys|oscars ceremony|',
  'red carpet|celebrity couple|celebrity death|actor arrested|pop star|royal family|',
  'meghan markle|prince harry|kardashians|kanye|kim kardashian|fans react|',
  'fan theory|first look|season finale|series finale|episode recap|show recap|',
  'streaming recap|horoscope|zodiac|astrology|red carpet|premiere|reunites?|',
  'reunion special|tour dates|sold[ -]out tour|new album|new single|music video|',
  'voice of (lilo|[a-z]+ in)|disney(\'?s| movie| film| channel)|pixar|',
  'hbo (max|series)|sitcom|tv host|talk show host|',
  'sequel (in the works|with|to)|spin[ -]?off series|',
  '(show|series|season \\d+) (renewed|cancell?ed|premiere|recap)|',
  'season \\d+ (premiere|finale|recap|trailer|episode)|',
  'questions (and demands )?we have for|jim carrey|jelly roll)\\b',
  // ── Gaming / consumer tech ──
  '|\\b(video game|game release|esport|fortnite|minecraft|roblox|playstation|xbox|',
  'nintendo|steam sale|gaming headset|twitch stream|call of duty|league of legends|',
  'overwatch|valorant|genshin|pokemon|zelda|mario|game review|gaming news|new game|',
  'rpg release|console launch|pc gaming|street fighter|dlc character|dlc pack|',
  'dlc release|game dlc|fighting game|jrpg|mmorpg|grand theft auto|gta online|',
  'gta vi|pre-?order date|cover art revealed|product review|unboxing|best buy|',
  'iphone 1[0-9]|macbook air|samsung galaxy s|new phone release|smartwatch review|',
  'gadget roundup|wearable tech review|home theater|soundbar|headphones review|',
  'earbuds|laptop review|tablet review|5g phone|best laptop|best phone|',
  'more color options)\\b|nintendo|buzzfeed',
  // ── Sports (scores / trades / results) ──
  '|\\b(nba (game|trade|dunk|mvp|draft|coach|championship|parade|finals?)|',
  'nfl (game|draft|trade|touchdown|coach|week)|mlb (game|trade|batting)|',
  'nhl (game|trade|goal)|premier league (goal|match|result|transfer)|la liga|',
  'bundesliga match|serie a match|cricket match|golf round|tennis match|',
  'f1 race result|superbowl ad|super bowl commercial|march madness|ncaa bracket|',
  'fantasy football|fantasy sports|sports betting odds|monday night football|',
  'college world series|world cup( \\d{4})? (match|win|loss|opener|group stage)|',
  'champions league (goal|match)|mock draft|',
  '(game|match) (analysis|recap|preview|highlights|report)|',
  'usmnt|uswnt|pochettino|pulisic|ronaldo|messi|lebron|',
  'transfer (rumou?r|window|news|deadline)|',
  'home run|touchdown|hat[ -]trick|playoff (win|loss|game))\\b',
  // ── Lifestyle listicle filler ──
  '|\\b(recipe|restaurant review|best restaurants|food trend|fashion week|',
  'beauty routine|skincare routine|home decor trend|interior design|travel tips|',
  'hotel review|vacation guide|celebrity diet|workout routine|fitness tips|',
  'meal prep|keto|intermittent fasting|abs workout|listicle|tier list|freakin|',
  'mind-blowing facts|cool facts|fun facts)\\b',
  // ── Advertisements / commerce ──
  '|\\b(deal of the day|deals? of the (week|year)|prime day|amazon sale|black friday|',
  'cyber monday|% off|\\d+ percent off|coupon code|promo code|discount code|',
  'shop now|buy now|on sale now|save up to|gift guide|best (gifts|deals|products) of \\d{4}|',
  'limited time offer|flash sale|clearance sale|affiliate link|sponsored content|',
  'sponsored post|advertorial|free shipping|lowest price|markdown|',
  'today\'?s best deals|earn special rewards|exclusive offer)\\b',
  // ── PR / marketing fluff ──
  '|\\b(is proud to announce|are proud to announce|proudly announces|',
  'announces (a )?(new )?partnership|announces? collaboration|press release|',
  'ribbon[ -]cutting|unveils new (gadget|phone|app|product|lineup|collection)|',
  'named (a )?(top|best) (workplace|employer)|wins (award|recognition)|',
  'award[ -]winning|recognized as|honored (with|for)|',
  'celebrates? milestone|launches new product|new product launch|',
  'now available for purchase|product roadmap unveiled|',
  '[a-z]+preneur|solopreneur|introduces? a [a-z ]+ operating system|',
  'webinar series|free webinar|register (now |today )?for (our|the) webinar|',
  '(concert|album|gig|residency|setlist) review|turned [a-z ]+ into a [a-z ]+: review)\\b',
].join(''), 'i');

// True when the story is junk (and not rescued by a priority signal).
// Pass the combined title + description + source string.
export function isJunk(text) {
  if (!text) return false;
  if (PRIORITY_RE.test(text)) return false; // legitimate news is never junk
  return JUNK_RE.test(text);
}

// Convenience for arrays of { title, description, source } articles.
export function filterJunkArticles(articles) {
  return (articles || []).filter((a) => {
    const src = typeof a.source === 'string' ? a.source : (a.source && a.source.name) || '';
    return !isJunk(`${a.title || ''} ${a.description || ''} ${src}`);
  });
}
