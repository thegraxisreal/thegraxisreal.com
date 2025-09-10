import store, { subscribe, getBalance, addBalance, canAfford } from './store.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'bar';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Bar</h2>
      <div class="tag">Lounge</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto">
        <div class="muted">Balance</div>
        <div id="bar-balance" class="money">$0</div>
      </div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a; display:grid; grid-template-columns: 240px 1fr; gap: 1rem; align-items:center;">
      <div style="display:grid; place-items:center; position:relative;">
        ${svgBartender()}
        <div id="bar-bubbles" style="position:absolute; inset:0; pointer-events:none; display:grid; place-items:center;"></div>
      </div>
      <div class="stack">
        <div class="muted">Flirt with the bartender:</div>
        <div class="controls" style="flex-wrap:wrap; gap:.5rem;">
          <input id="bar-input" type="text" placeholder="Say something clever…" style="flex:1; min-width: 220px; padding:.6rem .7rem; border-radius:10px; border:1px solid #2b3a52; background:#0b1322; color:var(--fg);" />
          <button id="bar-send" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Flirt</button>
        </div>
        
      </div>
    </div>

    <div class="stack">
      <h3 style="margin:.2rem 0 .1rem">Drinks</h3>
      <div id="bar-drinks" class="stack"></div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; justify-content:flex-end;">
      <button id="bar-sober" class="glass xl">Sober Up</button>
    </div>
  `;
  root.appendChild(wrap);

  // Inject effect styles
  const style = document.createElement('style');
  style.id = 'bar-effects-style';
  style.textContent = `
    @keyframes bar-wobble { 0%,100%{ transform: rotate(0deg);} 50%{ transform: rotate(1.2deg);} }
    @keyframes bar-shake { 0%,100%{ transform: translateX(0);} 25%{ transform: translateX(-4px);} 75%{ transform: translateX(4px);} }
    @keyframes bar-hue { 0%{ filter: hue-rotate(0deg);} 100%{ filter: hue-rotate(360deg);} }
    @keyframes bar-pop { 0%{ opacity:0; transform: translateY(6px) scale(.96);} 14%{ opacity:1; transform: translateY(0) scale(1);} 86%{ opacity:1;} 100%{ opacity:0; transform: translateY(-6px) scale(.98);} }
    .bar-effect-target { will-change: transform, filter; }
    .bar-blur { filter: blur(2px) saturate(1.2); }
    .bar-wobble { animation: bar-wobble 4s ease-in-out infinite; transform-origin: 50% 0%; }
    .bar-shake { animation: bar-shake .5s ease-in-out infinite; }
    .bar-hue { animation: bar-hue 8s linear infinite; }
    .bar-glow { filter: drop-shadow(0 0 16px rgba(170,0,255,.5)) saturate(1.4) contrast(1.05); }
    .bar-bubble { position:absolute; max-width: 180px; padding:.45rem .6rem; border-radius:12px; background: rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.22); box-shadow: 0 12px 28px rgba(0,0,0,.35); animation: bar-pop 2.4s ease forwards; color: var(--fg); font-size:.95rem; text-align:center; left:50%; top: -6px; transform: translate(-50%,-100%); }
  `;
  document.head.appendChild(style);

  const balEl = wrap.querySelector('#bar-balance');
  const bubblesEl = wrap.querySelector('#bar-bubbles');
  const inputEl = wrap.querySelector('#bar-input');
  const sendBtn = wrap.querySelector('#bar-send');
  const drinksEl = wrap.querySelector('#bar-drinks');
  const soberBtn = wrap.querySelector('#bar-sober');

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); });
  balEl.textContent = fmt(getBalance());

  function fmt(n) { return `$${n.toLocaleString()}`; }

  // Chat bubbles (ephemeral)
  const replies = [
    "You're sweet. Another drink?",
    "Flattery will get you everywhere.",
    "Careful, I bite.",
    "On the house? Not tonight.",
    "I’ve heard worse. And better.",
    "Buy a drink and we’ll talk.",
    "That line needs a chaser.",
    "Bold. I like bold.",
    "Tip jar’s right there. Wink.",
    "You must be new around here.",
  ];
  function bubble(msg) {
    if (!bubblesEl) return;
    const b = document.createElement('div');
    b.className = 'bar-bubble';
    b.textContent = msg;
    bubblesEl.appendChild(b);
    setTimeout(() => b.remove(), 2600);
  }
  function onSend() {
    const v = inputEl.value.trim();
    if (!v) return;
    // do not show user's message; only bartender reply
    inputEl.value = '';
    const r = replies[Math.floor(Math.random() * replies.length)];
    setTimeout(() => bubble(r), 200 + Math.random() * 400);
  }
  sendBtn.addEventListener('click', onSend);
  const onKeyDown = (e) => { if (e.key === 'Enter') onSend(); };
  inputEl.addEventListener('keydown', onKeyDown);

  // Drinks
  const EFFECT_TARGET = document.querySelector('main') || document.body;
  EFFECT_TARGET.classList.add('bar-effect-target');
  let currentEffect = '';
  function applyEffect(name) {
    if (currentEffect) EFFECT_TARGET.classList.remove(currentEffect);
    currentEffect = name || '';
    if (currentEffect) EFFECT_TARGET.classList.add(currentEffect);
  }
  function soberUp() { applyEffect(''); }

  const drinks = [
    { key: 'beer', name: 'Beer', price: 10, effect: 'bar-blur', desc: 'Slight blur and warmth. Takes the edge off.' },
    { key: 'whiskey', name: 'Whiskey', price: 20, effect: 'bar-wobble', desc: 'A gentle sway. The room starts to tilt.' },
    { key: 'martini', name: 'Martini', price: 30, effect: 'bar-hue', desc: 'Colors drift around you. Fancy.' },
    { key: 'tequila', name: 'Tequila Shot', price: 25, effect: 'bar-shake', desc: 'Quick shakes. The world trembles a bit.' },
    { key: 'absinthe', name: 'Absinthe', price: 50, effect: 'bar-glow', desc: 'Everything glows a little too bright.' },
  ];
  function renderDrinks() {
    drinksEl.innerHTML = '';
    drinks.forEach(d => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.padding = '.6rem .75rem';
      card.style.display = 'grid';
      card.style.gridTemplateColumns = '1fr auto';
      card.style.alignItems = 'center';
      card.style.gap = '.5rem';
      card.innerHTML = `
        <div class="stack">
          <div class="row" style="gap:.5rem"><strong>${d.name}</strong> <div class="money">$${d.price.toLocaleString()}</div></div>
          <div class="muted" style="opacity:.85">${d.desc}</div>
        </div>
        <button data-key="${d.key}" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Buy</button>
      `;
      const btn = card.querySelector('button');
      btn.addEventListener('click', () => {
        if (!canAfford(d.price)) return;
        addBalance(-d.price);
        applyEffect(d.effect);
      });
      drinksEl.appendChild(card);
    });
  }
  renderDrinks();

  soberBtn.addEventListener('click', () => { soberUp(); });

  cleanup = () => {
    document.getElementById('bar-effects-style')?.remove();
    EFFECT_TARGET.classList.remove('bar-effect-target', 'bar-blur', 'bar-wobble', 'bar-hue', 'bar-shake', 'bar-glow');
    sendBtn?.removeEventListener('click', onSend);
    inputEl?.removeEventListener('keydown', onKeyDown);
    soberBtn?.removeEventListener('click', soberUp);
    unsub();
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }

function svgBartender() {
  // Simple friendly bartender SVG
  return `
  <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff9bd3" stop-opacity=".95"/>
        <stop offset="1" stop-color="#d07cff" stop-opacity=".95"/>
      </linearGradient>
    </defs>
    <rect x="20" y="110" width="140" height="18" rx="6" fill="#332244"/>
    <circle cx="90" cy="70" r="34" fill="url(#g1)"/>
    <rect x="66" y="102" width="48" height="40" rx="10" fill="#4a2a6a"/>
    <path d="M70 64c6 10 34 10 40 0" stroke="#321a4a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="78" cy="66" r="3" fill="#321a4a"/>
    <circle cx="102" cy="66" r="3" fill="#321a4a"/>
    <path d="M80 80c6 6 24 6 30 0" stroke="#321a4a" stroke-width="3" stroke-linecap="round"/>
    <rect x="120" y="92" width="8" height="18" rx="2" fill="#ffd166"/>
    <rect x="122" y="86" width="4" height="8" rx="1" fill="#ffe6a6"/>
  </svg>`;
}
