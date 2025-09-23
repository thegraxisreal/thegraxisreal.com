import { addBalance, canAfford, getBalance } from './store.js';
import { __applyThemeFromShop } from './app.js';
import { formatMoneyExtended as fmt } from './format.js';

let cleanup = () => {};

const KEY = 'tgx_casino_shop_v1';
function loadState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function saveState(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

const THEMES = [
  { id:'default', name:'Default', price:0, desc:'Casino default look. Always owned.', vars:'default' },
  { id:'blue', name:'Blue', price:1000, desc:'Cool blues and neon accents.', vars:'blue' },
  { id:'red', name:'Red', price:10000, desc:'Warm reds with gold highlights.', vars:'red' },
  { id:'emerald', name:'Emerald', price:100000, desc:'Deep greens and crisp highlights.', vars:'emerald' },
  { id:'neon', name:'Neon', price:250000, desc:'High-contrast neon vibe.', vars:'blue' },
  { id:'gold', name:'Gold', price:1000000, desc:'Pure luxury. Gilded panels and warm glow.', vars:'gold' },
  { id:'blackout', name:'Blackout', price:1_000_000, desc:'Ultra-dark night mode with sharp accents.', vars:'blackout' },
  { id:'matrix', name:'Matrix Rain', price:1_000_000, desc:'Digital glyph rain pours over the UI.', vars:'matrix' },
  { id:'love_plinko', name:'I LOVE PLINKO', price:100_000_000, desc:'Pitch black backdrop, peg dots, and neon Plinko sparks everywhere.', vars:'love_plinko' },
  { id:'diamond', name:'Diamond', price:1000000000, desc:'1 billion. Frosted whites and clarity.', vars:'diamond' },
  { id:'waves', name:'Waves', price:5_000_000_000, desc:'Reactive iridescent waves from the ether.', vars:'waves' },
  { id:'fire', name:'Fire', price:1000000000000, desc:'Animated fire background with shifting warm highlights.', vars:'fire' },
  { id:'liquid', name:'Liquid Glass', price:15000000, desc:'Clear, semi-transparent UI over a bright backdrop.', vars:'liquid' },
  { id:'rich', name:"I'm Rich", price:500000000000000000, desc:'Green vibe with raining money. Buttons spray cash.', vars:'rich' },
  { id:'veryrich', name:"I'm Very Rich", price:5000000000000000000, desc:'Everything shines gold. It rains gold bars.', vars:'veryrich' },
  { id:'too_much_money', name:"I Have Too Much Money", price:50_000_000_000_000_000_000_000_000, desc:'An absurd mash-up of cash, gold, and glow.', vars:'too_much_money' },
];

const ITEMS = [
  { id:'clock', name:'Clock', price:50000, type:'toggle', desc:'Shows current time next to your balance.' },
  { id:'charlie_hat', name:'Hat for Charlie', price:1, type:'toggle', desc:'Gives the bartender a classy top hat.' },
  { id:'stocks1', name:'Stocks Lv.1', price:5000, type:'toggle', desc:'Pays $50 every 5s when enabled.' },
  { id:'stocks2', name:'Stocks Lv.2', price:50000, type:'toggle', desc:'Pays $500 every 5s when enabled.' },
  { id:'stocks3', name:'Stocks Lv.3', price:500000, type:'toggle', desc:'Pays $5,000 every 5s when enabled.' },
  { id:'stocks4', name:'Stocks Lv.4', price:5000000, type:'toggle', desc:'Pays $50,000 every 5s when enabled.' },
  { id:'stocks5', name:'Stocks Lv.5', price:50000000, type:'toggle', desc:'Pays $500,000 every 5s when enabled.' },
  { id:'stocks6', name:'Stocks Lv.6', price:500000000, type:'toggle', desc:'Pays $1,000,000 every 5s when enabled.' },
  { id:'stocks7', name:'Stocks Lv.7', price:5000000000, type:'toggle', desc:'Pays $5,000,000 every 5s when enabled.' },
  { id:'stocks8', name:'Stocks Lv.8', price:500_000_000_000_000_000, type:'toggle', desc:'Pays $50,000,000 every 5s when enabled.' },
  { id:'stocks9', name:'Stocks Lv.9', price:5e35, type:'toggle', desc:'Pays $1,000,000,000 every 5s when enabled.' },
  { id:'one_min_timer', name:'1 Minute Timer', price:500000000000, type:'consumable', desc:'Starts a 60s timer. Does absolutely nothing else.' },
];

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'shop';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Gift Shop</h2>
      <div class="tag">Upgrades & Themes</div>
    </div>

    <div class="store-section">
      <h3 style="margin:.2rem 0">Sign</h3>
      <div id="signs" class="store-grid"></div>
    </div>

    <div class="store-section">
      <h3 style="margin:.2rem 0">Themes</h3>
      <div id="themes" class="store-grid"></div>
    </div>

    <div class="store-section">
      <h3 style="margin:.2rem 0">Utilities</h3>
      <div id="items" class="store-grid"></div>
    </div>

    
  `;
  root.appendChild(wrap);

  function render() {
    const state = loadState();
    if (!state.themes) state.themes = { owned: { default: true }, equipped: state.themes?.equipped || 'default' };
    if (!state.items) state.items = {};
    const signsEl = wrap.querySelector('#signs');
    const themesEl = wrap.querySelector('#themes');
    const itemsEl = wrap.querySelector('#items');
    signsEl.innerHTML = '';
    themesEl.innerHTML = '';
    itemsEl.innerHTML = '';

    // Initialize state buckets
    state.signs = state.signs || { owned: { classic: true }, equipped: state.signs?.equipped || 'classic' };
    state.themes = state.themes || { owned: { default: true }, equipped: state.themes?.equipped || 'default' };
    state.items = state.items || {};

    // Signs
    const SIGNS = [
      { id:'classic', name:'Classic Sign', price:0, desc:'Original neon sign. Always owned.' },
      { id:'ascii_sign', name:'ASCII SIGN', price:10_000_000, desc:'Animated ASCII marquee ripped from cyberspace.' },
      { id:'diamond_sign', name:'Diamond Sign', price:1_000_000_000, desc:'Icy diamond glow.' },
      { id:'cursive_sign', name:'Cursive Sign', price:1_000_000_000, desc:'Switches the marquee to a flowing script.' },
      { id:'epilepsy_sign', name:'Epilepsy Sign', price:1_000_000_000_000, desc:'Flashes black and white rapidly.' },
      { id:'super_epilepsy_sign', name:'Super Epilepsy Sign', price:100_000_000_000_000, desc:'Unhinged strobing chaos for the fearless.' },
      { id:'name_sign', name:'Your Name Sign', price:100_000_000_000, desc:'Replaces the sign with \'YourName Casino\'.' },
      { id:'gold_sign', name:'Gold Sign', price:1_000_000_000_000_000, desc:'Shiny gold with sparkles.' },
      { id:'neon_sign', name:'Neon Flood Sign', price:1_000_000_000_000_000_000, desc:'Liquid neon animation floods the lettering.' },
    ];
    SIGNS.forEach(sg => {
      const owned = !!(state.signs.owned && state.signs.owned[sg.id]);
      const equipped = state.signs.equipped === sg.id;
      const card = document.createElement('div');
      card.className = 'store-card';
      const isNew = sg.id === 'ascii_sign';
      card.innerHTML = `
        <div class="store-thumb">${signIcon(sg.id)}</div>
        <div class="stack">
          <div class="store-name">
            <span>${sg.name}</span>
            ${isNew ? '<span class="store-badge store-badge-new">New</span>' : ''}
            ${equipped ? '<span class="store-badge">Equipped</span>' : owned ? '<span class="store-badge">Owned</span>' : ''}
          </div>
          <div class="store-desc">${sg.desc}</div>
        </div>
        <div class="store-cta">
          <div class="price">${sg.price ? fmt(sg.price) : 'Free'}</div>
          ${owned ? `<button data-equip-sign="${sg.id}" class="glass xs" ${equipped?'disabled':''}>Select</button>` : `<button data-buy-sign="${sg.id}" class="primary xs">Buy</button>`}
        </div>
      `;
      const buyBtn = card.querySelector('[data-buy-sign]');
      if (buyBtn) buyBtn.addEventListener('click', () => {
        if (!canAfford(sg.price)) return;
        const s = loadState();
        s.signs = s.signs || { owned: { classic: true }, equipped: s.signs?.equipped || 'classic' };
        addBalance(-sg.price);
        s.signs.owned = s.signs.owned || {}; s.signs.owned[sg.id] = true;
        // Buying doesn’t auto-equip
        saveState(s);
        render();
      });
      const selBtn = card.querySelector('[data-equip-sign]');
      if (selBtn) selBtn.addEventListener('click', () => {
        const s = loadState();
        s.signs = s.signs || { owned: { classic: true }, equipped: s.signs?.equipped || 'classic' };
        s.signs.equipped = sg.id;
        saveState(s);
        __applyThemeFromShop();
        render();
      });
      signsEl.appendChild(card);
    });

    THEMES.forEach(t => {
      const owned = !!(state.themes.owned && state.themes.owned[t.id]);
      const equipped = state.themes.equipped === t.id;
      const isNew = t.id === 'blackout' || t.id === 'love_plinko' || t.id === 'waves';
      const card = document.createElement('div');
      card.className = 'store-card';
      card.innerHTML = `
        <div class="store-thumb">${themeIcon(t.id)}</div>
        <div class="stack">
          <div class="store-name">
            <span>${t.name}</span>
            ${isNew ? '<span class="store-badge store-badge-new">New</span>' : ''}
            ${equipped ? '<span class="store-badge">Equipped</span>' : owned ? '<span class="store-badge">Owned</span>' : ''}
          </div>
          <div class="store-desc">${t.desc}</div>
        </div>
        <div class="store-cta">
          <div class="price">${t.price ? fmt(t.price) : 'Free'}</div>
          ${owned ? `<button data-equip="${t.id}" class="glass xs" ${equipped?'disabled':''}>Select</button>` : `<button data-buy-theme="${t.id}" class="primary xs">Buy</button>`}
        </div>
      `;
      // Events
      const buyBtn = card.querySelector('[data-buy-theme]');
      if (buyBtn) buyBtn.addEventListener('click', () => {
        const cost = t.price;
        if (!canAfford(cost)) return;
        const s = loadState();
        s.themes = s.themes || { owned: { default: true }, equipped: s.themes?.equipped || 'default' };
        addBalance(-cost);
        s.themes.owned = s.themes.owned || {}; s.themes.owned[t.id] = true;
        // Buying a theme deselects current equipped one (user must reselect)
        s.themes.equipped = null;
        saveState(s);
        render();
      });
      const selBtn = card.querySelector('[data-equip]');
      if (selBtn) selBtn.addEventListener('click', () => {
        const s = loadState();
        s.themes = s.themes || { owned: { default: true }, equipped: null };
        s.themes.equipped = t.id;
        saveState(s);
        __applyThemeFromShop();
        render();
      });
      themesEl.appendChild(card);
    });

    ITEMS.forEach(it => {
      const st = (state.items[it.id] ||= { owned:false, enabled:false });
      const card = document.createElement('div');
      card.className = 'store-card';
      card.innerHTML = `
        <div class="store-thumb">${itemIcon(it.id)}</div>
        <div class="stack">
          <div class="store-name">
            <span>${it.name}</span>
            ${st.owned ? '<span class="store-badge">Owned</span>' : ''}
          </div>
          <div class="store-desc">${it.desc}</div>
        </div>
        <div class="store-cta">
          <div class="price">${st.owned ? '—' : fmt(it.price)}</div>
          ${st.owned ? `<button data-toggle="${it.id}" class="${st.enabled?'primary':'glass'} xs">${st.enabled? 'On':'Off'}</button>` : `<button data-buy-item="${it.id}" class="primary xs">Buy</button>`}
        </div>
      `;
      const buyBtn = card.querySelector('[data-buy-item]');
      if (buyBtn) buyBtn.addEventListener('click', () => {
        if (!canAfford(it.price)) return;
        const s = loadState();
        s.items = s.items || {};
        addBalance(-it.price);
        if (it.type === 'consumable') {
          // Trigger side effect but do not persist ownership
          startOneMinuteTimer();
        } else {
          s.items[it.id] = { owned:true, enabled:false };
          saveState(s);
        }
        render();
      });
      const togBtn = card.querySelector('[data-toggle]');
      if (togBtn) togBtn.addEventListener('click', () => {
        const s = loadState();
        s.items = s.items || {}; s.items[it.id] = s.items[it.id] || { owned:false, enabled:false };
        s.items[it.id].enabled = !s.items[it.id].enabled;
        saveState(s);
        __applyThemeFromShop(); // updates clock/income
        render();
      });
      itemsEl.appendChild(card);
    });

    // (Scratchers moved to dedicated page)
  }

  render();
  cleanup = () => { wrap.remove(); };
}

export function unmount() { cleanup(); cleanup = () => {}; }

function themeIcon(id) {
  if (id === 'gold') return crownIcon('#f5c542');
  if (id === 'diamond') return diamondIcon('#9ad8ff');
  if (id === 'matrix') return matrixThemeIcon();
  if (id === 'too_much_money') return tooMuchThemeIcon();
  if (id === 'blackout') return blackoutThemeIcon();
  if (id === 'love_plinko') return lovePlinkoIcon();
  if (id === 'waves') return wavesThemeIcon();
  const color = id === 'blue' ? '#3ea6ff' : id === 'red' ? '#ff6b6b' : id === 'emerald' ? '#3ddc84' : '#aaa4ff';
  return swatchIcon(color);
}

function itemIcon(id) {
  if (id === 'clock') return clockIcon('#ffd166');
  if (id === 'charlie_hat') return hatIcon('#ffd166');
  if (id === 'one_min_timer') return timerIcon('#74e0ff');
  if (id.startsWith('stocks')) {
    const lvl = id.endsWith('1') ? 1 : id.endsWith('2') ? 2 : 3;
    return chartIcon('#3ddc84', lvl);
  }
  return swatchIcon('#888');
}

function signIcon(id) {
  if (id === 'classic') return swatchIcon('#8a64ff');
  if (id === 'ascii_sign') return asciiSignIcon();
  if (id === 'diamond_sign') return diamondIcon('#9ad8ff');
  if (id === 'epilepsy_sign') return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#fff"/><rect x="8" y="8" width="124" height="84" rx="12" fill="#000" opacity=".5"/></svg>`;
  if (id === 'name_sign') return `<svg width=\"140\" height=\"100\" viewBox=\"0 0 140 100\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"8\" y=\"8\" width=\"124\" height=\"84\" rx=\"12\" fill=\"#0b1322\"/><text x=\"70\" y=\"58\" text-anchor=\"middle\" font-size=\"14\" fill=\"#e6ebf2\" font-weight=\"800\">YourName</text></svg>`;
  if (id === 'gold_sign') return crownIcon('#f5c542');
  if (id === 'super_epilepsy_sign') return superEpilepsyIcon();
  if (id === 'neon_sign') return neonSignIcon();
  if (id === 'cursive_sign') return cursiveSignIcon();
  return swatchIcon('#888');
}

function swatchIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="100" height="60" rx="12" fill="${color}" opacity=".9"/><rect x="26" y="26" width="88" height="48" rx="10" fill="rgba(255,255,255,.08)"/></svg>`;
}
function matrixThemeIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mglow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#052312"/><stop offset="1" stop-color="#0a2819"/></linearGradient></defs><rect x="8" y="8" width="124" height="84" rx="12" fill="url(#mglow)"/><g font-family="'IBM Plex Mono',monospace" font-size="12" fill="#21f38c" opacity=".85"><text x="26" y="30">01-7E</text><text x="50" y="54" fill="#d7ffe0">A59</text><text x="82" y="76">5B#</text></g></svg>`;
}
function blackoutThemeIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="14" fill="#050505" stroke="rgba(255,255,255,.05)"/><rect x="24" y="24" width="92" height="52" rx="12" fill="#0b0b0b" stroke="rgba(255,255,255,.06)"/><path d="M40 66 H108" stroke="#ff5c58" stroke-width="4" stroke-linecap="round" opacity=".85"/><circle cx="52" cy="46" r="6" fill="#ff5c58" opacity=".9"/><circle cx="68" cy="46" r="6" fill="#ffb347" opacity=".85"/><circle cx="84" cy="46" r="6" fill="#9aa0a6" opacity=".75"/></svg>`;
}
function lovePlinkoIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lp-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#040207"/><stop offset="1" stop-color="#11052b"/></linearGradient></defs><rect x="8" y="8" width="124" height="84" rx="12" fill="url(#lp-bg)" stroke="#6f2b9a" opacity=".85"/><g fill="rgba(148,120,255,.55)">${Array.from({length:28}).map((_,i)=>{const x=16+Math.random()*104;const y=16+Math.random()*64;const r=1+Math.random()*1.8;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`;}).join('')}</g><g><circle cx="40" cy="28" r="7" fill="#ff4fac"/><path d="M40 18 v8" stroke="#ff9ffd" stroke-width="2" stroke-linecap="round" opacity=".8"/></g><g><circle cx="86" cy="18" r="6" fill="#7dd3ff"/><path d="M86 10 v8" stroke="#adf1ff" stroke-width="2" stroke-linecap="round" opacity=".75"/></g><g><circle cx="62" cy="48" r="8" fill="#ff7ace"/><path d="M62 38 v10" stroke="#ffc2f5" stroke-width="2" stroke-linecap="round" opacity=".75"/></g><g><circle cx="104" cy="52" r="5" fill="#ffd166"/><path d="M104 44 v8" stroke="#ffe9a3" stroke-width="2" stroke-linecap="round" opacity=".75"/></g><text x="70" y="88" text-anchor="middle" font-size="12" fill="#ff9ffd" font-weight="700">I LOVE PLINKO</text></svg>`;
}
function tooMuchThemeIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#11140a"/><g transform="translate(0,0)"><circle cx="46" cy="52" r="24" fill="#35f089" opacity=".85"/><path d="M46 36 L52 48 L40 48 Z" fill="#0f5a2f" opacity=".6"/></g><g transform="translate(48,0)"><path d="M24 32 L36 54 L12 54 Z" fill="#ffd24d" opacity=".9"/><rect x="18" y="54" width="16" height="10" rx="3" fill="#b8860b" opacity=".9"/></g><text x="70" y="86" text-anchor="middle" font-size="12" fill="#ffeebe" font-weight="700">CASH &amp; GOLD</text></svg>`;
}
function crownIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#2a1e08"/><path d="M28 62 L46 30 L70 56 L94 28 L112 62 Z" fill="${color}" stroke="#8f6b12" stroke-width="3"/><rect x="32" y="64" width="76" height="10" rx="5" fill="${color}" opacity=".9"/></svg>`;
}
function diamondIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0e1622"/><path d="M70 18 L100 40 L70 82 L40 40 Z" fill="${color}" opacity=".9"/><path d="M70 18 L85 40 L55 40 Z" fill="#e3f3ff" opacity=".6"/></svg>`;
}
function superEpilepsyIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0b1322"/><g opacity=".9"><rect x="12" y="18" width="20" height="64" fill="#ff005c"/><rect x="34" y="18" width="20" height="64" fill="#00f0ff"/><rect x="56" y="18" width="20" height="64" fill="#00ff7f"/><rect x="78" y="18" width="20" height="64" fill="#ffea00"/><rect x="100" y="18" width="20" height="64" fill="#ff005c"/></g></svg>`;
}
function wavesThemeIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wavesGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f8bff"/><stop offset="0.5" stop-color="#5ad8ff"/><stop offset="1" stop-color="#ffd6ff"/></linearGradient></defs><rect x="8" y="8" width="124" height="84" rx="16" fill="#050b16"/><g opacity=".9" fill="none" stroke="url(#wavesGrad)" stroke-width="2"><path d="M14 60 Q28 40 42 56 T70 50 T98 58 T126 52"/><path opacity=".6" d="M12 72 Q30 48 48 64 T80 58 T112 64"/><path opacity=".4" d="M18 34 Q34 50 50 38 T82 44 T120 36"/></g><circle cx="38" cy="32" r="6" fill="url(#wavesGrad)" opacity=".85"/><circle cx="102" cy="72" r="5" fill="#5ad8ff" opacity=".8"/><text x="70" y="86" text-anchor="middle" font-size="12" fill="url(#wavesGrad)" font-weight="700">WAVES</text></svg>`;
}
function asciiSignIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="asciiGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6188"/><stop offset="0.5" stop-color="#fc9867"/><stop offset="1" stop-color="#ffd866"/></linearGradient></defs><rect x="8" y="8" width="124" height="84" rx="12" fill="#04070f" stroke="rgba(255,255,255,.08)"/><rect x="18" y="18" width="104" height="64" rx="10" fill="rgba(12,24,40,.9)" stroke="rgba(255,255,255,.08)"/><text x="70" y="44" text-anchor="middle" font-size="12" font-family="'IBM Plex Mono',monospace" fill="url(#asciiGrad)" opacity=".9">thegraxisreal</text><text x="70" y="62" text-anchor="middle" font-size="12" font-family="'IBM Plex Mono',monospace" fill="url(#asciiGrad)" opacity=".9">casino</text><text x="70" y="80" text-anchor="middle" font-size="10" font-family="'IBM Plex Mono',monospace" fill="#6d97ff" opacity=".7">ASCII</text></svg>`;
}
function neonSignIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="16" fill="#05111c"/><defs><linearGradient id="neonGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00f6ff"/><stop offset="0.5" stop-color="#7d00ff"/><stop offset="1" stop-color="#00ffe1"/></linearGradient></defs><text x="70" y="58" text-anchor="middle" font-size="24" font-weight="800" fill="url(#neonGrad)" letter-spacing="4">NEON</text></svg>`;
}
function cursiveSignIcon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#160b1f"/><text x="70" y="58" text-anchor="middle" font-size="22" fill="#ffe1fa" font-family="'Brush Script MT','Lucida Handwriting',cursive">Cursive</text></svg>`;
}
function clockIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="120" height="80" rx="12" fill="#201a0a"/><circle cx="70" cy="50" r="28" fill="${color}" opacity=".9"/><line x1="70" y1="50" x2="70" y2="34" stroke="#3b2b05" stroke-width="4" stroke-linecap="round"/><line x1="70" y1="50" x2="88" y2="50" stroke="#3b2b05" stroke-width="4" stroke-linecap="round"/></svg>`;
}
function chartIcon(color, lvl=1) {
  const bars = [18, 36, 54].map((h,i)=>`<rect x="${30+i*24}" y="${70-h}" width="18" height="${h}" rx="4" fill="${color}" opacity="${0.6 + i*0.15}"/>`).join('');
  const badge = lvl===1?'I':(lvl===2?'II':'III');
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0a1e14"/>${bars}<circle cx="110" cy="20" r="12" fill="#123421" stroke="#1f5f3a"/><text x="110" y="24" text-anchor="middle" font-size="10" fill="#3ddc84" font-weight="700">${badge}</text></svg>`;
}

function hatIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0b1322"/><rect x="30" y="56" width="80" height="10" rx="5" fill="#1f2b44"/><rect x="52" y="32" width="36" height="24" rx="6" fill="#22324a" stroke="#415a86"/><rect x="52" y="32" width="36" height="6" rx="3" fill="${color}" opacity=".8"/></svg>`;
}
function timerIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="120" height="80" rx="12" fill="#0b1322"/><circle cx="70" cy="52" r="26" fill="#132032" stroke="#20304a"/><path d="M70 30 v22" stroke="${color}" stroke-width="4" stroke-linecap="round"/><path d="M70 52 h14" stroke="${color}" stroke-width="4" stroke-linecap="round"/><rect x="62" y="18" width="16" height="8" rx="2" fill="#20304a"/></svg>`;
}

function startOneMinuteTimer() {
  try {
    const host = document.body;
    const box = document.createElement('div');
    box.style.position = 'fixed'; box.style.bottom = '16px'; box.style.right = '16px'; box.style.zIndex = '1200';
    box.style.padding = '.5rem .75rem'; box.style.borderRadius = '10px'; box.style.background = 'rgba(20,30,50,.9)'; box.style.border = '1px solid #20304a';
    box.style.color = '#e6ebf2'; box.style.fontWeight = '700'; box.style.boxShadow = '0 8px 24px rgba(0,0,0,.4)';
    const span = document.createElement('span'); box.appendChild(span);
    let ms = 60_000;
    const tick = () => { span.textContent = `Timer: ${Math.ceil(ms/1000)}s`; ms -= 1000; if (ms < 0) { clearInterval(t); box.remove(); } };
    tick();
    const t = setInterval(tick, 1000);
    setTimeout(() => { clearInterval(t); try{ box.remove(); }catch{} }, 60_500);
  } catch {}
}

// ---------------- Scratchers implementation ----------------
function scratchCoverPumpkin() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a1406"/><stop offset="1" stop-color="#1a0a04"/></linearGradient>
    </defs>
    <rect x="8" y="8" width="124" height="84" rx="12" fill="url(#pbg)" stroke="#5a2a0a"/>
    <text x="70" y="30" text-anchor="middle" fill="#ffcc00" font-weight="900" font-size="12">Thegraxisreal Billions</text>
    <text x="70" y="46" text-anchor="middle" fill="#e6ebf2" opacity=".9" font-size="10">Match 3 🎃 to win</text>
    <text x="70" y="64" text-anchor="middle" fill="#ffd166" font-weight="800" font-size="12">100 Billion</text>
  </svg>`;
}
function scratchCoverCharlie() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="124" height="84" rx="12" fill="#0e1524" stroke="#20304a"/>
    <g transform="translate(52,18) scale(.6)">${charlieMiniSvg()}</g>
    <text x="70" y="90" text-anchor="middle" fill="#ffd166" font-weight="800" font-size="12">Charlie Chops</text>
  </svg>`;
}
function scratchCoverNeon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="124" height="84" rx="12" fill="#0a0f18" stroke="#20304a"/>
    <text x="70" y="34" text-anchor="middle" fill="#74e0ff" font-weight="900" font-size="14">Neon Jackpot</text>
    <text x="70" y="54" text-anchor="middle" fill="#a8dfff" opacity=".9" font-size="10">Match 3 ★ to win</text>
    <text x="70" y="72" text-anchor="middle" fill="#74e0ff" font-weight="800" font-size="12">10 Billion</text>
  </svg>`;
}
function scratchCoverDiamond() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="124" height="84" rx="12" fill="#0e1420" stroke="#20304a"/>
    ${diamondIcon('#9ad8ff')}
  </svg>`;
}

function charlieMiniSvg() {
  // Compact bartender face + torso (inline, self-contained)
  return `
    <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ch1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff9bd3"/>
          <stop offset="1" stop-color="#d07cff"/>
        </linearGradient>
      </defs>
      <rect x="10" y="42" width="40" height="8" rx="3" fill="#332244"/>
      <circle cx="30" cy="24" r="14" fill="url(#ch1)"/>
      <rect x="22" y="34" width="16" height="16" rx="4" fill="#4a2a6a"/>
      <path d="M22 22c4 4 12 4 16 0" stroke="#321a4a" stroke-width="2" stroke-linecap="round"/>
      <circle cx="24" cy="22" r="2" fill="#321a4a"/>
      <circle cx="36" cy="22" r="2" fill="#321a4a"/>
      <path d="M24 28c4 3 8 3 12 0" stroke="#321a4a" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
}

