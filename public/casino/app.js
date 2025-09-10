import store, { subscribe, getBalance } from './store.js';

// Simple hash-based router and dynamic importer
const routes = {
  home: () => import('./home.js'),
  slots: () => import('./games/slots.js'),
  blackjack: () => import('./games/blackjack.js'),
  horse: () => import('./games/horse.js'),
  plinko: () => import('./games/plinko.js'),
  coinflip: () => import('./games/coinflip.js'),
  bar: () => import('./bar.js'),
  shop: () => import('./shop.js'),
  blackmarket: () => import('./blackmarket.js'),
  leaderboard: () => import('./leaderboard.js'),
};

let activeModule = null;

function unmountActive() {
  if (activeModule && typeof activeModule.unmount === 'function') {
    try { activeModule.unmount(); } catch {/* noop */}
  }
  activeModule = null;
}

async function loadFromHash(hash) {
  const key = hash.replace(/^#\/?/, '') || '';
  const root = document.getElementById('game-root');

  // Default to home when no route
  const routeKey = (!key || !routes[key]) ? 'home' : key;

  try {
    const mod = await routes[routeKey]();
    unmountActive();
    activeModule = mod;
    root.innerHTML = '';
    await mod.mount(root); // each game exports mount(root) and unmount()
  } catch (e) {
    console.error('Failed to load route', routeKey, e);
    root.innerHTML = `<p>Failed to load ${routeKey}. Check console.</p>`;
  }
}

window.addEventListener('hashchange', () => loadFromHash(location.hash));
window.addEventListener('DOMContentLoaded', () => {
  // Initialize money HUD
  const hud = document.getElementById('money-amount');
  function formatHUD(n) {
    const abs = Math.floor(Math.max(0, n));
    const units = [
      { v: 1e15, s: 'q' },
      { v: 1e12, s: 't' },
      { v: 1e9, s: 'b' },
      { v: 1e6, s: 'm' },
    ];
    if (abs < 10_000_000) return `$${abs.toLocaleString()}`;
    for (const u of units) {
      if (abs >= u.v) {
        const val = Math.floor(abs / u.v);
        return `$${val}${u.s}`;
      }
    }
    return `$${abs.toLocaleString()}`;
  }
  if (hud) hud.textContent = formatHUD(getBalance());
  subscribe(({ balance }) => {
    if (hud) hud.textContent = formatHUD(balance);
  });

  // Apply equipped theme from shop state
  try {
    const state = JSON.parse(localStorage.getItem('tgx_casino_shop_v1') || '{}');
    if (state && state.themes && state.themes.equipped) applyTheme(state.themes.equipped);
  } catch {}

  // Clock HUD if enabled
  ensureClock();

  // Passive income (stocks)
  startIncomeLoop();

  // Start reporting balances every 60s to ngrok server if configured
  // Seed ngrok base if not set yet
  if (!localStorage.getItem('tgx_ngrok_base')) {
    localStorage.setItem('tgx_ngrok_base', 'https://safe-duly-sheep.ngrok-free.app');
  }
  startReporter();

  // Ensure a username is set globally, even on deep links
  ensureUsername();

  loadFromHash(location.hash);
});

function applyTheme(id) {
  const themes = getThemes();
  const t = themes[id];
  if (!t) return;
  const r = document.documentElement;
  for (const k in t.vars) r.style.setProperty(k, t.vars[k]);
}

function getThemes() {
  return {
    default: { vars: { '--bg':'#140a1f','--panel':'#0f1420','--panel-2':'#121a2a','--fg':'#e6ebf2','--muted':'#a7b3c7','--accent':'#ffcc00','--accent-2':'#00d4ff' } },
    blue:    { vars: { '--bg':'#0c1024','--panel':'#0f1730','--panel-2':'#101b3a','--fg':'#e8f0ff','--muted':'#a9b8df','--accent':'#3ea6ff','--accent-2':'#74e0ff' } },
    red:     { vars: { '--bg':'#200b0b','--panel':'#2a1010','--panel-2':'#331414','--fg':'#ffecec','--muted':'#f2b0b0','--accent':'#ff6b6b','--accent-2':'#ffd166' } },
    gold:    { vars: { '--bg':'#1e1503','--panel':'#281d05','--panel-2':'#2f230a','--fg':'#fff8e6','--muted':'#e6d8b0','--accent':'#f5c542','--accent-2':'#ffea86' } },
    emerald: { vars: { '--bg':'#071c16','--panel':'#0a261e','--panel-2':'#0c2e24','--fg':'#e7fff6','--muted':'#a8dccc','--accent':'#3ddc84','--accent-2':'#00ffd0' } },
    diamond: { vars: { '--bg':'#0a0f18','--panel':'#0e1420','--panel-2':'#111a2a','--fg':'#f5fbff','--muted':'#c6d8f0','--accent':'#9ad8ff','--accent-2':'#e3f3ff' } },
  };
}

function ensureClock() {
  try {
    const state = JSON.parse(localStorage.getItem('tgx_casino_shop_v1') || '{}');
    const enabled = !!(state.items && state.items.clock && state.items.clock.enabled);
    let hud = document.getElementById('money-hud');
    if (!hud) return;
    let clock = document.getElementById('money-clock');
    if (!enabled) { if (clock) clock.remove(); return; }
    if (!clock) {
      clock = document.createElement('div');
      clock.id = 'money-clock';
      clock.style.fontSize = '1rem';
      clock.style.color = 'var(--muted)';
      clock.style.marginTop = '.25rem';
      clock.style.textAlign = 'right';
      hud.appendChild(clock);
    }
    clearInterval(ensureClock._t);
    const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString(); };
    tick();
    ensureClock._t = setInterval(tick, 1000);
  } catch {}
}

