import store, { subscribe, getBalance, addBalance, canAfford } from '../store.js';
import { formatMoneyExtended as formatMoney } from '../format.js';
import { CHEAT_IDS, getCheatState, consumeCheat } from '../cheats.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'plinko';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Plinko</h2>
      <div class="tag">Physics</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto">
        <div class="muted">Balance</div>
        <div id="pl-balance" class="money">$0</div>
      </div>
    </div>

    <div style="border:1px solid #20304a; background:#0e1524; border-radius:12px; overflow:hidden; position:relative;">
      <canvas id="pl-canvas" style="display:block; width:100%; height:480px;"></canvas>
      <div id="pl-overlay" style="position:absolute; left:0; right:0; bottom:8px; display:flex; gap:4px; padding:0 8px; justify-content:space-between; pointer-events:none; font-size:.9rem; opacity:.9;"></div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; justify-content:space-between;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="pl-dec" class="glass xl">−</button>
          <div id="pl-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="pl-inc" class="glass xl">+</button>
          <button id="pl-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
        </div>
      </div>
      <div class="controls" style="gap:.5rem; align-items:center;">
        <button id="pl-drop" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Drop Ball</button>
        <button id="pl-cheat" class="glass xl" style="display:none; background: linear-gradient(180deg, rgba(255,0,0,.4), rgba(255,255,255,.06)); border-color: rgba(255,0,0,.6); color:#fff;">Use Cheat</button>
      </div>
    </div>

    <div id="pl-log" class="log"></div>
  `;
  root.appendChild(wrap);

  // --- State & helpers ---
  const state = {
    bet: 10,
    running: false,
    rows: 10, // peg rows
    binMultipliers: [],
  };
  const minBet = 1;
  const maxBet = 200;
  const fmt = (n) => formatMoney(n);

  const balEl = wrap.querySelector('#pl-balance');
  const betEl = wrap.querySelector('#pl-bet');
  const dropBtn = wrap.querySelector('#pl-drop');
  const logEl = wrap.querySelector('#pl-log');
  const decBtn = wrap.querySelector('#pl-dec');
  const incBtn = wrap.querySelector('#pl-inc');
  const maxBtn = wrap.querySelector('#pl-max');
  const canvas = wrap.querySelector('#pl-canvas');
  const overlay = wrap.querySelector('#pl-overlay');
  const ctx = canvas.getContext('2d');
  const cheatBtn = wrap.querySelector('#pl-cheat');

  // Responsive canvas sizing
  function resizeCanvas() {
    const box = canvas.parentElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const cssW = Math.max(520, Math.min(860, Math.floor(box.width)));
    const cssH = 480; // fixed height for predictable physics
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * ratio);
    canvas.height = Math.floor(cssH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildBoard();
    draw();
  }

  // Physics / Board config (recomputed on resize)
  let pegs = [];
  let bins = [];
  let walls = { left: 0, right: 0, top: 0, bottom: 0 };
  let ball = null; // {x,y,vx,vy,r}
  let anim = 0;

  function computeBinomialProbs(n) {
    // Returns length n+1 probabilities that sum to ~1
    const probs = new Array(n + 1);
    const denom = Math.pow(2, n);
    // Stable recurrence: p[k] = C(n,k)/2^n, with p[0] = 1/2^n
    let pk = 1 / denom;
    probs[0] = pk;
    for (let k = 1; k <= n; k++) {
      pk = pk * (n - k + 1) / k; // multiply by (n-k+1)/k
      probs[k] = pk;
    }
    return probs;
  }

  function computeBalancedMultipliers(count, targetEV = 0.95) {
    // Inverted Gaussian shape: low center, high edges; then scale to target EV
    const n = count - 1; // rows
    const probs = computeBinomialProbs(n);
    const mid = (count - 1) / 2;
    const sigma = count / 3.2; // shape spread
    const centerBase = 0.30;   // center ~30% return
    const edgeBoost = 7.7;     // edges approach ~8x before scaling
    const base = [];
    for (let i = 0; i < count; i++) {
      const z = (i - mid) / sigma;
      const invGauss = 1 - Math.exp(-0.5 * z * z);
      const raw = centerBase + edgeBoost * invGauss;
      base.push(raw);
    }
    // Scale to target EV
    let ev = 0;
    for (let i = 0; i < count; i++) ev += probs[i] * base[i];
    let scale = targetEV / ev;
    let scaled = base.map(v => v * scale);
    // Clamp minimum a bit, then rescale once to keep EV close
    const minMult = 0.22;
    let changed = false;
    for (let i = 0; i < scaled.length; i++) {
      if (scaled[i] < minMult) { scaled[i] = minMult; changed = true; }
    }
    if (changed) {
      let ev2 = 0; for (let i = 0; i < count; i++) ev2 += probs[i] * scaled[i];
      const s2 = targetEV / ev2;
      scaled = scaled.map(v => v * s2);
    }
    // Round to 2 decimals for display
    return scaled.map(v => Math.round(v * 100) / 100);
  }

  function buildBoard() {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    walls = { left: 16, right: W - 16, top: 16, bottom: H - 16 };

    // Peg layout
    const rows = state.rows;
    const top = 60;
    const bottom = H - 110;
    const boardHeight = bottom - top;
    const rowGap = boardHeight / rows;
    const colsMax = rows + 1; // widest row
    const left = 48;
    const right = W - 48;
    const widthAvail = right - left;
    const colGap = widthAvail / colsMax;
    const pegR = Math.max(4, Math.min(7, Math.floor(colGap * 0.18)));
    pegs = [];
    for (let r = 0; r < rows; r++) {
      const cols = r + 1;
      for (let c = 0; c < cols; c++) {
        const x = left + colGap * (c + 0.5 + (colsMax - cols) / 2);
        const y = top + r * rowGap;
        pegs.push({ x, y, r: pegR });
      }
    }

    // Bins
    const binCount = rows + 1;
    bins = [];
    const binTop = bottom + 8;
    const binBottom = H - 20;
    const binGap = widthAvail / binCount;
    for (let i = 0; i < binCount; i++) {
      const x0 = left + i * binGap;
      const x1 = left + (i + 1) * binGap;
      const cx = (x0 + x1) / 2;
      bins.push({ index: i, x0, x1, cx, top: binTop, bottom: binBottom });
    }

    // Multipliers: low in the middle, high at edges; ~95% EV
    state.binMultipliers = computeBalancedMultipliers(binCount, 0.95);

    // Reset overlay labels
    overlay.innerHTML = '';
    state.binMultipliers.forEach((m, i) => {
      const d = document.createElement('div');
      d.textContent = `×${m}`;
      d.className = 'tag';
      d.style.borderColor = 'rgba(0,212,255,.35)';
      d.style.background = 'rgba(255,255,255,.06)';
      d.style.color = 'var(--fg)';
      d.style.flex = '1 1 0';
      d.style.textAlign = 'center';
      overlay.appendChild(d);
    });
  }

  function drawBoard() {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    // Background gradient sheen
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1322');
    g.addColorStop(1, '#0d1627');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Pegs
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    pegs.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Bin walls
    ctx.strokeStyle = '#20304a';
    ctx.lineWidth = 2;
    const bottom = bins[0]?.top ?? (canvas.clientHeight - 100);
    bins.forEach(b => {
      ctx.beginPath();
      ctx.moveTo(b.x0, bottom);
      ctx.lineTo(b.x0, b.bottom);
      ctx.stroke();
    });
    // Rightmost wall
    const last = bins[bins.length - 1];
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x1, bottom);
      ctx.lineTo(last.x1, last.bottom);
      ctx.stroke();
    }

    // Floor
    ctx.beginPath();
    ctx.moveTo(walls.left, last?.bottom ?? (canvas.clientHeight - 20));
    ctx.lineTo(walls.right, last?.bottom ?? (canvas.clientHeight - 20));
    ctx.strokeStyle = '#1b263a';
    ctx.stroke();
  }

  function drawBall() {
    if (!ball) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,212,255,.95)';
    ctx.shadowColor = 'rgba(0,212,255,.35)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    drawBoard();
    drawBall();
  }

  // Physics simulation
  const G = 1800; // gravity px/s^2
  const REST = 0.6; // restitution
  const FRICTION = 0.005; // air friction per ms
  const MAX_V = 1600; // clamp
  const MIN_WIND = 300; // hidden wind range for visible push
  const MAX_WIND = 520;
  const PEG_KICK = 120; // additional vx impulse on peg contact toward wind
  const WIND_ACC = 420; // default fallback
  let windAcc = 0; // per-drop, ±WIND_ACC
  let windDir = 0; // -1, 0, +1 for deterministic direction

  function step(dt) {
    if (!ball) return;
    // dt in seconds
    const damping = Math.max(0.85, 1 - FRICTION * dt * 1000);

    ball.vy += G * dt;
    ball.vx += windAcc * dt;
    ball.vx *= damping; ball.vy *= damping;
    // Clamp
    if (ball.vx > MAX_V) ball.vx = MAX_V; else if (ball.vx < -MAX_V) ball.vx = -MAX_V;
    if (ball.vy > MAX_V) ball.vy = MAX_V; else if (ball.vy < -MAX_V) ball.vy = -MAX_V;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Collide with walls
    if (ball.x - ball.r < walls.left) { ball.x = walls.left + ball.r; ball.vx = Math.abs(ball.vx) * REST; }
    if (ball.x + ball.r > walls.right) { ball.x = walls.right - ball.r; ball.vx = -Math.abs(ball.vx) * REST; }
    if (ball.y - ball.r < walls.top) { ball.y = walls.top + ball.r; ball.vy = Math.abs(ball.vy) * REST; }

    // Peg collisions (circle-circle)
    const jitter = 0.35; // prevents lock-ups
    for (let i = 0; i < pegs.length; i++) {
      const p = pegs[i];
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const rr = ball.r + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rr * rr) {
        const d = Math.sqrt(d2) || 0.0001;
        // push out
        const nx = dx / d, ny = dy / d;
        const overlap = rr - d;
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        // reflect velocity along normal with restitution
        const vDotN = ball.vx * nx + ball.vy * ny;
        const rvx = ball.vx - (1 + REST) * vDotN * nx;
        const rvy = ball.vy - (1 + REST) * vDotN * ny;
        ball.vx = rvx + (Math.random() - 0.5) * jitter * 50;
        ball.vy = rvy + (Math.random() - 0.5) * jitter * 50;
        // wind-aligned impulse to make the push obvious
        if (windDir !== 0 && Math.random() < 0.8) {
          const strength = PEG_KICK * (0.6 + Math.random() * 0.8);
          ball.vx += windDir * strength;
        }
      }
    }

    // Bin region detection
    if (bins.length) {
      const top = bins[0].top;
      const floorY = bins[0].bottom;
      if (ball.y + ball.r >= top) {
        // collide with floor
        if (ball.y + ball.r > floorY) {
          ball.y = floorY - ball.r;
          ball.vy = -Math.abs(ball.vy) * REST;
        }
        // collide with bin dividers (treat as vertical segments)
        for (let i = 0; i < bins.length; i++) {
          const b = bins[i];
          // left wall of bin i
          const xw = b.x0;
          if (ball.x - ball.r < xw && ball.x + ball.r > xw && ball.y + ball.r > top) {
            if (ball.x < xw) { ball.x = xw - ball.r; ball.vx = -Math.abs(ball.vx) * REST; }
            else { ball.x = xw + ball.r; ball.vx = Math.abs(ball.vx) * REST; }
          }
        }
        // rightmost wall
        const last = bins[bins.length - 1];
        if (last) {
          const xw = last.x1;
          if (ball.x - ball.r < xw && ball.x + ball.r > xw && ball.y + ball.r > top) {
            if (ball.x < xw) { ball.x = xw - ball.r; ball.vx = -Math.abs(ball.vx) * REST; }
            else { ball.x = xw + ball.r; ball.vx = Math.abs(ball.vx) * REST; }
          }
        }
      }
    }
  }

  function loop(ts) {
    let last = loop._last || ts;
    let dt = Math.min(32, ts - last) / 1000; // cap
    loop._last = ts;
    step(dt);
    draw();
    // Settle detection: within a bin and nearly stopped
    if (ball) {
      const speed = Math.hypot(ball.vx, ball.vy);
      const inBins = bins.length && ball.y + ball.r >= (bins[0].top - 1);
      if (inBins && speed < 40) {
        settleBall();
        return; // loop ends on settle
      }
    }
    anim = requestAnimationFrame(loop);
  }

  let cheatBest = false;
  function settleBall() {
    if (!ball) return;
    // Snap to nearest bin center
    const x = ball.x;
    let idx = 0;
    let minDist = Infinity;
    for (let i = 0; i < bins.length; i++) {
      const d = Math.abs(x - bins[i].cx);
      if (d < minDist) { minDist = d; idx = i; }
    }
    if (cheatBest) {
      let best = 0; let bestI = 0;
      for (let i = 0; i < state.binMultipliers.length; i++) {
        if (state.binMultipliers[i] > best) { best = state.binMultipliers[i]; bestI = i; }
      }
      idx = bestI;
    }
    const m = state.binMultipliers[idx] ?? 0;
    const win = Math.floor(state.bet * m);
    // Place ball nicely
    const b = bins[idx];
    ball.x = b.cx; ball.y = b.bottom - ball.r; ball.vx = 0; ball.vy = 0;
    draw();
    // Pay out
    if (win > 0) {
      addBalance(win);
      logEl.textContent = `You won ${fmt(win)} (×${m})`;
      logEl.className = 'log win';
    } else {
      logEl.textContent = `No win (×${m})`;
      logEl.className = 'log loss';
    }
    state.running = false;
    cheatBest = false;
    windAcc = 0;
    windDir = 0;
    updateUI();
    cancelAnimationFrame(anim);
  }

  function startDrop() {
    if (state.running) return;
    if (!canAfford(state.bet)) return;
    state.running = true;
    addBalance(-state.bet);
    logEl.textContent = 'Dropping…';
    logEl.className = 'log';
    // Create ball near the top center with slight offset
    const x = canvas.clientWidth / 2 + (Math.random() - 0.5) * 40;
    const y = 28;
    ball = { x, y, vx: (Math.random() - 0.5) * 60, vy: 0, r: 8 };
    // 50% of the time: no wind at all
    if (Math.random() < 0.5) {
      windAcc = 0;
      windDir = 0;
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const gust = MIN_WIND + Math.random() * (MAX_WIND - MIN_WIND);
      windAcc = dir * gust;
      windDir = dir;
      // prime initial lateral motion subtly in the same direction
      ball.vx += dir * 100;
    }
    cancelAnimationFrame(anim);
    loop._last = undefined;
    anim = requestAnimationFrame(loop);
    updateUI();
  }

  // UI wiring
  function updateUI() {
    balEl.textContent = fmt(getBalance());
    betEl.textContent = fmt(state.bet);
    dropBtn.disabled = state.running || !canAfford(state.bet);
    decBtn.disabled = state.running;
    incBtn.disabled = state.running;
    const cs = getCheatState(CHEAT_IDS.plinko);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.running;
    // Wind indicator
    // no visible wind indicators
  }
  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); dropBtn.disabled = state.running || !canAfford(state.bet); });
  function onInc() { state.bet = Math.min(maxBet, state.bet + 1); updateUI(); }
  function onDec() { state.bet = Math.max(minBet, state.bet - 1); updateUI(); }

  dropBtn.addEventListener('click', startDrop);
  incBtn.addEventListener('click', onInc);
  decBtn.addEventListener('click', onDec);
  function onCheat() {
    if (state.running) return;
    const cs = getCheatState(CHEAT_IDS.plinko);
    if (!cs.charge) return;
    cheatBest = true;
    consumeCheat(CHEAT_IDS.plinko);
    updateUI();
  }
  cheatBtn.addEventListener('click', onCheat);
  maxBtn.addEventListener('click', () => { state.bet = Math.max(minBet, getBalance()); updateUI(); });
  betEl.addEventListener('click', () => {
    const v = prompt('Enter bet amount', String(state.bet));
    if (v == null) return;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    state.bet = Math.max(minBet, Math.min(n, getBalance()));
    updateUI();
  });
  window.addEventListener('resize', resizeCanvas);

  // Initial paint
  updateUI();
  balEl.textContent = fmt(getBalance());
  resizeCanvas();

  cleanup = () => {
    unsub();
    cancelAnimationFrame(anim);
    window.removeEventListener('resize', resizeCanvas);
    dropBtn?.removeEventListener('click', startDrop);
    incBtn?.removeEventListener('click', onInc);
    decBtn?.removeEventListener('click', onDec);
    cheatBtn?.removeEventListener('click', onCheat);
    maxBtn?.removeEventListener('click', () => {});
    betEl?.removeEventListener('click', () => {});
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
