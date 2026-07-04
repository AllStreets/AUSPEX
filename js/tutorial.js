'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AUSPEX · GUIDED TOUR
// A first-open, cinematic walkthrough — animated on-brand scenes, one per pillar
// of the cockpit. Shows once per browser (localStorage), replayable forever from
// the compass "Guide" button injected into the command deck. Self-contained:
// injects its own styles + button, so index.html only needs the <script> tag.
// Reuses the real AUSPEX glyphs (auspexCatIcon / event icons) so the tour mirrors
// the live UI exactly.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const SEEN_KEY = 'auspex.tour.seen.v1';
  const C = { all:'#B7C2CC', geo:'#6E8AFF', tec:'#22D3EE', mil:'#C084FC', fin:'#E8B84B', cli:'#34D17A',
              g1:'#34E08A', g2:'#A3E635', red:'#FF4D5E', gold:'#FFD489', ice:'#EAFBF1' };
  const catIcon = (k) => (typeof auspexCatIcon === 'function') ? auspexCatIcon(k) : '';

  // ── styles ────────────────────────────────────────────────────────────────
  function injectStyle() {
    if (document.getElementById('tut-style')) return;
    const s = document.createElement('style');
    s.id = 'tut-style';
    s.textContent = `
    .tut-ov{position:fixed;inset:0;z-index:4000;display:flex;flex-direction:column;
      align-items:center;justify-content:center;padding:clamp(18px,4vh,54px);
      font-family:var(--f-ui,'Manrope',sans-serif);
      background:
        radial-gradient(70% 60% at 18% -8%, rgba(31,184,92,.30) 0%, transparent 58%),
        radial-gradient(60% 60% at 100% 108%, rgba(110,138,255,.22) 0%, transparent 55%),
        radial-gradient(120% 120% at 50% 50%, rgba(4,7,11,.86) 40%, rgba(4,7,11,.97) 100%);
      backdrop-filter:blur(22px) saturate(1.1);-webkit-backdrop-filter:blur(22px) saturate(1.1);
      animation:tut-ov-in .5s cubic-bezier(.2,.7,.2,1) both}
    .tut-ov::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
      background-image:radial-gradient(rgba(255,255,255,.16) .5px,transparent .6px);
      background-size:3px 3px;mix-blend-mode:screen}
    @keyframes tut-ov-in{from{opacity:0}to{opacity:1}}
    .tut-brand{position:absolute;top:22px;left:26px;display:flex;align-items:center;gap:9px;
      font-family:var(--f-brand,'Syne',sans-serif);font-weight:800;letter-spacing:.24em;
      font-size:12px;color:var(--t2,#9fb3a8)}
    .tut-brand b{color:#EAFBF1;font-weight:800}
    .tut-brand i{width:8px;height:8px;border-radius:50%;font-style:normal;
      background:radial-gradient(circle at 35% 30%,#EAFBF1,${C.g1} 60%,#06331d);
      box-shadow:0 0 10px ${C.g1};animation:tut-breath 3.2s ease-in-out infinite alternate}
    .tut-skip{position:absolute;top:20px;right:24px;z-index:2;padding:8px 15px;border-radius:999px;
      background:rgba(233,241,236,.05);border:1px solid rgba(233,241,236,.14);color:var(--t2,#9fb3a8);
      font-family:var(--f-mono,monospace);font-size:10.5px;letter-spacing:.14em;cursor:pointer;
      transition:background .18s,border-color .18s,color .18s}
    .tut-skip:hover{background:rgba(233,241,236,.12);color:#EAFBF1;border-color:rgba(233,241,236,.28)}
    .tut-stage{display:flex;flex-direction:column;align-items:center;text-align:center;
      width:100%;max-width:660px}
    .tut-art{position:relative;width:100%;max-width:520px;aspect-ratio:16/10;border-radius:18px;
      overflow:hidden;margin-bottom:26px;
      background:linear-gradient(180deg,rgba(9,20,14,.72),rgba(6,12,9,.86));
      border:1px solid rgba(255,255,255,.10);
      box-shadow:0 30px 80px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.06),
        inset 0 0 60px -20px rgba(31,184,92,.20)}
    .tut-art::before{content:'';position:absolute;inset:0;border-radius:18px;padding:1px;pointer-events:none;
      background:linear-gradient(135deg,rgba(52,224,138,.5),rgba(110,138,255,.16) 45%,transparent 70%);
      -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
      -webkit-mask-composite:xor;mask-composite:exclude}
    .tut-art svg{position:absolute;inset:0;width:100%;height:100%}
    .tut-art .tut-glyph{position:absolute;display:flex;align-items:center;justify-content:center}
    .tut-art .tut-glyph svg{position:static;width:100%;height:100%;display:block}
    .tut-scene{animation:tut-scene-in .55s cubic-bezier(.2,.7,.2,1) both;width:100%;
      display:flex;flex-direction:column;align-items:center}
    @keyframes tut-scene-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    .tut-eyebrow{font-family:var(--f-mono,monospace);font-size:10.5px;letter-spacing:.34em;
      text-transform:uppercase;margin-bottom:13px;
      background:linear-gradient(90deg,${C.g1},${C.g2});-webkit-background-clip:text;
      background-clip:text;color:transparent;font-weight:600}
    .tut-title{font-family:var(--f-head,'Fraunces',serif);font-weight:600;color:#F3F8F4;
      font-size:clamp(26px,4.6vw,40px);line-height:1.08;letter-spacing:-.4px;margin:0 0 14px}
    .tut-body{font-size:clamp(13.5px,1.6vw,15.5px);line-height:1.62;color:var(--t2,#9fb3a8);
      max-width:520px;margin:0 auto}
    .tut-body b{color:#DDE9E1;font-weight:600}
    .tut-foot{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;width:100%;
      max-width:520px;margin-top:30px;gap:18px}
    .tut-nav{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      cursor:pointer;font-size:17px;border:1px solid rgba(255,255,255,.14);
      background:rgba(233,241,236,.04);color:#DDE9E1;transition:all .18s}
    .tut-nav:hover:not(:disabled){background:rgba(233,241,236,.12);transform:translateY(-1px)}
    .tut-nav:disabled{opacity:.28;cursor:not-allowed}
    .tut-prev{justify-self:start}
    .tut-next{justify-self:end;width:auto;padding:0 20px;border-radius:999px;gap:8px;
      background:linear-gradient(90deg,rgba(52,224,138,.22),rgba(163,230,53,.22));
      border-color:rgba(52,224,138,.45);color:#EAFBF1;font-family:var(--f-mono,monospace);
      font-size:11px;letter-spacing:.14em}
    .tut-next:hover{filter:brightness(1.14)}
    .tut-mid{display:flex;flex-direction:column;align-items:center;gap:9px}
    .tut-dots{display:flex;gap:8px}
    .tut-dot{width:7px;height:7px;border-radius:50%;background:rgba(233,241,236,.16);cursor:pointer;
      transition:all .22s}
    .tut-dot.done{background:rgba(52,224,138,.5)}
    .tut-dot.active{background:${C.g1};transform:scale(1.5);box-shadow:0 0 10px ${C.g1}}
    .tut-count{font-family:var(--f-mono,monospace);font-size:9.5px;letter-spacing:.18em;color:var(--t3,#5e7268)}
    /* command-deck guide button */
    .cmd-guide-btn{width:38px;height:38px;flex:0 0 auto;margin-left:2px;border-radius:10px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;position:relative;
      background:var(--glass-card,rgba(8,18,12,.76));border:1px solid var(--b1,rgba(255,255,255,.08));
      color:var(--t2,#9fb3a8);backdrop-filter:blur(14px);transition:all .18s}
    .cmd-guide-btn:hover{color:#EAFBF1;border-color:rgba(52,224,138,.5);
      box-shadow:0 0 16px -4px rgba(52,224,138,.5)}
    .cmd-guide-btn svg{width:19px;height:19px}
    .cmd-guide-btn.tut-hint{animation:tut-hint 2.4s ease-in-out 3}
    @keyframes tut-hint{0%,100%{box-shadow:0 0 0 0 rgba(52,224,138,0)}
      50%{box-shadow:0 0 0 5px rgba(52,224,138,.22),0 0 18px -2px rgba(52,224,138,.6);border-color:rgba(52,224,138,.6)}}
    /* scene motion */
    .tut-breath{animation:tut-breath 3.4s ease-in-out infinite alternate;transform-origin:center}
    @keyframes tut-breath{from{transform:scale(.97)}to{transform:scale(1.05)}}
    .tut-corona{animation:tut-corona 3.4s ease-in-out infinite alternate;transform-origin:center}
    @keyframes tut-corona{from{opacity:.10;transform:scale(.9)}to{opacity:.24;transform:scale(1.08)}}
    .tut-core{animation:tut-core 2.1s ease-in-out infinite alternate;transform-origin:center}
    @keyframes tut-core{from{opacity:.55}to{opacity:1}}
    .tut-orbit{animation:tut-orbit 26s linear infinite;transform-origin:center}
    @keyframes tut-orbit{to{transform:rotate(360deg)}}
    .tut-spin{animation:tut-orbit 60s linear infinite;transform-origin:center}
    .tut-ring{transform-origin:center;animation:tut-ring 2.6s ease-out infinite}
    @keyframes tut-ring{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.6);opacity:0}}
    .tut-float{animation:tut-float 4s ease-in-out infinite alternate}
    @keyframes tut-float{from{transform:translateY(4px)}to{transform:translateY(-5px)}}
    .tut-ray{transform-origin:left center;animation:tut-ray 2.6s ease-in-out infinite alternate}
    @keyframes tut-ray{from{opacity:.28}to{opacity:.95}}
    .tut-pop{animation:tut-pop .6s cubic-bezier(.2,1.4,.4,1) both}
    @keyframes tut-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
    .tut-draw{stroke-dasharray:340;stroke-dashoffset:340;animation:tut-draw 1.7s ease-out forwards}
    @keyframes tut-draw{to{stroke-dashoffset:0}}
    @media (prefers-reduced-motion: reduce){
      .tut-ov,.tut-scene,.tut-breath,.tut-corona,.tut-core,.tut-orbit,.tut-spin,.tut-ring,
      .tut-float,.tut-ray,.tut-pop,.tut-draw,.tut-brand i{animation:none!important}
      .tut-draw{stroke-dashoffset:0}}
    @media (max-width:560px){.tut-brand{display:none}.tut-title{font-size:23px}}
    `;
    document.head.appendChild(s);
  }

  // ── scene art builders ──────────────────────────────────────────────────
  const globe = (markers) => `
    <svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="tg-globe" cx="42%" cy="36%">
          <stop offset="0%" stop-color="${C.ice}"/><stop offset="30%" stop-color="#6FE6A6"/>
          <stop offset="70%" stop-color="${C.g1}"/><stop offset="100%" stop-color="#06331d" stop-opacity=".35"/>
        </radialGradient>
        <linearGradient id="tg-sig" x1="0" x2="1"><stop offset="0" stop-color="${C.g1}"/><stop offset="1" stop-color="${C.g2}"/></linearGradient>
      </defs>
      <g transform="translate(240 152)">
        <circle r="128" fill="url(#tg-globe)" class="tut-corona"/>
        <ellipse rx="158" ry="50" fill="none" stroke="url(#tg-sig)" stroke-opacity=".22" stroke-width="1" class="tut-orbit"/>
        <g class="tut-breath">
          <circle r="86" fill="url(#tg-globe)"/>
          <g stroke="${C.ice}" stroke-opacity=".26" fill="none" stroke-width="1" class="tut-spin">
            <circle r="86"/><ellipse rx="86" ry="30"/><ellipse rx="86" ry="58"/><ellipse rx="30" ry="86"/><ellipse rx="58" ry="86"/>
          </g>
        </g>
        ${markers || ''}
      </g>
    </svg>`;
  const mk = (x, y, c, d = 0) => `<g transform="translate(${x} ${y})" style="animation-delay:${d}s">
      <circle r="4.5" fill="${c}"/><circle r="4.5" fill="none" stroke="${c}" stroke-width="1.4" class="tut-ring" style="animation-delay:${d}s"/></g>`;
  const glyph = (k, c, x, y, sz) =>
    `<div class="tut-glyph" style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;transform:translate(-50%,-50%);color:${c};filter:drop-shadow(0 0 8px ${c}88)">${catIcon(k)}</div>`;

  const SCENES = [
    { eyebrow: 'AUSPEX · Planetary Awareness', title: 'Watch over the whole world',
      body: 'AUSPEX turns the planet’s live signal — news, disasters, ships, flights, tensions — into one calm, glanceable globe. A sixty-second tour; skip whenever you like.',
      art: () => `<div class="tut-art">${globe(mk(-40,-42,C.geo,0)+mk(48,-16,C.fin,.6)+mk(-16,46,C.cli,1.1)+mk(58,40,C.mil,1.6)+mk(-58,10,C.tec,.3))}</div>` },

    { eyebrow: 'The Feed · Geolocated', title: 'Every story, placed on Earth',
      body: 'Live news lands exactly where it happens, coloured by category — <b>geopolitics, tech, military, finance, climate</b>. Click any marker to read it; the right-hand feed is the full stream.',
      art: () => `<div class="tut-art">
        ${globe(mk(-30,-30,C.geo)+mk(40,20,C.mil,.8))}
        ${glyph('geo',C.geo,30,30,26)}${glyph('finance',C.fin,72,34,24)}${glyph('tech',C.tec,24,66,24)}
        ${glyph('military',C.mil,66,70,26)}${glyph('climate',C.cli,50,22,22)}
        <svg viewBox="0 0 480 300"><g class="tut-float">
          <rect x="322" y="120" width="132" height="60" rx="10" fill="rgba(8,18,12,.9)" stroke="rgba(110,138,255,.5)"/>
          <rect x="336" y="134" width="52" height="7" rx="3.5" fill="${C.geo}"/>
          <rect x="336" y="150" width="104" height="6" rx="3" fill="rgba(233,241,236,.5)"/>
          <rect x="336" y="162" width="80" height="6" rx="3" fill="rgba(233,241,236,.3)"/>
        </g></svg></div>` },

    { eyebrow: 'Live Layers · Top Bar', title: 'Toggle the world’s systems',
      body: 'Switch on real-time layers from the top bar — disaster <b>EVENTS</b>, live <b>VESSELS</b> and <b>FLIGHTS</b>, subsea <b>CABLES</b>, <b>SANCTIONS</b>, <b>THREATS</b>. Each paints the globe with its own live data.',
      art: () => `<div class="tut-art">
        <svg viewBox="0 0 480 300">
          <g font-family="var(--f-mono,monospace)" font-size="10" letter-spacing="1.4">
            ${['EVENTS','VESSELS','FLIGHTS','THREATS','CABLES'].map((t,i)=>{
              const on=i===0||i===2; const x=40+ (i%3)*140; const y=42+Math.floor(i/3)*40;
              const c=[C.g1,C.tec,C.gold,C.red,C.geo][i];
              return `<g class="tut-pop" style="animation-delay:${i*.12}s" transform="translate(${x} ${y})">
                <rect width="120" height="26" rx="13" fill="${on?`${c}22`:'rgba(255,255,255,.03)'}" stroke="${on?c:'rgba(255,255,255,.14)'}"/>
                <circle cx="15" cy="13" r="4" fill="${on?c:'rgba(255,255,255,.2)'}"/>
                <text x="30" y="17" fill="${on?'#EAFBF1':'rgba(233,241,236,.45)'}">${t}</text></g>`;}).join('')}
          </g>
          <g transform="translate(240 210)">
            <circle r="66" fill="url(#tg-globe)" class="tut-breath" opacity=".9"/>
            <defs><radialGradient id="tg-globe" cx="42%" cy="36%"><stop offset="0%" stop-color="${C.ice}"/><stop offset="60%" stop-color="${C.g1}"/><stop offset="100%" stop-color="#06331d" stop-opacity=".4"/></radialGradient></defs>
            <g stroke="${C.ice}" stroke-opacity=".25" fill="none" stroke-width="1" class="tut-spin"><circle r="66"/><ellipse rx="66" ry="24"/><ellipse rx="24" ry="66"/></g>
            ${mk(-30,-18,C.gold)}${mk(34,10,C.g1,.5)}${mk(6,34,C.red,1)}
          </g>
        </svg></div>` },

    { eyebrow: 'Lenses · On any story', title: 'See past the headline',
      body: 'Open a story and turn on a lens — <b>MIRRORS</b> (how each media sphere frames it), <b>BLINDSPOT</b> (who’s covering it), <b>VERIFY</b> (claim by claim), <b>REACH</b> (translate & listen).',
      art: () => { const rays=[C.geo,C.red,C.gold,C.cli];
        return `<div class="tut-art"><svg viewBox="0 0 480 300">
          <g transform="translate(150 150)">
            <path d="M-26 -34 L26 0 L-26 34 Z" fill="none" stroke="url(#tg-sig)" stroke-width="2.5" class="tut-float"/>
            <linearGradient id="tg-sig" x1="0" x2="1"><stop offset="0" stop-color="${C.g1}"/><stop offset="1" stop-color="${C.g2}"/></linearGradient>
            <rect x="-150" y="-3" width="130" height="6" rx="3" fill="${C.ice}" opacity=".85"/>
            ${rays.map((c,i)=>`<line x1="26" y1="0" x2="220" y2="${-66+i*44}" stroke="${c}" stroke-width="3" stroke-linecap="round" class="tut-ray" style="animation-delay:${i*.25}s"/>`).join('')}
          </g>
          <g font-family="var(--f-mono,monospace)" font-size="9.5" letter-spacing="1.2" fill="#EAFBF1">
            ${['MIRRORS','BLINDSPOT','VERIFY','REACH'].map((t,i)=>`<text x="380" y="${92+i*44}" text-anchor="end" class="tut-pop" style="animation-delay:${.6+i*.15}s">${t}</text>`).join('')}
          </g>
        </svg></div>`; } },

    { eyebrow: 'Command Deck', title: 'Your intelligence tools',
      body: 'A daily <b>BRIEF</b> written by AI from today’s signal, <b>ANALYST</b> mode to pin and reason across events, thematic <b>SECTORS</b> and humanitarian <b>RELIEF</b> boards, and the <b>MAP KEY</b> legend.',
      art: () => { const items=[['BRIEF',C.geo],['ANALYST',C.g1],['SECTORS',C.fin],['RELIEF',C.cli],['MAP KEY',C.tec]];
        return `<div class="tut-art"><svg viewBox="0 0 480 300">
          ${items.map((it,i)=>{const x=80+ (i%3)*160; const y=95+Math.floor(i/3)*90;
            return `<g transform="translate(${x} ${y})" class="tut-pop" style="animation-delay:${i*.11}s">
              <rect x="-46" y="-30" width="92" height="60" rx="12" fill="${it[1]}14" stroke="${it[1]}66"/>
              <circle cx="0" cy="-6" r="11" fill="none" stroke="${it[1]}" stroke-width="2" class="tut-core"/>
              <circle cx="0" cy="-6" r="3.5" fill="${it[1]}"/>
              <text y="22" text-anchor="middle" font-family="var(--f-mono,monospace)" font-size="8.5" letter-spacing="1" fill="#EAFBF1">${it[0]}</text></g>`;}).join('')}
        </svg></div>`; } },

    { eyebrow: 'Threats · Countries', title: 'Read the world’s tensions',
      body: 'Turn on <b>THREATS</b> and <b>COUNTRIES</b> to surface conflict zones and nuclear or sanctioned states. Click a red conflict triangle for a live, AI-written brief on that flashpoint.',
      art: () => `<div class="tut-art"><svg viewBox="0 0 480 300">
        <defs><radialGradient id="tg-g2" cx="42%" cy="36%"><stop offset="0%" stop-color="${C.ice}"/><stop offset="62%" stop-color="${C.g1}"/><stop offset="100%" stop-color="#06331d" stop-opacity=".4"/></radialGradient></defs>
        <g transform="translate(190 152)">
          <circle r="92" fill="url(#tg-g2)" class="tut-breath"/>
          <g stroke="${C.ice}" stroke-opacity=".24" fill="none" stroke-width="1" class="tut-spin"><circle r="92"/><ellipse rx="92" ry="32"/><ellipse rx="32" ry="92"/></g>
          <g transform="translate(-14 -24)"><circle r="7" fill="none" stroke="${C.red}" stroke-width="1.6" class="tut-ring"/><path d="M0 -9 L9 8 L-9 8 Z" fill="${C.red}"/></g>
          <g transform="translate(40 30)"><circle r="6" fill="none" stroke="${C.gold}" stroke-width="1.6" class="tut-ring" style="animation-delay:1s"/><path d="M0 -8 L8 7 L-8 7 Z" fill="${C.gold}"/></g>
        </g>
        <g class="tut-float">
          <rect x="300" y="96" width="150" height="112" rx="12" fill="rgba(8,18,12,.92)" stroke="${C.red}66"/>
          <text x="316" y="120" font-family="var(--f-mono,monospace)" font-size="9" letter-spacing="1.5" fill="${C.red}">CONFLICT BRIEF</text>
          ${[0,1,2,3].map(i=>`<rect x="316" y="${134+i*15}" width="${118-i*14}" height="6" rx="3" fill="rgba(233,241,236,${.5-i*.09})"/>`).join('')}
        </g></svg></div>` },

    { eyebrow: 'You’re ready', title: 'The world, at a glance',
      body: 'That’s AUSPEX. Explore freely — <b>drag</b> to spin, <b>scroll</b> to zoom, search anything. Replay this tour anytime from the compass in the command deck.',
      art: () => `<div class="tut-art">${globe(mk(-44,-38,C.geo,0)+mk(50,-20,C.tec,.4)+mk(-20,44,C.cli,.8)+mk(56,36,C.fin,1.2)+mk(14,-52,C.mil,1.6)+mk(-56,18,C.gold,.6))}
        <svg viewBox="0 0 480 300"><g transform="translate(392 66)" class="tut-pop" style="animation-delay:.5s">
          <circle r="20" fill="rgba(52,224,138,.12)" stroke="${C.g1}" stroke-width="1.4"/>
          <path d="M0 -11 L3 -3 L11 0 L3 3 L0 11 L-3 3 L-11 0 L-3 -3 Z" fill="${C.g1}" class="tut-core"/>
        </g></svg></div>` },
  ];

  // ── render ────────────────────────────────────────────────────────────────
  let root = null;
  function esc(str){const d=document.createElement('div');d.textContent=str;return d.innerHTML;}

  function close() {
    markSeen();
    if (root) { root.style.animation = 'tut-ov-in .3s reverse forwards'; const r = root; root = null;
      setTimeout(() => r.remove(), 300); }
    document.removeEventListener('keydown', onKey);
  }
  function markSeen(){ try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) {} }

  function onKey(e){
    if (!root) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { const n = +root.dataset.i + 1; n < SCENES.length ? render(n) : close(); }
    else if (e.key === 'ArrowLeft') { const p = +root.dataset.i - 1; if (p >= 0) render(p); }
  }

  function render(i) {
    injectStyle();
    const sc = SCENES[i], last = i === SCENES.length - 1;
    if (!root) {
      root = document.createElement('div');
      root.className = 'tut-ov';
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      document.body.appendChild(root);
      document.addEventListener('keydown', onKey);
    }
    root.dataset.i = i;
    const dots = SCENES.map((_, k) => `<span class="tut-dot ${k===i?'active':(k<i?'done':'')}" data-k="${k}"></span>`).join('');
    root.innerHTML = `
      <div class="tut-brand"><i></i><span><b>AUSPEX</b></span></div>
      <button class="tut-skip" data-act="skip">${last ? 'Close · esc' : 'Skip tour · esc'}</button>
      <div class="tut-stage">
        <div class="tut-scene">
          ${sc.art()}
          <div class="tut-eyebrow">${esc(sc.eyebrow)}</div>
          <h2 class="tut-title">${esc(sc.title)}</h2>
          <p class="tut-body">${sc.body}</p>
        </div>
        <div class="tut-foot">
          <button class="tut-nav tut-prev" data-act="prev" ${i===0?'disabled':''} aria-label="Previous">←</button>
          <div class="tut-mid">
            <div class="tut-dots">${dots}</div>
            <div class="tut-count">${String(i+1).padStart(2,'0')} / ${String(SCENES.length).padStart(2,'0')}</div>
          </div>
          <button class="tut-nav tut-next" data-act="next">${last ? 'Enter AUSPEX' : 'Next'} ${last?'':'→'}</button>
        </div>
      </div>`;
    root.querySelector('[data-act=skip]').onclick = close;
    root.querySelector('[data-act=prev]').onclick = () => { if (i>0) render(i-1); };
    root.querySelector('[data-act=next]').onclick = () => { last ? close() : render(i+1); };
    root.querySelectorAll('.tut-dot').forEach(d => d.onclick = () => render(+d.dataset.k));
  }

  function open(){ render(0); }

  // ── command-deck guide button ──────────────────────────────────────────────
  function injectButton() {
    const panel = document.getElementById('cmd-panel');
    if (!panel || document.getElementById('cmd-guide-btn')) return;
    const b = document.createElement('button');
    b.id = 'cmd-guide-btn'; b.className = 'cmd-guide-btn';
    b.title = 'Guide — replay the AUSPEX tour';
    b.setAttribute('aria-label', 'Open the AUSPEX guide');
    // compass — fits a planetary-awareness cockpit
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2 5.2-2Z" fill="currentColor" fill-opacity=".18"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></svg>`;
    b.onclick = open;
    panel.appendChild(b);
    return b;
  }

  // ── first-open logic ────────────────────────────────────────────────────────
  function seen() { try { return !!localStorage.getItem(SEEN_KEY); } catch (e) { return false; } }
  function maybeShow() {
    const forced = /(?:[?#&])tour\b/.test(location.href);
    if (!forced && seen()) return;
    // Wait for the loading screen to clear so the tour never fights the intro.
    let tries = 0;
    (function waitLoad() {
      const ld = document.getElementById('loading');
      const up = ld && ld.offsetParent !== null && getComputedStyle(ld).opacity > 0.05;
      if (up && tries++ < 60) return setTimeout(waitLoad, 200);
      setTimeout(open, 260);
    })();
  }

  function boot() {
    injectStyle();
    const btn = injectButton();
    if (btn && !seen()) btn.classList.add('tut-hint');   // gentle nudge on first ever visit
    maybeShow();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // expose for console / links
  window.openAuspexTour = open;
})();
