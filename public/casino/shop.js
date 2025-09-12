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
  { id:'diamond', name:'Diamond', price:1000000000, desc:'1 billion. Frosted whites and clarity.', vars:'diamond' },
  { id:'fire', name:'Fire', price:1000000000000, desc:'Animated fire background with shifting warm highlights.', vars:'fire' },
  { id:'liquid', name:'Liquid Glass', price:15000000, desc:'Clear, semi-transparent UI over a bright backdrop.', vars:'liquid' },
  { id:'rich', name:"I'm Rich", price:500000000000000000, desc:'Green vibe with raining money. Buttons spray cash.', vars:'rich' },
  { id:'veryrich', name:"I'm Very Rich", price:5000000000000000000, desc:'Everything shines gold. It rains gold bars.', vars:'veryrich' },
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
      { id:'diamond_sign', name:'Diamond Sign', price:1_000_000_000, desc:'Icy diamond glow.' },
      { id:'epilepsy_sign', name:'Epilepsy Sign', price:1_000_000_000_000, desc:'Flashes black and white rapidly.' },
      { id:'name_sign', name:'Your Name Sign', price:100_000_000_000, desc:'Replaces the sign with \'YourName Casino\'.' },
      { id:'gold_sign', name:'Gold Sign', price:1_000_000_000_000_000, desc:'Shiny gold with sparkles.' },
    ];
    SIGNS.forEach(sg => {
      const owned = !!(state.signs.owned && state.signs.owned[sg.id]);
      const equipped = state.signs.equipped === sg.id;
      const card = document.createElement('div');
      card.className = 'store-card';
      card.innerHTML = `
        <div class="store-thumb">${signIcon(sg.id)}</div>
        <div class="stack">
          <div class="store-name">
            <span>${sg.name}</span>
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
      const card = document.createElement('div');
      card.className = 'store-card';
      card.innerHTML = `
        <div class="store-thumb">${themeIcon(t.id)}</div>
        <div class="stack">
          <div class="store-name">
            <span>${t.name}</span>
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
  }

  render();
  cleanup = () => { wrap.remove(); };
}

export function unmount() { cleanup(); cleanup = () => {}; }

function themeIcon(id) {
  if (id === 'gold') return crownIcon('#f5c542');
  if (id === 'diamond') return diamondIcon('#9ad8ff');
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
  if (id === 'diamond_sign') return diamondIcon('#9ad8ff');
  if (id === 'epilepsy_sign') return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#fff"/><rect x="8" y="8" width="124" height="84" rx="12" fill="#000" opacity=".5"/></svg>`;
  if (id === 'name_sign') return `<svg width=\"140\" height=\"100\" viewBox=\"0 0 140 100\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"8\" y=\"8\" width=\"124\" height=\"84\" rx=\"12\" fill=\"#0b1322\"/><text x=\"70\" y=\"58\" text-anchor=\"middle\" font-size=\"14\" fill=\"#e6ebf2\" font-weight=\"800\">YourName</text></svg>`;
  if (id === 'gold_sign') return crownIcon('#f5c542');
  return swatchIcon('#888');
}

function swatchIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="100" height="60" rx="12" fill="${color}" opacity=".9"/><rect x="26" y="26" width="88" height="48" rx="10" fill="rgba(255,255,255,.08)"/></svg>`;
}
function crownIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#2a1e08"/><path d="M28 62 L46 30 L70 56 L94 28 L112 62 Z" fill="${color}" stroke="#8f6b12" stroke-width="3"/><rect x="32" y="64" width="76" height="10" rx="5" fill="${color}" opacity=".9"/></svg>`;
}
function diamondIcon(color) {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0e1622"/><path d="M70 18 L100 40 L70 82 L40 40 Z" fill="${color}" opacity=".9"/><path d="M70 18 L85 40 L55 40 Z" fill="#e3f3ff" opacity=".6"/></svg>`;
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
