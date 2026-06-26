'use strict';

// ═══════════════════════════════════════════════════════════════════════
// BLINDSPOT + SOURCE PROVENANCE
// Provenance: who actually owns the outlet you're reading (state / public /
// private / nonprofit, country, lean) — shown inline under the byline.
// Blindspot: which media spheres are covering this story and which are SILENT —
// computed from the live feed (no AI), so you see what you're NOT being shown.
// Also hosts the shared lens-panel shell (lpOpen/lpClose) reused by Verify.
// ═══════════════════════════════════════════════════════════════════════

function _bsesc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function _bsflag(iso, h) { return iso ? `<img class="ap-prov-flag" src="https://flagcdn.com/${iso}.svg" alt="" loading="lazy" onerror="this.style.display='none'" style="height:${h || 11}px">` : ''; }

// ── Outlet ownership / funding reference. type: state|public|private|nonprofit.
const OUTLET_META = {
  'reuters':{iso:'gb',owner:'Thomson Reuters',type:'private',lean:'Centrist wire'},
  'associated press':{iso:'us',owner:'AP (member cooperative)',type:'nonprofit',lean:'Centrist wire'},
  'ap':{iso:'us',owner:'AP (member cooperative)',type:'nonprofit',lean:'Centrist wire'},
  'afp':{iso:'fr',owner:'Agence France-Presse',type:'public',lean:'Centrist wire'},
  'bbc':{iso:'gb',owner:'BBC (UK licence fee)',type:'public',lean:'Centre'},
  'the guardian':{iso:'gb',owner:'Scott Trust',type:'nonprofit',lean:'Centre-left'},
  'guardian':{iso:'gb',owner:'Scott Trust',type:'nonprofit',lean:'Centre-left'},
  'the new york times':{iso:'us',owner:'The New York Times Co.',type:'private',lean:'Centre-left'},
  'new york times':{iso:'us',owner:'The New York Times Co.',type:'private',lean:'Centre-left'},
  'nyt':{iso:'us',owner:'The New York Times Co.',type:'private',lean:'Centre-left'},
  'washington post':{iso:'us',owner:'Nash Holdings (J. Bezos)',type:'private',lean:'Centre-left'},
  'wall street journal':{iso:'us',owner:'News Corp (Murdoch)',type:'private',lean:'Centre-right'},
  'wsj':{iso:'us',owner:'News Corp (Murdoch)',type:'private',lean:'Centre-right'},
  'bloomberg':{iso:'us',owner:'Bloomberg L.P.',type:'private',lean:'Business / centre'},
  'financial times':{iso:'gb',owner:'Nikkei (Japan)',type:'private',lean:'Business / centre'},
  'ft':{iso:'gb',owner:'Nikkei (Japan)',type:'private',lean:'Business / centre'},
  'cnn':{iso:'us',owner:'Warner Bros. Discovery',type:'private',lean:'Centre-left'},
  'fox news':{iso:'us',owner:'Fox Corp (Murdoch)',type:'private',lean:'Right'},
  'npr':{iso:'us',owner:'NPR (member-funded)',type:'nonprofit',lean:'Centre-left'},
  'pbs':{iso:'us',owner:'PBS (public)',type:'public',lean:'Centre-left'},
  'cbs':{iso:'us',owner:'Paramount Global',type:'private',lean:'Centre-left'},
  'nbc':{iso:'us',owner:'Comcast / NBCUniversal',type:'private',lean:'Centre-left'},
  'abc news':{iso:'us',owner:'Disney',type:'private',lean:'Centre-left'},
  'politico':{iso:'us',owner:'Axel Springer (Germany)',type:'private',lean:'Centre'},
  'axios':{iso:'us',owner:'Cox Enterprises',type:'private',lean:'Centre'},
  'the hill':{iso:'us',owner:'Nexstar',type:'private',lean:'Centre'},
  'usa today':{iso:'us',owner:'Gannett',type:'private',lean:'Centre'},
  'wired':{iso:'us',owner:'Condé Nast',type:'private',lean:'Tech / centre-left'},
  'al jazeera':{iso:'qa',owner:'Qatar government',type:'state',lean:'Qatar state-funded'},
  'al arabiya':{iso:'sa',owner:'MBC / Saudi-linked',type:'state',lean:'Saudi-aligned'},
  'middle east eye':{iso:'gb',owner:'M.E.E. Ltd',type:'private',lean:'Pro-Qatar / critical'},
  'trt':{iso:'tr',owner:'Turkish government',type:'state',lean:'Turkey state'},
  'trt world':{iso:'tr',owner:'Turkish government',type:'state',lean:'Turkey state'},
  'xinhua':{iso:'cn',owner:'Chinese government',type:'state',lean:'CCP state media'},
  'cgtn':{iso:'cn',owner:'Chinese government (CCP)',type:'state',lean:'CCP state media'},
  'global times':{iso:'cn',owner:"People's Daily (CCP)",type:'state',lean:'State / nationalist'},
  'china daily':{iso:'cn',owner:'Chinese government',type:'state',lean:'CCP state media'},
  'scmp':{iso:'hk',owner:'Alibaba Group',type:'private',lean:'HK / pro-Beijing tilt'},
  'south china morning post':{iso:'hk',owner:'Alibaba Group',type:'private',lean:'HK / pro-Beijing tilt'},
  'rt':{iso:'ru',owner:'Russian government',type:'state',lean:'Kremlin state media'},
  'tass':{iso:'ru',owner:'Russian government',type:'state',lean:'Kremlin state media'},
  'sputnik':{iso:'ru',owner:'Russian government (Rossiya Segodnya)',type:'state',lean:'Kremlin state media'},
  'ria':{iso:'ru',owner:'Russian government',type:'state',lean:'Kremlin state media'},
  'interfax':{iso:'ru',owner:'Interfax (private, Moscow)',type:'private',lean:'Russia'},
  'dw':{iso:'de',owner:'German government-funded',type:'public',lean:'Centre'},
  'deutsche welle':{iso:'de',owner:'German government-funded',type:'public',lean:'Centre'},
  'france 24':{iso:'fr',owner:'France Médias Monde (state)',type:'public',lean:'Centre'},
  'euronews':{iso:'fr',owner:'Alpac Capital / EU-funded',type:'private',lean:'Centre'},
  'the times of india':{iso:'in',owner:'Bennett, Coleman & Co.',type:'private',lean:'Centre'},
  'times of india':{iso:'in',owner:'Bennett, Coleman & Co.',type:'private',lean:'Centre'},
  'the hindu':{iso:'in',owner:'The Hindu Group',type:'private',lean:'Centre-left'},
  'nikkei':{iso:'jp',owner:'Nikkei Inc.',type:'private',lean:'Business / centre'},
  'kyodo':{iso:'jp',owner:'Kyodo News (cooperative)',type:'nonprofit',lean:'Centrist wire'},
  'africanews':{iso:'cg',owner:'Euronews group',type:'private',lean:'Pan-African / centre'},
  'cna':{iso:'sg',owner:'Mediacorp (Singapore state-linked)',type:'state',lean:'Singapore'},
  'reliefweb':{iso:'us',owner:'UN OCHA',type:'public',lean:'Humanitarian (UN)'},
  'un news':{iso:'us',owner:'United Nations',type:'public',lean:'UN official'},
};
const TYPE_LABEL = { state:'STATE', public:'PUBLIC', private:'PRIVATE', nonprofit:'NONPROFIT' };

