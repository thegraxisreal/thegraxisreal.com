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

    <!-- Race track on top -->
    <div id="hr-track" style="position:relative; border:1px solid #20304a; border-radius:12px; background:#0e1524; height:300px; overflow:hidden; box-shadow: inset 0 4px 14px rgba(0,0,0,.35);"></div>

    <!-- Selection list underneath -->
    <div class="stack">
      <div class="muted">Pick a horse:</div>
      <div id="hr-list" class="stack"></div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; justify-content:space-between;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="hr-bet-dec" class="glass xl">−</button>
          <div id="hr-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="hr-bet-inc" class="glass xl">+</button>
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
    maxBet: 200,
    lanes: 5,
    racing: false,
    selected: null, // index
    horses: [], // filled per race: {name,color,prob,mult}
  };

  // Elements
  const balEl = wrap.querySelector('#hr-balance');
  const betEl = wrap.querySelector('#hr-bet');
  const startBtn = wrap.querySelector('#hr-start');
  const betMaxBtn = wrap.querySelector('#hr-bet-max');
  const listEl = wrap.querySelector('#hr-list');
  const trackEl = wrap.querySelector('#hr-track');
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

  // Render horse list with odds and selection
  function renderList() {
    listEl.innerHTML = '';
    state.horses.forEach((h, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.gap = '8px';
      row.style.alignItems = 'center';
      row.style.cursor = 'pointer';
      row.style.padding = '.4rem .5rem';
      row.style.border = '1px solid #2b3a52';
      row.style.borderRadius = '10px';
      row.setAttribute('data-i', String(i));
      row.innerHTML = `
        <div class="controls" style="gap:.5rem">
          <div style="width:20px; height:20px; border-radius:50%; background:${h.color}; box-shadow: 0 0 10px rgba(0,0,0,.35);"></div>
          <strong>${h.name}</strong>
        </div>
        <div class="spacer"></div>
        <div class="tag">×${h.mult.toFixed(2)}</div>
      `;
      row.addEventListener('click', onSelect);
      listEl.appendChild(row);
    });
  }

  function onSelect(e) {
    if (state.racing) return;
    const row = e.currentTarget;
    const i = parseInt(row.getAttribute('data-i'), 10);
    state.selected = i;
    highlightSelection();
    cheatHorse = false;
    updateUI();
  }

  function highlightSelection() {
    const rows = listEl.querySelectorAll('[data-i]');
    rows.forEach(el => {
      if (parseInt(el.getAttribute('data-i'), 10) === state.selected) {
        el.style.outline = '2px solid rgba(0,212,255,.6)';
        el.style.borderRadius = '10px';
        el.style.background = 'rgba(255,255,255,.04)';
      } else {
        el.style.outline = 'none';
        el.style.background = 'transparent';
      }
    });
  }

  // Track rendering
  let anim = 0;
  let runners = []; // {el, x, v, base}
  let finishX = 0;

  function layoutTrack() {
    trackEl.innerHTML = '';
    const W = trackEl.clientWidth;
    const H = trackEl.clientHeight;
    const lanes = state.lanes;
    const laneH = H / lanes;
    finishX = W - 48; // padding for finish flag

    // Finish line
    const finish = document.createElement('div');
    finish.style.position = 'absolute';
    finish.style.left = finishX + 'px';
    finish.style.top = '0';
    finish.style.bottom = '0';
    finish.style.width = '4px';
    finish.style.background = '#20304a';
    trackEl.appendChild(finish);

    // Start line marker
    const start = document.createElement('div');
    start.style.position = 'absolute';
    start.style.left = '16px';
    start.style.top = '0';
    start.style.bottom = '0';
    start.style.width = '2px';
    start.style.background = '#1b263a';
    trackEl.appendChild(start);

    runners = state.horses.map((h, i) => {
      const y = i * laneH;
      const lane = document.createElement('div');
      lane.style.position = 'absolute';
      lane.style.left = '0';
      lane.style.top = `${Math.round(y)}px`;
      lane.style.height = `${Math.floor(laneH)}px`;
      lane.style.borderTop = i === 0 ? 'none' : '1px dashed #1b263a';
      lane.style.borderBottom = '1px dashed #1b263a';
      lane.style.paddingLeft = '8px';

      const marker = document.createElement('div');
      marker.style.position = 'absolute';
      marker.style.left = '16px';
      marker.style.top = '50%';
      marker.style.transform = 'translate(0, -50%)';
      marker.style.width = '24px';
      marker.style.height = '24px';
      marker.style.borderRadius = '50%';
      marker.style.background = h.color;
      marker.style.boxShadow = '0 0 12px rgba(0,0,0,.45)';
      marker.textContent = '🐎';
      marker.style.display = 'grid';
      marker.style.placeItems = 'center';
      marker.style.fontSize = '16px';

      const nameTag = document.createElement('div');
      nameTag.className = 'tag';
      nameTag.textContent = h.name;
      nameTag.style.position = 'absolute';
      nameTag.style.left = '8px';
      nameTag.style.top = '6px';
      nameTag.style.pointerEvents = 'none';

      lane.appendChild(nameTag);
      lane.appendChild(marker);
      trackEl.appendChild(lane);

      // Base speed proportional to probability with randomness
      const base = 120 + h.prob * 140; // px/s
      return { el: marker, x: 16, v: 0, base };
    });
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
        r.el.style.left = `${Math.floor(r.x)}px`;
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
    updateUI();
  }

  function log(msg) { logEl.textContent = msg; }

  // UI wiring
  let cheatHorse = false;
  function updateUI() {
    betEl.textContent = fmt(state.bet);
    startBtn.disabled = state.racing || state.selected == null || !canAfford(state.bet);
    const cs = getCheatState(CHEAT_IDS.horse);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.racing || state.selected == null;
  }
  function onBetInc() { state.bet = Math.min(state.maxBet, state.bet + 1); updateUI(); }
  function onBetDec() { state.bet = Math.max(state.minBet, state.bet - 1); updateUI(); }
  function onBetMax() { state.bet = Math.max(state.minBet, getBalance()); updateUI(); }
  function onBetEdit() {
    if (state.racing) return;
    const v = prompt('Enter bet amount', String(state.bet));
    if (v == null) return;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    state.bet = Math.max(state.minBet, Math.min(n, getBalance()));
    updateUI();
  }

  wrap.querySelector('#hr-bet-inc').addEventListener('click', onBetInc);
  wrap.querySelector('#hr-bet-dec').addEventListener('click', onBetDec);
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
  renderList();
  highlightSelection();
  layoutTrack();
  updateUI();

  cleanup = () => {
    cancelAnimationFrame(anim);
    unsub();
    wrap.querySelector('#hr-bet-inc')?.removeEventListener('click', onBetInc);
    wrap.querySelector('#hr-bet-dec')?.removeEventListener('click', onBetDec);
    betMaxBtn?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    startBtn?.removeEventListener('click', startRace);
    cheatBtn?.removeEventListener('click', onCheat);
    const rows = listEl.querySelectorAll('[data-i]');
    rows.forEach(el => el.removeEventListener('click', onSelect));
    window.removeEventListener('resize', onResize);
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