function symbolPumpkin(){ return emojiSvg('🎃'); }
function symbolLeaf(){ return emojiSvg('🍁'); }
function symbolGhost(){ return emojiSvg('👻'); }
function symbolCharlie(){ return `<div style="display:grid;place-items:center;width:100%;height:100%"><div style="transform:scale(1)">${charlieMiniSvg()}</div></div>`; }
function symbolMug(){ return emojiSvg('🍺'); }
function symbolHat(){ return emojiSvg('🎩'); }
function symbolStar(){ return emojiSvg('★'); }
function symbolBolt(){ return emojiSvg('⚡'); }
function symbolMoon(){ return emojiSvg('🌙'); }
function symbolDiamond(){ return emojiSvg('💎'); }
function symbolRing(){ return emojiSvg('💍'); }
function symbolCrown(){ return emojiSvg('👑'); }

function emojiSvg(ch) {
  const safe = escapeHtml(ch);
  return `<div style="display:grid;place-items:center;width:100%;height:100%;font-size:46px">${safe}</div>`;
}

function openScratcher(def, isWin) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.zIndex = '1200';
  overlay.style.background = 'radial-gradient(900px 500px at 50% -10%, rgba(255,255,255,.06), transparent), #0a0f18';
  overlay.style.display = 'grid'; overlay.style.placeItems = 'center';

  const panel = document.createElement('div');
  panel.className = 'card';
  panel.style.width = 'min(680px, 96vw)';
  panel.style.background = '#0e1524'; panel.style.borderColor = '#20304a';
  panel.style.padding = '1rem'; panel.style.borderRadius = '12px';
  panel.innerHTML = `
    <div class="row" style="align-items:center; gap:.5rem; margin-bottom:.5rem">
      <strong style="font-size:1.2rem">${escapeHtml(def.name)}</strong>
      <div class="spacer"></div>
      <button class="glass" id="sc-close">Close</button>
    </div>
    <div class="muted" style="margin-bottom:.5rem">Scratch all three areas. 1 in 10 chance to match 3.</div>
    <div id="sc-area" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:.75rem"></div>
    <div id="sc-msg" class="stack" style="margin-top:.75rem"></div>
  `;
  overlay.appendChild(panel);

  const area = panel.querySelector('#sc-area');
  const msg = panel.querySelector('#sc-msg');

  // Determine symbols to place behind scratch layers
  const winner = isWin;
  const slots = [0,1,2].map(()=>({html:''}));
  if (winner) {
    slots.forEach(s => s.html = def.winSymbol());
  } else {
    // Ensure not all 3 equal; choose at least one miss symbol
    const winIdx = Math.floor(Math.random()*3);
    const missChoices = def.missSymbols;
    for (let i=0;i<3;i++) {
      if (i===winIdx) slots[i].html = def.winSymbol(); else slots[i].html = missChoices[Math.floor(Math.random()*missChoices.length)]();
    }
    // If by chance all equal (rare), force a miss
    const allEq = slots.every(s=>s.html===slots[0].html);
    if (allEq) slots[2].html = missChoices[0]();
  }

  const revealed = [false,false,false];
  slots.forEach((s, i) => {
    const cell = document.createElement('div');
    cell.style.position='relative'; cell.style.height='160px'; cell.style.border='1px solid #20304a'; cell.style.borderRadius='8px';
    cell.style.overflow='hidden'; cell.style.background='#0b1322';
    const content = document.createElement('div'); content.innerHTML = s.html; content.style.width='100%'; content.style.height='100%';
    cell.appendChild(content);
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400; // will scale via CSS
    canvas.style.position='absolute'; canvas.style.inset='0'; canvas.style.width='100%'; canvas.style.height='100%';
    cell.appendChild(canvas);
    area.appendChild(cell);
    initScratchCanvas(canvas, def.theme || '#bbb', () => { revealed[i] = true; checkSettle(); });
  });

  function checkSettle() {
    if (revealed.every(Boolean)) {
      const won = winner;
      if (won) {
        msg.innerHTML = `<div class="row" style="gap:.5rem; align-items:center"><strong style="color:${def.theme}">WINNER!</strong><div>Prize:</div><div class="money">${fmt(def.prize)}</div></div>`;
        try { import('./store.js').then(m=>m.addBalance(def.prize)); } catch { }
      } else {
        msg.innerHTML = `<div class="muted">No match this time. Better luck on the next ticket.</div>`;
      }
    }
  }

  panel.querySelector('#sc-close').addEventListener('click', () => overlay.remove(), { once:true });
  document.body.appendChild(overlay);
}

