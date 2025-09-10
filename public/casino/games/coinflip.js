import store, { subscribe, getBalance, addBalance, canAfford } from '../store.js';
import { CHEAT_IDS, getCheatState, consumeCheat } from '../cheats.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'coinflip';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Coin Flip</h2>
      <div class="tag">×1.95 payout</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto">
        <div class="muted">Balance</div>
        <div id="cf-balance" class="money">$0</div>
      </div>
    </div>

    <div style="display:grid; place-items:center; padding: 12px 0;">
      <div id="cf-stage" style="perspective: 800px; width: 160px; height: 160px;">
        <div id="cf-coin" style="width: 140px; height: 140px; margin:10px auto; border-radius: 50%; position: relative; transform-style: preserve-3d; transition: transform 1.2s cubic-bezier(.2,.8,.2,1); box-shadow: 0 14px 30px rgba(0,0,0,.45), inset 0 2px 6px rgba(255,255,255,.15); background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.12), rgba(255,255,255,.02) 60%), linear-gradient(180deg, #c49c1e, #8f6b12); border: 1px solid rgba(255,255,255,.25);"></div>
      </div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; gap:.75rem; flex-wrap:wrap; justify-content:space-between;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="cf-bet-dec" class="glass xl">−</button>
          <div id="cf-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="cf-bet-inc" class="glass xl">+</button>
          <button id="cf-bet-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
        </div>
      </div>
      <div class="controls">
        <button id="pick-h" class="glass xl" style="background: linear-gradient(180deg, rgba(0,212,255,.18), rgba(255,255,255,.06)); border-color: rgba(0,212,255,.3);">Heads</button>
        <button id="pick-t" class="glass xl" style="background: linear-gradient(180deg, rgba(255,204,0,.16), rgba(255,255,255,.06)); border-color: rgba(255,204,0,.3);">Tails</button>
        <button id="cf-flip" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Flip</button>
        <button id="cf-cheat" class="glass xl" style="display:none; background: linear-gradient(180deg, rgba(255,0,0,.4), rgba(255,255,255,.06)); border-color: rgba(255,0,0,.6); color:#fff;">Use Cheat</button>
      </div>
    </div>

    <div id="cf-log" class="log"></div>
  `;
  root.appendChild(wrap);

  // Inject faces for 3D coin
  const coin = wrap.querySelector('#cf-coin');
  const faceH = document.createElement('div');
  faceH.textContent = 'H';
  faceH.style.position = 'absolute';
  faceH.style.inset = '0';
  faceH.style.display = 'grid';
  faceH.style.placeItems = 'center';
  faceH.style.fontWeight = '800';
  faceH.style.fontSize = '64px';
  faceH.style.backfaceVisibility = 'hidden';
  faceH.style.color = 'rgba(0,0,0,.8)';
  faceH.style.textShadow = '0 1px 0 rgba(255,255,255,.35)';
  const faceT = faceH.cloneNode(true);
  faceH.textContent = 'H';
  faceT.textContent = 'T';
  faceT.style.transform = 'rotateY(180deg)';
  coin.appendChild(faceH);
  coin.appendChild(faceT);

  // State
  const state = {
    bet: 10,
    minBet: 1,
    maxBet: 500,
    pick: 'H',
    flipping: false,
  };

  // Elements
  const balEl = wrap.querySelector('#cf-balance');
  const betEl = wrap.querySelector('#cf-bet');
  const logEl = wrap.querySelector('#cf-log');
  const flipBtn = wrap.querySelector('#cf-flip');
  const incBtn = wrap.querySelector('#cf-bet-inc');
  const decBtn = wrap.querySelector('#cf-bet-dec');
  const maxBtn = wrap.querySelector('#cf-bet-max');
  const btnH = wrap.querySelector('#pick-h');
  const btnT = wrap.querySelector('#pick-t');
  const cheatBtn = wrap.querySelector('#cf-cheat');

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); updateUI(); });

  function fmt(n) { return `$${n.toLocaleString()}`; }

  function updateUI() {
    balEl.textContent = fmt(getBalance());
    betEl.textContent = fmt(state.bet);
    flipBtn.disabled = state.flipping || !canAfford(state.bet) || !state.pick;
    incBtn.disabled = state.flipping;
    decBtn.disabled = state.flipping;
    btnH.disabled = state.flipping;
    btnT.disabled = state.flipping;
    const cs = getCheatState(CHEAT_IDS.coinflip);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.flipping;
    btnH.className = state.pick === 'H' ? 'primary' : 'glass';
    btnT.className = state.pick === 'T' ? 'primary' : 'glass';
  }
  updateUI();

  // Selection
  function onPickH() { if (state.flipping) return; state.pick = 'H'; updateUI(); }
  function onPickT() { if (state.flipping) return; state.pick = 'T'; updateUI(); }
  function onBetMax() { if (state.flipping) return; state.bet = Math.max(state.minBet, getBalance()); updateUI(); }
  function onBetEdit() { if (state.flipping) return; const v = prompt('Enter bet amount', String(state.bet)); if (v==null) return; const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n<=0) return; state.bet = Math.max(state.minBet, Math.min(n, getBalance())); updateUI(); }

  // Flip logic
  function onFlip() {
    if (state.flipping) return;
    if (!canAfford(state.bet)) return;
    state.flipping = true;
    addBalance(-state.bet);
    updateUI();
    logEl.textContent = 'Flipping…';
    logEl.className = 'log';

    const spins = 6 + Math.floor(Math.random() * 4); // 6-9 spins
    const outcome = cheatNext ? state.pick : (Math.random() < 0.5 ? 'H' : 'T');
    const endRot = outcome === 'H' ? 0 : 180; // face H at 0deg, T at 180deg
    // reset transition to allow reflow
    coin.style.transition = 'transform 1.2s cubic-bezier(.2,.8,.2,1)';
    // kick off
    requestAnimationFrame(() => {
      coin.style.transform = `rotateY(${spins * 360 + endRot}deg)`;
    });

    // After animation settle
    const duration = 1250; // ms
    const t = setTimeout(() => {
      clearTimeout(t);
      settle(outcome);
    }, duration);
  }

  function settle(outcome) {
    const payoutMult = 1.95; // ~95% EV
    if (outcome === state.pick) {
      const win = Math.floor(state.bet * payoutMult);
      addBalance(win);
      logEl.textContent = `${outcome === 'H' ? 'Heads' : 'Tails'}! You won ${fmt(win)} (×${payoutMult})`;
      logEl.className = 'log win';
    } else {
      logEl.textContent = `${outcome === 'H' ? 'Heads' : 'Tails'}. You lost.`;
      logEl.className = 'log loss';
    }
    state.flipping = false;
    cheatNext = false;
    updateUI();
  }

  // Events
  function onInc() { state.bet = Math.min(state.maxBet, state.bet + 1); updateUI(); }
  function onDec() { state.bet = Math.max(state.minBet, state.bet - 1); updateUI(); }
  flipBtn.addEventListener('click', onFlip);
  incBtn.addEventListener('click', onInc);
  decBtn.addEventListener('click', onDec);
  maxBtn.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  btnH.addEventListener('click', onPickH);
  btnT.addEventListener('click', onPickT);
  cheatBtn.addEventListener('click', onCheat);

  balEl.textContent = fmt(getBalance());

  cleanup = () => {
    unsub();
    flipBtn?.removeEventListener('click', onFlip);
    incBtn?.removeEventListener('click', onInc);
    decBtn?.removeEventListener('click', onDec);
    maxBtn?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    btnH?.removeEventListener('click', onPickH);
    btnT?.removeEventListener('click', onPickT);
    cheatBtn?.removeEventListener('click', onCheat);
    wrap.remove();
  };
  let cheatNext = false;
  function onCheat() {
    if (state.flipping) return;
    const cs = getCheatState(CHEAT_IDS.coinflip);
    if (!cs.charge) return;
    cheatNext = true;
    consumeCheat(CHEAT_IDS.coinflip);
    updateUI();
  }
}

export function unmount() { cleanup(); cleanup = () => {}; }
