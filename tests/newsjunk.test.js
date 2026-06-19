import { describe, it, expect } from 'vitest';
import { isJunk, filterJunkArticles, PRIORITY_RE, JUNK_RE } from '../src/newsjunk.js';

describe('isJunk — drops advertisements / commerce', () => {
  const ads = [
    'Deal of the Day: Save up to 60% off on wireless earbuds',
    'Black Friday and Cyber Monday: today\'s best deals on laptops',
    'Best gifts of 2026: the ultimate holiday gift guide',
    'Shop now and use this promo code for free shipping',
    'Earn Special Rewards in GTA Online with the Fine Art Collector Program',
  ];
  ads.forEach((t) => it(`drops "${t.slice(0, 40)}..."`, () => expect(isJunk(t)).toBe(true)));
});

describe('isJunk — drops PR / marketing fluff', () => {
  const pr = [
    'Acme Corp is proud to announce a new partnership with Globex',
    'Widget Inc unveils new phone lineup at flashy launch event',
    'Local startup wins award for best workplace, hosts ribbon-cutting',
    'Press release: Vendor named a top employer for third year running',
    'Webinar Series Introduces New Auto Supplier Transition Program for manufacturers',
  ];
  pr.forEach((t) => it(`drops "${t.slice(0, 40)}..."`, () => expect(isJunk(t)).toBe(true)));
});

describe('isJunk — drops pop-culture / celebrity / sports noise', () => {
  const pop = [
    'Knicks parade celebrates NBA Championship win in Manhattan',
    'College World Series delivers more magic during home run',
    'Grand Theft Auto VI Pre-Order Date And Cover Art Revealed',
    "Daveigh Chase, star of 'The Ring' and the voice of Lilo in Disney's 'Lilo & Stitch,' dies at 35",
    'What went wrong for Cristiano Ronaldo in his first World Cup 2026 match?',
    'Google Calendar finally has more color options for events',
    'Fans react as season finale leaves a massive cliffhanger',
    'Your weekly horoscope: what the zodiac says about love',
    "Secret list of celebrities attending billionaire's invite-only society about sex and cults",
  ];
  pop.forEach((t) => it(`drops "${t.slice(0, 40)}..."`, () => expect(isJunk(t)).toBe(true)));
});

describe('isJunk — KEEPS legitimate news (accuracy / no over-filtering)', () => {
  const legit = [
    'World reacts to US-Iran deal to extend ceasefire, reopen Strait of Hormuz',
    'Mortgage rates dropped this week as Iran peace deal took shape',
    'Record drought grips the Horn of Africa as famine warnings mount',
    'SpaceX rocket launch delivers spy satellite to orbit for Pentagon',
    'U.S. moves toward troop reductions in Europe as Hegseth scolds NATO allies',
    'Supreme Court sides with Texas man over gun rights challenge',
    'Russia\'s nuclear-powered Skyfall missile is dirty and dangerous, report says',
    'Dangerous fault lines in California at highest pressure in 1,000 years',
    'New trade deal between EU and Mercosur reshapes tariffs',
    'Central bank holds interest rates as inflation cools',
    'World Cup host nation faces protests over stadium costs',
    'Plague outbreak research: hunter-gatherers died 5,500 years ago',
    'Celebrities raise millions for refugees fleeing the war',
  ];
  legit.forEach((t) => it(`keeps "${t.slice(0, 40)}..."`, () => expect(isJunk(t)).toBe(false)));
});

describe('PRIORITY_RE overrides JUNK_RE', () => {
  it('a sponsored-sounding but geopolitical story is kept', () => {
    // contains "on sale now" (ad phrase) but also "sanction" (priority)
    const t = 'Oil futures on sale now? Sanctions reshape global crude markets';
    expect(JUNK_RE.test(t)).toBe(true);
    expect(PRIORITY_RE.test(t)).toBe(true);
    expect(isJunk(t)).toBe(false);
  });
});

describe('filterJunkArticles', () => {
  it('filters an array by title/description/source', () => {
    const arts = [
      { title: 'Deal of the Day: 50% off earbuds', description: '', source: 'Shop' },
      { title: 'NATO summit addresses escalating conflict', description: '', source: 'BBC' },
      { title: 'Celebrity couple announces red carpet reunion', description: '', source: 'Variety' },
    ];
    expect(filterJunkArticles(arts).map((a) => a.title)).toEqual([
      'NATO summit addresses escalating conflict',
    ]);
  });
});