function outletMeta(src) {
  if (!src) return null;
  const s = String(src).toLowerCase().trim();
  if (OUTLET_META[s]) return OUTLET_META[s];
  // substring match (e.g. "Reuters UK" → reuters)
  for (const k in OUTLET_META) if (s.includes(k) || k.includes(s)) return OUTLET_META[k];
  return null;
}

// Inline provenance under the byline.
function renderProvenance(story) {
  const el = document.getElementById('ap-prov');
  if (!el) return;
  const m = outletMeta(story && story.src);
  if (!m) { el.className = 'ap-prov'; el.innerHTML = ''; return; }
  el.className = 'ap-prov on';
  el.innerHTML = `<span class="ap-prov-chip">${_bsflag(m.iso)} ${_bsesc(m.owner)}</span>`
    + `<span class="ap-prov-tag ${m.type}">${TYPE_LABEL[m.type] || m.type}</span>`
    + `<span class="ap-prov-lean">${_bsesc(m.lean)}</span>`;
}

// ── Shared lens-panel shell (also used by Verify) ──────────────────────────
let _lpEl = null;
function _lpEnsure() {
  if (_lpEl) return _lpEl;
  const bd = document.createElement('div'); bd.id = 'lp-bd'; bd.addEventListener('click', lpClose);
  const p = document.createElement('div'); p.id = 'lp-panel';
  document.body.appendChild(bd); document.body.appendChild(p);
  _lpEl = p; return p;
}
function lpShell(eyebrow, title, accent, body, foot) {
  return `<div class="lp-hdr"><div class="lp-hdr-l"><div class="lp-eyebrow" style="color:${accent}">${eyebrow}</div><div class="lp-title">${title}</div></div><button class="lp-close" onclick="lpClose()">×</button></div>`
    + `<div class="lp-scroll">${body}</div>` + (foot ? `<div class="lp-foot">${foot}</div>` : '');
}
function lpOpen(eyebrow, title, accent, body, foot) {
  const p = _lpEnsure();
  document.getElementById('lp-bd').classList.add('on'); p.classList.add('on');
  p.innerHTML = lpShell(eyebrow, title, accent, body, foot);
}
function lpSetBody(eyebrow, title, accent, body, foot) { if (_lpEl) _lpEl.innerHTML = lpShell(eyebrow, title, accent, body, foot); }
function lpClose() { if (_lpEl) _lpEl.classList.remove('on'); const bd = document.getElementById('lp-bd'); if (bd) bd.classList.remove('on'); }

