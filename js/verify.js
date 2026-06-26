'use strict';

// ═══════════════════════════════════════════════════════════════════════
// VERIFY — claim-level verification ledger.
// Breaks a story into its individual factual claims and marks each CONFIRMED /
// DISPUTED / UNVERIFIED, with a one-line basis and an objective count of how
// many independent outlets in the live feed corroborate it. Fights the AUSPEX
// enemy directly: a rumour dressed as a fact. Uses the shared lens panel.
// ═══════════════════════════════════════════════════════════════════════

const VF_ACCENT = '#34E08A';
const VF_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="12" cy="12" r="9"/><path d="M8 12 11 15 16 9"/></svg>';
const VF_STATUS = {
  confirmed:  { lbl:'CONFIRMED',  color:'#34E08A' },
  disputed:   { lbl:'DISPUTED',   color:'#FF4D5E' },
  unverified: { lbl:'UNVERIFIED', color:'#FFB454' },
};
let _vfCache = {};

function _vfesc(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function openVerifyFromArticle() {
  if (typeof _apStoryId === 'undefined' || _apStoryId == null) return;
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const story = news.find(s => s.id === _apStoryId);
  if (story) openVerify(story);
}

// Independent corroboration: how many OTHER outlets in the live feed carry a
// claim's key terms (distinct source names).
function _vfCorroborate(claim, story) {
  const news = (typeof NEWS !== 'undefined' ? NEWS : []) || [];
  const stop = new Set('the a an and or of to in on for with from this that is are was were be has have had will would said says report over into amid after before than then'.split(' '));
  const terms = (String(claim).toLowerCase().match(/[a-z][a-z'-]{4,}/g) || []).filter(w => !stop.has(w)).slice(0, 6);
  if (!terms.length) return 0;
  const srcs = new Set();
  for (const s of news) {
    if (!s.src) continue;
    const hay = `${s.title || ''} ${s.summary || ''}`.toLowerCase();
    const hit = terms.filter(t => hay.includes(t)).length;
    if (hit >= 2) srcs.add(String(s.src).toLowerCase());
  }
  return srcs.size;
}

function openVerify(story) {
  lpOpen(`${VF_ICON} VERIFY · claim ledger`, _vfesc(story.title), VF_ACCENT,
    `<div class="lp-load"><span class="lp-spin"></span>Extracting and checking the claims…</div>`,
    'AUSPEX · AI assessment of claim status, not ground truth · corroboration counted in the live feed');

  if (typeof aiEnabled !== 'function' || !aiEnabled()) {
    lpSetBody(`${VF_ICON} VERIFY · claim ledger`, _vfesc(story.title), VF_ACCENT,
      `<div class="lp-empty">The claim ledger needs the AUSPEX AI, which is unavailable here. It works on the live deployment.</div>`);
    return;
  }
  if (_vfCache[story.id]) return _vfRender(story, _vfCache[story.id]);

  const sys = 'You are AUSPEX\'s verification analyst. Extract the distinct factual CLAIMS a news item asserts, then classify each as confirmed (well-established / widely reported), disputed (contested or contradicted), or unverified (single-source, speculative, or not yet corroborated). Be skeptical and honest; prefer "unverified" when unsure. Output ONLY valid JSON.';
  const user = `STORY:\nTitle: ${story.title}\nSummary: ${story.summary || ''}\n${story.body ? 'Body: ' + String(story.body).slice(0, 900) : ''}\n\nReturn JSON exactly:\n{\n "claims": [\n   {"claim":"one specific factual claim the story makes, one sentence","status":"confirmed|disputed|unverified","basis":"one short sentence on why it has that status"}\n ],\n "summary":"one calm sentence on how solid this story's factual basis is"\n}\nExtract 3 to 6 of the most load-bearing claims.`;

  callOpenAI(sys, user, 950).then(raw => {
    let data;
    try { data = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()); }
    catch (e) {
      lpSetBody(`${VF_ICON} VERIFY · claim ledger`, _vfesc(story.title), VF_ACCENT,
        `<div class="lp-empty">The ledger couldn't be built just now. Try again in a moment.</div>`);
      return;
    }
    _vfCache[story.id] = data;
    _vfRender(story, data);
  });
}

function _vfRender(story, d) {
  const claims = (d.claims || []);
  const tally = { confirmed: 0, disputed: 0, unverified: 0 };
  const rows = claims.map((c, i) => {
    const st = VF_STATUS[c.status] || VF_STATUS.unverified;
    if (tally[c.status] != null) tally[c.status]++; else tally.unverified++;
    const corr = _vfCorroborate(c.claim, story);
    const corrTxt = corr >= 2 ? `${corr} independent outlets` : corr === 1 ? '1 outlet only' : 'no live corroboration';
    return `<div class="vf-row" style="--mc:${st.color}">
      <div class="vf-row-side"><span class="vf-status">${st.lbl}</span><span class="vf-idx">${i + 1}</span></div>
      <div class="vf-row-body">
        <div class="vf-claim">${_vfesc(c.claim)}</div>
        <div class="vf-basis">${_vfesc(c.basis || '')}</div>
        <div class="vf-corr"><span class="vf-corr-dot ${corr >= 2 ? 'ok' : corr === 1 ? 'low' : 'none'}"></span>${corrTxt}</div>
      </div>
    </div>`;
  }).join('');

  const pill = (k) => `<span class="vf-tally-pill" style="--mc:${VF_STATUS[k].color}"><b>${tally[k]}</b> ${VF_STATUS[k].lbl}</span>`;
  const body = `
    <div class="vf-tally">${pill('confirmed')}${pill('disputed')}${pill('unverified')}</div>
    <div class="vf-ledger">${rows || '<div class="lp-empty">No discrete claims extracted.</div>'}</div>
    ${d.summary ? `<div class="vf-summary">“${_vfesc(d.summary)}”</div>` : ''}`;
  lpSetBody(`${VF_ICON} VERIFY · claim ledger`, _vfesc(story.title), VF_ACCENT, body,
    'AUSPEX · AI assessment of claim status, not ground truth · corroboration counted in the live feed');
}
