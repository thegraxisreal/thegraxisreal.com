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
      <div class="slots-lever" role="button" aria-label="Pull the lever to spin" tabindex="0">
        <div class="slots-lever-arm">
          <div class="slots-lever-knob"></div>
        </div>
      </div>
      <div class="row slots-toolbar">
        <div class="stack">
          <div class="muted">Bet</div>
          <div class="controls slots-bet-controls">
            <button id="bet-dec" class="glass xl">−</button>
            <div id="bet" class="tag slots-bet-display" style="cursor:pointer">$10</div>
            <button id="bet-inc" class="glass xl">+</button>
            <button id="bet-half" class="glass xl slots-half">Half</button>
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
  const getMaxBet = () => Math.max(minBet, getBalance());
  const symbols = ['🍒', '🍋', '🍇', '🔔', '⭐️', '7️⃣'];
  const sequenceRepeats = 12;

  const balanceEl = el.querySelector('#balance');
  const betEl = el.querySelector('#bet');
  const betIncBtn = el.querySelector('#bet-inc');
  const betDecBtn = el.querySelector('#bet-dec');
  const betHalfBtn = el.querySelector('#bet-half');
  const betMaxBtn = el.querySelector('#bet-max');
  const spinBtn = el.querySelector('#spin');
  const cheatBtn = el.querySelector('#cheat-slots');
  const resultEl = el.querySelector('#result');
  const reelEls = Array.from(el.querySelectorAll('.slots-reel'));
  if (resultEl) {
    resultEl.textContent = 'Pull the lever or press spin to play!';
    resultEl.className = 'log slots-log';
  }
  const leverEl = el.querySelector('.slots-lever');
  const leverKnob = leverEl?.querySelector('.slots-lever-knob');
  if (leverEl) {
    leverEl.setAttribute('title', 'Pull the lever to spin');
    leverEl.setAttribute('aria-disabled', 'false');
  }

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

  const lever = { progress: 0, pointerId: null, startY: 0 };
  const LEVER_PULL_REQUIRED = 0.65;
  const LEVER_DRAG_MAX = 150;

  function setLeverProgress(p) {
    lever.progress = Math.max(0, Math.min(1, p));
    const offsetPx = lever.progress * 110;
    if (leverEl) leverEl.style.setProperty('--lever-offset', `${Math.min(offsetPx, 96).toFixed(1)}px`);
  }

  function animateLeverReturn(delay = 0) {
    if (lever.pointerId != null) return;
    const reset = () => {
      setLeverProgress(0);
      leverEl?.classList.remove('slots-lever-fired');
    };
    if (delay > 0) setTimeout(reset, delay);
    else reset();
  }

  function fireLever(source = 'lever') {
    if (!leverEl) return false;
    if (leverEl.classList.contains('slots-lever-disabled') || state.spinning) {
      animateLeverReturn();
      return false;
    }
    setLeverProgress(1);
    leverEl.classList.add('slots-lever-fired');
    const releaseDelay = source === 'button' ? 320 : 520;
    animateLeverReturn(releaseDelay);
    setTimeout(() => {
      leverEl?.classList.remove('slots-lever-fired');
    }, releaseDelay + 260);
    onSpin();
    return true;
  }

  function onLeverPointerDown(e) {
    if (!leverEl || !leverKnob || leverEl.classList.contains('slots-lever-disabled') || state.spinning) return;
    lever.pointerId = e.pointerId;
    lever.startY = e.clientY;
    leverEl.classList.add('slots-lever-dragging');
    try { leverKnob.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  }

  function onLeverPointerMove(e) {
    if (lever.pointerId == null || e.pointerId !== lever.pointerId) return;
    const delta = e.clientY - lever.startY;
    const progress = Math.max(0, Math.min(1, delta / LEVER_DRAG_MAX));
    setLeverProgress(progress);
  }

  function finishLeverPointer(e, cancelled) {
    if (lever.pointerId == null || e.pointerId !== lever.pointerId) return;
    try { leverKnob?.releasePointerCapture(lever.pointerId); } catch {}
    lever.pointerId = null;
    leverEl?.classList.remove('slots-lever-dragging');
    if (!cancelled && lever.progress >= LEVER_PULL_REQUIRED) {
      fireLever();
    } else {
      animateLeverReturn();
    }
  }

  function onLeverPointerUp(e) { finishLeverPointer(e, false); }
  function onLeverPointerCancel(e) { finishLeverPointer(e, true); }

  function onLeverKeyDown(e) {
    if (!leverEl) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (leverEl.classList.contains('slots-lever-disabled') || state.spinning) return;
      e.preventDefault();
      leverEl.classList.remove('slots-lever-dragging');
      fireLever('keyboard');
    }
  }

  setLeverProgress(0);

  const update = () => {
    balanceEl.textContent = fmt(getBalance());
    const maxBet = getMaxBet();
    if (!state.spinning) {
      if (state.bet > maxBet) state.bet = maxBet;
      else if (state.bet < minBet) state.bet = minBet;
    }
    betEl.textContent = fmt(state.bet);
    const affordable = canAfford(state.bet);
    spinBtn.disabled = state.spinning || !affordable;
    betIncBtn.disabled = state.spinning;
    betDecBtn.disabled = state.spinning;
    betHalfBtn.disabled = state.spinning;
    betMaxBtn.disabled = state.spinning;
    betEl.style.opacity = state.spinning ? '.7' : '1';
    if (leverEl) {
      const leverDisabled = state.spinning || !affordable;
      leverEl.classList.toggle('slots-lever-disabled', leverDisabled);
      leverEl.setAttribute('aria-disabled', leverDisabled ? 'true' : 'false');
      if (leverDisabled && lever.pointerId == null && lever.progress > 0 && !leverEl.classList.contains('slots-lever-fired')) {
        animateLeverReturn();
      }
    }
    const cs = getCheatState(CHEAT_IDS.slots);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.spinning;
    if (!affordable && !state.spinning) {
      resultEl.textContent = 'Not enough balance for that bet.';
      resultEl.className = 'log slots-log loss';
    }
  };
  update();

  const unsub = subscribe(() => {
    update();
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
    state.bet = Math.min(getMaxBet(), state.bet + 1);
    update();
  }

  function onBetDec() {
    if (state.spinning) return;
    state.bet = Math.max(minBet, state.bet - 1);
    update();
  }

  function onBetHalf() {
    if (state.spinning) return;
    const addition = Math.floor(getBalance() / 2);
    if (addition <= 0) return;
    state.bet = Math.max(minBet, Math.min(getMaxBet(), state.bet + addition));
    update();
  }

  function onBetMax() {
    if (state.spinning) return;
    state.bet = getMaxBet();
    update();
  }

  function onBetEdit() {
    if (state.spinning) return;
    const v = prompt('Enter bet amount', String(state.bet));
    if (v == null) return;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return;
    const maxBet = getMaxBet();
    state.bet = Math.max(minBet, Math.min(n, maxBet));
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

  function onSpinClick() {
    if (state.spinning) return;
    if (leverEl && !leverEl.classList.contains('slots-lever-disabled')) {
      const fired = fireLever('button');
      if (!fired) onSpin();
    } else {
      onSpin();
    }
  }

  betIncBtn.addEventListener('click', onBetInc);
  betDecBtn.addEventListener('click', onBetDec);
  betHalfBtn.addEventListener('click', onBetHalf);
  betMaxBtn.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  spinBtn.addEventListener('click', onSpinClick);
  cheatBtn.addEventListener('click', onCheat);
  if (leverKnob) {
    leverKnob.addEventListener('pointerdown', onLeverPointerDown);
    leverKnob.addEventListener('pointermove', onLeverPointerMove);
    leverKnob.addEventListener('pointerup', onLeverPointerUp);
    leverKnob.addEventListener('pointercancel', onLeverPointerCancel);
  }
  leverEl?.addEventListener('keydown', onLeverKeyDown);

  cleanup = () => {
    unsub();
    betIncBtn?.removeEventListener('click', onBetInc);
    betDecBtn?.removeEventListener('click', onBetDec);
    betHalfBtn?.removeEventListener('click', onBetHalf);
    betMaxBtn?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    spinBtn?.removeEventListener('click', onSpinClick);
    cheatBtn?.removeEventListener('click', onCheat);
    if (leverKnob) {
      leverKnob.removeEventListener('pointerdown', onLeverPointerDown);
      leverKnob.removeEventListener('pointermove', onLeverPointerMove);
      leverKnob.removeEventListener('pointerup', onLeverPointerUp);
      leverKnob.removeEventListener('pointercancel', onLeverPointerCancel);
    }
    leverEl?.removeEventListener('keydown', onLeverKeyDown);
    el.remove();
  };
}

export function unmount() {
  cleanup();
  cleanup = () => {};
}
