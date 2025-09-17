import store, { subscribe, getBalance, addBalance, canAfford } from '../store.js';
import { formatMoneyExtended as formatMoney } from '../format.js';
import { CHEAT_IDS, getCheatState, consumeCheat } from '../cheats.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'horse-race';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Horse Race</h2>
      <div class="tag">Racing</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto">
        <div class="muted">Balance</div>
        <div id="hr-balance" class="money">$0</div>
      </div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a;">
      <div id="hr-wrap" style="display:grid; grid-template-columns: 140px 1fr; gap:.75rem; align-items:center;">
        <div id="hr-names" class="stack"></div>
        <svg id="hr-svg" width="100%" height="260" viewBox="0 0 800 260" preserveAspectRatio="none"></svg>
      </div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; justify-content:space-between;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="hr-bet-dec" class="glass xl">−</button>
          <div id="hr-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="hr-bet-inc" class="glass xl">+</button>
          <button id="hr-bet-half" class="glass xl" style="background: linear-gradient(180deg, rgba(0,212,255,.18), rgba(255,255,255,.06)); border-color: rgba(0,212,255,.3);">Half</button>
          <button id="hr-bet-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
        </div>
      </div>
      <button id="hr-start" class="primary xl" style="background: linear-gradient(180deg, rgba(255,0,170,.22), rgba(255,255,255,.06)); border-color: rgba(255,0,170,.45);">Start Race</button>
    </div>

    <div id="hr-log" class="log"></div>
  `;
  root.appendChild(wrap);

  // --- State ---
  const state = {
    bet: 10,
    minBet: 1,
    lanes: 5,
    racing: false,
    selected: null, // index
    horses: [], // filled per race: {name,color,prob,mult}
  };

  // Elements
  const balEl = wrap.querySelector('#hr-balance');
  const betEl = wrap.querySelector('#hr-bet');
  const startBtn = wrap.querySelector('#hr-start');
  const betHalfBtn = wrap.querySelector('#hr-bet-half');
  const betMaxBtn = wrap.querySelector('#hr-bet-max');
  const namesEl = wrap.querySelector('#hr-names');
  const svg = wrap.querySelector('#hr-svg');
  const logEl = wrap.querySelector('#hr-log');
  // Cheat button beside Start
  const cheatBtn = document.createElement('button');
  cheatBtn.id = 'hr-cheat';
  cheatBtn.textContent = 'Use Cheat';
  cheatBtn.className = 'glass xl';
  cheatBtn.style.background = 'linear-gradient(180deg, rgba(255,0,0,.4), rgba(255,255,255,.06))';
  cheatBtn.style.borderColor = 'rgba(255,0,0,.6)';
  cheatBtn.style.color = '#fff';
  wrap.querySelector('#hr-start').parentElement.appendChild(cheatBtn);

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); updateUI(); });
  balEl.textContent = fmt(getBalance());

  // Helpers
  function fmt(n) { return formatMoney(n); }
  function randIn(min, max) { return min + Math.random() * (max - min); }

  // Build horses with probabilities and multipliers targeting ~94% EV
  function generateHorses() {
    const n = state.lanes;
    // Random weights, then normalize to probs
    const weights = Array.from({ length: n }, () => Math.pow(randIn(0.4, 1.4), 2));
    const sum = weights.reduce((a, b) => a + b, 0);
    const probs = weights.map(w => w / sum);
    const targetEV = 0.94;
    const multsRaw = probs.map(p => targetEV / p);
    // Clip and round multipliers for sanity
    const mults = multsRaw.map(m => Math.max(1.2, Math.min(15, Math.round(m * 100) / 100)));
    const palette = ['#ffcc00', '#00d4ff', '#3ddc84', '#ff6ad5', '#ffd166'];
    const names = ['Comet', 'Blaze', 'Thunder', 'Shadow', 'Aurora', 'Rocket', 'Storm', 'Nova'];
    state.horses = Array.from({ length: n }, (_, i) => ({
      name: names[i % names.length],
      color: palette[i % palette.length],
      prob: probs[i],
      mult: mults[i],
    }));
  }

  function highlightSelection() {
    namesEl.querySelectorAll('[data-i]').forEach(el => {
      const i = parseInt(el.getAttribute('data-i'), 10);
      el.style.outline = (i === state.selected) ? '2px solid rgba(0,212,255,.6)' : 'none';
      el.style.background = (i === state.selected) ? 'rgba(255,255,255,.06)' : 'transparent';
    });
    svg.querySelectorAll('[data-lane]').forEach(el => {
      const i = parseInt(el.getAttribute('data-lane'), 10);
      el.style.opacity = (i === state.selected || state.selected==null) ? '1' : '.85';
    });
  }

  // Track rendering
  let anim = 0;
  let runners = []; // {el, x, v, base}
  let finishX = 0;

  function layoutTrack() {
    // Names list
    namesEl.innerHTML = '';
    state.horses.forEach((h, i) => {
      const row = document.createElement('div');
      row.className = 'row'; row.style.gap = '.5rem'; row.style.alignItems = 'center'; row.style.cursor = 'pointer';
      row.setAttribute('data-i', String(i));
      row.innerHTML = `<div style="width:14px;height:14px;border-radius:50%;background:${h.color}"></div><strong>${h.name}</strong><div class="spacer"></div><div class="tag">×${h.mult.toFixed(2)}</div>`;
      row.addEventListener('click', () => { if (state.racing) return; state.selected = i; highlightSelection(); updateUI(); });
      namesEl.appendChild(row);
    });

    // SVG lanes
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const bbox = svg.getBoundingClientRect();
    const W = Math.max(600, Math.floor(bbox.width || 800));
    const H = 260; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const lanes = state.lanes; const laneH = H/lanes; finishX = W - 40;
    for (let i=0;i<lanes;i++) {
      const y = i*laneH;
      const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
      r.setAttribute('x','0'); r.setAttribute('y', String(y)); r.setAttribute('width', String(W)); r.setAttribute('height', String(laneH));
      r.setAttribute('fill', i%2? '#0c1422':'#0b1322'); r.setAttribute('opacity','0.95'); r.setAttribute('data-lane', String(i)); svg.appendChild(r);
      if (i>0) { const line = document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1','0'); line.setAttribute('y1', String(y)); line.setAttribute('x2', String(W)); line.setAttribute('y2', String(y)); line.setAttribute('stroke','#1b263a'); line.setAttribute('stroke-dasharray','4 6'); svg.appendChild(line); }
      const t = document.createElementNS('http://www.w3.org/2000/svg','text'); t.setAttribute('x','8'); t.setAttribute('y', String(y + laneH - 8)); t.setAttribute('fill','#a8dccc'); t.setAttribute('font-size','12'); t.textContent = `×${state.horses[i].mult.toFixed(2)}`; svg.appendChild(t);
    }
    const start = document.createElementNS('http://www.w3.org/2000/svg','line'); start.setAttribute('x1','20'); start.setAttribute('y1','0'); start.setAttribute('x2','20'); start.setAttribute('y2', String(H)); start.setAttribute('stroke','#1b263a'); start.setAttribute('stroke-width','2'); svg.appendChild(start);
    const finish = document.createElementNS('http://www.w3.org/2000/svg','line'); finish.setAttribute('x1', String(finishX)); finish.setAttribute('y1','0'); finish.setAttribute('x2', String(finishX)); finish.setAttribute('y2', String(H)); finish.setAttribute('stroke','#20304a'); finish.setAttribute('stroke-width','4'); svg.appendChild(finish);

    runners = state.horses.map((h,i) => { const y = i*laneH + laneH/2 + 6; const t = document.createElementNS('http://www.w3.org/2000/svg','text'); t.setAttribute('x','20'); t.setAttribute('y', String(y)); t.setAttribute('font-size','16'); t.textContent = '🐎'; svg.appendChild(t); const base = 120 + h.prob*140; return { el:t, x:20, v:0, base }; });
  }

  function startRace() {
    if (state.racing) return;
    if (state.selected == null) { log('Pick a horse to bet on.'); return; }
    if (!canAfford(state.bet)) return;
    state.racing = true;
    addBalance(-state.bet);
    updateUI();
    log('They’re off!');

    // speed model per runner
    const bursts = runners.map(() => ({ t: randIn(0.4, 1.2), s: randIn(140, 280) }));

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(32, now - last) / 1000;
      last = now;
      let winner = -1;
      runners.forEach((r, i) => {
        // Accelerate toward base with easing + small noise
        const noise = (Math.random() - 0.5) * 30;
        const target = r.base + noise;
        r.v += (target - r.v) * 0.8 * dt; // ease toward target

        // Occasional burst based on horse probability
        bursts[i].t -= dt;
        if (bursts[i].t <= 0) {
          r.v += bursts[i].s; // brief sprint
          bursts[i].t = randIn(0.6, 1.4);
          bursts[i].s = randIn(100, 220);
        }

        if (cheatHorse && state.selected === i) { r.v += 600 * dt; }
        r.x += r.v * dt;
        if (r.x >= finishX) { r.x = finishX; if (winner === -1) winner = i; }
        r.el.setAttribute('x', String(Math.floor(r.x)));
      });

      if (winner !== -1) {
        settle(winner);
        return;
      }
      anim = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(anim);
    anim = requestAnimationFrame(frame);
  }

  function settle(winner) {
    cancelAnimationFrame(anim);
    state.racing = false;
    const w = state.horses[winner];
    if (state.selected === winner) {
      const win = Math.floor(state.bet * w.mult);
      addBalance(win);
      log(`Winner: ${w.name}! You won ${fmt(win)} (×${w.mult.toFixed(2)})`);
      logEl.className = 'log win';
    } else {
      log(`Winner: ${w.name}. Better luck next time.`);
      logEl.className = 'log loss';
    }
    // Immediately clear selection to prevent instant re-start exploit
    state.selected = null;
    updateUI();

    // Reset race state so users cannot spam Start for instant wins
    // - Clear selection, regenerate horses, rebuild track, clear cheat
    // - Reset log style back to neutral
    setTimeout(() => {
      logEl.className = 'log';
      cheatHorse = false;
      generateHorses();
      highlightSelection();
      layoutTrack();
      updateUI();
      log('Pick a horse to bet on.');
    }, 800);
  }

  function log(msg) { logEl.textContent = msg; }

  // UI wiring
  let cheatHorse = false;
  function updateUI() {
    if (!state.racing) {
      const balance = getBalance();
      if (state.bet > balance) state.bet = Math.max(state.minBet, balance);
    }
    betEl.textContent = fmt(state.bet);
    startBtn.disabled = state.racing || state.selected == null || !canAfford(state.bet);
    const cs = getCheatState(CHEAT_IDS.horse);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.racing || state.selected == null;
    betHalfBtn.disabled = state.racing;
    betMaxBtn.disabled = state.racing;
  }
  function onBetInc() {
    if (state.racing) return;
    const balance = getBalance();
    state.bet = Math.max(state.minBet, Math.min(balance, state.bet + 1));
    updateUI();
  }
  function onBetDec() { if (state.racing) return; state.bet = Math.max(state.minBet, state.bet - 1); updateUI(); }
  function onBetHalf() {
    if (state.racing) return;
    const balance = getBalance();
    const addition = Math.floor(balance / 2);
    if (addition <= 0) return;
    state.bet = Math.max(state.minBet, Math.min(balance, state.bet + addition));
    updateUI();
  }
  function onBetMax() {
    if (state.racing) return;
    const balance = getBalance();
    state.bet = Math.max(state.minBet, balance);
    updateUI();
  }
  function onBetEdit() {
    if (state.racing) return;
    const v = prompt('Enter bet amount', String(state.bet));
    if (v == null) return;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    const balance = getBalance();
    state.bet = Math.max(state.minBet, Math.min(n, balance));
    updateUI();
  }

  wrap.querySelector('#hr-bet-inc').addEventListener('click', onBetInc);
  wrap.querySelector('#hr-bet-dec').addEventListener('click', onBetDec);
  betHalfBtn.addEventListener('click', onBetHalf);
  betMaxBtn.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  startBtn.addEventListener('click', startRace);
  function onCheat() {
    if (state.racing || state.selected == null) return;
    const cs = getCheatState(CHEAT_IDS.horse);
    if (!cs.charge) return;
    cheatHorse = true;
    consumeCheat(CHEAT_IDS.horse);
    updateUI();
  }
  cheatBtn.addEventListener('click', onCheat);
  function onResize() { layoutTrack(); positionRunners(); }
  window.addEventListener('resize', onResize);

  function positionRunners() {
    runners.forEach(r => { r.el.style.left = `${Math.floor(r.x)}px`; });
  }

  // Initialize
  state.selected = null;
  generateHorses();
  highlightSelection();
  layoutTrack();
  updateUI();

  cleanup = () => {
    cancelAnimationFrame(anim);
    unsub();
    wrap.querySelector('#hr-bet-inc')?.removeEventListener('click', onBetInc);
    wrap.querySelector('#hr-bet-dec')?.removeEventListener('click', onBetDec);
    betHalfBtn?.removeEventListener('click', onBetHalf);
    betMaxBtn?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    startBtn?.removeEventListener('click', startRace);
    cheatBtn?.removeEventListener('click', onCheat);
    window.removeEventListener('resize', onResize);
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
