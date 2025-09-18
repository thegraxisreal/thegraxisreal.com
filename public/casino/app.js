import store, { subscribe, getBalance } from './store.js';
import { formatMoney, formatMoneyExtended } from './format.js';

// Simple hash-based router and dynamic importer
const routes = {
  home: () => import('./home.js'),
  slots: () => import('./games/slots.js'),
  blackjack: () => import('./games/blackjack.js'),
  horse: () => import('./games/horse.js'),
  plinko: () => import('./games/plinko.js'),
  coinflip: () => import('./games/coinflip.js'),
  roulette: () => import('./games/roulette.js'),
  bar: () => import('./bar.js'),
  shop: () => import('./shop_hub.js'),
  blackmarket: () => import('./blackmarket.js'),
  leaderboard: () => import('./leaderboard.js'),
  email: () => import('./email.js'),
  lottery: () => import('./games/lottery.js'),
  scratchers: () => import('./scratchers.js'),
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
  let hudHover = false;
  function fullMoney(n) { return `$${Math.floor(Math.max(0, n)).toLocaleString()}`; }
  function formatHUD(n) { return formatMoneyExtended(n); }
  if (hud) hud.textContent = formatHUD(getBalance());
  // Delta indicator under HUD (ignores stock income)
  let prevBal = getBalance();
  subscribe(({ balance }) => {
    if (!hud) return;
    // Update display respecting hover
    hud.textContent = hudHover ? fullMoney(balance) : formatHUD(balance);
    // Delta logic
    const delta = Math.floor(balance) - Math.floor(prevBal);
    if (delta !== 0) {
      // If delta equals pending stock income, ignore
      const pending = Math.floor(startIncomeLoop._pendingInc || 0);
      if (!(pending && delta === pending)) {
        showMoneyDelta(delta);
      }
      startIncomeLoop._pendingInc = 0;
    }
    prevBal = balance;
  });
  if (hud) {
    hud.addEventListener('mouseenter', () => {
      hudHover = true;
      hud.textContent = fullMoney(getBalance());
    });
    hud.addEventListener('mouseleave', () => {
      hudHover = false;
      hud.textContent = formatHUD(getBalance());
    });
  }

  // Prepare delta container
  const hudWrap = document.getElementById('money-hud');
  if (hudWrap && !document.getElementById('money-delta')) {
    const d = document.createElement('div');
    d.id = 'money-delta';
    hudWrap.appendChild(d);
  }

  // Apply equipped theme from shop state
  try {
    const state = JSON.parse(localStorage.getItem('tgx_casino_shop_v1') || '{}');
    if (state && state.themes && state.themes.equipped) applyTheme(state.themes.equipped);
    applySignFromShop();
  } catch {}

  // Clock HUD if enabled
  ensureClock();

  // Passive income (stocks)
  startIncomeLoop();

  // Start reporting balances every 60s to tunnel server if configured
  // Seed tunnel base if not set yet
  // Allow override via querystring: ?api=https://your-tunnel-hostname.example
  // If not provided, force-set to current default tunnel so old cached values are replaced.
  try {
    const qs = new URLSearchParams(location.search || '');
    const api = qs.get('api');
    if (api && /^https?:\/\//i.test(api)) {
      localStorage.setItem('tgx_ngrok_base', api.replace(/\/$/, ''));
    } else {
      // Force rewrite to current default (update this when tunnel changes)
      localStorage.setItem('tgx_ngrok_base', 'https://station-salaries-relationships-inn.trycloudflare.com');
    }
  } catch {}
  startReporter();

  // Ensure a username is set globally, even on deep links
  ensureUsername();

  // Shop menu now uses <details>; no JS required

  // Start background email generator and HUD ping
  initEmailSystem();
  updateEmailPing();

  // Apply any active global bar effects (e.g., Beer blur)
  initGlobalBarEffects();

  // Close dropdown menus (Shop, Games) when navigating or selecting an item
  function closeDropdownMenus() {
    document.querySelectorAll('details.shop-menu').forEach((d) => { if (d.open) d.open = false; });
  }
  window.addEventListener('hashchange', closeDropdownMenus);
  document.addEventListener('click', (e) => {
    const link = e.target && e.target.closest('.shop-panel a');
    if (link) closeDropdownMenus();
  });

  loadFromHash(location.hash);
});

function applyTheme(id) {
  const themes = getThemes();
  const t = themes[id];
  if (!t) return;
  const r = document.documentElement;
  for (const k in t.vars) r.style.setProperty(k, t.vars[k]);
  // Theme extras
  removeThemeExtras();
  if (id === 'fire') enableFireTheme();
  if (id === 'rich') enableRichTheme();
  if (id === 'veryrich') enableVeryRichTheme();
  if (id === 'matrix') enableMatrixTheme();
  if (id === 'too_much_money') enableTooMuchMoneyTheme();
}

