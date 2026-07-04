'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AUSPEX · GUIDED TOUR
// A first-open product walkthrough built from REAL screenshots of the live
// cockpit — the globe, a sourced story, the MIRRORS/BLINDSPOT/VERIFY lenses, the
// daily brief, the threat layers — each framed cinematically with a caption that
// actually teaches the feature. Shows once per browser (localStorage), replayable
// forever from the GUIDE button in the command deck. Self-contained: injects its
// own styles; the launcher lives in index.html.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const SEEN_KEY = 'auspex.tour.seen.v1';
  const A = { geo:'#6E8AFF', cyan:'#22D3EE', gold:'#E8B84B', grn:'#34E08A', red:'#FF4D5E', vio:'#C084FC' };

  const SCENES = [
    { img: 'globe',     pos: '50% 50%', accent: A.grn,
      eyebrow: 'AUSPEX · Planetary Awareness', title: 'The whole world, live',
      body: 'One globe, the planet’s live signal. Every marker is a real event or story placed where it happens — drag to spin, scroll to zoom, and the feed on the right is the full stream.' },
    { img: 'article',   pos: '50% 0%', accent: A.geo,
      eyebrow: 'Read · With provenance', title: 'Every story, fully sourced',
      body: 'Open any marker to read the story — with its outlet, <b>owner and political lean</b> laid bare up front, and a toolbar of lenses to go deeper before you trust a word.' },
    { img: 'mirrors',   pos: '50% 0%', accent: A.cyan,
      eyebrow: 'Mirrors · Bias x-ray', title: 'See every angle at once',
      body: '<b>MIRRORS</b> shows how each media sphere — Western, Chinese, Russian, Arab — frames the same story, plotted on a single framing spectrum from one pole to the other.' },
    { img: 'blindspot', pos: '50% 0%', accent: A.gold,
      eyebrow: 'Blindspot · Who is silent', title: 'See who isn’t covering it',
      body: '<b>BLINDSPOT</b> measures coverage across every sphere — who’s amplifying a story, and whose silence is itself the signal.' },
    { img: 'verify',    pos: '50% 0%', accent: A.grn,
      eyebrow: 'Verify · Claim ledger', title: 'Check it, claim by claim',
      body: '<b>VERIFY</b> breaks a story into individual claims — <b>confirmed, disputed, or unverified</b> — each with a live count of how many independent outlets corroborate it.' },
    { img: 'brief',     pos: '50% 0%', accent: A.geo,
      eyebrow: 'Daily Brief · Written by AI', title: 'The world, briefed on demand',
      body: 'One tap writes a full situation report from today’s signal — executive summary, key developments, strategic implications — and exports to a clean HTML file.' },
    { img: 'threats',   pos: '50% 50%', accent: A.cyan,
      eyebrow: 'Live Layers · The full picture', title: 'Layer the world’s systems',
      body: 'Toggle live layers from the top bar — disaster <b>events</b>, live <b>vessels</b> and <b>flights</b>, subsea cables, sanctions, <b>threats</b> — each painting the globe with real-time data. That’s AUSPEX. Replay this tour anytime from the <b>GUIDE</b> button in the command deck.' },
  ];

  // ── styles ──────────────────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('tut-style')) return;
    const s = document.createElement('style');
    s.id = 'tut-style';
    s.textContent = `
    .tut-ov{position:fixed;inset:0;z-index:4000;display:flex;flex-direction:column;
      align-items:center;justify-content:center;padding:clamp(16px,3.5vh,44px);
      font-family:var(--f-ui,'Manrope',sans-serif);
      background:
        radial-gradient(72% 60% at 16% -10%, rgba(31,184,92,.26) 0%, transparent 56%),
        radial-gradient(60% 60% at 102% 108%, rgba(110,138,255,.20) 0%, transparent 54%),
        radial-gradient(120% 120% at 50% 50%, rgba(4,7,11,.9) 42%, rgba(4,7,11,.98) 100%);
      backdrop-filter:blur(24px) saturate(1.1);-webkit-backdrop-filter:blur(24px) saturate(1.1);
      animation:tut-ov-in .5s cubic-bezier(.2,.7,.2,1) both}
    .tut-ov::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.45;
      background-image:radial-gradient(rgba(255,255,255,.15) .5px,transparent .6px);background-size:3px 3px;mix-blend-mode:screen}
    @keyframes tut-ov-in{from{opacity:0}to{opacity:1}}
    .tut-brand{position:absolute;top:22px;left:26px;display:flex;align-items:center;gap:9px;
      font-family:var(--f-brand,'Syne',sans-serif);font-weight:800;letter-spacing:.24em;font-size:12px;color:var(--t2,#9fb3a8)}
    .tut-brand b{color:#EAFBF1}
    .tut-brand i{width:8px;height:8px;border-radius:50%;font-style:normal;
      background:radial-gradient(circle at 35% 30%,#EAFBF1,#34E08A 60%,#06331d);box-shadow:0 0 10px #34E08A;
      animation:tut-glow 3.2s ease-in-out infinite alternate}
    @keyframes tut-glow{from{opacity:.6;transform:scale(.9)}to{opacity:1;transform:scale(1.15)}}
    .tut-skip{position:absolute;top:20px;right:24px;z-index:2;padding:8px 15px;border-radius:999px;
      background:rgba(233,241,236,.05);border:1px solid rgba(233,241,236,.14);color:var(--t2,#9fb3a8);
      font-family:var(--f-mono,monospace);font-size:10.5px;letter-spacing:.14em;cursor:pointer;transition:all .18s}
    .tut-skip:hover{background:rgba(233,241,236,.12);color:#EAFBF1;border-color:rgba(233,241,236,.28)}
    .tut-stage{display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;max-width:640px}
    .tut-frame{position:relative;width:100%;max-width:600px;aspect-ratio:16/10;border-radius:16px;overflow:hidden;
      margin-bottom:26px;background:#04070b;border:1px solid rgba(255,255,255,.12);
      box-shadow:0 40px 90px -34px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.06)}
    .tut-frame::before{content:'';position:absolute;inset:0;z-index:3;border-radius:16px;padding:1px;pointer-events:none;
      background:linear-gradient(135deg,var(--ac,#34E08A) 0%,rgba(255,255,255,.14) 42%,transparent 72%);
      -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
      -webkit-mask-composite:xor;mask-composite:exclude;opacity:.85}
    .tut-frame::after{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:16px;
      box-shadow:inset 0 0 70px -18px color-mix(in srgb,var(--ac,#34E08A) 60%,transparent),
        inset 0 -60px 60px -40px rgba(4,7,11,.9)}
    .tut-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:var(--pos,50% 50%);
      animation:tut-kb 11s ease-in-out infinite alternate;will-change:transform}
    @keyframes tut-kb{from{transform:scale(1.015)}to{transform:scale(1.075)}}
    .tut-tag{position:absolute;z-index:4;left:14px;bottom:13px;display:flex;align-items:center;gap:7px;
      padding:5px 11px 5px 8px;border-radius:999px;background:rgba(4,7,11,.72);backdrop-filter:blur(8px);
      border:1px solid color-mix(in srgb,var(--ac,#34E08A) 45%,transparent);
      font-family:var(--f-mono,monospace);font-size:9px;letter-spacing:.16em;color:#EAFBF1}
    .tut-tag b{width:6px;height:6px;border-radius:50%;background:var(--ac,#34E08A);box-shadow:0 0 8px var(--ac,#34E08A)}
    .tut-scene{animation:tut-scene-in .55s cubic-bezier(.2,.7,.2,1) both;width:100%;display:flex;flex-direction:column;align-items:center}
    @keyframes tut-scene-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    .tut-eyebrow{font-family:var(--f-mono,monospace);font-size:10.5px;letter-spacing:.32em;text-transform:uppercase;
      margin-bottom:12px;color:var(--ac,#34E08A);font-weight:600;filter:brightness(1.12)}
    .tut-title{font-family:var(--f-head,'Fraunces',serif);font-weight:600;color:#F3F8F4;
      font-size:clamp(25px,4.4vw,38px);line-height:1.08;letter-spacing:-.4px;margin:0 0 13px}
    .tut-body{font-size:clamp(13px,1.55vw,15px);line-height:1.62;color:var(--t2,#9fb3a8);max-width:540px;margin:0 auto}
    .tut-body b{color:#DDE9E1;font-weight:600}
    .tut-foot{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;width:100%;max-width:540px;margin-top:28px;gap:18px}
    .tut-nav{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;
      font-size:17px;border:1px solid rgba(255,255,255,.14);background:rgba(233,241,236,.04);color:#DDE9E1;transition:all .18s}
    .tut-nav:hover:not(:disabled){background:rgba(233,241,236,.12);transform:translateY(-1px)}
    .tut-nav:disabled{opacity:.28;cursor:not-allowed}
    .tut-prev{justify-self:start}
    .tut-next{justify-self:end;width:auto;padding:0 20px;border-radius:999px;gap:8px;
      background:linear-gradient(90deg,rgba(52,224,138,.24),rgba(163,230,53,.22));border-color:rgba(52,224,138,.5);
      color:#EAFBF1;font-family:var(--f-mono,monospace);font-size:11px;letter-spacing:.14em}
    .tut-next:hover{filter:brightness(1.14)}
    .tut-mid{display:flex;flex-direction:column;align-items:center;gap:9px}
    .tut-dots{display:flex;gap:8px}
    .tut-dot{width:7px;height:7px;border-radius:50%;background:rgba(233,241,236,.16);cursor:pointer;transition:all .22s}
    .tut-dot.done{background:rgba(52,224,138,.5)}
    .tut-dot.active{background:#34E08A;transform:scale(1.5);box-shadow:0 0 10px #34E08A}
    .tut-count{font-family:var(--f-mono,monospace);font-size:9.5px;letter-spacing:.18em;color:var(--t3,#5e7268)}
    @media (prefers-reduced-motion: reduce){.tut-ov,.tut-scene,.tut-shot,.tut-brand i{animation:none!important}}
    @media (max-width:560px){.tut-brand{display:none}.tut-title{font-size:22px}}
    `;
    document.head.appendChild(s);
  }

  function preload(){ SCENES.forEach(s => { const im = new Image(); im.src = `assets/guide/${s.img}.jpg`; }); }

  // ── render ──────────────────────────────────────────────────────────────
  let root = null;
  const esc = (t) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };

  function close() {
    markSeen();
    if (root) { const r = root; root = null; r.style.animation = 'tut-ov-in .28s reverse forwards'; setTimeout(() => r.remove(), 280); }
    document.removeEventListener('keydown', onKey);
  }
  function markSeen(){ try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) {} }
  function onKey(e) {
    if (!root) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { const n = +root.dataset.i + 1; n < SCENES.length ? render(n) : close(); }
    else if (e.key === 'ArrowLeft') { const p = +root.dataset.i - 1; if (p >= 0) render(p); }
  }

  function render(i) {
    injectStyle();
    const sc = SCENES[i], last = i === SCENES.length - 1;
    if (!root) {
      root = document.createElement('div'); root.className = 'tut-ov';
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      document.body.appendChild(root); document.addEventListener('keydown', onKey);
    }
    root.dataset.i = i;
    const tag = esc(sc.eyebrow.split('·')[0].trim().toUpperCase());
    const dots = SCENES.map((_, k) => `<span class="tut-dot ${k===i?'active':(k<i?'done':'')}" data-k="${k}"></span>`).join('');
    root.innerHTML = `
      <div class="tut-brand"><i></i><span><b>AUSPEX</b></span></div>
      <button class="tut-skip" data-act="skip">${last ? 'Close · esc' : 'Skip tour · esc'}</button>
      <div class="tut-stage">
        <div class="tut-scene" style="--ac:${sc.accent}">
          <div class="tut-frame">
            <img class="tut-shot" src="assets/guide/${sc.img}.jpg" alt="${esc(sc.title)}" style="--pos:${sc.pos}">
            <div class="tut-tag"><b></b>${tag}</div>
          </div>
          <div class="tut-eyebrow">${esc(sc.eyebrow)}</div>
          <h2 class="tut-title">${esc(sc.title)}</h2>
          <p class="tut-body">${sc.body}</p>
        </div>
        <div class="tut-foot">
          <button class="tut-nav tut-prev" data-act="prev" ${i===0?'disabled':''} aria-label="Previous">←</button>
          <div class="tut-mid"><div class="tut-dots">${dots}</div>
            <div class="tut-count">${String(i+1).padStart(2,'0')} / ${String(SCENES.length).padStart(2,'0')}</div></div>
          <button class="tut-nav tut-next" data-act="next">${last ? 'Enter AUSPEX' : 'Next'} ${last?'':'→'}</button>
        </div>
      </div>`;
    root.querySelector('[data-act=skip]').onclick = close;
    root.querySelector('[data-act=prev]').onclick = () => { if (i>0) render(i-1); };
    root.querySelector('[data-act=next]').onclick = () => { last ? close() : render(i+1); };
    root.querySelectorAll('.tut-dot').forEach(d => d.onclick = () => render(+d.dataset.k));
  }
  function open(){ render(0); }

  // ── first-open logic ────────────────────────────────────────────────────
  function seen(){ try { return !!localStorage.getItem(SEEN_KEY); } catch (e) { return false; } }
  function maybeShow() {
    if (!/(?:[?#&])tour\b/.test(location.href) && seen()) return;
    let tries = 0;
    (function waitLoad() {
      const ld = document.getElementById('loading');
      const up = ld && ld.offsetParent !== null && getComputedStyle(ld).opacity > 0.05;
      if (up && tries++ < 60) return setTimeout(waitLoad, 200);
      setTimeout(open, 280);
    })();
  }
  function boot(){ injectStyle(); preload(); maybeShow(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.openAuspexTour = open;
})();
