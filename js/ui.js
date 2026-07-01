'use strict';

// ═══════════════════════════════════════════
// UI — FEED, ARTICLE, TICKER, CATEGORY, SEARCH,
//      PICKER, SIDEBAR, EQ, HEATMAP, SENTIMENT,
//      MARKET, WATCHLIST, SCRUBBER
// ═══════════════════════════════════════════

function _cardHtml(s) {
  return `<div class="ncard" style="--nc:${s.color}" data-id="${s.id}">
    <div class="nc-top">
      <span class="nc-cat">${CATS[s.cat] ? CATS[s.cat].label : s.cat.toUpperCase()}</span>
      <div class="nc-dot"></div>
      <span class="nc-src">${s.src}</span>
      ${s.brk ? '<span class="brk">BREAKING</span>' : ''}
      <span class="nc-time">${s.time}</span>
      <div class="nc-actions" onclick="event.stopPropagation()">
        <button class="nc-star ${watchlist.includes(s.id)?'saved':''}" data-wl-id="${s.id}" title="Save to watchlist">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="${watchlist.includes(s.id)?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        <button class="nc-star ${analystAssets.includes(s.id)?'saved':''} nc-pin-btn" data-pin-id="${s.id}" title="Pin to Analyst Mode" style="color:${analystAssets.includes(s.id)?'#4ADE80':''}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </button>
        <button class="nc-star ${reliefAssets.includes(s.id)?'saved':''} nc-relief-btn" data-relief-id="${s.id}" title="Pin to RELIEF Board" style="color:${reliefAssets.includes(s.id)?'#34D399':''}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </button>
      </div>
    </div>
    <div class="nc-title">${s.title||''}</div>
    ${s.region ? `<div class="nc-loc"><div class="nc-pip"></div>${s.region}</div>` : ''}
  </div>`;
}

