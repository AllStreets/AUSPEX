'use strict';

// ═══════════════════════════════════════════════════════════════════════
// THREE MIRRORS — per-story bias x-ray.
// Reads any story through the world's media spheres at once and shows, honestly:
// what they ALL agree on (the facts), how each FRAMES it, and what each OMITS.
// This is AUSPEX's thesis made literal — the least-biased view is the one that
// shows you every mirror at once. Reuses DIV_SOURCES (sphere→outlets) + callOpenAI.
// ═══════════════════════════════════════════════════════════════════════

const MIR_SPHERES = [
  { id: 'western', label: 'WESTERN',     color: '#0A84FF',
    names: (typeof DIV_SOURCES !== 'undefined' && DIV_SOURCES.western && DIV_SOURCES.western.names) || ['Reuters','AP','BBC','Guardian','FT','NYT','WSJ','Bloomberg','CNN','NPR','Politico','Axios','WIRED'] },
  { id: 'chinese', label: 'CHINESE',     color: '#FF2D55',
    names: (typeof DIV_SOURCES !== 'undefined' && DIV_SOURCES.chinese && DIV_SOURCES.chinese.names) || ['Xinhua','CGTN','Global Times','China Daily','SCMP','South China Morning Post','Caixin'] },
  { id: 'russian', label: 'RUSSIAN',     color: '#FF9F0A',
    names: (typeof DIV_SOURCES !== 'undefined' && DIV_SOURCES.russian && DIV_SOURCES.russian.names) || ['RT','TASS','Interfax','RIA','Sputnik','Novosti'] },
  { id: 'arab',    label: 'ARAB · MENA', color: '#34D399',
    names: ['Al Jazeera','Al Arabiya','Middle East Eye','TRT','The National','Arab News'] },
];
const _MIR_STOP = new Set('the a an and or of to in on for with from this that these those is are was were be been has have had will would could should it its as at by we they their our you your he she his her not but who what when where why how amid over into out up down off about after before than then them his has are us un new news say says said report reports'.split(' '));
let _mirEl = null, _mirCache = {};