function startIncomeLoop() {
  clearInterval(startIncomeLoop._t);
  const pay = () => {
    try {
      const state = JSON.parse(localStorage.getItem('tgx_casino_shop_v1') || '{}');
      const items = state.items || {};
      let inc = 0;
      if (items.stocks1 && items.stocks1.owned && items.stocks1.enabled) inc += 50;
      if (items.stocks2 && items.stocks2.owned && items.stocks2.enabled) inc += 500;
      if (items.stocks3 && items.stocks3.owned && items.stocks3.enabled) inc += 5000;
      if (inc > 0) { try { import('./store.js').then(m => m.addBalance(inc)); } catch { addBalance(inc); } }
    } catch {}
  };
  pay();
  startIncomeLoop._t = setInterval(pay, 5000);
}

// Expose so shop can re-apply after user changes
export function __applyThemeFromShop() {
  try {
    const state = JSON.parse(localStorage.getItem('tgx_casino_shop_v1') || '{}');
    if (state && state.themes && state.themes.equipped) applyTheme(state.themes.equipped);
  } catch {}
  ensureClock();
}

// Reporter sends {username,balance} every 60s if username + NGROK_BASE set
function startReporter() {
  clearInterval(startReporter._t);
  const tick = async () => {
    try {
      const base = localStorage.getItem('tgx_ngrok_base');
      const name = localStorage.getItem('tgx_username');
      if (!base || !name) return;
      const payload = { username: name, balance: getBalance() };
      const url = `${base.replace(/\/$/,'')}/report?ngrok_skip_browser_warning=true`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        // Help bypass ngrok browser warning; server handles CORS preflight
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      }).catch(()=>{});
    } catch {}
  };
  tick();
  startReporter._t = setInterval(tick, 60000);
}

// Prompt once for username (modal), used on initial load or deep links
function ensureUsername() {
  const key = 'tgx_username';
  const existing = localStorage.getItem(key);
  if (existing && existing.trim()) return;
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.background = 'rgba(0,0,0,.5)'; overlay.style.display = 'grid'; overlay.style.placeItems = 'center'; overlay.style.zIndex = '80';
  const panel = document.createElement('div');
  panel.className = 'card stack'; panel.style.maxWidth = '520px'; panel.style.margin = '1rem';
  panel.innerHTML = `
    <h3 style="margin:.25rem 0">Choose a username</h3>
    <p class="muted">This name will appear on the public leaderboard and cannot be changed later.</p>
    <input id="name-input" type="text" placeholder="username (letters, numbers, underscore)" style="padding:.7rem .8rem; border-radius:10px; border:1px solid #2b3a52; background:#0b1322; color:var(--fg);" />
    <div class="row" style="justify-content:flex-end; gap:.5rem">
      <button id="name-submit" class="primary">Confirm</button>
    </div>
    <div id="name-err" class="muted"></div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  function validate(v) {
    const s = (v || '').trim();
    if (s.length < 3) return 'At least 3 characters';
    if (s.length > 20) return 'Max 20 characters';
    if (!/^\w+$/.test(s)) return 'Use letters, numbers, underscore only';
    return '';
  }
  function submit() {
    const input = panel.querySelector('#name-input');
    const err = panel.querySelector('#name-err');
    const msg = validate(input.value);
    if (msg) { err.textContent = msg; return; }
    localStorage.setItem(key, input.value.trim());
    document.body.removeChild(overlay);
  }
  panel.querySelector('#name-submit').addEventListener('click', submit);
  panel.querySelector('#name-input').addEventListener('keydown', (e)=>{ if (e.key==='Enter') submit(); });
  setTimeout(()=> panel.querySelector('#name-input').focus(), 50);
}
