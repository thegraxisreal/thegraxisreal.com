import store, { subscribe, getBalance, addBalance, canAfford, setBalance } from './store.js';
import { formatMoneyExtended as formatMoney } from './format.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'bar';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Bar</h2>
      <div class="tag">Premium Lounge</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto">
        <div class="muted">Balance</div>
        <div id="bar-balance" class="money">$0</div>
      </div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a; display:grid; grid-template-columns: 220px 1fr; gap: 1rem; align-items:center;">
      <div style="display:grid; place-items:center;">
        ${svgBartender()}
      </div>
      <div class="stack">
        <div class="muted">Menu</div>
        <div id="bar-drinks" class="stack"></div>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  const balEl = wrap.querySelector('#bar-balance');
  const drinksEl = wrap.querySelector('#bar-drinks');

  const unsub = subscribe(({ balance }) => { balEl.textContent = formatMoney(balance); });
  balEl.textContent = formatMoney(getBalance());

  // Drinks (upscaled)
  const drinks = [
    { key: 'beer', name: 'Beer', price: 100_000, desc: 'Blurs your vision for 30s (persists across pages).' },
    { key: 'whiskey', name: 'Whiskey Shot', price: 1_000_000, desc: 'Blackout for 10s. You might drop 1 or 2 dollars.' },
    { key: 'death', name: 'Very Strong', price: 500_000, desc: 'Very Strong' },
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
          <div class="row" style="gap:.5rem"><strong>${d.name}</strong> <div class="money">${formatMoney(d.price)}</div></div>
          <div class="muted" style="opacity:.85">${d.desc}</div>
        </div>
        <button data-key="${d.key}" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Buy</button>
      `;
      const btn = card.querySelector('button');
      btn.addEventListener('click', () => onBuy(d));
      drinksEl.appendChild(card);
    });
  }
  renderDrinks();

  function onBuy(d) {
    if (!canAfford(d.price)) return;
    addBalance(-d.price);
    if (d.key === 'beer') buyBeer();
    else if (d.key === 'whiskey') buyWhiskey();
    else if (d.key === 'death') buyDeath();
  }

  // Beer: persistent global blur 30s
  function buyBeer() {
    try {
      const until = Date.now() + 30_000;
      const eff = { type: 'blur', until };
      localStorage.setItem('tgx_global_effect', JSON.stringify(eff));
      const body = document.body; if (body) body.classList.add('global-blur');
      setTimeout(() => { const now = Date.now(); const cur = JSON.parse(localStorage.getItem('tgx_global_effect')||'null'); if (!cur || now>=cur.until) body?.classList.remove('global-blur'); }, 30_500);
    } catch {}
  }

  // Whiskey: blackout 10s, then lose 20%
  function buyWhiskey() {
    const overlay = mkOverlay('#000');
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.remove();
      const bal = getBalance();
      const loss = Math.floor(bal * 0.20);
      if (loss > 0) addBalance(-loss);
    }, 10_000);
  }

  // Death: blackout 10s, then gravestone, reset to 1000
  function buyDeath() {
    const overlay = mkOverlay('#000');
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.remove();
      const grave = mkGrave();
      document.body.appendChild(grave);
      setBalance(100000);
      grave.addEventListener('click', () => grave.remove(), { once: true });
    }, 10_000);
  }

  function mkOverlay(color='#000') {
    const o = document.createElement('div');
    o.style.position = 'fixed'; o.style.inset = '0'; o.style.background = color; o.style.zIndex = '1000'; o.style.opacity = '1';
    o.style.transition = 'opacity .6s ease';
    return o;
  }

  function mkGrave() {
    const name = (localStorage.getItem('tgx_username')||'').trim() || 'Player';
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed'; wrap.style.inset = '0'; wrap.style.zIndex = '1001'; wrap.style.display='grid'; wrap.style.placeItems='center'; wrap.style.background = 'radial-gradient(800px 400px at 50% 30%, rgba(255,255,255,.04), transparent), #0a0f18';
    const svg = `
      <svg width="420" height="360" viewBox="0 0 420 360" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#9aa7b8"/>
            <stop offset="1" stop-color="#6b7686"/>
          </linearGradient>
        </defs>
        <rect x="60" y="260" width="300" height="32" rx="8" fill="#3a4758"/>
        <path d="M120 260 V140 a90 90 0 0 1 180 0 V260 Z" fill="url(#g)" stroke="#2b3a52" stroke-width="4"/>
        <text x="210" y="190" text-anchor="middle" font-size="48" fill="#1e293b" font-weight="800">R.I.P</text>
        <text x="210" y="230" text-anchor="middle" font-size="22" fill="#1e293b" font-weight="700">${escapeHtml(name)}</text>
      </svg>
    `;
    const box = document.createElement('div'); box.innerHTML = svg; wrap.appendChild(box);
    const note = document.createElement('div'); note.textContent = 'Click to continue'; note.className='muted'; note.style.marginTop='12px'; wrap.appendChild(note);
    return wrap;
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  cleanup = () => { unsub(); wrap.remove(); };
}

export function unmount() { cleanup(); cleanup = () => {}; }

function svgBartender() {
  // Simple friendly bartender SVG (adds a top hat if enabled from Shop)
  let hat = false;
  try {
    const s = JSON.parse(localStorage.getItem('tgx_casino_shop_v1')||'{}');
    hat = !!(s.items && s.items.charlie_hat && s.items.charlie_hat.enabled);
  } catch {}
  const hatSvg = hat ? `
    <g transform='translate(0,-8)'>
      <rect x="64" y="28" width="52" height="10" rx="5" fill="#0b0b0b" stroke="#444"/>
      <rect x="74" y="6" width="32" height="26" rx="6" fill="#0b0b0b" stroke="#444"/>
      <rect x="74" y="12" width="32" height="6" rx="3" fill="#ffd166" opacity=".85"/>
    </g>` : '';
  return `
  <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff9bd3" stop-opacity=".95"/>
        <stop offset="1" stop-color="#d07cff" stop-opacity=".95"/>
      </linearGradient>
    </defs>
    <rect x="20" y="110" width="140" height="18" rx="6" fill="#332244"/>
    <g id="head">
      <circle cx="90" cy="70" r="34" fill="url(#g1)"/>
      ${hatSvg}
    </g>
    <rect x="66" y="102" width="48" height="40" rx="10" fill="#4a2a6a"/>
    <path d="M70 64c6 10 34 10 40 0" stroke="#321a4a" stroke-width="3" stroke-linecap="round"/>
    <circle cx="78" cy="66" r="3" fill="#321a4a"/>
    <circle cx="102" cy="66" r="3" fill="#321a4a"/>
    <path d="M80 80c6 6 24 6 30 0" stroke="#321a4a" stroke-width="3" stroke-linecap="round"/>
    <rect x="120" y="92" width="8" height="18" rx="2" fill="#ffd166"/>
    <rect x="122" y="86" width="4" height="8" rx="1" fill="#ffe6a6"/>
  </svg>`;
}
