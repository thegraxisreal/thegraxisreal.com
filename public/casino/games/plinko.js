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

    <div class="toolbar" style="margin-top:.5rem; justify-content:space-between; gap:1.5rem; flex-wrap:wrap;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="pl-dec" class="glass xl">−</button>
          <div id="pl-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="pl-inc" class="glass xl">+</button>
          <button id="pl-half" class="glass xl" style="background: linear-gradient(180deg, rgba(0,212,255,.18), rgba(255,255,255,.06)); border-color: rgba(0,212,255,.3);">Half</button>
          <button id="pl-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
        </div>
      </div>
      <div class="stack" style="min-width:180px;">
        <div class="muted">Balls</div>
        <div class="controls plinko-ball-controls" style="gap:.5rem; align-items:center;">
          <button id="pl-ball-dec" class="glass xl">−</button>
          <div id="pl-ball-count" class="tag" style="min-width:3rem; text-align:center;">1</div>
          <button id="pl-ball-inc" class="glass xl">+</button>
        </div>
        <div id="pl-ball-info" class="muted" style="font-size:.8rem; opacity:.78;">$10 each</div>
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
    binColors: [],
    ballCount: 1,
  };
  const minBet = 1;
  const BALL_OPTIONS = [1, 5, 20];
  const minBalls = BALL_OPTIONS[0];
  const maxBalls = BALL_OPTIONS[BALL_OPTIONS.length - 1];
  const dropIntervalMs = 500;
  const fmt = (n) => formatMoney(n);

  const balEl = wrap.querySelector('#pl-balance');
  const betEl = wrap.querySelector('#pl-bet');
  const dropBtn = wrap.querySelector('#pl-drop');
  const logEl = wrap.querySelector('#pl-log');
  const decBtn = wrap.querySelector('#pl-dec');
  const incBtn = wrap.querySelector('#pl-inc');
  const halfBtn = wrap.querySelector('#pl-half');
  const maxBtn = wrap.querySelector('#pl-max');
  const ballDecBtn = wrap.querySelector('#pl-ball-dec');
  const ballIncBtn = wrap.querySelector('#pl-ball-inc');
  const ballCountEl = wrap.querySelector('#pl-ball-count');
  const ballInfoEl = wrap.querySelector('#pl-ball-info');
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
  let balls = [];
  let anim = 0;
  let activeRun = null;
  let dropTimer = null;

  function clearDropTimer() {
    if (dropTimer) {
      clearTimeout(dropTimer);
      dropTimer = null;
    }
  }

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

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function mixColors(hex1, hex2, t) {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    const r = Math.round(lerp(c1.r, c2.r, t));
    const g = Math.round(lerp(c1.g, c2.g, t));
    const b = Math.round(lerp(c1.b, c2.b, t));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function computeBinColors(count) {
    const mid = (count - 1) / 2;
    const baseYellow = '#ffd166';
    const midOrange = '#ff9f1c';
    const edgeRed = '#ff4d4f';
    const colors = [];
    for (let i = 0; i < count; i++) {
      const dist = Math.abs(i - mid) / mid || 0;
      let color;
      if (dist <= 0.5) {
        const t = dist / 0.5;
        color = mixColors(baseYellow, midOrange, t);
      } else {
        const t = (dist - 0.5) / 0.5;
        color = mixColors(midOrange, edgeRed, Math.min(1, t));
      }
      colors.push(color);
    }
    return colors;
  }

  function triggerBinBounce(index) {
    if (!overlay) return;
    const el = overlay.children?.[index];
    if (!el) return;
    el.classList.remove('plinko-hit');
    void el.offsetWidth;
    el.classList.add('plinko-hit');
    setTimeout(() => el.classList.remove('plinko-hit'), 520);
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
    state.binColors = computeBinColors(binCount);

    // Reset overlay labels
    overlay.innerHTML = '';
    state.binMultipliers.forEach((m, i) => {
      const d = document.createElement('div');
      d.textContent = `×${m}`;
      d.className = 'tag';
      const color = state.binColors[i] || 'rgba(255,255,255,.12)';
      d.style.background = color;
      d.style.borderColor = 'rgba(255,255,255,.18)';
      d.style.color = '#0a0f18';
      d.style.fontWeight = '700';
      d.style.textShadow = '0 1px 2px rgba(255,255,255,.45)';
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
      const color = state.binColors[b.index] || 'rgba(255,255,255,.12)';
      ctx.beginPath();
      ctx.moveTo(b.x0, bottom);
      ctx.lineTo(b.x0, b.bottom);
      ctx.stroke();
      const grd = ctx.createLinearGradient(0, bottom - 24, 0, b.bottom);
      grd.addColorStop(0, `${color}`);
      grd.addColorStop(1, 'rgba(10,15,24,0.95)');
      ctx.fillStyle = grd;
      ctx.fillRect(b.x0, b.bottom - 20, b.x1 - b.x0, 22);
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

  function drawBalls() {
    if (!balls.length) return;
    balls.forEach(b => {
      ctx.save();
      ctx.fillStyle = 'rgba(0,212,255,.95)';
      ctx.shadowColor = 'rgba(0,212,255,.35)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function draw() {
    drawBoard();
    drawBalls();
  }

  // Physics simulation
  const G = 1800; // gravity px/s^2
  const REST = 0.6; // restitution
  const FRICTION = 0.005; // air friction per ms
  const MAX_V = 1600; // clamp
  const MIN_WIND = 300; // hidden wind range for visible push
  const MAX_WIND = 520;
  const PEG_KICK = 120; // additional vx impulse on peg contact toward wind
  function step(dt) {
    if (!balls.length) return;
    const damping = Math.max(0.85, 1 - FRICTION * dt * 1000);
    balls.forEach(ball => {
      ball.vy += G * dt;
      ball.vx += (ball.windAcc ?? 0) * dt;
      ball.vx *= damping; ball.vy *= damping;
      if (ball.vx > MAX_V) ball.vx = MAX_V; else if (ball.vx < -MAX_V) ball.vx = -MAX_V;
      if (ball.vy > MAX_V) ball.vy = MAX_V; else if (ball.vy < -MAX_V) ball.vy = -MAX_V;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.r < walls.left) { ball.x = walls.left + ball.r; ball.vx = Math.abs(ball.vx) * REST; }
      if (ball.x + ball.r > walls.right) { ball.x = walls.right - ball.r; ball.vx = -Math.abs(ball.vx) * REST; }
      if (ball.y - ball.r < walls.top) { ball.y = walls.top + ball.r; ball.vy = Math.abs(ball.vy) * REST; }

      const jitter = 0.35;
      for (let i = 0; i < pegs.length; i++) {
        const p = pegs[i];
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const rr = ball.r + p.r;
        const d2 = dx * dx + dy * dy;
        if (d2 <= rr * rr) {
          const d = Math.sqrt(d2) || 0.0001;
          const nx = dx / d, ny = dy / d;
          const overlap = rr - d;
          ball.x += nx * overlap;
          ball.y += ny * overlap;
          const vDotN = ball.vx * nx + ball.vy * ny;
          const rvx = ball.vx - (1 + REST) * vDotN * nx;
          const rvy = ball.vy - (1 + REST) * vDotN * ny;
          ball.vx = rvx + (Math.random() - 0.5) * jitter * 50;
          ball.vy = rvy + (Math.random() - 0.5) * jitter * 50;
          if ((ball.windDir ?? 0) !== 0 && Math.random() < 0.8) {
            const strength = PEG_KICK * (0.6 + Math.random() * 0.8);
            ball.vx += (ball.windDir ?? 0) * strength;
          }
        }
      }

      if (bins.length) {
        const top = bins[0].top;
        const floorY = bins[0].bottom;
        if (ball.y + ball.r >= top) {
          if (ball.y + ball.r > floorY) {
            ball.y = floorY - ball.r;
            ball.vy = -Math.abs(ball.vy) * REST;
          }
          for (let i = 0; i < bins.length; i++) {
            const b = bins[i];
            const xw = b.x0;
            if (ball.x - ball.r < xw && ball.x + ball.r > xw && ball.y + ball.r > top) {
              if (ball.x < xw) { ball.x = xw - ball.r; ball.vx = -Math.abs(ball.vx) * REST; }
              else { ball.x = xw + ball.r; ball.vx = Math.abs(ball.vx) * REST; }
            }
          }
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
    });
  }

  function loop(ts) {
    let last = loop._last || ts;
    let dt = Math.min(32, ts - last) / 1000;
    loop._last = ts;
    step(dt);
    draw();
    if (!balls.length) {
      cancelAnimationFrame(anim);
      anim = 0;
      loop._last = undefined;
      if (!activeRun) {
        state.running = false;
        updateUI();
      }
      return;
    }
    for (const b of [...balls]) {
      const speed = Math.hypot(b.vx, b.vy);
      const inBins = bins.length && b.y + b.r >= (bins[0].top - 1);
      if (inBins && speed < 40) settleBall(b);
    }
    anim = requestAnimationFrame(loop);
  }

  let cheatBest = false;
  function settleBall(currentBall) {
    if (!currentBall) return;
    const arrIndex = balls.indexOf(currentBall);
    if (arrIndex !== -1) balls.splice(arrIndex, 1);
    const x = currentBall.x;
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
    const multiplier = state.binMultipliers[idx] ?? 0;
    const perBallStake = activeRun ? activeRun.perBall : state.bet;
    const win = Math.floor(perBallStake * multiplier);
    const ballNumber = currentBall.index ?? (activeRun ? activeRun.results.length + 1 : 1);
    const b = bins[idx];
    currentBall.x = b.cx; currentBall.y = b.bottom - currentBall.r; currentBall.vx = 0; currentBall.vy = 0;
    draw();
    triggerBinBounce(idx);
    if (activeRun) {
      if (win > 0) addBalance(win);
      activeRun.totalWin += win;
      activeRun.results.push({ index: ballNumber, multiplier, win });
      const msg = `Ball ${ballNumber}/${activeRun.totalBalls} landed ×${multiplier}${win > 0 ? ` (+${fmt(win)})` : ' (no win)'}`;
      logEl.textContent = msg;
      logEl.className = win > 0 ? 'log win' : 'log loss';
    } else {
      if (win > 0) {
        addBalance(win);
        logEl.textContent = `You won ${fmt(win)} (×${multiplier})`;
        logEl.className = 'log win';
      } else {
        logEl.textContent = `No win (×${multiplier})`;
        logEl.className = 'log loss';
      }
    }
    if (activeRun && activeRun.results.length === activeRun.totalBalls && balls.length === 0 && (!activeRun.ballsRemaining || activeRun.ballsRemaining <= 0)) {
      finalizeRun();
    } else if (!activeRun && balls.length === 0) {
      cheatBest = false;
      state.running = false;
      updateUI();
    }
  }

  function finalizeRun() {
    clearDropTimer();
    state.running = false;
    const totalBalls = activeRun?.totalBalls ?? 0;
    const totalWin = activeRun?.totalWin ?? 0;
    if (activeRun) {
      if (totalWin > 0) {
        logEl.textContent = `All ${totalBalls} balls finished: +${fmt(totalWin)} total`;
        logEl.className = 'log win';
      } else {
        logEl.textContent = `All ${totalBalls} balls finished: no wins`;
        logEl.className = 'log loss';
      }
    }
    balls.length = 0;
    loop._last = undefined;
    cheatBest = false;
    activeRun = null;
    updateUI();
  }

  function launchBall() {
    if (!activeRun || activeRun.ballsRemaining <= 0) return;
    activeRun.launched = (activeRun.launched || 0) + 1;
    const index = activeRun.launched;
    activeRun.ballsRemaining -= 1;
    const x = canvas.clientWidth / 2 + (Math.random() - 0.5) * 40;
    const y = 28;
    const ballObj = { x, y, vx: (Math.random() - 0.5) * 60, vy: 0, r: 8, index, windAcc: 0, windDir: 0 };
    if (Math.random() >= 0.5) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const gust = MIN_WIND + Math.random() * (MAX_WIND - MIN_WIND);
      ballObj.windAcc = dir * gust;
      ballObj.windDir = dir;
      ballObj.vx += dir * 100;
    }
    balls.push(ballObj);
    if (!anim) {
      loop._last = undefined;
      anim = requestAnimationFrame(loop);
    }
    if (activeRun.totalBalls > 1) {
      logEl.textContent = `Ball ${index}/${activeRun.totalBalls} dropping…`;
      logEl.className = 'log';
    } else {
      logEl.textContent = 'Dropping…';
      logEl.className = 'log';
    }
    updateUI();
  }

  function scheduleNextLaunch() {
    if (!activeRun || activeRun.ballsRemaining <= 0) return;
    if (dropTimer) return;
    dropTimer = setTimeout(() => {
      dropTimer = null;
      launchBall();
      scheduleNextLaunch();
    }, dropIntervalMs);
  }

  function startDrop() {
    if (state.running) return;
    if (!canAfford(state.bet)) return;
    const optionIdx = BALL_OPTIONS.indexOf(state.ballCount);
    const ballCount = optionIdx === -1 ? BALL_OPTIONS[0] : BALL_OPTIONS[optionIdx];
    state.ballCount = ballCount;
    const perBall = Math.floor(state.bet / ballCount);
    if (perBall <= 0) {
      logEl.textContent = 'Increase bet or reduce balls.';
      logEl.className = 'log loss';
      updateUI();
      return;
    }
    const totalCost = perBall * ballCount;
    if (!canAfford(totalCost)) return;
    state.running = true;
    addBalance(-totalCost);
    activeRun = {
      perBall,
      totalBalls: ballCount,
      ballsRemaining: ballCount,
      totalWin: 0,
      results: [],
      launched: 0,
    };
    const remainder = state.bet - totalCost;
    const extra = remainder > 0 ? ` (unused ${fmt(remainder)})` : '';
    logEl.textContent = `Dropping ${ballCount} ball${ballCount>1?'s':''} at ${fmt(perBall)} each${extra}…`;
    logEl.className = 'log';
    clearDropTimer();
    balls.length = 0;
    launchBall();
    scheduleNextLaunch();
    updateUI();
  }

  // UI wiring
  function updateUI() {
    const balance = getBalance();
    if (!state.running && state.bet > balance) state.bet = Math.max(minBet, balance);
    if (!BALL_OPTIONS.includes(state.ballCount)) state.ballCount = BALL_OPTIONS[0];
    balEl.textContent = fmt(balance);
    betEl.textContent = fmt(state.bet);
    const perBall = Math.floor(state.bet / Math.max(1, state.ballCount));
    const remainder = state.bet - perBall * state.ballCount;
    const validBallWager = perBall >= 1;
    if (ballCountEl) ballCountEl.textContent = String(state.ballCount);
    if (ballInfoEl) {
      if (validBallWager) {
        const remainderText = remainder > 0 ? ` • ${fmt(remainder)} unused` : '';
        ballInfoEl.textContent = `${fmt(perBall)} each${remainderText}`;
        ballInfoEl.style.color = '';
      } else {
        ballInfoEl.textContent = 'Increase bet or lower balls';
        ballInfoEl.style.color = '#ff6b6b';
      }
    }
    dropBtn.textContent = state.ballCount === 1 ? 'Drop Ball' : `Drop ${state.ballCount} Balls`;
    dropBtn.disabled = state.running || !canAfford(state.bet) || !validBallWager;
    decBtn.disabled = state.running;
    incBtn.disabled = state.running;
    halfBtn.disabled = state.running;
    maxBtn.disabled = state.running;
    if (ballDecBtn) ballDecBtn.disabled = state.running || state.ballCount <= minBalls;
    if (ballIncBtn) ballIncBtn.disabled = state.running || state.ballCount >= maxBalls;
    const cs = getCheatState(CHEAT_IDS.plinko);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.running;
    // Wind indicator
    // no visible wind indicators
  }
  const unsub = subscribe(() => {
    updateUI();
  });
  function onInc() {
    if (state.running) return;
    const balance = getBalance();
    state.bet = Math.max(minBet, Math.min(balance, state.bet + 1));
    updateUI();
  }
  function onDec() {
    if (state.running) return;
    state.bet = Math.max(minBet, state.bet - 1);
    updateUI();
  }
  function onBetHalf() {
    if (state.running) return;
    const balance = getBalance();
    const addition = Math.floor(balance / 2);
    if (addition <= 0) return;
    state.bet = Math.max(minBet, Math.min(balance, state.bet + addition));
    updateUI();
  }
  function onBetMax() {
    if (state.running) return;
    const balance = getBalance();
    state.bet = Math.max(minBet, balance);
    updateUI();
  }
  function onBetEdit() {
    if (state.running) return;
    const v = prompt('Enter bet amount', String(state.bet));
    if (v == null) return;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    const balance = getBalance();
    state.bet = Math.max(minBet, Math.min(n, balance));
    updateUI();
  }

  function onBallInc() {
    if (state.running) return;
    const idx = BALL_OPTIONS.indexOf(state.ballCount);
    if (idx === -1) {
      state.ballCount = BALL_OPTIONS[0];
    } else if (idx < BALL_OPTIONS.length - 1) {
      state.ballCount = BALL_OPTIONS[idx + 1];
    }
    updateUI();
  }

  function onBallDec() {
    if (state.running) return;
    const idx = BALL_OPTIONS.indexOf(state.ballCount);
    if (idx === -1) {
      state.ballCount = BALL_OPTIONS[0];
    } else if (idx > 0) {
      state.ballCount = BALL_OPTIONS[idx - 1];
    }
    updateUI();
  }

  dropBtn.addEventListener('click', startDrop);
  incBtn.addEventListener('click', onInc);
  decBtn.addEventListener('click', onDec);
  ballIncBtn?.addEventListener('click', onBallInc);
  ballDecBtn?.addEventListener('click', onBallDec);
  function onCheat() {
    if (state.running) return;
    const cs = getCheatState(CHEAT_IDS.plinko);
    if (!cs.charge) return;
    cheatBest = true;
    consumeCheat(CHEAT_IDS.plinko);
    updateUI();
  }
  cheatBtn.addEventListener('click', onCheat);
  halfBtn.addEventListener('click', onBetHalf);
  maxBtn.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  window.addEventListener('resize', resizeCanvas);

  // Initial paint
  updateUI();
  balEl.textContent = fmt(getBalance());
  resizeCanvas();

  cleanup = () => {
    unsub();
    cancelAnimationFrame(anim);
    clearDropTimer();
    window.removeEventListener('resize', resizeCanvas);
    dropBtn?.removeEventListener('click', startDrop);
    incBtn?.removeEventListener('click', onInc);
    decBtn?.removeEventListener('click', onDec);
    ballIncBtn?.removeEventListener('click', onBallInc);
    ballDecBtn?.removeEventListener('click', onBallDec);
    cheatBtn?.removeEventListener('click', onCheat);
    halfBtn?.removeEventListener('click', onBetHalf);
    maxBtn?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    activeRun = null;
    balls.length = 0;
    anim = 0;
    loop._last = undefined;
    state.running = false;
    cheatBest = false;
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