function _mirKeywords(s) {
  const txt = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
  const words = (txt.match(/[a-z][a-z'-]{3,}/g) || []).filter(w => !_MIR_STOP.has(w));
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 8);
}
function _mirMatch(src, names) {
  const s = (src || '').toLowerCase();
  return names.some(n => s.includes(n.toLowerCase()) || n.toLowerCase().includes(s));
}
// Real coverage of THIS topic by each sphere, pulled from the live feed.
function _mirCoverage(story) {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const kw = _mirKeywords(story);
  const out = {};
  for (const sp of MIR_SPHERES) {
    const hits = news.filter(s => s.id !== story.id && _mirMatch(s.src, sp.names) &&
      kw.some(k => (`${s.title || ''} ${s.summary || ''}`.toLowerCase()).includes(k)))
      .slice(0, 4)
      .map(s => ({ title: s.title, src: s.src }));
    out[sp.id] = hits;
  }
  return { kw, out };
}

function _mirPanel() {
  if (_mirEl) return _mirEl;
  const bd = document.createElement('div');
  bd.id = 'mir-bd';
  bd.addEventListener('click', closeMirrors);
  const p = document.createElement('div');
  p.id = 'mir-panel';
  document.body.appendChild(bd);
  document.body.appendChild(p);
  _mirEl = p;
  return p;
}
function closeMirrors() {
  if (_mirEl) _mirEl.classList.remove('on');
  const bd = document.getElementById('mir-bd'); if (bd) bd.classList.remove('on');
}
function openMirrorsFromArticle() {
  if (typeof _apStoryId === 'undefined' || _apStoryId == null) return;
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const story = news.find(s => s.id === _apStoryId);
  if (story) openMirrors(story);
}

function _mirShell(story, inner) {
  return `
    <div class="mir-hdr">
      <div class="mir-hdr-l">
        <div class="mir-eyebrow">◆ THREE MIRRORS · bias x-ray</div>
        <div class="mir-title">${(story.title || '').replace(/</g, '&lt;')}</div>
      </div>
      <button class="mir-close" onclick="closeMirrors()">×</button>
    </div>
    <div class="mir-scroll">${inner}</div>
    <div class="mir-foot">AUSPEX reads every mirror at once · framing is interpretation, not fact · ${(typeof aiEnabled === 'function' && aiEnabled()) ? 'AI-synthesised, unconfirmed' : 'AI offline'}</div>`;
}

async function openMirrors(story) {
  const p = _mirPanel();
  document.getElementById('mir-bd').classList.add('on');
  p.classList.add('on');

  if (typeof aiEnabled !== 'function' || !aiEnabled()) {
    p.innerHTML = _mirShell(story, `<div class="mir-empty">The bias x-ray needs the AUSPEX AI, which is unavailable here. It works on the live deployment.</div>`);
    return;
  }
  p.innerHTML = _mirShell(story, `<div class="mir-load"><span class="mir-spin"></span>Reading this story through ${MIR_SPHERES.length} mirrors…</div>`);

  const cov = _mirCoverage(story);
  if (_mirCache[story.id]) { p.innerHTML = _mirShell(story, _mirRender(_mirCache[story.id], cov)); return; }

  const covLines = MIR_SPHERES.map(sp => {
    const hits = cov.out[sp.id];
    return `${sp.label}: ${hits.length ? hits.map(h => `"${h.title}" (${h.src})`).join(' | ') : '(no matching coverage in the live feed)'}`;
  }).join('\n');

  const sys = 'You are AUSPEX\'s media-bias analyst — rigorously non-partisan. Given a news event and how different media spheres cover it, produce an honest x-ray of the coverage. Never take a side; describe how each side frames it. Be specific and concise. Output ONLY valid JSON.';
  const user = `EVENT:\nTitle: ${story.title}\nSummary: ${story.summary || ''}\n${story.body ? 'Detail: ' + String(story.body).slice(0, 700) : ''}\n\nHOW THE SPHERES ARE COVERING IT (from the live feed; may be sparse):\n${covLines}\n\nDefine a single framing AXIS with two opposing poles for THIS story, then place each sphere on it (0 = fully the left pole, 100 = fully the right pole). Return JSON exactly:\n{\n "poles": ["left-pole framing in 2-4 words", "right-pole framing in 2-4 words"],\n "agreed": ["the core facts all/most sides accept — 2 to 4 short bullets"],\n "spheres": {\n   "western": {"framing":"one sentence on the Western framing/emphasis","tone":"one or two words","lean": 0-100 or null if no coverage},\n   "chinese": {"framing":"...","tone":"...","lean": 0-100 or null},\n   "russian": {"framing":"...","tone":"...","lean": 0-100 or null},\n   "arab": {"framing":"...","tone":"...","lean": 0-100 or null}\n },\n "omitted": ["what tends to be under-reported or left out — 1 to 3 short bullets"],\n "note": "one calm sentence on how far the framing diverges and why awareness matters"\n}`;

  let data = null;
  try {
    const raw = await callOpenAI(sys, user, 900);
    data = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
  } catch (e) {
    p.innerHTML = _mirShell(story, `<div class="mir-empty">The mirrors couldn't be read just now. Try again in a moment.</div>`);
    return;
  }
  _mirCache[story.id] = data;
  p.innerHTML = _mirShell(story, _mirRender(data, cov));
}

function _mesc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function _mirRender(d, cov) {
  const poles = Array.isArray(d.poles) ? d.poles : ['', ''];
  const agreed = (d.agreed || []).map((x, i) => `<li><i class="mir-num">${i + 1}</i>${_mesc(x)}</li>`).join('');
  const omitted = (d.omitted || []).map(x => `<li>${_mesc(x)}</li>`).join('');

  // Framing spectrum — each sphere placed by its lean. Labels alternate above/below
  // so they don't collide. This is the signature: divergence you can SEE.
  const nodes = MIR_SPHERES.map((sp, i) => {
    const s = (d.spheres && d.spheres[sp.id]) || {};
    if (s.lean == null || isNaN(+s.lean)) return '';
    const lean = Math.max(3, Math.min(97, +s.lean));
    return `<div class="mir-node ${i % 2 ? 'dn' : 'up'}" style="left:${lean}%;--mc:${sp.color}">
      <b class="mir-node-lbl">${sp.label}</b><span class="mir-node-dot"></span></div>`;
  }).join('');

  // Mirror entries — editorial rows, not tiles: a heavy colour rule, the sphere in
  // its own colour, the framing in display serif, real headlines as mono citations.
  const rows = MIR_SPHERES.map(sp => {
    const s = (d.spheres && d.spheres[sp.id]) || {};
    const hits = (cov.out[sp.id] || []).slice(0, 2)
      .map(h => `<div class="mir-cite">↳ “${_mesc(h.title)}” <span>${_mesc(h.src)}</span></div>`).join('');
    return `<div class="mir-row" style="--mc:${sp.color}">
      <div class="mir-row-hd"><span class="mir-row-name">${sp.label}</span>${s.tone ? `<span class="mir-row-tone">${_mesc(String(s.tone).toUpperCase())}</span>` : ''}</div>
      <div class="mir-row-frame">${_mesc(s.framing || '—')}</div>
      ${hits ? `<div class="mir-cites">${hits}</div>` : `<div class="mir-cite mir-cite-none">↳ no matching coverage in the live feed</div>`}
    </div>`;
  }).join('');

  return `
    <section class="mir-consensus">
      <div class="mir-prism"></div>
      <div class="mir-cap">CONSENSUS — what every mirror shows</div>
      <ol class="mir-facts">${agreed || '<li>—</li>'}</ol>
    </section>
    <section class="mir-spectrum">
      <div class="mir-cap">FRAMING SPECTRUM — where each mirror stands</div>
      <div class="mir-axis">
        <div class="mir-axis-track">${nodes}</div>
      </div>
      <div class="mir-poles"><span>◄ ${_mesc(poles[0] || 'one framing')}</span><span>${_mesc(poles[1] || 'the other')} ►</span></div>
    </section>
    <section class="mir-mirrors">${rows}</section>
    <section class="mir-blindspot">
      <div class="mir-cap">THE BLIND SPOT — what tends to be left out</div>
      <ul class="mir-facts mir-omit">${omitted || '<li>—</li>'}</ul>
    </section>
    ${d.note ? `<div class="mir-note">“${_mesc(d.note)}”</div>` : ''}`;
}

// Inject the entry button into the article reading panel once the DOM is ready.
function _mirInjectButton() {
  const relief = document.getElementById('ap-relief-btn');
  if (!relief || document.getElementById('ap-mirrors-btn')) return;
  const b = document.createElement('button');
  b.id = 'ap-mirrors-btn';
  b.setAttribute('onclick', 'openMirrorsFromArticle()');
  b.innerHTML = '◆ THREE MIRRORS';
  b.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:9px 16px;margin-left:8px;background:rgba(110,138,255,.06);border:1px solid rgba(110,138,255,.22);border-radius:3px;font-family:var(--f-mono);font-size:10px;color:rgba(110,138,255,.85);letter-spacing:.08em;cursor:pointer;transition:all .18s';
  b.onmouseover = () => { b.style.background = 'rgba(110,138,255,.14)'; b.style.borderColor = 'rgba(110,138,255,.5)'; b.style.color = '#8AA0FF'; };
  b.onmouseout = () => { b.style.background = 'rgba(110,138,255,.06)'; b.style.borderColor = 'rgba(110,138,255,.22)'; b.style.color = 'rgba(110,138,255,.85)'; };
  relief.insertAdjacentElement('afterend', b);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _mirInjectButton);
else _mirInjectButton();
