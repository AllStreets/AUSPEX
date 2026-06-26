'use strict';

// ═══════════════════════════════════════════════════════════════════════
// REACH — on-demand translation + audio.
// Make any story readable and listenable in the world's major languages — but
// only when asked, so it costs nothing until used (no always-on auto-translate).
// Translation via the AUSPEX AI; audio via the browser's on-device speech
// synthesis (free, no server). "For everyone" made literal.
// ═══════════════════════════════════════════════════════════════════════

const REACH_LANGS = [
  { name: 'Español', code: 'es' }, { name: 'Français', code: 'fr' }, { name: 'Deutsch', code: 'de' },
  { name: 'العربية', code: 'ar' }, { name: '中文', code: 'zh-CN' }, { name: 'Русский', code: 'ru' },
  { name: 'हिन्दी', code: 'hi' }, { name: 'Português', code: 'pt' }, { name: '日本語', code: 'ja' }, { name: 'Kiswahili', code: 'sw' },
];
let _reachOrig = null, _reachLang = null, _reachSpeaking = false, _reachCache = {};

function _reachStory() { const news = (typeof NEWS !== 'undefined' ? NEWS : []) || []; return news.find(s => s.id === _apStoryId); }
function _reachEl() { return document.getElementById('ap-reach'); }
function _reachListenLabel(t) { const l = document.getElementById('ap-listen-lbl'); if (l) l.textContent = t; }

// Called by openArticle — fresh story, fresh state.
function reachReset() {
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  _reachSpeaking = false; _reachLang = null; _reachOrig = null;
  const el = _reachEl(); if (el) { el.className = 'ap-reach'; el.innerHTML = ''; }
  _reachListenLabel('LISTEN');
}

function reachTranslateFromArticle() {
  const el = _reachEl(); if (!el) return;
  if (el.classList.contains('on')) { el.className = 'ap-reach'; el.innerHTML = ''; return; }
  el.className = 'ap-reach on';
  if (typeof aiEnabled !== 'function' || !aiEnabled()) {
    el.innerHTML = '<div class="ap-reach-note">Translation needs the AUSPEX AI — available on the live site.</div>'; return;
  }
  if (_reachLang) { _reachMark(REACH_LANGS.find(l => l.code === _reachLang)?.name || ''); return; }
  const chips = REACH_LANGS.map(l => `<button class="ap-reach-chip" onclick="reachDoTranslate('${l.code}','${l.name}')">${l.name}</button>`).join('');
  el.innerHTML = `<span class="ap-reach-lbl">TRANSLATE TO</span>${chips}`;
}

async function reachDoTranslate(code, name) {
  const story = _reachStory(); if (!story) return;
  const lead = document.getElementById('ap-lead'), text = document.getElementById('ap-text');
  if (!_reachOrig) _reachOrig = { lead: lead.textContent, text: text.textContent };
  const el = _reachEl();
  const key = story.id + ':' + code;
  if (_reachCache[key]) { lead.textContent = _reachCache[key].lead; text.textContent = _reachCache[key].text; _reachLang = code; _reachMark(name); return; }
  el.innerHTML = `<span class="ap-reach-lbl"><span class="lp-spin" style="width:11px;height:11px;border-width:2px;display:inline-block;vertical-align:-1px"></span> translating to ${name}…</span>`;
  const sys = `Translate the user's text into ${name}. Preserve meaning and a natural news register. Output ONLY the translation — no preamble, no notes.`;
  try {
    const tl = await callOpenAI(sys, _reachOrig.lead || '', 520);
    const tt = await callOpenAI(sys, _reachOrig.text || _reachOrig.lead || '', 1500);
    _reachCache[key] = { lead: tl.trim(), text: tt.trim() };
    lead.textContent = _reachCache[key].lead; text.textContent = _reachCache[key].text; _reachLang = code;
    _reachMark(name);
  } catch (e) { el.innerHTML = '<div class="ap-reach-note">Translation failed — try again.</div>'; }
}

function _reachMark(name) {
  const el = _reachEl(); if (!el) return;
  el.className = 'ap-reach on';
  el.innerHTML = `<span class="ap-reach-active">● TRANSLATED · ${name}</span><button class="ap-reach-chip ap-reach-revert" onclick="reachRevert()">↺ SHOW ORIGINAL</button>`;
}

function reachRevert() {
  if (_reachOrig) { document.getElementById('ap-lead').textContent = _reachOrig.lead; document.getElementById('ap-text').textContent = _reachOrig.text; }
  _reachLang = null;
  const el = _reachEl(); if (el) { el.className = 'ap-reach'; el.innerHTML = ''; }
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  _reachSpeaking = false; _reachListenLabel('LISTEN');
}

function reachListenFromArticle() {
  if (!window.speechSynthesis) return;
  if (_reachSpeaking) { speechSynthesis.cancel(); _reachSpeaking = false; _reachListenLabel('LISTEN'); return; }
  const story = _reachStory(); if (!story) return;
  const title = document.getElementById('ap-title').textContent;
  const lead = document.getElementById('ap-lead').textContent;
  const text = document.getElementById('ap-text').textContent;
  const u = new SpeechSynthesisUtterance(`${title}. ${lead} ${text}`.slice(0, 4000));
  if (_reachLang) u.lang = _reachLang;
  u.rate = 1.0;
  u.onend = () => { _reachSpeaking = false; _reachListenLabel('LISTEN'); };
  u.onerror = () => { _reachSpeaking = false; _reachListenLabel('LISTEN'); };
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  _reachSpeaking = true; _reachListenLabel('STOP');
}