// ── Coverage by sphere (no AI — counts in the live feed) ───────────────────
const _BS_STOP = new Set('the a an and or of to in on for with from this that those is are was were be been has have had will would could should it its as at by we they their our you your not but who what when where why how amid over into out up down off about after before than then them new news say says said report reports'.split(' '));
function _bsKeywords(s) {
  const txt = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
  const words = (txt.match(/[a-z][a-z'-]{3,}/g) || []).filter(w => !_BS_STOP.has(w));
  const freq = {}; for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 7);
}
function _bsSpheres() {
  return (typeof MIR_SPHERES !== 'undefined') ? MIR_SPHERES : [
    { id:'western', label:'WESTERN', color:'#0A84FF', names:['Reuters','AP','BBC','Guardian','NYT','CNN','Bloomberg','FT','NPR'] },
    { id:'chinese', label:'CHINESE', color:'#FF2D55', names:['Xinhua','CGTN','Global Times','China Daily','SCMP'] },
    { id:'russian', label:'RUSSIAN', color:'#FF9F0A', names:['RT','TASS','Interfax','RIA','Sputnik'] },
    { id:'arab', label:'ARAB · MENA', color:'#34D399', names:['Al Jazeera','Al Arabiya','Middle East Eye','TRT'] },
  ];
}
function _bsMatch(src, names) { const s = (src || '').toLowerCase(); return names.some(n => s.includes(n.toLowerCase()) || n.toLowerCase().includes(s)); }

function openBlindspotFromArticle() {
  if (typeof _apStoryId === 'undefined' || _apStoryId == null) return;
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const story = news.find(s => s.id === _apStoryId);
  if (story) openBlindspot(story);
}

const BS_ACCENT = '#FFB454';
const BS_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5 a8.5 8.5 0 0 1 0 17 Z" fill="currentColor" stroke="none"/></svg>';

function openBlindspot(story) {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const kw = _bsKeywords(story);
  const spheres = _bsSpheres();
  const counts = spheres.map(sp => {
    const n = news.filter(s => s.id !== story.id && _bsMatch(s.src, sp.names) &&
      kw.some(k => (`${s.title || ''} ${s.summary || ''}`.toLowerCase()).includes(k))).length;
    // count the source's own sphere coverage including this story
    return { sp, n: n + (_bsMatch(story.src, sp.names) ? 1 : 0) };
  });
  const max = Math.max(1, ...counts.map(c => c.n));
  const silent = counts.filter(c => c.n === 0).map(c => c.sp.label);
  const covered = counts.filter(c => c.n > 0);

  const bars = counts.map(({ sp, n }) => {
    const pct = Math.round((n / max) * 100);
    const isSilent = n === 0;
    return `<div class="bs-row" style="--mc:${sp.color}">
      <div class="bs-row-lbl">${sp.label}</div>
      <div class="bs-row-track"><span class="bs-row-fill" style="width:${isSilent ? 0 : Math.max(6, pct)}%"></span></div>
      <div class="bs-row-n">${n}</div>
      ${isSilent ? '<div class="bs-row-flag">BLIND SPOT</div>' : '<div class="bs-row-flag bs-row-ok"></div>'}
    </div>`;
  }).join('');

  let verdict, vclass;
  if (silent.length === 0) { verdict = 'Broadly covered — every sphere is reporting this. Compare how they frame it in MIRRORS.'; vclass = 'ok'; }
  else if (covered.length <= 1) { verdict = `This is a single-sphere story — carried mainly by ${covered[0] ? covered[0].sp.label : 'one outlet'} and largely absent elsewhere. Treat with extra scrutiny.`; vclass = 'warn'; }
  else { verdict = `Your blind spot: this story is largely unreported by ${silent.join(', ')} media. You are seeing only part of the picture.`; vclass = 'warn'; }

  const m = outletMeta(story.src);
  const sourceCard = m ? `
    <div class="bs-source">
      <div class="bs-source-flag">${_bsflag(m.iso, 22)}</div>
      <div class="bs-source-body">
        <div class="bs-source-name">${_bsesc(story.src)}</div>
        <div class="bs-source-meta"><span class="ap-prov-tag ${m.type}">${TYPE_LABEL[m.type] || m.type}</span> ${_bsesc(m.owner)} · ${_bsesc(m.lean)}</div>
      </div>
    </div>` : `
    <div class="bs-source">
      <div class="bs-source-body"><div class="bs-source-name">${_bsesc(story.src || 'Unknown source')}</div>
      <div class="bs-source-meta bs-source-unk">Ownership not in the provenance registry — verify independently.</div></div>
    </div>`;

  const body = `
    <section class="bs-sec">
      <div class="lp-cap">SOURCE — who is telling you this</div>
      ${sourceCard}
    </section>
    <section class="bs-sec" style="margin-top:42px">
      <div class="lp-cap">COVERAGE BALANCE — who is reporting it, who is silent</div>
      <div class="bs-bars">${bars}</div>
    </section>
    <div class="bs-verdict ${vclass}">${_bsesc(verdict)}</div>`;
  const foot = 'AUSPEX · coverage measured against the live multi-sphere feed · silence is a signal, not proof';
  lpOpen(`${BS_ICON} BLINDSPOT · who is silent`, _bsesc(story.title), BS_ACCENT, body, foot);
}