// Reflect a feed card's Pin-to-RELIEF state after a toggle.
function _ncRefreshReliefBtn(id) {
  const pinned = (typeof reliefAssets !== 'undefined') && reliefAssets.includes(id);
  document.querySelectorAll(`[data-relief-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('saved', pinned);
    btn.style.color = pinned ? '#34D399' : '';
  });
}

function _bindFeedCards(container) {
  container.querySelectorAll('.ncard').forEach(card => {
    const sid = card.dataset.id;
    // Story ids are integers (live fetch) OR Supabase UUID strings (archived).
    // Resolve by string-equality and bind every action to the REAL story object
    // and its actual id, so cards work for both id types (the old `+id` coercion
    // turned UUIDs into NaN, silently dropping the click + the pin handlers).
    const story = (typeof NEWS !== 'undefined' && NEWS.find(s => String(s.id) === sid))
               || (typeof FALLBACK_NEWS !== 'undefined' && FALLBACK_NEWS.find(s => String(s.id) === sid));
    if (!story) return;
    card.addEventListener('click', () => openArticle(story));
    const wlBtn = card.querySelector('[data-wl-id]');
    if (wlBtn) wlBtn.addEventListener('click', () => toggleWatchlist(story.id));
    const pinBtn = card.querySelector('[data-pin-id]');
    if (pinBtn) pinBtn.addEventListener('click', () => pinStory(story.id));
    const rlBtn = card.querySelector('[data-relief-id]');
    if (rlBtn) rlBtn.addEventListener('click', () => {
      if (typeof pinStoryToRelief === 'function') pinStoryToRelief(story);
      _ncRefreshReliefBtn(story.id);
    });
  });
}

function renderFeed(stories, instant) {
  _lastFeedStories = stories;
  const feed = document.getElementById('news-feed');
  // Build the feed contents in one place so we can run it either after the
  // fade transition (normal) or immediately (instant — used while scrubbing,
  // where the 130ms opacity fade would strobe on every slider tick).
  const paint = () => {
    if (!stories.length) {
      feed.innerHTML = '<div class="feed-empty">NO ACTIVE STORIES</div>';
    } else {
      const display = stories.slice(0, 42);
      feed.innerHTML = display.map(_cardHtml).join('');
      _bindFeedCards(feed);
      if (stories.length > 42) {
        const btn = document.createElement('button');
        btn.className = 'feed-show-more';
        btn.textContent = `SHOW ${stories.length - 42} MORE STORIES ↓`;
        btn.onclick = showMoreFeedStories;
        feed.appendChild(btn);
      }
    }
    document.getElementById('sb-count').textContent = stories.length > 42 ? `42 OF ${stories.length}` : `${stories.length} STORIES`;
    // Show total pool size (including historical) as a subtle sub-count
    const totalPool = (typeof NEWS !== 'undefined') ? NEWS.length : stories.length;
    const countEl = document.getElementById('story-count');
    if (countEl && totalPool > stories.length) countEl.title = `${totalPool} total in archive`;
    document.getElementById('story-count').textContent = stories.length;
    feed.style.opacity = '1';
  };
  if (instant) {
    // No fade — repaint in place. Keeps scrubbing smooth/flicker-free.
    feed.style.opacity = '1';
    paint();
    return;
  }
  feed.style.opacity = '0';
  setTimeout(paint, 130);
}

function showMoreFeedStories() {
  const feed = document.getElementById('news-feed');
  const btn = feed.querySelector('.feed-show-more');
  if (btn) btn.remove();
  const remaining = _lastFeedStories.slice(42);
  const tmp = document.createElement('div');
  tmp.innerHTML = remaining.map(_cardHtml).join('');
  _bindFeedCards(tmp);
  while (tmp.firstChild) feed.appendChild(tmp.firstChild);
  document.getElementById('sb-count').textContent = `${_lastFeedStories.length} STORIES`;
}

// ═══════════════════════════════════════════
// CATEGORY FILTER
// ═══════════════════════════════════════════
function setCategory(cat) {
  activeCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
  const filtered = getActiveFeedStories();
  updateAllGlobeElements();
  applyMeaningfulArcs(filtered);
  renderFeed(filtered);
  if (G) {
    const tod = getTod();
    const tints = {all:null,geo:'#300010',military:'#1a0c00',finance:'#1a1500',climate:'#001a0c',tech:'#000d1a'};
    const base = getAtmos(tod);
    G.atmosphereColor(cat === 'all' ? base : (tints[cat] || base));
  }
}

document.querySelectorAll('.cat-btn').forEach(b =>
  b.addEventListener('click', () => setCategory(b.dataset.cat))
);

// Paint each filter row's glyph with the SAME icon the globe uses for that
// category, tinted live via --cc — one consistent visual language rail↔map.
document.querySelectorAll('.cat-btn').forEach(b => {
  const pip = b.querySelector('.cat-pip');
  if (pip && typeof auspexCatIcon === 'function') pip.innerHTML = auspexCatIcon(b.dataset.cat);
});

// ═══════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════
function toggleSearch() {
  searchOpen = !searchOpen;
  const inp = document.getElementById('srch');
  inp.classList.toggle('open', searchOpen);
  if (searchOpen) inp.focus();
  else { inp.value = ''; renderFeed(getActiveFeedStories()); }
}

function handleSearch(q) {
  const pool = activeCat === 'all' ? NEWS : NEWS.filter(s => s.cat === activeCat);
  if (!q.trim()) { renderFeed(pool); return; }
  const lq = q.toLowerCase();
  renderFeed(pool.filter(s =>
    s.title.toLowerCase().includes(lq) ||
    s.summary.toLowerCase().includes(lq) ||
    s.region.toLowerCase().includes(lq) ||
    s.src.toLowerCase().includes(lq)
  ));
}

// ═══════════════════════════════════════════
// LOCATION CLICK — single or multi-story
// ═══════════════════════════════════════════
function handleLocationClick(story) {
  const pool = activeCat === 'all' ? NEWS : NEWS.filter(s => s.cat === activeCat);
  const nearby = pool.filter(s =>
    Math.abs(s.lat - story.lat) < 0.5 && Math.abs(s.lng - story.lng) < 0.5
  );
  if (nearby.length <= 1) {
    openArticle(story);
  } else {
    openPicker(nearby);
  }
}

function openPicker(stories) {
  G.controls().autoRotate = false;
  G.pointOfView({ lat: stories[0].lat, lng: stories[0].lng, altitude: 1.55 }, 1000);

  document.getElementById('pk-loc').textContent = stories[0].region.toUpperCase();
  document.getElementById('pk-count').textContent = `${stories.length} STORIES AT THIS LOCATION`;
  document.getElementById('pk-list').innerHTML = stories.map(s => `
    <div class="pk-item" data-id="${s.id}">
      <div class="pk-accent" style="background:${s.color}"></div>
      <div class="pk-info">
        <div class="pk-cat" style="color:${s.color}">${CATS[s.cat].label}${s.brk ? ' · <span style="color:var(--brk)">BREAKING</span>' : ''}</div>
        <div class="pk-title">${s.title}</div>
        <div class="pk-src">${s.src} · ${s.time}</div>
      </div>
      <span class="pk-arrow">›</span>
    </div>`).join('');

  document.getElementById('pk-list').querySelectorAll('.pk-item').forEach(el => {
    const s = NEWS.find(n => String(n.id) === el.dataset.id);
    el.addEventListener('click', () => { closePicker(); openArticle(s); });
  });

  document.getElementById('art-bd').classList.add('on');
  document.getElementById('picker').classList.add('on');
}

function closePicker() {
  document.getElementById('picker').classList.remove('on');
  document.getElementById('art-bd').classList.remove('on');
  setTimeout(() => { if (G) G.controls().autoRotate = true; }, 600);
}

// ═══════════════════════════════════════════
// ARTICLE PANEL
// ═══════════════════════════════════════════
function pinStoryFromArticle() {
  if (_apStoryId == null) return;
  pinStory(_apStoryId);
  const lbl = document.getElementById('ap-pin-lbl');
  const btn = document.getElementById('ap-pin-btn');
  const pinned = analystAssets.includes(_apStoryId);
  if (lbl) lbl.textContent = pinned ? 'PINNED ✓' : 'PIN TO ANALYST';
  if (btn) { btn.style.background = pinned?'rgba(74,222,128,.12)':'rgba(74,222,128,.05)'; btn.style.borderColor = pinned?'rgba(74,222,128,.45)':'rgba(74,222,128,.2)'; btn.style.color = pinned?'#4ADE80':'rgba(74,222,128,.7)'; }
}
// Some feed items arrive with raw HTML in the summary/body (<p>, <a href>, &amp;
// entities). The article reads as plain text, so strip tags + decode entities,
// keeping the link/anchor text. Used for what's displayed (and thus translated).
function _apStripHtml(s) {
  if (s == null) return '';
  return String(s)
    // 1) decode entities FIRST, so encoded tags (&lt;a href&gt;) become strippable
    .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;|&rsquo;/gi, "'").replace(/&amp;/gi, '&')
    // 2) block tags → spaces
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ').replace(/<br\s*\/?>/gi, ' ')
    // 3) strip anchors even when unterminated (truncated "read more" links)
    .replace(/<\/?a\b[^>]*>?/gi, '')
    // 4) any other tag, then any leftover unterminated tag fragment at the end
    .replace(/<[a-z!/][^>]*>/gi, '').replace(/<[a-z!/][^>]*$/i, '')
    .replace(/\s+/g, ' ').trim();
}

// ── Article body enrichment ────────────────────────────────────────────────
// Live/archived stories only carry a one-line dek (the feed's `description`),
// stored in `summary`. `body` is empty (or, for legacy archives, a duplicate of
// the dek). Rather than render the dek twice, we: (1) show it once as the lead,
// (2) fill the body with an AI-expanded analytical brief when the model is
// reachable, and (3) always render an honest structured "dossier" of the signals
// we actually have. Demo stories with a genuine, distinct body keep the classic
// full-text read.

// Reset the enrichment block and advance the open token so any in-flight AI
// brief from a previously-open card cannot inject into this one. Returns the
// token the caller should capture.
function _apBeginRender() {
  const enrichEl = document.getElementById('ap-enrich');
  if (enrichEl) { enrichEl.className = 'ap-enrich'; enrichEl.innerHTML = ''; }
  return ++_apRenderSeq;
}

const _apEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// How many news spheres carry this story in the live feed (honest, no AI).
// Reuses the Blindspot coverage helpers when they are loaded.
function _apCoverage(story) {
  if (typeof _bsSpheres !== 'function' || typeof _bsKeywords !== 'function' ||
      typeof _bsMatch !== 'function' || typeof NEWS === 'undefined') return null;
  const news = NEWS || [];
  const kw = _bsKeywords(story);
  const labels = [];
  for (const sp of _bsSpheres()) {
    const n = news.filter(s => s.id !== story.id && _bsMatch(s.src, sp.names) &&
        kw.some(k => (`${s.title || ''} ${s.summary || ''}`.toLowerCase()).includes(k))).length
      + (_bsMatch(story.src, sp.names) ? 1 : 0);
    if (n > 0) labels.push(sp.label);
  }
  if (!labels.length) return null;
  return labels.length === 1
    ? `Single sphere · ${labels[0]} · scrutinize`
    : `${labels.length} spheres · ${labels.join(', ')}`;
}

// Build the structured dossier rows from data we genuinely have.
function _apEnrichBlock(story) {
  const rows = [];
  const m = (typeof outletMeta === 'function') ? outletMeta(story.src) : null;
  const tlbl = (typeof TYPE_LABEL !== 'undefined' && m) ? (TYPE_LABEL[m.type] || m.type) : '';
  if (m) rows.push(['SOURCE', `${_apEsc(m.owner)} · ${_apEsc(tlbl)} · ${_apEsc(m.lean)} lean`]);
  else if (story.src) rows.push(['SOURCE', `${_apEsc(story.src)} · ownership unverified`]);

  const cfg = (typeof CATS !== 'undefined' && CATS[story.cat]) ? CATS[story.cat] : null;
  const catLbl = cfg ? cfg.label : (story.cat || '').toUpperCase();
  const filed = [catLbl, story.brk ? 'BREAKING' : null, story.region || null]
    .filter(Boolean).map(_apEsc).join(' · ');
  if (filed) rows.push(['FILED', filed]);

  const cov = _apCoverage(story);
  if (cov) rows.push(['COVERAGE', _apEsc(cov)]);

  if (!rows.length) return '';
  return rows.map(([k, v]) =>
    `<div class="ap-enrich-row"><span class="ap-enrich-k">${k}</span><span class="ap-enrich-v">${v}</span></div>`
  ).join('');
}

// Expand a thin story into a 3-sentence analytical brief via the AI proxy.
// Cached per story id; guarded by the render token so a stale response never
// lands in a card the user has since navigated away from.
async function _apFillBrief(story, seq) {
  const textEl = document.getElementById('ap-text');
  if (!textEl) return;
  const id = story.id;
  if (_apBriefCache[id] != null) { if (_apRenderSeq === seq) textEl.textContent = _apBriefCache[id]; return; }
  textEl.innerHTML = '<span class="ap-brief-load"><span class="lp-spin" style="width:11px;height:11px;border-width:2px"></span> AUSPEX is expanding this brief…</span>';
  const sys = 'You are AUSPEX, a geopolitical intelligence desk. The reader has ALREADY seen the headline and the one-line dek shown above your text — do NOT restate or paraphrase them. Add analysis they do not already have, in exactly three sentences: (1) essential context or background the dek leaves out, (2) why it matters strategically — stakes, actors, second-order effects, (3) what to watch next. Neutral wire-service register. Output only the three sentences as one paragraph — no preamble, no markdown, no lists. Do not invent specific figures, names, dates, or quotes that are not implied by the input; stay analytical rather than fabricating facts.';
  const user = `HEADLINE: ${_apStripHtml(story.title)}\nDEK: ${_apStripHtml(story.summary)}\nSOURCE: ${story.src || 'wire'}\nREGION: ${story.region || '—'}`;
  try {
    const out = (await callOpenAI(sys, user, 340) || '').trim();
    if (_apRenderSeq !== seq) return;               // user navigated away
    if (!out) { textEl.textContent = ''; return; }  // fall back to lead + dossier
    _apBriefCache[id] = out;
    textEl.textContent = out;
  } catch (e) {
    if (_apRenderSeq === seq) textEl.textContent = '';
  }
}

// Render the lead + body region for a story. Called by openArticle.
function _apRenderBody(story, seq) {
  const leadTxt = _apStripHtml(story.summary);
  const bodyTxt = _apStripHtml(story.body);
  document.getElementById('ap-lead').textContent = leadTxt;
  const textEl = document.getElementById('ap-text');
  const enrichEl = document.getElementById('ap-enrich');

  // A genuine, distinct article body (demo dataset) → classic full-text read.
  const hasRealBody = bodyTxt && bodyTxt !== leadTxt &&
    !leadTxt.includes(bodyTxt) && bodyTxt.length > leadTxt.length + 40;
  if (hasRealBody) {
    textEl.textContent = bodyTxt;
    if (enrichEl) { enrichEl.className = 'ap-enrich'; enrichEl.innerHTML = ''; }
    return;
  }

  // Thin story: never duplicate the dek. Structured dossier always; AI brief when reachable.
  if (enrichEl) {
    const html = _apEnrichBlock(story);
    enrichEl.innerHTML = html;
    enrichEl.className = html ? 'ap-enrich on' : 'ap-enrich';
  }
  if (typeof aiEnabled === 'function' && aiEnabled()) {
    _apFillBrief(story, seq);
  } else {
    textEl.textContent = '';
  }
}

function openArticle(story) {
  if (!story) return;
  const _seq = _apBeginRender();
  _apStoryId = story.id ?? null;
  if (typeof _restorePinButton === 'function') _restorePinButton();
  // Update pin button state
  const pinned = _apStoryId != null && analystAssets.includes(_apStoryId);
  const lbl = document.getElementById('ap-pin-lbl');
  const btn = document.getElementById('ap-pin-btn');
  if (lbl) lbl.textContent = pinned ? 'PINNED ✓' : 'PIN TO ANALYST';
  if (btn) { btn.style.background = pinned?'rgba(74,222,128,.12)':'rgba(74,222,128,.05)'; btn.style.borderColor = pinned?'rgba(74,222,128,.45)':'rgba(74,222,128,.2)'; btn.style.color = pinned?'#4ADE80':'rgba(74,222,128,.7)'; }
  // Pin-to-RELIEF for this story (independent pool)
  if (typeof _setReliefPanelButton === 'function') _setReliefPanelButton({ type: 'story', story });
  if (G && story.lat != null && story.lng != null && !isNaN(story.lat) && !isNaN(story.lng)) {
    G.controls().autoRotate = false;
    G.pointOfView({lat: story.lat, lng: story.lng, altitude: 1.55}, 1400);
  }

  const cfg = CATS[story.cat] || {label: (story.cat||'').toUpperCase(), color: story.color || '#888'};
  story.color = story.color || cfg.color || '#888';
  document.getElementById('ap-cat').textContent = cfg.label;
  document.getElementById('ap-cat').style.cssText = `color:${story.color};background:${story.color}18`;
  const brkEl = document.getElementById('ap-brk');
  brkEl.textContent = 'BREAKING';
  brkEl.style.color = '';
  brkEl.style.display = story.brk ? 'inline-flex' : 'none';
  document.getElementById('ap-title').textContent = _apStripHtml(story.title);
  document.getElementById('ap-src').textContent = story.src;
  document.getElementById('ap-time').textContent = story.time;
  document.getElementById('ap-region').textContent = story.region;
  _apRenderBody(story, _seq);
  const apLink = document.getElementById('ap-link');
  if (story.url) {
    apLink.href = story.url;
    apLink.style.display = 'inline-flex';
  } else {
    apLink.style.display = 'none';
  }
  document.getElementById('ap-cdot').style.background = story.color;
  let coordStr = story.region ? story.region.toUpperCase() : '';
  if (story.lat != null && !isNaN(story.lat)) {
    const la = story.lat >= 0 ? story.lat.toFixed(4)+'°N' : Math.abs(story.lat).toFixed(4)+'°S';
    const ln = story.lng >= 0 ? story.lng.toFixed(4)+'°E' : Math.abs(story.lng).toFixed(4)+'°W';
    coordStr = `${la}, ${ln}  ·  ${coordStr}`;
  }
  document.getElementById('ap-coords').textContent = coordStr;

  if (typeof renderProvenance === 'function') renderProvenance(story);
  if (typeof reachReset === 'function') reachReset();

  document.getElementById('art-panel').classList.remove('art-panel--event');
  document.getElementById('art-panel').classList.add('on');
  document.getElementById('art-bd').classList.add('on');
}

function closeArticle() {
  document.getElementById('art-panel').classList.remove('on', 'art-panel--event');
  document.getElementById('art-bd').classList.remove('on');
  setTimeout(() => { if (G) G.controls().autoRotate = true; }, 700);
}

function resetGlobe() {
  if (!G) return;
  G.pointOfView({ lat: 48, lng: 68, altitude: 1.8 }, 1200);
}

function toggleSpin() {
  if (!G) return;
  const on = !G.controls().autoRotate;
  G.controls().autoRotate = on;
  G.controls().autoRotateSpeed = on ? 0.32 : 0;
  document.getElementById('spin-btn').classList.toggle('on', on);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeArticle(); closePicker(); } });
document.getElementById('art-bd').addEventListener('click', () => { closePicker(); });

// ═══════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('off', !sidebarOpen);
  document.getElementById('sb-tab').innerHTML = sidebarOpen ? '&#8249;' : '&#8250;';
}

// ═══════════════════════════════════════════
// TICKER — CSS animation (compositor thread, no main-thread rAF)
// ═══════════════════════════════════════════
let _tkrEl = null;
const _TKR_SPD = 72; // px/sec

function _tkrApplyAnim() {
  if (!_tkrEl) return;
  requestAnimationFrame(() => {
    const half = _tkrEl.scrollWidth / 2;
    if (half <= 0) return;
    const dur = half / _TKR_SPD;
    _tkrEl.style.animation = `strip-scroll ${dur}s linear infinite`;
  });
}

function initTicker() {
  const ordered = [...NEWS.filter(s => s.brk), ...NEWS.filter(s => !s.brk)].slice(0, 25);
  if (!ordered.length) return;
  const hash = ordered.map(s => s.id).join(',');
  if (hash === _tkrHash) return;
  _tkrHash = hash;

  if (!_tkrEl) _tkrEl = document.getElementById('tkr-inner');
  if (!_tkrEl) return;

  _tkrEl.style.animation = 'none';
  _tkrEl.innerHTML = [...ordered, ...ordered].map(s => `
    <span class="tkr-item" data-url="${s.url || ''}" onclick="if(this.dataset.url)window.open(this.dataset.url,'_blank')" title="${s.url ? 'Click to read full article' : ''}">
      <span class="tkr-pip" style="background:${s.color}"></span>
      <span class="tkr-src" style="color:${s.color}">${s.src.toUpperCase()}</span>
      ${s.title}
    </span>`).join('');

  if (!_tkrEl._tkrEvt) {
    _tkrEl._tkrEvt = true;
    _tkrEl.addEventListener('mouseenter', () => { _tkrEl.style.animationPlayState = 'paused'; });
    _tkrEl.addEventListener('mouseleave', () => { _tkrEl.style.animationPlayState = 'running'; });
  }

  _tkrApplyAnim();
}

// ═══════════════════════════════════════════
// CLOCK  (local time)
// ═══════════════════════════════════════════
function tick() {
  const n = new Date();
  document.getElementById('utc').textContent =
    [n.getHours(), n.getMinutes(), n.getSeconds()]
      .map(x => String(x).padStart(2,'0')).join(':');
  checkDayNight(n.getHours());
  updateScrubberLiveLabel();
}
setInterval(tick, 1000);

// ═══════════════════════════════════════════
// HEAT MAP
// ═══════════════════════════════════════════

// (HEAT feature removed)

// updateAllGlobeElements lives in globe.js
// (duplicates removed)

// ═══════════════════════════════════════════
// MEANINGFUL ARCS — entity-based connections
// ═══════════════════════════════════════════
const SENT_LEX = {
  geo: {
    pos: ['ceasefire','peace','agreement','talks','diplomat','treaty','withdrawal','accord'],
    neg: ['war','invasion','attack','crisis','nuclear','escalat','bomb','strike','threat','conflict'],
  },
  military: {
    pos: ['withdrawal','peacekeep','negotiat','ceasefire','deescalat'],
    neg: ['combat','deploy','missile','airstrike','troops','attack','offensive','drone strike'],
  },
  finance: {
    pos: ['surge','rally','gain','record high','growth','profit','bull','rise','recovery','beat'],
    neg: ['crash','fall','decline','recession','loss','bear','drop','debt crisis','default','sell-off'],
  },
  climate: {
    pos: ['record low','renewable','net zero','agreement','reforestation','clean energy','accord'],
    neg: ['record high','wildfire','flood','drought','emission','crisis','catastrophe','ice loss'],
  },
  tech: {
    pos: ['breakthrough','launch','record','partnership','acquisition','advance','released'],
    neg: ['breach','ban','restrict','fine','outage','hack','vulnerability','recall'],
  },
};

function computeSentiment(stories) {
  const results = {};
  for (const cat of ['geo','military','finance','climate','tech']) {
    const catStories = stories.filter(s => s.cat === cat);
    if (!catStories.length) { results[cat] = 0; continue; }
    const text = catStories.map(s => `${s.title} ${s.summary||''}`).join(' ').toLowerCase();
    const lex = SENT_LEX[cat];
    let score = 0;
    lex.pos.forEach(w => { if (text.includes(w)) score++; });
    lex.neg.forEach(w => { if (text.includes(w)) score--; });
    results[cat] = Math.max(-3, Math.min(3, score));
  }
  return results;
}

function renderSentiment(stories) {
  const s = computeSentiment(stories);
  for (const [cat, score] of Object.entries(s)) {
    const el = document.getElementById(`sent-${cat}`);
    if (!el) continue;
    if (score > 0)      { el.textContent = '↑'; el.style.color = '#30D158'; }
    else if (score < 0) { el.textContent = '↓'; el.style.color = '#FF2D55'; }
    else                { el.textContent = '→'; el.style.color = '#FF9F0A'; }
  }
}
function fetchWithTimeout(url, ms = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function fetchMarketData() {
  if (marketData.length > 0 && Date.now() - marketCacheTs < MARKET_CACHE_TTL) {
    renderMarketBar(); return;
  }

  // ── Run all three sources in PARALLEL so a hanging stocks fetch
  //    never delays crypto or FX ────────────────────────────────────
  const bucket = { stocks: [], crypto: [], fx: [] };

  await Promise.allSettled([

    // 1. Equities — Yahoo Finance v8/chart, 3 s per ticker timeout
    (async () => {
      const fetchTicker = async (sym) => {
        try {
          const r = await fetchWithTimeout(
            `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`, 3000
          );
          if (!r.ok) return null;
          const d = await r.json();
          const meta = d?.chart?.result?.[0]?.meta;
          if (!meta?.regularMarketPrice) return null;
          const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
          const chg = ((meta.regularMarketPrice - prev) / prev) * 100;
          return { sym, price: formatPrice(meta.regularMarketPrice), chg,
                   _score: (STOCK_WEIGHTS[sym] || 5) * Math.abs(chg), type: 'stock' };
        } catch { return null; }
      };
      const res = await Promise.allSettled(STOCK_TICKERS.map(fetchTicker));
      bucket.stocks = res
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value)
        .sort((a, b) => b._score - a._score)
        .slice(0, 3);
    })(),

    // 2. Crypto — CoinGecko
    (async () => {
      try {
        const r = await fetchWithTimeout(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
        );
        if (!r.ok) return;
        const d = await r.json();
        if (d?.bitcoin?.usd)  bucket.crypto.push({ sym:'BTC', price: formatPrice(d.bitcoin.usd),  chg: d.bitcoin.usd_24h_change,  type:'crypto' });
        if (d?.ethereum?.usd) bucket.crypto.push({ sym:'ETH', price: formatPrice(d.ethereum.usd), chg: d.ethereum.usd_24h_change, type:'crypto' });
      } catch {}
    })(),

    // 3. FX — open.er-api.com (free, no key, reliable CORS)
    (async () => {
      try {
        const r = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD');
        if (!r.ok) return;
        const d = await r.json();
        const rates = d?.rates;
        if (!rates) return;
        [
          { sym:'EUR/USD', price: rates.EUR ? (1/rates.EUR).toFixed(4) : null },
          { sym:'GBP/USD', price: rates.GBP ? (1/rates.GBP).toFixed(4) : null },
          { sym:'USD/JPY', price: rates.JPY?.toFixed(2) ?? null },
          { sym:'USD/CNY', price: rates.CNY?.toFixed(4) ?? null },
          { sym:'USD/CAD', price: rates.CAD?.toFixed(4) ?? null },
        ].forEach(p => { if (p.price) bucket.fx.push({ sym: p.sym, price: p.price, chg: null, type:'fx' }); });
      } catch {}
    })(),

  ]);

  const allItems = [...bucket.stocks, ...bucket.crypto, ...bucket.fx];
  if (allItems.length > 0) {
    marketData = allItems;
    marketCacheTs = Date.now();
  }
  renderMarketBar();
}

function formatPrice(n) {
  if (n == null || isNaN(n)) return '—';
  return n >= 1000 ? n.toLocaleString('en-US', {maximumFractionDigits:0}) : n.toFixed(2);
}

let _mktEl = null;
const _MKT_SPD = 55; // px/sec

function _mktApplyAnim(el) {
  requestAnimationFrame(() => {
    const half = el.scrollWidth / 2;
    if (half <= 0) return;
    el.style.animation = `strip-scroll ${half / _MKT_SPD}s linear infinite`;
  });
}

function renderMarketBar() {
  if (!_mktEl) _mktEl = document.getElementById('mkt-inner');
  const el = _mktEl;
  if (!el) return;

  if (marketData.length === 0) {
    el.style.animation = 'none';
    el.innerHTML = '<span class="mkt-item" style="color:var(--t3);letter-spacing:.18em">LOADING MARKET DATA</span>';
    _mktHash = '';
    return;
  }

  const hash = marketData.map(m => m.sym + m.price).join('|');
  if (hash === _mktHash) return;
  _mktHash = hash;

  const items = [];
  const addGroup = (group) => {
    group.forEach((m) => {
      if (items.length > 0) items.push('<div class="mkt-sep"></div>');
      const chgHtml = m.chg != null
        ? `<span class="mkt-chg ${m.chg >= 0 ? 'mkt-up' : 'mkt-dn'}">${m.chg >= 0 ? '▲' : '▼'}&thinsp;${Math.abs(m.chg).toFixed(2)}%</span>`
        : '';
      items.push(`<div class="mkt-item"><span class="mkt-sym">${m.sym}</span><span class="mkt-price">${m.price}</span>${chgHtml}</div>`);
    });
  };
  addGroup(marketData.filter(m => m.type === 'stock'));
  addGroup(marketData.filter(m => m.type === 'crypto'));
  addGroup(marketData.filter(m => m.type === 'fx'));

  el.style.animation = 'none';
  const half = items.join('');
  el.innerHTML = half + '<div class="mkt-sep" style="opacity:0;padding:0 24px"></div>' + half;

  if (!el._mktEvt) {
    el._mktEvt = true;
    el.addEventListener('mouseenter', () => { el.style.animationPlayState = 'paused'; });
    el.addEventListener('mouseleave', () => { el.style.animationPlayState = 'running'; });
  }

  _mktApplyAnim(el);
}

function toggleMarket() {
  marketVisible = !marketVisible;
  document.getElementById('market-bar').classList.toggle('on', marketVisible);
  if (marketVisible) {
    renderMarketBar();
    fetchMarketData();
  }
}

// ═══════════════════════════════════════════
// WATCHLIST
function toggleWatchlist(storyId) {
  const idx = watchlist.indexOf(storyId);
  if (idx === -1) watchlist.push(storyId); else watchlist.splice(idx, 1);
  localStorage.setItem('auspex_wl', JSON.stringify(watchlist));
  const saved = watchlist.includes(storyId);
  document.querySelectorAll(`[data-wl-id="${storyId}"]`).forEach(btn => {
    btn.classList.toggle('saved', saved);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', saved ? 'currentColor' : 'none');
  });
  if (watchlistFilter) renderFeed(getActiveFeedStories());
}

function toggleWatchlistFilter() {
  watchlistFilter = !watchlistFilter;
  document.getElementById('wl-toggle-btn').classList.toggle('on', watchlistFilter);
  renderFeed(getActiveFeedStories());
}

function getActiveFeedStories() {
  let pool = activeCat === 'all' ? NEWS : NEWS.filter(s => s.cat === activeCat);
  if (watchlistFilter) pool = pool.filter(s => watchlist.includes(s.id));
  return pool;
}

// ═══════════════════════════════════════════
// HISTORICAL SCRUBBER
// ═══════════════════════════════════════════
function archiveCurrentStories() {
  if (!NEWS.length) return;
  const now = Date.now();
  STORY_ARCHIVE.push({ ts: now, stories: NEWS.map(s => ({...s})) });
  // Keep only last 24h (max 50 snapshots)
  const cutoff = now - 24 * 60 * 60 * 1000;
  while (STORY_ARCHIVE.length > 50 || (STORY_ARCHIVE.length > 0 && STORY_ARCHIVE[0].ts < cutoff)) {
    STORY_ARCHIVE.shift();
  }
}

function initScrubber() {
  const ticks = document.getElementById('scrb-ticks');
  const labels = [];
  for (let i = 24; i >= 0; i -= 4) {
    labels.push(`<span class="scrb-tick${i===0?' now':''}">${i===0?'NOW':'-'+i+'h'}</span>`);
  }
  ticks.innerHTML = labels.join('');

  // Coalesce rapid slider ticks into one render per animation frame. Firing the
  // feed fade + globe rebuild on every 'input' event (dozens per drag) is what
  // makes scrubbing strobe / flicker / transiently duplicate markers.
  let _scrubRaf = null;
  let _scrubPendingV = null;
  const applyScrubValue = (v) => {
    scrubLive = v === 100;
    const badge = document.getElementById('scrb-badge');
    badge.classList.toggle('past', !scrubLive);
    badge.innerHTML = scrubLive ? '<span class="scrb-dot"></span>LIVE' : '<span class="scrb-dot"></span>PAST';
    if (scrubLive) {
      document.getElementById('scrb-time-lbl').textContent = 'LIVE';
      // Returning to live must restore the FULL live state (all overlay layers,
      // full feed) — not replay the last snapshot, which froze the globe on a
      // capped story-only subset and dropped countries/cities/threats.
      scrubToLive();
    } else {
      const hoursAgo = (100 - v) * 0.24;
      const targetTs = Date.now() - hoursAgo * 3600000;
      const d = new Date(targetTs);
      document.getElementById('scrb-time-lbl').textContent =
        d.toLocaleDateString([], {month:'short',day:'numeric'}) + ' ' +
        d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      // Apply time-of-day globe texture based on scrub hour
      const h = d.getHours();
      const scrubTod = h < 6 || h >= 20 ? 'night' : h < 8 ? 'dawn' : h < 18 ? 'day' : 'dusk';
      if (G) {
        if (scrubTod === 'night') {
          G.globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg');
          G.atmosphereColor('#030a28');
          G.atmosphereAltitude(0.22);
        } else {
          G.globeImageUrl(getTexture(scrubTod));
          G.atmosphereColor(getAtmos(scrubTod));
          G.atmosphereAltitude(0.17);
        }
      }
      // Show nearest archived snapshot
      if (STORY_ARCHIVE.length > 0) {
        const nearest = STORY_ARCHIVE.reduce((best, snap) =>
          Math.abs(snap.ts - targetTs) < Math.abs(best.ts - targetTs) ? snap : best
        );
        applyScrubSnapshot(nearest);
      }
    }
  };

  document.getElementById('scrb-range').addEventListener('input', function() {
    _scrubPendingV = parseInt(this.value);
    if (_scrubRaf) return;
    _scrubRaf = requestAnimationFrame(() => {
      _scrubRaf = null;
      const v = _scrubPendingV;
      _scrubPendingV = null;
      applyScrubValue(v);
    });
  });
}

function applyScrubSnapshot(snap) {
  const filtered = activeCat === 'all' ? snap.stories : snap.stories.filter(s => s.cat === activeCat);
  renderFeed(filtered, true); // instant — no fade, so scrubbing stays flicker-free
  if (G) {
    const scrubVisual = filtered.map(s => ({...s, _type:'story'}));
    try { if (_lnpActive) { BROADCASTERS.forEach(b => scrubVisual.push({...b, _type:'broadcaster'})); } } catch(e) {}
    G.htmlElementsData(scrubVisual).htmlElement(item => item._type === 'broadcaster' ? (() => {
      const d = document.createElement('div'); d.className = 'bcast-marker'; d.style.setProperty('--bc', item.color);
      const isActive = item.id === _lnpCurrentId;
      d.innerHTML = `<div class="bcast-box" style="${isActive ? `box-shadow:0 0 10px ${item.color}55` : ''}"><div class="bcast-sig" style="${isActive ? '' : 'animation:none;opacity:.5'}"></div><div class="bcast-name">${item.name}</div><div class="bcast-city">${item.city}</div></div><div class="bcast-stem"></div><div class="bcast-tip"></div>`;
      d.onclick = (e) => { e.stopPropagation(); switchBroadcaster(item.id); };
      return d;
    })() : makeMarker(item));
    G.pointsData(filtered).pointLat('lat').pointLng('lng')
      .pointAltitude(0.025).pointRadius(0.55).pointColor(() => 'rgba(0,0,0,0)')
      .onPointClick(s => handleLocationClick(s)).onPointHover(s => { document.body.style.cursor = s ? 'pointer' : ''; });
  }
}

function updateScrubberLiveLabel() {
  if (!scrubLive) return;
  const n = new Date();
  document.getElementById('scrb-time-lbl').textContent =
    n.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

function scrubToLive() {
  scrubLive = true;
  document.getElementById('scrb-range').value = 100;
  document.getElementById('scrb-badge').classList.remove('past');
  document.getElementById('scrb-badge').innerHTML = '<span class="scrb-dot"></span>LIVE';
  if (lastTod) { G && G.globeImageUrl(getTexture(lastTod)); G && G.atmosphereColor(getAtmos(lastTod)); G && G.atmosphereAltitude(0.17); }
  const filtered = getActiveFeedStories();
  renderFeed(filtered);
  updateAllGlobeElements();
}

