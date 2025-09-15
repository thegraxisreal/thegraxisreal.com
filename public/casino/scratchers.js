import { canAfford, addBalance } from './store.js';
import { formatMoneyExtended as fmt } from './format.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'scratchers';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Scratchers</h2>
      <div class="tag">Instant Win Cards</div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a;">
      <div id="sc-grid" class="store-grid"></div>
    </div>
  `;
  root.appendChild(wrap);

  const grid = wrap.querySelector('#sc-grid');
  grid.innerHTML = '';

  const SCRATCHERS = [
    { id:'tgx_billions', name:'Thegraxisreal Billions', price:100_000, prize:100_000_000_000, blurb:'Pumpkin themed. Match 3 🎃 to win 100B.', cover: () => coverPumpkin(), theme:'#ff7a18', winSymbol: () => symPumpkin(), miss:[() => symLeaf(), () => symGhost()] },
    { id:'charlie_chops', name:'Charlie Chops', price:1_000_000, prize:100_000_000_000_000, blurb:'Match 3 Charlies to win 100T.', cover: () => coverCharlie(), theme:'#ffd166', winSymbol: () => symCharlie(), miss:[() => symMug(), () => symHat()] },
    { id:'neon_jackpot', name:'Neon Jackpot', price:250_000, prize:10_000_000_000, blurb:'Match 3 ★ to win 10B.', cover: () => coverNeon(), theme:'#74e0ff', winSymbol: () => symStar(), miss:[() => symBolt(), () => symMoon()] },
    { id:'diamond_dazzle', name:'Diamond Dazzle', price:5_000_000, prize:20_000_000_000_000, blurb:'Match 3 💎 to win 20T.', cover: () => coverDiamond(), theme:'#9ad8ff', winSymbol: () => symDiamond(), miss:[() => symRing(), () => symCrown()] },
  ];

  SCRATCHERS.forEach(sc => {
    const card = document.createElement('div');
    card.className = 'store-card';
    card.innerHTML = `
      <div class="store-thumb">${sc.cover()}</div>
      <div class="stack">
        <div class="store-name"><span>${sc.name}</span></div>
        <div class="store-desc">${sc.blurb}</div>
      </div>
      <div class="store-cta">
        <div class="price">${fmt(sc.price)}</div>
        <button class="primary xs" data-buy="${sc.id}">Buy</button>
      </div>
    `;
    card.querySelector('[data-buy]')?.addEventListener('click', () => {
      if (!canAfford(sc.price)) return;
      addBalance(-sc.price);
      const win = Math.random() < 0.10; // 1 in 10 chance
      openScratcher(sc, win);
    });
    grid.appendChild(card);
  });

  cleanup = () => { wrap.remove(); };
}

export function unmount() { cleanup(); cleanup = () => {}; }

// ---- Visuals ----
function coverPumpkin() {
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
function coverCharlie() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="124" height="84" rx="12" fill="#0e1524" stroke="#20304a"/>
    <g transform="translate(52,18) scale(.6)">${charlieMiniSvg()}</g>
    <text x="70" y="90" text-anchor="middle" fill="#ffd166" font-weight="800" font-size="12">Charlie Chops</text>
  </svg>`;
}
function coverNeon() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="124" height="84" rx="12" fill="#0a0f18" stroke="#20304a"/>
    <text x="70" y="34" text-anchor="middle" fill="#74e0ff" font-weight="900" font-size="14">Neon Jackpot</text>
    <text x="70" y="54" text-anchor="middle" fill="#a8dfff" opacity=".9" font-size="10">Match 3 ★ to win</text>
    <text x="70" y="72" text-anchor="middle" fill="#74e0ff" font-weight="800" font-size="12">10 Billion</text>
  </svg>`;
}
function coverDiamond() {
  return `<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="124" height="84" rx="12" fill="#0e1420" stroke="#20304a"/>
    <path d="M70 18 L100 40 L70 82 L40 40 Z" fill="#9ad8ff" opacity=".9"/>
    <path d="M70 18 L85 40 L55 40 Z" fill="#e3f3ff" opacity=".6"/>
  </svg>`;
}

function charlieMiniSvg() {
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

function symPumpkin(){ return emojiBox('🎃'); }
function symLeaf(){ return emojiBox('🍁'); }
function symGhost(){ return emojiBox('👻'); }
function symCharlie(){ return `<div style="display:grid;place-items:center;width:100%;height:100%"><div style="transform:scale(1)">${charlieMiniSvg()}</div></div>`; }
function symMug(){ return emojiBox('🍺'); }
function symHat(){ return emojiBox('🎩'); }
function symStar(){ return emojiBox('★'); }
function symBolt(){ return emojiBox('⚡'); }
function symMoon(){ return emojiBox('🌙'); }
function symDiamond(){ return emojiBox('💎'); }
function symRing(){ return emojiBox('💍'); }
function symCrown(){ return emojiBox('👑'); }

function emojiBox(ch) { return `<div style="display:grid;place-items:center;width:100%;height:100%;font-size:46px">${escapeHtml(ch)}</div>`; }

function openScratcher(def, isWin) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.zIndex = '1200';
  // Subtle darken + blur, not a full gray-out
  overlay.style.background = 'rgba(0,0,0,.22)';
  overlay.style.backdropFilter = 'blur(4px)';
  overlay.style.webkitBackdropFilter = 'blur(4px)';
  overlay.style.display = 'grid'; overlay.style.placeItems = 'center';

  const panel = document.createElement('div');
  panel.className = 'card';
  panel.style.width = 'min(680px, 96vw)';
  panel.style.background = '#0e1524'; panel.style.borderColor = '#20304a';
  panel.style.padding = '1rem'; panel.style.borderRadius = '12px';
  panel.style.boxShadow = '0 20px 60px rgba(0,0,0,.45)';
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

  const winner = isWin;
  const slots = [0,1,2].map(()=>({html:''}));
  if (winner) slots.forEach(s => s.html = def.winSymbol());
  else {
    const winIdx = Math.floor(Math.random()*3);
    for (let i=0;i<3;i++) slots[i].html = (i===winIdx) ? def.winSymbol() : def.miss[Math.floor(Math.random()*def.miss.length)]();
    if (slots.every(s=>s.html===slots[0].html)) slots[2].html = def.miss[0]();
  }

  const revealed = [false,false,false];
  slots.forEach((s, i) => {
    const cell = document.createElement('div');
    cell.style.position='relative'; cell.style.height='160px'; cell.style.border='1px solid #20304a'; cell.style.borderRadius='8px';
    cell.style.overflow='hidden'; cell.style.background='#0b1322';
    const content = document.createElement('div'); content.innerHTML = s.html; content.style.width='100%'; content.style.height='100%';
    cell.appendChild(content);
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400;
    canvas.style.position='absolute'; canvas.style.inset='0'; canvas.style.width='100%'; canvas.style.height='100%';
    cell.appendChild(canvas);
    area.appendChild(cell);
    initScratchCanvas(canvas, def.theme || '#bbb', () => { revealed[i] = true; settleIfDone(); });
  });

  function settleIfDone() {
    if (revealed.every(Boolean)) {
      if (winner) {
        msg.innerHTML = `<div class="row" style="gap:.5rem; align-items:center"><strong style="color:${def.theme}">WINNER!</strong><div>Prize:</div><div class="money">${fmt(def.prize)}</div></div>`;
        try { addBalance(def.prize); } catch {}
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
  const grad = ctx.createLinearGradient(0,0,W,H);
  grad.addColorStop(0, shade(color, -20));
  grad.addColorStop(0.5, shade(color, 0));
  grad.addColorStop(1, shade(color, 20));
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i=0;i<40;i++) { const x=Math.random()*W, y=Math.random()*H, w=60*Math.random(), h=8; ctx.fillRect(x,y,w,h); }

  let scratching = false; let erased = 0; const RevealFrac = 0.55;
  const rect = () => canvas.getBoundingClientRect();
  const clearAt = (clientX, clientY) => {
    const r = rect();
    const x = (clientX - r.left) * (W / r.width);
    const y = (clientY - r.top) * (H / r.height);
    ctx.globalCompositeOperation = 'destination-out';
    const radius = 24;
    ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    erased += (Math.PI*radius*radius)/(W*H);
    if (erased > RevealFrac) { canvas.remove(); onReveal(); }
  };
  const onDown = (e) => { scratching = true; const p = point(e); clearAt(p.x,p.y); e.preventDefault(); };
  const onMove = (e) => { if (!scratching) return; const p = point(e); clearAt(p.x,p.y); e.preventDefault(); };
  const onUp = () => { scratching = false; };
  const point = (e) => e.touches && e.touches[0] ? { x:e.touches[0].clientX, y:e.touches[0].clientY } : { x:e.clientX, y:e.clientY };
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