function getThemes() {
  return {
    default: { vars: { '--bg':'#140a1f','--panel':'#0f1420','--panel-2':'#121a2a','--fg':'#e6ebf2','--muted':'#a7b3c7','--accent':'#ffcc00','--accent-2':'#00d4ff' } },
    blue:    { vars: { '--bg':'#0c1024','--panel':'#0f1730','--panel-2':'#101b3a','--fg':'#e8f0ff','--muted':'#a9b8df','--accent':'#3ea6ff','--accent-2':'#74e0ff' } },
    red:     { vars: { '--bg':'#200b0b','--panel':'#2a1010','--panel-2':'#331414','--fg':'#ffecec','--muted':'#f2b0b0','--accent':'#ff6b6b','--accent-2':'#ffd166' } },
    gold:    { vars: { '--bg':'#1e1503','--panel':'#281d05','--panel-2':'#2f230a','--fg':'#fff8e6','--muted':'#e6d8b0','--accent':'#f5c542','--accent-2':'#ffea86' } },
    emerald: { vars: { '--bg':'#071c16','--panel':'#0a261e','--panel-2':'#0c2e24','--fg':'#e7fff6','--muted':'#a8dccc','--accent':'#3ddc84','--accent-2':'#00ffd0' } },
    diamond: { vars: { '--bg':'#0a0f18','--panel':'#0e1420','--panel-2':'#111a2a','--fg':'#f5fbff','--muted':'#c6d8f0','--accent':'#9ad8ff','--accent-2':'#e3f3ff' } },
    fire:    { vars: { '--bg':'#120a06','--panel':'#1c0f08','--panel-2':'#220f0a','--fg':'#ffe9d6','--muted':'#e2b7a0','--accent':'#ff7a18','--accent-2':'#ffd166' } },
    liquid:  { vars: { '--bg':'#ffffff','--panel':'rgba(255,255,255,.35)','--panel-2':'rgba(255,255,255,.25)','--fg':'#0a0f18','--muted':'#6b7686','--accent':'#0ea5e9','--accent-2':'#82cfff' } },
    rich:    { vars: { '--bg':'#08240e','--panel':'#0e2f15','--panel-2':'#12381a','--fg':'#e6ffe6','--muted':'#a8dca8','--accent':'#17c964','--accent-2':'#b8ffb8' } },
    veryrich:{ vars: { '--bg':'#120d02','--panel':'#1a1405','--panel-2':'#231a07','--fg':'#ffeebe','--muted':'#e4c76f','--accent':'#ffd24d','--accent-2':'#fff0a3' } },
    matrix:  { vars: { '--bg':'#030a05','--panel':'#06140a','--panel-2':'#071d11','--fg':'#d7ffe0','--muted':'#6dd89c','--accent':'#21f38c','--accent-2':'#0affd2' } },
    too_much_money:{ vars: { '--bg':'#050b07','--panel':'#102118','--panel-2':'#241807','--fg':'#f8ffe3','--muted':'#d0f5a5','--accent':'#35f089','--accent-2':'#ffd24d' } },
    blackout: { vars: { '--bg':'#040404','--panel':'#0a0a0a','--panel-2':'#101010','--fg':'#f2f2f2','--muted':'#a3a3a3','--accent':'#ff5c58','--accent-2':'#ffb347','--shadow':'0 18px 36px rgba(0,0,0,.55)','--border':'rgba(255,255,255,.05)' } },
    love_plinko: { vars: { '--bg':'radial-gradient(circle, rgba(255,79,172,.12) 1px, transparent 1px) 0 0/14px 14px, #040207','--panel':'#150424','--panel-2':'#1d0633','--fg':'#fceaff','--muted':'#c69fff','--accent':'#ff4fac','--accent-2':'#7dd3ff','--shadow':'0 24px 50px rgba(31,3,53,.6)','--border':'rgba(255,79,172,.18)' } },
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
      if (items.stocks4 && items.stocks4.owned && items.stocks4.enabled) inc += 50000;
      if (items.stocks5 && items.stocks5.owned && items.stocks5.enabled) inc += 500000;
      if (items.stocks6 && items.stocks6.owned && items.stocks6.enabled) inc += 1000000;
      if (items.stocks7 && items.stocks7.owned && items.stocks7.enabled) inc += 5000000;
      if (items.stocks8 && items.stocks8.owned && items.stocks8.enabled) inc += 50000000;
      if (items.stocks9 && items.stocks9.owned && items.stocks9.enabled) inc += 1000000000;
      if (inc > 0) {
        // mark pending so HUD delta can ignore this passive income
        startIncomeLoop._pendingInc = inc;
        try { import('./store.js').then(m => m.addBalance(inc)); } catch { addBalance(inc); }
      }
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
  applySignFromShop();
}

function applySignFromShop() {
  try {
    const state = JSON.parse(localStorage.getItem('tgx_casino_shop_v1') || '{}');
    const id = state && state.signs && state.signs.equipped || 'classic';
    applySign(id);
  } catch { applySign('classic'); }
}

function applySign(id) {
  const el = document.getElementById('brand-sign');
  if (!el) return;
  removeSignExtras();
  el.classList.remove('sign-diamond','sign-epilepsy','sign-gold','sign-super-epilepsy','sign-neon','sign-cursive');
  el.style.removeProperty('background');
  el.style.removeProperty('-webkit-background-clip');
  el.style.removeProperty('background-clip');
  el.style.removeProperty('-webkit-text-fill-color');
  el.style.removeProperty('color');
  el.style.removeProperty('text-shadow');
  el.style.removeProperty('font-family');
  el.style.removeProperty('font-size');
  el.style.removeProperty('letter-spacing');
  el.style.removeProperty('text-transform');
  el.style.removeProperty('filter');
  el.style.removeProperty('animation');
  el.style.removeProperty('position');
  el.textContent = 'thegraxisreal casino';
  if (id === 'diamond_sign') enableDiamondSign(el);
  else if (id === 'epilepsy_sign') enableEpilepsySign(el);
  else if (id === 'gold_sign') enableGoldSign(el);
  else if (id === 'name_sign') enableNameSign(el);
  else if (id === 'super_epilepsy_sign') enableSuperEpilepsySign(el);
  else if (id === 'neon_sign') enableNeonSign(el);
  else if (id === 'cursive_sign') enableCursiveSign(el);
}

function removeSignExtras() {
  document.getElementById('sign-diamond-style')?.remove();
  document.getElementById('sign-epilepsy-style')?.remove();
  document.getElementById('sign-gold-style')?.remove();
  document.getElementById('sign-super-epilepsy-style')?.remove();
  document.getElementById('sign-neon-style')?.remove();
  document.getElementById('sign-cursive-style')?.remove();
  clearInterval(enableGoldSign._t);
}

function enableDiamondSign(el) {
  const style = document.createElement('style');
  style.id = 'sign-diamond-style';
  style.textContent = `
    .sign-diamond { background: linear-gradient(90deg, #e3f3ff, #9ad8ff, #e3f3ff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 12px rgba(154,216,255,.45); }
  `;
  document.head.appendChild(style);
  el.classList.add('sign-diamond');
}

function enableEpilepsySign(el) {
  const style = document.createElement('style');
  style.id = 'sign-epilepsy-style';
  style.textContent = `
    @keyframes strobe { 0%{ color:#000; background:#fff; } 50%{ color:#fff; background:#000; } 100%{ color:#000; background:#fff; } }
    .sign-epilepsy { animation: strobe .12s linear infinite; padding:.1rem .35rem; border-radius:8px; }
  `;
  document.head.appendChild(style);
  el.classList.add('sign-epilepsy');
}

function enableGoldSign(el) {
  const style = document.createElement('style');
  style.id = 'sign-gold-style';
  style.textContent = `
    @keyframes goldShimmer { 0%{ background-position:0% 50%; } 100%{ background-position:200% 50%; } }
    .sign-gold { 
      background: linear-gradient(90deg, #fff3b0, #ffd24d, #b8860b, #ffd24d, #fff3b0);
      background-size: 200% 100%;
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
      text-shadow: 0 0 10px rgba(255,210,77,.35);
      animation: goldShimmer 3s linear infinite;
      position: relative;
    }
    .gold-sparkle{ position:fixed; z-index:90; color:#ffe9a3; text-shadow:0 0 6px rgba(255,210,77,.8); pointer-events:none; opacity:.9; }
    @keyframes sparkle { 0%{ transform:translateY(0) scale(0.8) rotate(0deg); opacity:.0 } 20%{opacity:1} 100%{ transform:translateY(40px) scale(1.2) rotate(180deg); opacity:0 } }
  `;
  document.head.appendChild(style);
  el.classList.add('sign-gold');
  const spawn = () => {
    const r = el.getBoundingClientRect();
    const x = r.left + Math.random()*r.width;
    const y = r.top + Math.random()*r.height*0.6;
    const n = document.createElement('div');
    n.className = 'gold-sparkle'; n.textContent = '✦';
    n.style.left = x+'px'; n.style.top = y+'px'; n.style.animation = `sparkle ${700+Math.random()*600}ms ease-out forwards`;
    document.body.appendChild(n);
    setTimeout(()=>n.remove(), 1400);
  };
  enableGoldSign._t = setInterval(()=>{ for(let i=0;i<2;i++) spawn(); }, 500);
}

function enableNameSign(el) {
  const raw = (localStorage.getItem('tgx_username')||'').trim();
  const name = raw || 'Player';
  el.textContent = `${name} casino`;
}

function enableSuperEpilepsySign(el) {
  const style = document.createElement('style');
  style.id = 'sign-super-epilepsy-style';
  style.textContent = `
    @keyframes megaStrobe {
      0%{ color:#fff; background:#ff005c; box-shadow:0 0 24px rgba(255,0,92,.75); }
      25%{ color:#000; background:#00f0ff; box-shadow:0 0 26px rgba(0,240,255,.75); }
      50%{ color:#fff; background:#00ff7f; box-shadow:0 0 28px rgba(0,255,127,.75); }
      75%{ color:#000; background:#ffea00; box-shadow:0 0 30px rgba(255,234,0,.8); }
      100%{ color:#fff; background:#ff005c; box-shadow:0 0 24px rgba(255,0,92,.75); }
    }
    .sign-super-epilepsy { position:relative; padding:.2rem .55rem; border-radius:14px; text-transform:uppercase; animation:megaStrobe .08s linear infinite, flicker 6s infinite; }
    .sign-super-epilepsy::after { content:''; position:absolute; inset:-10px; border-radius:16px; border:2px dashed rgba(255,255,255,.75); opacity:.85; mix-blend-mode:screen; animation:megaStrobe .12s linear infinite reverse; }
  `;
  document.head.appendChild(style);
  el.classList.add('sign-super-epilepsy');
}

function enableNeonSign(el) {
  const style = document.createElement('style');
  style.id = 'sign-neon-style';
  style.textContent = `
    @keyframes neonFlow { 0%{ background-position:0% 50%; } 100%{ background-position:200% 50%; } }
    @keyframes neonPulse { 0%,100%{ opacity:1; filter:drop-shadow(0 0 12px rgba(0,255,234,.8)) drop-shadow(0 0 32px rgba(255,0,255,.45)); } 50%{ opacity:.92; filter:drop-shadow(0 0 18px rgba(0,255,234,.9)) drop-shadow(0 0 42px rgba(255,0,255,.6)); } }
    .sign-neon { position:relative; background:linear-gradient(120deg,#00f6ff,#0d6bff,#ff00ff,#00f6ff); background-size:260% 260%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:4px; text-transform:uppercase; animation:neonFlow 3.4s linear infinite, neonPulse 2.4s ease-in-out infinite; }
    .sign-neon::before { content:''; position:absolute; inset:-14px; border-radius:18px; background:radial-gradient(circle at 25% 35%, rgba(0,255,234,.32), transparent 60%), radial-gradient(circle at 75% 40%, rgba(255,0,255,.28), transparent 70%); filter:blur(18px); opacity:.85; animation:neonFlow 4.6s linear infinite reverse; z-index:-1; }
  `;
  document.head.appendChild(style);
  el.classList.add('sign-neon');
}

function enableCursiveSign(el) {
  const style = document.createElement('style');
  style.id = 'sign-cursive-style';
  style.textContent = `
    .sign-cursive { font-family:'Brush Script MT','Lucida Handwriting','Pacifico',cursive; font-weight:400; font-size:clamp(2.5rem,6vw,3.4rem); letter-spacing:.08em; text-transform:none !important; color:#ffe6fd; text-shadow:0 0 14px rgba(255,143,232,.6), 0 0 30px rgba(255,86,166,.35); }
  `;
  document.head.appendChild(style);
  el.classList.add('sign-cursive');
  el.textContent = 'Thegraxisreal casino';
}

function removeThemeExtras() {
  document.getElementById('theme-fire-style')?.remove();
  document.getElementById('theme-fire-bg')?.remove();
  document.getElementById('theme-rich-style')?.remove();
  document.getElementById('theme-rich-rain')?.remove();
  document.getElementById('theme-veryrich-style')?.remove();
  document.getElementById('theme-veryrich-rain')?.remove();
  document.getElementById('theme-matrix-style')?.remove();
  document.getElementById('theme-matrix-rain')?.remove();
  document.getElementById('theme-too-much-style')?.remove();
  document.getElementById('theme-too-much-glow')?.remove();
  document.getElementById('theme-too-much-overlay')?.remove();
  document.getElementById('theme-too-much-burst')?.remove();
  clearInterval(enableRichTheme._t);
  clearInterval(enableVeryRichTheme._t);
  clearInterval(enableMatrixTheme._t);
  clearInterval(enableTooMuchMoneyTheme._t);
  document.removeEventListener('click', richClickBurst, true);
  document.body.classList.remove('theme-too-much');
}
function enableFireTheme() {
  const style = document.createElement('style');
  style.id = 'theme-fire-style';
  style.textContent = `
    @keyframes fireShift { 0%{ filter:hue-rotate(0deg) saturate(1.1);} 50%{ filter:hue-rotate(20deg) saturate(1.4);} 100%{ filter:hue-rotate(0deg) saturate(1.1);} }
    .fire-layer { position: fixed; inset: -10% -10% 0 -10%; z-index: -1; background:
      radial-gradient(1200px 600px at 60% -10%, rgba(255,150,0,.22), transparent),
      radial-gradient(800px 500px at 30% 0%, rgba(255,60,0,.18), transparent),
      radial-gradient(600px 400px at 70% 10%, rgba(255,200,0,.16), transparent),
      linear-gradient(#1a0d07,#120a06);
      animation: fireShift 6s ease-in-out infinite; pointer-events:none; }
  `;
  document.head.appendChild(style);
  const layer = document.createElement('div');
  layer.id = 'theme-fire-bg';
  layer.className = 'fire-layer';
  document.body.appendChild(layer);
}
function enableRichTheme() {
  const style = document.createElement('style');
  style.id = 'theme-rich-style';
  style.textContent = `.money-emoji{position:fixed;will-change:transform,opacity;z-index:1200;pointer-events:none}@keyframes fall{0%{transform:translateY(-10vh) rotate(0deg);opacity:0}10%{opacity:1}100%{transform:translateY(110vh) rotate(360deg);opacity:0}}`;
  document.head.appendChild(style);
  const rain = document.createElement('div'); rain.id='theme-rich-rain'; document.body.appendChild(rain);
  enableRichTheme._t = setInterval(()=>{ for(let i=0;i<3;i++) spawnEmoji(Math.random()*window.innerWidth, -20, 1+Math.random()*1.5); },700);
  document.addEventListener('click', richClickBurst, true);
}
function richClickBurst(e){
  const t=e.target; if(!t) return; if(!(t.closest('button')||t.closest('.btn'))) return;
  const rect=t.getBoundingClientRect(); const x=rect.left+rect.width/2; const y=rect.top+rect.height/2;
  for(let i=0;i<6;i++) spawnEmoji(x+(Math.random()-0.5)*20, y+(Math.random()-0.5)*10, 0.9+Math.random()*0.6, true);
}
function spawnEmoji(x,y,speed=1){ const n=document.createElement('div'); n.className='money-emoji'; n.textContent='💸'; n.style.left=x+'px'; n.style.top=y+'px'; n.style.fontSize=(18+Math.random()*10)+'px'; n.style.animation=`fall ${3/speed}s linear forwards`; document.body.appendChild(n); setTimeout(()=>n.remove(), (3000/speed)|0); }

function enableVeryRichTheme() {
  const style = document.createElement('style');
  style.id = 'theme-veryrich-style';
  style.textContent = `.gold-emoji{position:fixed;will-change:transform,opacity;z-index:1200;pointer-events:none}@keyframes goldfall{0%{transform:translateY(-10vh) rotate(0deg);opacity:0}10%{opacity:1}100%{transform:translateY(110vh) rotate(360deg);opacity:0}}`;
  document.head.appendChild(style);
  const rain = document.createElement('div'); rain.id='theme-veryrich-rain'; document.body.appendChild(rain);
  const svgGoldBar = (w=28) => `
    <svg width="${w}" height="${Math.round(w*0.6)}" viewBox="0 0 140 84" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gb1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff3b0"/>
          <stop offset="0.5" stop-color="#ffd24d"/>
          <stop offset="1" stop-color="#b8860b"/>
        </linearGradient>
      </defs>
      <path d="M18 58 L42 18 H98 L122 58 Z" fill="url(#gb1)" stroke="#8f6b12" stroke-width="6"/>
      <rect x="22" y="58" width="96" height="12" rx="6" fill="#d6a419" stroke="#8f6b12" stroke-width="4"/>
    </svg>`;
  const emit = (x,y,speed=1)=>{
    const n=document.createElement('div'); n.className='gold-emoji';
    n.innerHTML = svgGoldBar(20 + Math.floor(Math.random()*16));
    n.style.left=(x||Math.random()*window.innerWidth)+'px';
    n.style.top=(y||-20)+'px';
    n.style.position='fixed';
    n.style.animation=`goldfall ${3/speed}s linear forwards`;
    document.body.appendChild(n);
    setTimeout(()=>n.remove(), (3000/speed)|0);
  };
  enableVeryRichTheme._t = setInterval(()=>{ for(let i=0;i<4;i++) emit(); },600);
}

function enableMatrixTheme() {
  const style = document.createElement('style');
  style.id = 'theme-matrix-style';
  style.textContent = `
    @keyframes matrixFall { 0%{ transform: translate3d(0,-20vh,0); opacity:0; } 10%{ opacity:.85; } 100%{ transform: translate3d(0,110vh,0); opacity:0; } }
    #theme-matrix-rain { position:fixed; inset:0; pointer-events:none; z-index:95; overflow:hidden; mix-blend-mode:screen; }
    .matrix-stream { position:absolute; top:-30vh; color:#24ff99; font-family:'IBM Plex Mono','Fira Code',monospace; font-weight:600; text-shadow:0 0 12px rgba(36,255,153,.55); white-space:nowrap; opacity:.85; animation: matrixFall var(--dur,4s) linear forwards; }
    .matrix-stream span { display:block; line-height:1.05em; }
    .matrix-stream span.head { color:#d7ffe0; text-shadow:0 0 16px rgba(215,255,224,.85); }
  `;
  document.head.appendChild(style);
  const host = document.createElement('div');
  host.id = 'theme-matrix-rain';
  document.body.appendChild(host);
  const glyphs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%@&';
  const spawn = () => {
    if (!document.body.contains(host)) return;
    const width = Math.max(typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280, 320);
    const col = document.createElement('div');
    col.className = 'matrix-stream';
    const duration = 3600 + Math.random() * 2600;
    col.style.setProperty('--dur', duration + 'ms');
    col.style.animationDuration = duration + 'ms';
    col.style.left = Math.round(Math.random() * width) + 'px';
    col.style.fontSize = (14 + Math.random() * 10) + 'px';
    const length = 12 + Math.floor(Math.random() * 14);
    let html = '';
    for (let i = 0; i < length; i++) {
      const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
      const cls = i === 0 ? ' class="head"' : '';
      html += `<span${cls}>${ch}</span>`;
    }
    col.innerHTML = html;
    host.appendChild(col);
    setTimeout(() => { col.remove(); }, duration + 800);
  };
  for (let i = 0; i < 24; i++) spawn();
  clearInterval(enableMatrixTheme._t);
  enableMatrixTheme._t = setInterval(spawn, 170);
}

function enableTooMuchMoneyTheme() {
  enableRichTheme();
  enableVeryRichTheme();
  const style = document.createElement('style');
  style.id = 'theme-too-much-style';
  style.textContent = `
    @keyframes glowRotate { 0%{ transform: rotate(0deg); } 100%{ transform: rotate(360deg); } }
    @keyframes cashPulse { 0%{ opacity:.35; filter:hue-rotate(0deg); } 50%{ opacity:.6; filter:hue-rotate(30deg); } 100%{ opacity:.45; filter:hue-rotate(-20deg); } }
    @keyframes blingDrop { 0%{ transform:translate3d(0,-25vh,0) scale(.6); opacity:0; } 15%{ opacity:1; } 60%{ transform:translate3d(var(--sway,0),60vh,0) scale(1.05); opacity:.92; } 100%{ transform:translate3d(calc(var(--sway,0)*1.2),110vh,0) scale(1.3); opacity:0; } }
    #theme-too-much-glow, #theme-too-much-overlay { position:fixed; inset:-12%; pointer-events:none; }
    #theme-too-much-glow { z-index:-1; background:conic-gradient(from 0deg, rgba(53,240,137,.55), rgba(255,210,77,.35), rgba(53,240,137,.55)); filter:blur(140px); opacity:.55; animation:glowRotate 32s linear infinite; }
    #theme-too-much-overlay { z-index:8; mix-blend-mode:screen; background:
      radial-gradient(circle at 15% 20%, rgba(53,240,137,.25), transparent 55%),
      radial-gradient(circle at 85% 25%, rgba(255,210,77,.22), transparent 60%),
      radial-gradient(circle at 50% 80%, rgba(255,255,255,.08), transparent 65%);
      animation:cashPulse 7s ease-in-out infinite alternate;
    }
    #theme-too-much-burst { position:fixed; inset:0; pointer-events:none; z-index:1200; overflow:hidden; }
    .too-much-bling { position:absolute; top:-10vh; font-size:28px; opacity:0; text-shadow:0 0 16px rgba(255,234,128,.85); filter:drop-shadow(0 0 10px rgba(255,210,77,.45)); animation:blingDrop 4000ms ease-in-out forwards; }
    .too-much-bling.alt { text-shadow:0 0 18px rgba(111,255,200,.85); filter:drop-shadow(0 0 12px rgba(53,240,137,.6)); }
  `;
  document.head.appendChild(style);
  document.body.classList.add('theme-too-much');
  const glow = document.createElement('div'); glow.id = 'theme-too-much-glow'; document.body.appendChild(glow);
  const overlay = document.createElement('div'); overlay.id = 'theme-too-much-overlay'; document.body.appendChild(overlay);
  const burstHost = document.createElement('div'); burstHost.id = 'theme-too-much-burst'; document.body.appendChild(burstHost);
  const pool = ['💰','💎','👑','🪙','💵','🤑'];
  const spawn = () => {
    if (!document.body.contains(burstHost)) return;
    const node = document.createElement('div');
    node.className = 'too-much-bling';
    if (Math.random() > 0.6) node.classList.add('alt');
    node.textContent = pool[Math.floor(Math.random() * pool.length)];
    const left = Math.random() * 100;
    node.style.left = `${left}vw`;
    node.style.fontSize = `${26 + Math.random() * 22}px`;
    const duration = 3200 + Math.random() * 1800;
    node.style.animationDuration = `${duration}ms`;
    node.style.setProperty('--sway', `${(Math.random() - 0.5) * 18}vw`);
    burstHost.appendChild(node);
    setTimeout(() => { node.remove(); }, duration + 800);
  };
  for (let i = 0; i < 6; i++) spawn();
  clearInterval(enableTooMuchMoneyTheme._t);
  enableTooMuchMoneyTheme._t = setInterval(() => {
    for (let i = 0; i < 3; i++) spawn();
  }, 1000);
}

// Render ephemeral delta under HUD
function showMoneyDelta(delta) {
  try {
    const hudWrap = document.getElementById('money-hud');
    if (!hudWrap) return;
    const host = document.getElementById('money-delta') || (() => { const d = document.createElement('div'); d.id='money-delta'; hudWrap.appendChild(d); return d; })();
    const node = document.createElement('div');
    node.className = 'money-delta ' + (delta > 0 ? 'plus' : 'minus');
    const abs = Math.abs(delta);
    node.textContent = (delta > 0 ? '+$' : '-$') + Math.floor(abs).toLocaleString();
    host.appendChild(node);
    setTimeout(() => node.remove(), 1800);
  } catch {}
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

// (shop menu logic removed)

// ---------------- Email system (background) ----------------
function loadEmailState() {
  try {
    const s = JSON.parse(localStorage.getItem('tgx_email_state_v1') || '{}');
    s.emails = Array.isArray(s.emails) ? s.emails : [];
    s.unread = Math.max(0, s.unread | 0);
    if (!Number.isFinite(s.startBalance)) s.startBalance = 100000;
    return s;
  } catch { return { emails: [], unread: 0, startBalance: 100000 }; }
}
function saveEmailState(s) { try { localStorage.setItem('tgx_email_state_v1', JSON.stringify(s)); } catch {} }

function initEmailSystem() {
  // seed start balance once
  try { if (!localStorage.getItem('tgx_start_balance_v1')) localStorage.setItem('tgx_start_balance_v1', '100000'); } catch {}
  scheduleNextEmail();
  // Clear unread when viewing email tab
  window.addEventListener('hashchange', () => {
    if ((location.hash || '').replace(/^#\/?/, '') === 'email') {
      const s = loadEmailState(); s.unread = 0; saveEmailState(s); updateEmailPing();
    }
  });
  const ping = document.getElementById('email-ping');
  if (ping) ping.addEventListener('click', () => { location.hash = '#/email'; });
}

function scheduleNextEmail() {
  clearTimeout(scheduleNextEmail._t);
  const delay = 60000 + Math.random() * 60000; // 60–120s
  scheduleNextEmail._t = setTimeout(() => { try { generateEmail(); } finally { scheduleNextEmail(); } }, delay);
}

function updateEmailPing() {
  const ping = document.getElementById('email-ping');
  if (!ping) return;
  const s = loadEmailState();
  ping.style.display = s.unread > 0 ? 'block' : 'none';
}

function generateEmail() {
  const now = Date.now();
  const balance = getBalance();
  const s = loadEmailState();
  const start = Number(localStorage.getItem('tgx_start_balance_v1') || s.startBalance || 100000);
  const profit = Math.max(0, balance - start);

  const sender = pickRandom(SENDERS);
  const tpl = pickRandom(TEMPLATES(balance));
  // Always use TOTAL balance with a strong sink: 30% – 100%
  const percent = randIn(0.30, 1.00);
  const basis = 'total';
  const amountBase = balance;
  let requested = Math.floor(amountBase * percent);
  if (!Number.isFinite(requested) || requested <= 0) requested = Math.floor(randIn(10, 120));
  // Clamp to available funds (allow up to 100%)
  requested = Math.max(1, Math.min(requested, Math.floor(balance)));

  const email = {
    id: String(now) + '_' + Math.floor(Math.random() * 1e6),
    ts: now,
    sender,
    subject: tpl.subject(sender),
    body: tpl.body(sender),
    percent: Math.round(percent * 100),
    basis,
    requested,
    read: false,
  };
  s.emails.push(email);
  while (s.emails.length > 5) s.emails.shift();
  s.unread = (s.unread | 0) + 1;
  saveEmailState(s);
  updateEmailPing();
  try { window.dispatchEvent(new CustomEvent('tgx-email-added')); } catch {}
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randIn(a, b) { return a + Math.random() * (b - a); }

const SENDERS = [
  'Uncle Frank','Aunt Marge','Cousin Vinny','Roommate Greg','Neighbor Linda','Boss (Oops)','High School Friend','Random Influencer','IRS?','Prince of Bel‑Air',
  'Gym Buddy','Bowling League','Your Dentist','Ex‑Coworker','Crypto Bro','The Landlord','Streamer You Follow','Barista','HR Robot','Tech Support',
  'Charity (Totally Real)','Parking Authority','Local Wizard','Space Camp','Pet Sitter','Time Traveler','Pirate Captain','The Algorithm','Night Club Promoter','Lucky Leprechaun'
];

function TEMPLATES(balance) {
  return [
    { minPct:.3, maxPct:.9, basis:'profit', subject:(s)=>`${s} needs a small favor`, body:(s)=>`Hey, could you spot me a cut from your recent wins? Promise I’ll pay you back... eventually.` },
    { minPct:.5, maxPct:.8, basis:'profit', subject:(s)=>`It’s ${s} — emergency!`, body:()=>`My chair exploded. Don’t ask. I need a replacement and you have “disposable income”.` },
    { minPct:.2, maxPct:.6, basis:'profit', subject:(s)=>`${s}: Business opportunity`, body:()=>`Limited‑time investment in artisanal AI‑powered birdhouses. We just need seed cash.` },
    { minPct:.6, maxPct:.9, basis:'profit', subject:(s)=>`${s} says: Bro please`, body:()=>`Listen. I would never ask. But this time I am asking. Big time.` },
    { minPct:.3, maxPct:.5, basis:'profit', subject:()=>`Parking Ticket Department`, body:()=>`We noticed your car parked near a casino. That’s a fee now. It’s a new thing.` },
    { minPct:.4, maxPct:.7, basis:'profit', subject:()=>`Gym dues overdue`, body:()=>`You haven’t been in months, but the vibes fee compounds. Help the vibes.` },
    { minPct:.7, maxPct:.9, basis:'profit', subject:()=>`Space Camp Scholarship`, body:()=>`Send a kid to space (briefly). They’ll wave at you from the stratosphere.` },
    { minPct:.2, maxPct:.4, basis:'profit', subject:()=>`Local Wizard Invoice`, body:()=>`You stepped over a chalk circle. The ward must be repainted. Arts & crafts aren’t free.` },
    { minPct:.5, maxPct:.9, basis:'profit', subject:()=>`Crypto Bro Needs Fiat`, body:()=>`It’s complicated. It’s actually simple. Just send cash. We’ll all make it.` },
    { minPct:.3, maxPct:.6, basis:'profit', subject:()=>`Tech Support #A113`, body:()=>`We fixed your winnings from the cloud. Maintenance fee applies.` },
    { minPct:.2, maxPct:.3, basis:'profit', subject:()=>`Charity: Save the Pixels`, body:()=>`Every pixel deserves a home. Your donation rescues low‑res sprites.` },
    { minPct:.8, maxPct:.9, basis:'profit', subject:(s)=>`${s} — urgent wedding fund`, body:()=>`Venue wants 8 inflatable swans. You understand.` },
    { minPct:.4, maxPct:.7, basis:'profit', subject:()=>`Pet Sitter SOS`, body:()=>`Your fish learned taxes. I need a raise.` },
    { minPct:.5, maxPct:.9, basis:'auto', subject:()=>`IRS… probably`, body:()=>`This is definitely real. Send a percentage to remain breathtakingly compliant.` },
    { minPct:.6, maxPct:.9, basis:'auto', subject:()=>`From The Algorithm`, body:()=>`Your generosity is trending. Confirm by sending a proportional offering.` },
  ];
}

// Debug/testing hook: force-generate an email immediately
export function __debugAddEmail() {
  try { generateEmail(); } catch {}
}

// ---------------- Global Bar Effects (persist across pages) ----------------
function getBarEffect() {
  try { return JSON.parse(localStorage.getItem('tgx_global_effect') || 'null'); } catch { return null; }
}
function setBarEffect(effect) {
  if (effect) localStorage.setItem('tgx_global_effect', JSON.stringify(effect));
  else localStorage.removeItem('tgx_global_effect');
}
function applyBarEffect() {
  const eff = getBarEffect();
  const now = Date.now();
  const body = document.body;
  if (!body) return;
  // Clear all
  body.classList.remove('global-blur');
  if (!eff) return;
  if (eff.until && now >= eff.until) { setBarEffect(null); return; }
  if (eff.type === 'blur') {
    body.classList.add('global-blur');
  }
}
function initGlobalBarEffects() {
  applyBarEffect();
  clearInterval(initGlobalBarEffects._t);
  initGlobalBarEffects._t = setInterval(applyBarEffect, 1000);
  window.addEventListener('hashchange', applyBarEffect);
}
