import { getBalance, addBalance, canAfford, subscribe } from '../store.js';
import { formatMoneyExtended as fmt } from '../format.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'wheel';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Wheel</h2>
      <div class="tag">Odds reshuffle every spin</div>
      <div class="spacer"></div>
      <div class="stack" style="align-items:end;">
        <div class="muted">Balance</div>
        <div id="wh-balance" class="money">$0</div>
      </div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a;">
      <div id="wh-wrap" class="stack" style="gap:.5rem">
        <svg id="wh-svg" width="100%" height="380" viewBox="0 0 800 380" preserveAspectRatio="none"></svg>
        <div id="wh-log" class="log">New wheel loaded.</div>
      </div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; gap:.75rem; flex-wrap:wrap; justify-content:space-between;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="wh-bet-dec" class="glass xl">−</button>
          <div id="wh-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="wh-bet-inc" class="glass xl">+</button>
          <button id="wh-bet-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
        </div>
      </div>
      <button id="wh-spin" class="primary xl" style="background: linear-gradient(180deg, rgba(255,0,170,.22), rgba(255,255,255,.06)); border-color: rgba(255,0,170,.45);">Spin</button>
    </div>
  `;
  root.appendChild(wrap);

  // Elements
  const balEl = wrap.querySelector('#wh-balance');
  const svg = wrap.querySelector('#wh-svg');
  const logEl = wrap.querySelector('#wh-log');
  const betEl = wrap.querySelector('#wh-bet');
  const betInc = wrap.querySelector('#wh-bet-inc');
  const betDec = wrap.querySelector('#wh-bet-dec');
  const betMax = wrap.querySelector('#wh-bet-max');
  const spinBtn = wrap.querySelector('#wh-spin');

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); updateUI(); });
  balEl.textContent = fmt(getBalance());

  // RNG helpers
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function shuffle(arr){
    const cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    for (let i = arr.length -1; i > 0; i--) {
      let j;
      if (cryptoObj) { const x = new Uint32Array(1); cryptoObj.getRandomValues(x); j = x[0] % (i+1); }
      else { j = Math.floor(Math.random()*(i+1)); }
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // State
  const state = {
    bet: 10,
    minBet: 1,
    maxBet: 2000,
    spinning: false,
    slices: [], // { mult:number, color:string }
    landingIdx: 0,
    angle: 0,
  };

  const offset = -Math.PI/2; // pointer at top

  function buildSlices() {
    // Clean, simple 6-slice wheel. Bigger low-multiplier wedges, tiny jackpots.
    const high = Math.random() < 0.5 ? 10 : 5; // choose a high slice baseline
    let base = [0, 0.5, 1, 1.5, 2, high];
    if (Math.random() < 0.12) base[base.length - 1] = 20; // rare jackpot

    const weightFor = (m) => {
      if (m === 0) return 6.0;
      if (m === 0.5) return 4.8;
      if (m === 1) return 3.6;
      if (m === 1.5) return 2.4;
      if (m === 2) return 1.8;
      if (m === 5) return 1.0;
      if (m === 10) return 0.8;
      return 0.5; // 20x
    };

    base = shuffle(base.slice());
    let slices = base.map(mult => ({ mult, color: colorFor(mult), weight: weightFor(mult) }));
    // Nudge EV toward ~0.95 by slightly adjusting a mid slice if extreme
    const ev = slices.reduce((a,s)=>a + s.mult * (s.weight), 0) / slices.reduce((a,s)=>a + s.weight, 0);
    if (ev > 1.05) {
      const i = slices.findIndex(s=>s.mult===1.5) ?? slices.findIndex(s=>s.mult===1);
      if (i>=0) slices[i].mult = 1; // soften
    } else if (ev < 0.85) {
      const i = slices.findIndex(s=>s.mult===0.5);
      if (i>=0) slices[i].mult = 1; // less harsh
    }

    const totalW = slices.reduce((a,s)=>a+s.weight,0);
    let acc = 0;
    for (const s of slices) {
      const span = (s.weight/totalW) * Math.PI * 2;
      s.start = acc;
      s.end = acc + span;
      s.center = s.start + span/2;
      acc += span;
    }
    state.slices = slices;
  }

  function colorFor(m){
    if (m === 0) return '#a11b2b';
    if (m === 0.5) return '#9c6a16';
    if (m <= 1.2) return '#14667a';
    if (m <= 2) return '#1b7f46';
    if (m <= 3) return '#17c964';
    if (m <= 5) return '#ffd166';
    if (m <= 10) return '#00c2ff';
    return '#ff6ad5'; // 20x+
  }

  // Draw wheel
  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = svg.viewBox.baseVal.width || 800;
    const H = svg.viewBox.baseVal.height || 380;
    const cx = W/2, cy = H/2 + 6, R = Math.min(W,H)*0.45, innerR = R*0.64;

    // defs (gradients)
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg','radialGradient');
    grad.setAttribute('id','whbg'); grad.setAttribute('cx','50%'); grad.setAttribute('cy','38%'); grad.setAttribute('r','70%');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg','stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#0c1422'); s1.setAttribute('stop-opacity','1');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg','stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#060b14'); s2.setAttribute('stop-opacity','1');
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad); svg.appendChild(defs);

    const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('x','0'); bg.setAttribute('y','0'); bg.setAttribute('width', String(W)); bg.setAttribute('height', String(H)); bg.setAttribute('fill','url(#whbg)');
    svg.appendChild(bg);

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform', `translate(${cx},${cy}) rotate(${(state.angle*180/Math.PI).toFixed(3)})`);
    svg.appendChild(g);

    for (let i=0;i<state.slices.length;i++){
      const start = offset + state.slices[i].start;
      const end = offset + state.slices[i].end;
      const x1 = Math.cos(start)*R, y1 = Math.sin(start)*R;
      const x2 = Math.cos(end)*R, y2 = Math.sin(end)*R;
      const xi1 = Math.cos(end)*innerR, yi1 = Math.sin(end)*innerR;
      const xi2 = Math.cos(start)*innerR, yi2 = Math.sin(start)*innerR;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 0 0 ${xi2} ${yi2} Z`;
      path.setAttribute('d', d);
      path.setAttribute('fill', state.slices[i].color);
      path.setAttribute('stroke', '#20304a');
      path.setAttribute('stroke-width', '1');
      g.appendChild(path);

      const mid = (start+end)/2;
      const tx = Math.cos(mid)*(innerR-12);
      const ty = Math.sin(mid)*(innerR-12);
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', String(tx)); t.setAttribute('y', String(ty));
      t.setAttribute('fill', '#e6ebf2'); t.setAttribute('font-size', '12'); t.setAttribute('font-weight','700');
      t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
      const m = state.slices[i].mult;
      const label = m === 0 ? '×0' : `×${Number(m).toFixed(m>=1?1:1).replace(/\.0$/,'')}`;
      t.textContent = label;
      g.appendChild(t);
    }

    // Pegs around rim
    for (let i=0;i<72;i++){
      const a = i*(Math.PI*2/72) + state.angle*0.02; // slight parallax
      const px = cx + Math.cos(a)*(R+2);
      const py = cy + Math.sin(a)*(R+2);
      const peg = document.createElementNS('http://www.w3.org/2000/svg','circle');
      peg.setAttribute('cx', String(px)); peg.setAttribute('cy', String(py)); peg.setAttribute('r','1.4');
      peg.setAttribute('fill','#22324a');
      svg.appendChild(peg);
    }

    // Rim + bevel
    const rim = document.createElementNS('http://www.w3.org/2000/svg','circle');
    rim.setAttribute('cx', String(cx)); rim.setAttribute('cy', String(cy)); rim.setAttribute('r', String(R+6));
    rim.setAttribute('fill','none'); rim.setAttribute('stroke','#20304a'); rim.setAttribute('stroke-width','7');
    svg.appendChild(rim);

    const pointer = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    const px = cx, py = cy - (R+10);
    const pts = `${px},${py} ${px-10},${py+18} ${px+10},${py+18}`;
    pointer.setAttribute('points', pts);
    pointer.setAttribute('fill', '#ffd166'); pointer.setAttribute('stroke', '#a67c00'); pointer.setAttribute('stroke-width','2');
    svg.appendChild(pointer);

    // Center hub
    const hub = document.createElementNS('http://www.w3.org/2000/svg','circle');
    hub.setAttribute('cx', String(cx)); hub.setAttribute('cy', String(cy)); hub.setAttribute('r', String(innerR*0.45));
    hub.setAttribute('fill','#0d1726'); hub.setAttribute('stroke','#20304a'); hub.setAttribute('stroke-width','3');
    svg.appendChild(hub);
    const htxt = document.createElementNS('http://www.w3.org/2000/svg','text');
    htxt.setAttribute('x', String(cx)); htxt.setAttribute('y', String(cy)); htxt.setAttribute('fill','#9fb3d1');
    htxt.setAttribute('font-size','14'); htxt.setAttribute('font-weight','800'); htxt.setAttribute('text-anchor','middle'); htxt.setAttribute('dominant-baseline','central');
    htxt.textContent = 'WHEEL'; svg.appendChild(htxt);
  }

  function pickLandingIndex(){
    // Weighted random by angular size (weights)
    const r = Math.random();
    const total = state.slices[state.slices.length-1].end; // 2π
    const target = r * total;
    for (let i=0;i<state.slices.length;i++){
      if (target >= state.slices[i].start && target < state.slices[i].end) return i;
    }
    return state.slices.length-1;
  }

  function angleForSliceCenter(i){ return - (offset + state.slices[i].center); }

  // Spin logic
  let raf = 0;
  function spin(){
    if (state.spinning) return;
    if (!canAfford(state.bet)) { log('Insufficient funds.'); return; }
    addBalance(-state.bet);
    state.spinning = true;
    updateUI();
    // Fresh wheel each spin
    buildSlices();
    log('Spinning…');
    // Choose landing and target angle with extra turns
    state.landingIdx = pickLandingIndex();
    const target = angleForSliceCenter(state.landingIdx) + (Math.PI*2)*(2 + randInt(0,2));
    const start = state.angle;
    const dur = 4600; // ms
    const t0 = performance.now();
    function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
    function frame(now){
      const p = Math.min(1, (now - t0) / dur);
      const e = easeOutCubic(p);
      state.angle = start + (target - start) * e;
      draw();
      if (p < 1) { raf = requestAnimationFrame(frame); }
      else { finish(); }
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function finish(){
    state.spinning = false;
    // Snap exactly to index center
    state.angle = angleForSliceCenter(state.landingIdx);
    draw();
    const mult = state.slices[state.landingIdx].mult;
    const payout = Math.round(state.bet * mult);
    const net = payout - state.bet;
    if (payout > 0) addBalance(payout);
    let label = `×${Number(mult).toFixed(mult>=1?1:1).replace(/\.0$/,'')}`;
    let msg;
    if (mult === 0) msg = `Bust — ${label}. Lost ${fmt(state.bet)}.`;
    else if (mult === 1) msg = `Push — ${label}. Returned ${fmt(payout)}.`;
    else if (net > 0) msg = `Hit ${label}! Returned ${fmt(payout)} (Profit ${fmt(net)}).`;
    else msg = `Hit ${label}. Returned ${fmt(payout)} (Lost ${fmt(-net)}).`;
    logEl.className = mult === 0 ? 'log loss' : (mult >= 5 ? 'log win' : (net>0?'log':'log loss'));
    log(msg);
    // Small pointer rattle
    rattle();
    updateUI();
  }

  function rattle(){
    let n = 6;
    const base = state.angle;
    function step(){
      if (n-- <= 0) { state.angle = base; draw(); return; }
      const amp = (n/6) * (Math.PI/180)*2.5; // up to ~2.5deg
      state.angle = base + (n%2? -amp: amp);
      draw();
      setTimeout(step, 40);
    }
    step();
  }

  function log(s){ logEl.textContent = s; }

  // Bet UI
  function updateUI(){
    betEl.textContent = fmt(state.bet);
    spinBtn.disabled = state.spinning || !canAfford(state.bet);
  }
  function onBetInc(){ state.bet = Math.min(state.maxBet, state.bet + 1); updateUI(); }
  function onBetDec(){ state.bet = Math.max(state.minBet, state.bet - 1); updateUI(); }
  function onBetMax(){ state.bet = Math.max(state.minBet, getBalance()); updateUI(); }
  function onBetEdit(){ if (state.spinning) return; const v = prompt('Enter bet amount', String(state.bet)); if (v==null) return; const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n<=0) return; state.bet = Math.max(state.minBet, Math.min(n, getBalance())); updateUI(); }

  betInc.addEventListener('click', onBetInc);
  betDec.addEventListener('click', onBetDec);
  betMax.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  spinBtn.addEventListener('click', spin);
  window.addEventListener('resize', draw);

  // Init
  buildSlices();
  draw();
  updateUI();

  cleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', draw);
    betInc?.removeEventListener('click', onBetInc);
    betDec?.removeEventListener('click', onBetDec);
    betMax?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    spinBtn?.removeEventListener('click', spin);
    unsub();
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