function initScratchCanvas(canvas, color='#c0c0c0', onReveal=()=>{}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // Paint foil
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0, shade(color, -20));
  grad.addColorStop(0.5, shade(color, 0));
  grad.addColorStop(1, shade(color, 20));
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i=0;i<40;i++) { const x=Math.random()*W, y=Math.random()*H, w=60*Math.random(), h=8; ctx.fillRect(x,y,w,h); }

  let scratching = false; let erased = 0; const ERaseToReveal = 0.55;
  const rect = () => canvas.getBoundingClientRect();
  const clearAt = (clientX, clientY) => {
    const r = rect();
    const x = (clientX - r.left) * (W / r.width);
    const y = (clientY - r.top) * (H / r.height);
    ctx.globalCompositeOperation = 'destination-out';
    const radius = 24;
    ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // crude reveal detection
    erased += (Math.PI*radius*radius)/(W*H);
    if (erased > ERaseToReveal) { canvas.remove(); onReveal(); }
  };
  const onDown = (e) => { scratching = true; const p = point(e); clearAt(p.x,p.y); e.preventDefault(); };
  const onMove = (e) => { if (!scratching) return; const p = point(e); clearAt(p.x,p.y); e.preventDefault(); };
  const onUp = () => { scratching = false; };
  const point = (e) => {
    if (e.touches && e.touches[0]) return { x:e.touches[0].clientX, y:e.touches[0].clientY };
    return { x:e.clientX, y:e.clientY };
  };
  canvas.addEventListener('mousedown', onDown); canvas.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, {passive:false}); canvas.addEventListener('touchmove', onMove, {passive:false}); canvas.addEventListener('touchend', onUp, {passive:false});
}

function shade(hex, amt) {
  try {
    const col = hex.replace('#','');
    const num = parseInt(col.length===3 ? col.split('').map(x=>x+x).join('') : col, 16);
    let r = (num>>16) + amt, g = (num>>8 & 0xff) + amt, b = (num & 0xff) + amt;
    r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
    return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
  } catch { return hex; }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
