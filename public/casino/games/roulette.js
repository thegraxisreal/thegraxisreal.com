import { getBalance, addBalance, canAfford, subscribe, setBalance } from '../store.js';
import { formatMoneyExtended as fmt } from '../format.js';
import { getCheatState, consumeCheat, CHEAT_IDS } from '../cheats.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'roulette';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Roulette</h2>
      <div class="tag">European</div>
      <div class="spacer"></div>
      <div class="stack" style="align-items:end;">
        <div class="muted">Balance</div>
        <div id="rl-balance" class="money">$0</div>
      </div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a;">
      <div id="rl-wrap" class="stack" style="gap:.75rem">
        <svg id="rl-svg" width="100%" height="360" viewBox="0 0 800 360" preserveAspectRatio="none"></svg>
        <div id="rl-log" class="log"></div>
      </div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; gap:.75rem; flex-wrap:wrap; justify-content:space-between;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="rl-bet-dec" class="glass xl">−</button>
          <div id="rl-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="rl-bet-inc" class="glass xl">+</button>
          <button id="rl-bet-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
        </div>
      </div>
      <div class="stack" style="min-width:260px; flex:1">
        <div class="muted">Pick</div>
        <div class="muted" style="opacity:.75; font-size:.9em;">Payouts: Red/Black ×4 • Number/0 ×100</div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap; align-items:center;">
          <label class="tag" style="cursor:pointer"><input type="radio" name="rl-type" value="red" style="margin-right:.35rem">Red</label>
          <label class="tag" style="cursor:pointer"><input type="radio" name="rl-type" value="black" style="margin-right:.35rem">Black</label>
          <label class="tag" style="cursor:pointer"><input type="radio" name="rl-type" value="zero" style="margin-right:.35rem">0</label>
          <label class="tag" style="cursor:pointer"><input type="radio" name="rl-type" value="number" style="margin-right:.35rem">Number</label>
          <input id="rl-number" type="number" min="0" max="36" placeholder="0-36" style="width:80px; padding:.35rem .5rem; background:#0f1627; border:1px solid #20304a; color:#e6ebf2; border-radius:6px" />
        </div>
      </div>
      <button id="rl-start" class="primary xl" style="background: linear-gradient(180deg, rgba(255,0,170,.22), rgba(255,255,255,.06)); border-color: rgba(255,0,170,.45);">Spin</button>
    </div>
  `;
  root.appendChild(wrap);

  // Elements
  const balEl = wrap.querySelector('#rl-balance');
  const svg = wrap.querySelector('#rl-svg');
  const logEl = wrap.querySelector('#rl-log');
  const betEl = wrap.querySelector('#rl-bet');
  const betInc = wrap.querySelector('#rl-bet-inc');
  const betDec = wrap.querySelector('#rl-bet-dec');
  const betMax = wrap.querySelector('#rl-bet-max');
  const startBtn = wrap.querySelector('#rl-start');
  const numInput = wrap.querySelector('#rl-number');

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); updateUI(); });
  balEl.textContent = fmt(getBalance());

  // State
  const state = {
    bet: 10,
    minBet: 1,
    maxBet: 1000,
    spinning: false,
    pick: { type: null, number: null },
  };

  function setPick(type, number = null) {
    state.pick = { type, number: (number != null ? Number(number) : null) };
    updateUI();
  }

  // Wheel constants
  const order = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const redNums = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const segCount = order.length;
  const segAngle = (Math.PI * 2) / segCount;
  const offset = -Math.PI / 2; // 0 at top

  // Rendering
  let anim = 0;
  let wheelAngle = 0;
  let wheelVel = 0;
  let ballAngle = 0;
  let ballVel = 0;
  let settled = false;
  let capturing = false; // after drop, guide ball into pocket
  let captureIdx = -1;
  let ballRScale = 0.90; // relative to R; eases inward during capture
  const zeroIdx = 0 + order.indexOf(0);
  let cheatUseActive = false;
  let cheatCatastrophe = false; // 25% chance
  let cheatForcedZero = false;  // true when cheat steers to 0
  let flyOut = null; // {x,y,vx,vy,active}
  let spinStart = 0;
  let lastCx = 0, lastCy = 0, lastR = 0;

  function clearSvg() { while (svg.firstChild) svg.removeChild(svg.firstChild); }

  function drawWheel() {
    clearSvg();
    const W = svg.viewBox.baseVal.width || 800;
    const H = svg.viewBox.baseVal.height || 360;
    const cx = W/2, cy = H/2;
    const R = Math.min(W, H) * 0.45;
    const innerR = R * 0.7;
    const ballR = R * ballRScale;

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('x','0'); bg.setAttribute('y','0'); bg.setAttribute('width', String(W)); bg.setAttribute('height', String(H));
    bg.setAttribute('fill','#0b1322');
    svg.appendChild(bg);

    lastCx = cx; lastCy = cy; lastR = R;

    // Group for wheel that we rotate by wheelAngle
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('transform', `translate(${cx},${cy}) rotate(${(wheelAngle*180/Math.PI).toFixed(3)})`);
    svg.appendChild(g);

    // Segments
    for (let i=0;i<segCount;i++) {
      const start = offset + i*segAngle;
      const end = start + segAngle;
      const n = order[i];
      const color = (n===0) ? '#0b8f3a' : (redNums.has(n) ? '#d22' : '#111');
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const x1 = Math.cos(start)*R, y1 = Math.sin(start)*R;
      const x2 = Math.cos(end)*R, y2 = Math.sin(end)*R;
      const xi1 = Math.cos(end)*innerR, yi1 = Math.sin(end)*innerR;
      const xi2 = Math.cos(start)*innerR, yi2 = Math.sin(start)*innerR;
      const d = [
        `M ${x1} ${y1}`,
        `A ${R} ${R} 0 0 1 ${x2} ${y2}`,
        `L ${xi1} ${yi1}`,
        `A ${innerR} ${innerR} 0 0 0 ${xi2} ${yi2}`,
        'Z'
      ].join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', color);
      path.setAttribute('stroke', '#20304a');
      path.setAttribute('stroke-width', '1');
      g.appendChild(path);

      // Number labels
      const mid = (start+end)/2;
      const tx = Math.cos(mid)*(innerR-14);
      const ty = Math.sin(mid)*(innerR-14);
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', String(tx)); t.setAttribute('y', String(ty));
      t.setAttribute('fill', '#e6ebf2');
      t.setAttribute('font-size', '12');
      t.setAttribute('font-weight', '700');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'middle');
      t.textContent = String(n);
      g.appendChild(t);
    }

    // Rim
    const rim = document.createElementNS('http://www.w3.org/2000/svg','circle');
    rim.setAttribute('cx', String(cx)); rim.setAttribute('cy', String(cy)); rim.setAttribute('r', String(R+4));
    rim.setAttribute('fill','none'); rim.setAttribute('stroke','#20304a'); rim.setAttribute('stroke-width','6');
    svg.appendChild(rim);

    // Ball
    if (flyOut && flyOut.active) {
      const ball = document.createElementNS('http://www.w3.org/2000/svg','circle');
      ball.setAttribute('cx', String(flyOut.x)); ball.setAttribute('cy', String(flyOut.y)); ball.setAttribute('r', '7');
      ball.setAttribute('fill', '#fff'); ball.setAttribute('stroke', '#aaa');
      svg.appendChild(ball);
    } else {
      const bx = cx + Math.cos(ballAngle)*ballR;
      const by = cy + Math.sin(ballAngle)*ballR;
      const ball = document.createElementNS('http://www.w3.org/2000/svg','circle');
      ball.setAttribute('cx', String(bx)); ball.setAttribute('cy', String(by)); ball.setAttribute('r', '7');
      ball.setAttribute('fill', '#fff'); ball.setAttribute('stroke', '#aaa');
      svg.appendChild(ball);
    }

    // Peg at top as reference
    const peg = document.createElementNS('http://www.w3.org/2000/svg','circle');
    peg.setAttribute('cx', String(cx)); peg.setAttribute('cy', String(cy - (ballR+14)));
    peg.setAttribute('r', '3'); peg.setAttribute('fill', '#ffd166');
    svg.appendChild(peg);

    // Tiny green square way left (visible when cheat is armed or during flyout)
    if (cheatUseActive || (flyOut && flyOut.active)) {
      const sq = document.createElementNS('http://www.w3.org/2000/svg','rect');
      const sx = cx - (R + 80);
      const sy = cy - 6;
      sq.setAttribute('x', String(sx)); sq.setAttribute('y', String(sy));
      sq.setAttribute('width', '12'); sq.setAttribute('height', '12');
      sq.setAttribute('fill', '#0b8f3a');
      sq.setAttribute('stroke', '#0a6e2e');
      svg.appendChild(sq);
    }
  }

  function angleNorm(a){ a%=Math.PI*2; if (a<0) a+=Math.PI*2; return a; }
  function angleToIndex(relAngle){
    const a = angleNorm(relAngle - offset);
    let i = Math.floor(a / segAngle);
    if (i<0) i=0; if (i>=segCount) i = segCount-1;
    return i;
  }

  function log(s){ logEl.textContent = s; }

  function startSpin(){
    if (state.spinning) return;
    if (!state.pick.type) { log('Pick red, black, 0, or a number.'); return; }
    if (!canAfford(state.bet)) { log('Insufficient funds.'); return; }
    state.spinning = true;
    addBalance(-state.bet);
    updateUI();
    log('Spinning…');

    // Randomize initial conditions
    wheelAngle = 0;
    ballAngle = Math.random() * Math.PI*2;
    wheelVel = 6 + Math.random()*2; // rad/s
    ballVel = -(16 + Math.random()*6); // opposite direction
    settled = false;
    capturing = false;
    captureIdx = -1;
    ballRScale = 0.90;
    flyOut = null;
    cheatUseActive = false;
    cheatCatastrophe = false;
    spinStart = performance.now();
    
    // Check cheat charge
    try {
      const charged = getCheatState(CHEAT_IDS.roulette)?.charge;
      if (charged) {
        cheatUseActive = true;
        consumeCheat(CHEAT_IDS.roulette);
        cheatCatastrophe = Math.random() < 0.25; // 1 in 4 spins backfire
      }
    } catch {}

    let last = performance.now();
    function frame(now){
      const dt = Math.min(32, now - last) / 1000; // seconds
      last = now;
      const elapsed = now - spinStart;
      // Integrate
      wheelAngle += wheelVel * dt;
      wheelVel *= 0.994; // wheel friction

      if (flyOut && flyOut.active) {
        // Ball flying toward tiny square
        flyOut.x += flyOut.vx * dt;
        flyOut.y += flyOut.vy * dt;
        const tx = lastCx - (lastR + 80) + 6;
        const ty = lastCy;
        const dx = tx - flyOut.x, dy = ty - flyOut.y;
        if (dx*dx + dy*dy < 12*12) {
          // Reached square: catastrophic loss
          cancelAnimationFrame(anim);
          state.spinning = false;
          setBalance(0);
          logEl.className = 'log loss';
          log('The ball flew off and hit the tiny green square. You lost everything.');
          updateUI();
          return;
        }
      } else if (!capturing) {
        ballAngle += ballVel * dt;
        ballVel *= 0.992; // ball friction on rim
        // Mild jitter to avoid perfect repeats
        ballVel += (Math.random()-0.5)*0.02;
        // Cheat behaviors
        if (cheatUseActive && cheatCatastrophe && elapsed > 900) {
          // Launch ball off toward the tiny green square
          const R = Math.min((svg.viewBox.baseVal.width||800),(svg.viewBox.baseVal.height||360)) * 0.45;
          const cx = (svg.viewBox.baseVal.width||800)/2; const cy = (svg.viewBox.baseVal.height||360)/2;
          const ballR = R * ballRScale;
          const bx = cx + Math.cos(ballAngle)*ballR;
          const by = cy + Math.sin(ballAngle)*ballR;
          const tx = cx - (R + 80) + 6;
          const ty = cy;
          const dx = tx - bx, dy = ty - by;
          const len = Math.hypot(dx,dy) || 1;
          const speed = 900; // px/s
          flyOut = { x: bx, y: by, vx: dx/len*speed, vy: dy/len*speed, active: true };
        }
        // Start capture phase when slow enough; force to zero if cheat success
        const threshold = (cheatUseActive && !cheatCatastrophe) ? 2.2 : 1.6;
        if (Math.abs(ballVel) < threshold) {
          if (cheatUseActive && !cheatCatastrophe) {
            captureIdx = zeroIdx;
            cheatForcedZero = true;
          } else {
            const rel = ballAngle - wheelAngle;
            captureIdx = angleToIndex(rel);
          }
          capturing = true;
        }
      } else {
        // Guide ball toward pocket center and ease radial position inward
        const targetRel = offset + captureIdx*segAngle + segAngle/2;
        const targetAbs = wheelAngle + targetRel;
        // shortest angular difference in [-pi, pi]
        let diff = angleNorm(targetAbs - ballAngle);
        if (diff > Math.PI) diff -= 2*Math.PI;
        // ease toward target and damp velocity
        ballVel *= 0.95;
        ballAngle += ballVel * dt + diff * 0.20; // blend physics with easing
        // move ball slightly inward while capturing
        const targetScale = 0.84;
        ballRScale += (targetScale - ballRScale) * 0.05;
        // Finish when nearly aligned and slow
        if (Math.abs(diff) < 0.01 && Math.abs(ballVel) < 0.2) {
          const hit = order[captureIdx];
          settled = true;
          return settle(hit);
        }
      }
      drawWheel();
      anim = requestAnimationFrame(frame);
    }
    cancelAnimationFrame(anim);
    anim = requestAnimationFrame(frame);
  }

  function settle(number){
    cancelAnimationFrame(anim);
    state.spinning = false;
    const color = number===0 ? 'green' : (redNums.has(number)?'red':'black');

    // Payouts
    let payout = 0;
    const t = state.pick.type;
    if (t === 'red' && color === 'red') payout = state.bet * 4;
    else if (t === 'black' && color === 'black') payout = state.bet * 4;
    else if (t === 'zero' && number === 0) payout = state.bet * (cheatForcedZero ? 20 : 100);
    else if (t === 'number' && Number(state.pick.number) === number) payout = state.bet * (cheatForcedZero ? 20 : 100);

    if (payout > 0) {
      addBalance(payout);
      logEl.className = 'log win';
      log(`Hit ${number} (${color}). You won ${fmt(payout)}.`);
    } else {
      logEl.className = 'log loss';
      log(`Hit ${number} (${color}). Better luck next spin.`);
    }
    updateUI();
  }

  // UI helpers
  function updateUI(){
    betEl.textContent = fmt(state.bet);
    startBtn.disabled = state.spinning || !state.pick.type || !canAfford(state.bet);
    numInput.disabled = state.pick.type !== 'number' || state.spinning;
    // Sync radios
    wrap.querySelectorAll('input[name="rl-type"]').forEach((el) => {
      el.checked = (el.value === state.pick.type);
      el.disabled = state.spinning;
    });
    if (state.pick.type === 'number' && state.pick.number != null) {
      numInput.value = String(state.pick.number);
    }
  }

  function onBetInc(){ state.bet = Math.min(state.maxBet, state.bet + 1); updateUI(); }
  function onBetDec(){ state.bet = Math.max(state.minBet, state.bet - 1); updateUI(); }
  function onBetMax(){ state.bet = Math.max(state.minBet, getBalance()); updateUI(); }
  function onBetEdit(){ if (state.spinning) return; const v = prompt('Enter bet amount', String(state.bet)); if (v==null) return; const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n<=0) return; state.bet = Math.max(state.minBet, Math.min(n, getBalance())); updateUI(); }

  betInc.addEventListener('click', onBetInc);
  betDec.addEventListener('click', onBetDec);
  betMax.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  startBtn.addEventListener('click', startSpin);

  function onTypeChange(e){
    if (e.target && e.target.name === 'rl-type') {
      const v = e.target.value;
      if (v === 'number') setPick('number', Number(numInput.value||0));
      else setPick(v, null);
    }
  }
  wrap.addEventListener('change', onTypeChange);
  function onNumInput(){
    let n = Math.floor(Number(numInput.value||0));
    if (!Number.isFinite(n)) n = 0;
    n = Math.max(0, Math.min(36, n));
    numInput.value = String(n);
    if (state.pick.type === 'number') setPick('number', n);
  }
  numInput.addEventListener('input', onNumInput);

  function onResize(){ drawWheel(); }
  window.addEventListener('resize', onResize);

  // Init
  setPick('red');
  drawWheel();
  updateUI();

  cleanup = () => {
    cancelAnimationFrame(anim);
    window.removeEventListener('resize', onResize);
    betInc?.removeEventListener('click', onBetInc);
    betDec?.removeEventListener('click', onBetDec);
    betMax?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    startBtn?.removeEventListener('click', startSpin);
    wrap.removeEventListener('change', onTypeChange);
    numInput?.removeEventListener('input', onNumInput);
    unsub();
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
