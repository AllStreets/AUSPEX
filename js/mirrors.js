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
  const user = `EVENT:\nTitle: ${story.title}\nSummary: ${story.summary || ''}\n${story.body ? 'Detail: ' + String(story.body).slice(0, 700) : ''}\n\nHOW THE SPHERES ARE COVERING IT (from the live feed; may be sparse):\n${covLines}\n\nReturn JSON exactly:\n{\n "agreed": ["the core facts all/most sides would accept — 2 to 4 short bullets"],\n "spheres": {\n   "western": {"framing":"one sentence on the Western framing/emphasis","tone":"one or two words"},\n   "chinese": {"framing":"...","tone":"..."},\n   "russian": {"framing":"...","tone":"..."},\n   "arab": {"framing":"...","tone":"..."}\n },\n "omitted": ["what tends to go under-reported or be left out across the coverage — 1 to 3 short bullets"],\n "note": "one calm sentence on how much the framing diverges and why awareness matters"\n}`;

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

function _mirRender(d, cov) {
  const agreed = (d.agreed || []).map(x => `<li>${String(x).replace(/</g, '&lt;')}</li>`).join('');
  const omitted = (d.omitted || []).map(x => `<li>${String(x).replace(/</g, '&lt;')}</li>`).join('');
  const cards = MIR_SPHERES.map(sp => {
    const s = (d.spheres && d.spheres[sp.id]) || {};
    const hits = (cov.out[sp.id] || []).slice(0, 2).map(h => `<div class="mir-hl">“${h.title.replace(/</g, '&lt;')}” <span>${h.src}</span></div>`).join('');
    return `<div class="mir-card" style="--mc:${sp.color}">
      <div class="mir-card-hd"><span class="mir-dot"></span>${sp.label}${s.tone ? `<span class="mir-tone">${String(s.tone).toUpperCase()}</span>` : ''}</div>
      <div class="mir-frame">${(s.framing || '—').replace(/</g, '&lt;')}</div>
      ${hits ? `<div class="mir-hls">${hits}</div>` : `<div class="mir-nohl">no matching live coverage</div>`}
    </div>`;
  }).join('');
  return `
    <div class="mir-sec mir-agree">
      <div class="mir-sec-t">◇ WHAT ALL SIDES AGREE ON</div>
      <ul class="mir-list">${agreed || '<li>—</li>'}</ul>
    </div>
    <div class="mir-sec-t mir-mid">◇ HOW EACH MIRROR FRAMES IT</div>
    <div class="mir-grid">${cards}</div>
    <div class="mir-sec mir-omit">
      <div class="mir-sec-t">◇ WHAT TENDS TO BE LEFT OUT</div>
      <ul class="mir-list">${omitted || '<li>—</li>'}</ul>
    </div>
    ${d.note ? `<div class="mir-note">${String(d.note).replace(/</g, '&lt;')}</div>` : ''}`;
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
