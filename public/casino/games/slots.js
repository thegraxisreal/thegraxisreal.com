import { subscribe, getBalance, addBalance, canAfford } from '../store.js';
import { formatMoneyExtended as formatMoney } from '../format.js';
import { CHEAT_IDS, getCheatState, consumeCheat } from '../cheats.js';

let cleanup = () => {};

export async function mount(root) {
  const el = document.createElement('div');
  el.id = 'slots';
  el.className = 'slots-wrap';
  el.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Slots</h2>
      <div class="tag">High roller edition</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto; text-align:right;">
        <div class="muted">Balance</div>
        <div class="money" id="balance">$1,000</div>
      </div>
    </div>
    <div class="card stack slots-machine">
      <div class="slots-window" id="slots-window">
        <div class="slots-reel" data-reel="0"><div class="slots-track"></div></div>
        <div class="slots-reel" data-reel="1"><div class="slots-track"></div></div>
        <div class="slots-reel" data-reel="2"><div class="slots-track"></div></div>
      </div>
      <div class="row slots-toolbar">
        <div class="stack">
          <div class="muted">Bet</div>
          <div class="controls slots-bet-controls">
            <button id="bet-dec" class="glass xl">−</button>
            <div id="bet" class="tag slots-bet-display" style="cursor:pointer">$10</div>
            <button id="bet-inc" class="glass xl">+</button>
            <button id="bet-max" class="primary xl slots-max">Max</button>
          </div>
        </div>
        <div class="controls slots-actions" style="gap:.75rem; align-items:center;">
          <button id="spin" class="primary xl slots-spin">Spin</button>
          <button id="cheat-slots" class="glass xl slots-cheat" style="display:none;">Use Cheat</button>
        </div>
      </div>
      <div class="slots-footer stack">
        <div id="result" class="log slots-log"></div>
        <div class="muted">Payouts</div>
        <div class="slots-payouts">
          <div>7️⃣ 7️⃣ 7️⃣</div><div class="money">×20</div>
          <div>⭐️ ⭐️ ⭐️</div><div class="money">×10</div>
          <div>Any 3 of a kind</div><div class="money">×8</div>
          <div>Any 2 of a kind</div><div class="money">×2</div>
        </div>
      </div>
    </div>
  `;
  root.appendChild(el);

  const state = { bet: 10, spinning: false };
  const minBet = 1;
  const maxBet = 100;
  const symbols = ['🍒', '🍋', '🍇', '🔔', '⭐️', '7️⃣'];
  const sequenceRepeats = 12;

  const balanceEl = el.querySelector('#balance');
  const betEl = el.querySelector('#bet');
  const betIncBtn = el.querySelector('#bet-inc');
  const betDecBtn = el.querySelector('#bet-dec');
  const betMaxBtn = el.querySelector('#bet-max');
  const spinBtn = el.querySelector('#spin');
  const cheatBtn = el.querySelector('#cheat-slots');
  const resultEl = el.querySelector('#result');
  const reelEls = Array.from(el.querySelectorAll('.slots-reel'));

  const machineEl = el.querySelector('.slots-machine');
  const computed = machineEl ? getComputedStyle(machineEl) : null;
  const symbolHeight = computed ? parseFloat(computed.getPropertyValue('--slot-symbol-height')) || 112 : 112;

  const fmt = (n) => formatMoney(n);

  const loops = 6;
  const reels = reelEls.map((reelEl, index) => {
    const track = reelEl.querySelector('.slots-track');
    const baseSequence = [];
    for (let i = 0; i < sequenceRepeats; i++) baseSequence.push(...symbols);
    const rotation = (index * 5) % baseSequence.length;
    const rotated = baseSequence.slice(rotation).concat(baseSequence.slice(0, rotation));
    const extended = Array.from({ length: rotated.length * loops }, (_, idx) => rotated[idx % rotated.length]);
    track.innerHTML = extended.map((sym, idx) => `<div class="slot-symbol" data-idx="${idx}">${sym}</div>`).join('');
    const start = Math.floor(Math.random() * rotated.length);
    track.style.transform = `translateY(${-start * symbolHeight}px)`;
    return {
      reelEl,
      track,
      sequence: rotated,
      sequenceLength: rotated.length,
      renderLength: extended.length,
      position: start,
    };
  });

  const update = () => {
    balanceEl.textContent = fmt(getBalance());
    betEl.textContent = fmt(state.bet);
    const affordable = canAfford(state.bet);
    spinBtn.disabled = state.spinning || !affordable;
    betIncBtn.disabled = state.spinning;
    betDecBtn.disabled = state.spinning;
    betMaxBtn.disabled = state.spinning;
    betEl.style.opacity = state.spinning ? '.7' : '1';
    const cs = getCheatState(CHEAT_IDS.slots);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.spinning;
    if (!affordable && !state.spinning) {
      resultEl.textContent = 'Not enough balance for that bet.';
      resultEl.className = 'log slots-log loss';
    }
  };
  update();

  const unsub = subscribe(({ balance }) => {
    balanceEl.textContent = fmt(balance);
  });

  const randomSymbol = () => symbols[Math.floor(Math.random() * symbols.length)];

  function findNextIndex(reel, startIndex, targetSymbol) {
    const { sequence, sequenceLength } = reel;
    for (let offset = 0; offset < sequenceLength * 2; offset++) {
      const idx = startIndex + offset;
      if (sequence[idx % sequenceLength] === targetSymbol) return idx;
    }
    return startIndex;
  }

  function animateReel(reel, index, targetSymbol) {
    const baseSpins = 18 + index * 6;
    const startIndex = reel.position + baseSpins;
    const targetIndex = findNextIndex(reel, startIndex, targetSymbol);
    const distance = targetIndex - reel.position;
    const duration = 1100 + index * 220 + distance * 8;
    const track = reel.track;

    return new Promise((resolve) => {
      const onEnd = (evt) => {
        if (evt.target !== track || evt.propertyName !== 'transform') return;
        track.removeEventListener('transitionend', onEnd);
        reel.position = targetIndex % reel.sequenceLength;
        const normalizedTranslate = -reel.position * symbolHeight;
        requestAnimationFrame(() => {
          track.style.transition = 'none';
          track.style.transform = `translateY(${normalizedTranslate}px)`;
          void track.offsetHeight;
          track.style.transition = '';
          resolve(targetSymbol);
        });
      };

      track.addEventListener('transitionend', onEnd);
      requestAnimationFrame(() => {
        track.style.transition = `transform ${duration}ms cubic-bezier(0.18, 0.82, 0.23, 0.97)`;
        track.style.transform = `translateY(${-targetIndex * symbolHeight}px)`;
      });
    });
  }

  function evaluate(resultSymbols) {
    const [a, b, c] = resultSymbols;
    if (a === '7️⃣' && b === '7️⃣' && c === '7️⃣') return { amount: state.bet * 20, highlight: [0, 1, 2] };
    if (a === '⭐️' && b === '⭐️' && c === '⭐️') return { amount: state.bet * 10, highlight: [0, 1, 2] };
    if (a === b && b === c) return { amount: state.bet * 8, highlight: [0, 1, 2] };
    if (a === b) return { amount: state.bet * 2, highlight: [0, 1] };
    if (a === c) return { amount: state.bet * 2, highlight: [0, 2] };
    if (b === c) return { amount: state.bet * 2, highlight: [1, 2] };
    return { amount: 0, highlight: [] };
  }

  function applyHighlights(indices) {
    reels.forEach((reel, idx) => {
      if (indices.includes(idx)) {
        reel.reelEl.classList.add('slots-reel-win');
      } else {
        reel.reelEl.classList.remove('slots-reel-win');
      }
    });
  }

  function onBetInc() {
    if (state.spinning) return;
    state.bet = Math.min(maxBet, state.bet + 1);
    update();
  }

  function onBetDec() {
    if (state.spinning) return;
    state.bet = Math.max(minBet, state.bet - 1);
    update();
  }

  function onBetMax() {
    if (state.spinning) return;
    state.bet = Math.max(minBet, Math.min(getBalance(), maxBet));
    update();
  }

  function onBetEdit() {
    if (state.spinning) return;
    const v = prompt('Enter bet amount', String(state.bet));
    if (v == null) return;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    state.bet = Math.max(minBet, Math.min(n, maxBet, getBalance() || maxBet));
    update();
  }

  let cheatNext = false;
  function onCheat() {
    if (state.spinning) return;
    const cs = getCheatState(CHEAT_IDS.slots);
    if (!cs.charge) return;
    cheatNext = true;
    consumeCheat(CHEAT_IDS.slots);
    applyHighlights([]);
    update();
    resultEl.textContent = 'Cheat locked in! Next spin hits the jackpot.';
    resultEl.className = 'log slots-log';
  }

  async function onSpin() {
    if (state.spinning) return;
    if (!canAfford(state.bet)) {
      update();
      return;
    }
    state.spinning = true;
    applyHighlights([]);
    addBalance(-state.bet);
    resultEl.textContent = 'Spinning…';
    resultEl.className = 'log slots-log';
    update();

    const finalSymbols = cheatNext ? ['7️⃣', '7️⃣', '7️⃣'] : [randomSymbol(), randomSymbol(), randomSymbol()];
    cheatNext = false;

    try {
      const resolved = await Promise.all(reels.map((reel, idx) => animateReel(reel, idx, finalSymbols[idx])));
      const { amount, highlight } = evaluate(resolved);
      if (amount > 0) {
        addBalance(amount);
        resultEl.textContent = `You won ${fmt(amount)}!`;
        resultEl.className = 'log slots-log win';
      } else {
        resultEl.textContent = 'No win. Try again!';
        resultEl.className = 'log slots-log loss';
      }
      applyHighlights(highlight);
    } finally {
      state.spinning = false;
      update();
    }
  }

  betIncBtn.addEventListener('click', onBetInc);
  betDecBtn.addEventListener('click', onBetDec);
  betMaxBtn.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  spinBtn.addEventListener('click', onSpin);
  cheatBtn.addEventListener('click', onCheat);

  cleanup = () => {
    unsub();
    betIncBtn?.removeEventListener('click', onBetInc);
    betDecBtn?.removeEventListener('click', onBetDec);
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
