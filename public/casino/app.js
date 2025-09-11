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
  bar: () => import('./bar.js'),
  shop: () => import('./shop.js'),
  blackmarket: () => import('./blackmarket.js'),
  leaderboard: () => import('./leaderboard.js'),
  email: () => import('./email.js'),
  lottery: () => import('./games/lottery.js'),
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

  // Shop menu now uses <details>; no JS required

  // Start background email generator and HUD ping
  initEmailSystem();
  updateEmailPing();

  // Apply any active global bar effects (e.g., Beer blur)
  initGlobalBarEffects();

  // Close Shop menu when navigating into any shop route
  function closeShopMenuIfShopRoute() {
    const key = (location.hash || '').replace(/^#\/?/, '') || 'home';
    if (key === 'shop' || key === 'bar' || key === 'blackmarket') {
      const d = document.querySelector('details.shop-menu');
      if (d && d.open) d.open = false;
    }
  }
  window.addEventListener('hashchange', closeShopMenuIfShopRoute);
  // Also close immediately when clicking a submenu item
  document.addEventListener('click', (e) => {
    const link = e.target && e.target.closest('.shop-panel a');
    if (link) {
      const d = document.querySelector('details.shop-menu');
      if (d && d.open) d.open = false;
    }
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
}

function removeThemeExtras() {
  document.getElementById('theme-fire-style')?.remove();
  document.getElementById('theme-fire-bg')?.remove();
  document.getElementById('theme-rich-style')?.remove();
  document.getElementById('theme-rich-rain')?.remove();
  clearInterval(enableRichTheme._t);
  document.removeEventListener('click', richClickBurst, true);
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
