import store, { subscribe, getBalance, addBalance, canAfford } from '../store.js';
import { CHEAT_IDS, getCheatState, consumeCheat } from '../cheats.js';

let cleanup = () => {};

export async function mount(root) {
  const el = document.createElement('div');
  el.id = 'slots';
  el.className = 'slots-wrap';
  el.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Slots</h2>
      <div class="tag">RNG Demo</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto">
        <div class="muted">Balance</div>
        <div class="money" id="balance">$1,000</div>
      </div>
    </div>
    <div class="card stack">
      <div class="reels">
        <div class="reel"><div class="symbol" id="r1">🍒</div></div>
        <div class="reel"><div class="symbol" id="r2">🍋</div></div>
        <div class="reel"><div class="symbol" id="r3">🍇</div></div>
      </div>

      <div class="toolbar" style="margin-top:.5rem; justify-content:space-between;">
        <div class="stack">
          <div class="muted">Bet</div>
          <div class="controls">
            <button id="bet-dec" class="glass xl">−</button>
            <div id="bet" class="tag" style="cursor:pointer">$10</div>
            <button id="bet-inc" class="glass xl">+</button>
            <button id="bet-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
          </div>
        </div>
        <div class="controls" style="gap:.5rem; align-items:center;">
          <button id="spin" class="primary xl" style="background: linear-gradient(180deg, rgba(255,0,170,.22), rgba(255,255,255,.06)); border-color: rgba(255,0,170,.45);">Spin</button>
          <button id="cheat-slots" class="glass xl" style="display:none; background: linear-gradient(180deg, rgba(255,0,0,.4), rgba(255,255,255,.06)); border-color: rgba(255,0,0,.6); color:#fff;">Use Cheat</button>
        </div>
      </div>

      <div class="row">
        <div id="result" class="log"></div>
        <div class="muted">Payouts</div>
      </div>
      <div class="payouts">
        <div class="grid">
          <div>7️⃣ 7️⃣ 7️⃣</div><div class="money">×20</div>
          <div>⭐️ ⭐️ ⭐️</div><div class="money">×10</div>
          <div>Any 3 of a kind</div><div class="money">×8</div>
          <div>Any 2 of a kind</div><div class="money">×2</div>
        </div>
      </div>
    </div>
  `;
  root.appendChild(el);

  // State
  const state = { bet: 10, spinning: false };
  const minBet = 1;
  const maxBet = 100;
  const symbols = ['🍒', '🍋', '🍇', '🔔', '⭐️', '7️⃣'];
  const r1 = el.querySelector('#r1');
  const r2 = el.querySelector('#r2');
  const r3 = el.querySelector('#r3');
  const balanceEl = el.querySelector('#balance');
  const betEl = el.querySelector('#bet');
  const betMaxBtn = el.querySelector('#bet-max');
  const resultEl = el.querySelector('#result');
  const spinBtn = el.querySelector('#spin');
  const cheatBtn = el.querySelector('#cheat-slots');

  let timers = [];

  const fmt = (n) => `$${n.toLocaleString()}`;
  const update = () => {
    balanceEl.textContent = fmt(getBalance());
    betEl.textContent = fmt(state.bet);
    spinBtn.disabled = state.spinning || !canAfford(state.bet);
    const cs = getCheatState(CHEAT_IDS.slots);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.spinning;
  };
  update();

  // Subscribe to global balance so UI stays in sync
  const unsub = subscribe(({ balance }) => {
    balanceEl.textContent = fmt(balance);
  });

  function randomSymbol() {
    return symbols[Math.floor(Math.random() * symbols.length)];
  }

  function clearTimers() {
    timers.forEach((t) => clearInterval(t));
    timers = [];
  }

  function spinReel(node, duration) {
    const interval = 60;
    return new Promise((resolve) => {
      const t = setInterval(() => {
        node.textContent = randomSymbol();
      }, interval);
      timers.push(t);
      setTimeout(() => {
        clearInterval(t);
        timers = timers.filter((x) => x !== t);
        // Final settle
        const final = randomSymbol();
        node.textContent = final;
        resolve(final);
      }, duration);
    });
  }

  function payout(a, b, c) {
    if (a === '7️⃣' && b === '7️⃣' && c === '7️⃣') return state.bet * 20;
    if (a === '⭐️' && b === '⭐️' && c === '⭐️') return state.bet * 10;
    if (a === b && b === c) return state.bet * 8;
    if (a === b || a === c || b === c) return state.bet * 2;
    return 0;
  }

  async function onSpin() {
    if (state.spinning) return;
    if (!canAfford(state.bet)) return;
    state.spinning = true;
    addBalance(-state.bet);
    resultEl.textContent = 'Spinning…';
    resultEl.className = 'log';
    update();

    try {
      let [a, b, c] = await Promise.all([
        spinReel(r1, 900 + Math.random() * 300),
        spinReel(r2, 1100 + Math.random() * 300),
        spinReel(r3, 1300 + Math.random() * 300),
      ]);
      if (cheatNext) { a = '7️⃣'; b = '7️⃣'; c = '7️⃣'; r1.textContent = a; r2.textContent = b; r3.textContent = c; cheatNext = false; }
      const win = payout(a, b, c);
      if (win > 0) {
        addBalance(win);
        resultEl.textContent = `You won ${fmt(win)}!`;
        resultEl.className = 'log win';
      } else {
        resultEl.textContent = 'No win. Try again!';
        resultEl.className = 'log loss';
      }
    } finally {
      state.spinning = false;
      update();
    }
  }

  function onBetInc() {
    state.bet = Math.min(maxBet, state.bet + 1);
    update();
  }
  function onBetDec() {
    state.bet = Math.max(minBet, state.bet - 1);
    update();
  }
  function onBetMax() {
    state.bet = Math.max(minBet, getBalance());
    update();
  }
  function onBetEdit() {
    const v = prompt('Enter bet amount', String(state.bet));
    if (v == null) return;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    state.bet = Math.max(minBet, Math.min(n, getBalance()));
    update();
  }

  let cheatNext = false;
  function onCheat() {
    if (state.spinning) return;
    const cs = getCheatState(CHEAT_IDS.slots);
    if (!cs.charge) return;
    cheatNext = true;
    consumeCheat(CHEAT_IDS.slots);
    update();
  }

  el.querySelector('#bet-inc').addEventListener('click', onBetInc);
  el.querySelector('#bet-dec').addEventListener('click', onBetDec);
  betMaxBtn.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  spinBtn.addEventListener('click', onSpin);
  cheatBtn.addEventListener('click', onCheat);

  cleanup = () => {
    clearTimers();
    unsub();
    el.querySelector('#bet-inc')?.removeEventListener('click', onBetInc);
    el.querySelector('#bet-dec')?.removeEventListener('click', onBetDec);
    betMaxBtn?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    spinBtn?.removeEventListener('click', onSpin);
    cheatBtn?.removeEventListener('click', onCheat);
    el.remove();
  };
}

export function unmount() {
  cleanup();
  cleanup = () => {};
}
