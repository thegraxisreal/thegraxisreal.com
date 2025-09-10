import store, { subscribe, getBalance, addBalance, canAfford } from '../store.js';
import { CHEAT_IDS, getCheatState, consumeCheat } from '../cheats.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'blackjack';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Blackjack</h2>
      <div class="tag">3:2 on Blackjack</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto">
        <div class="muted">Balance</div>
        <div id="bj-balance" class="money">$0</div>
      </div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a;">
      <div class="stack">
        <div class="row"><strong>Dealer</strong> <div id="bj-dealer-value" class="tag">—</div></div>
        <div id="bj-dealer" class="row" style="gap:.5rem; flex-wrap:wrap;"></div>
      </div>
      <hr style="border:none; border-top:1px solid #20304a; margin:.75rem 0;" />
      <div class="stack">
        <div class="row"><strong>You</strong> <div id="bj-player-value" class="tag">—</div></div>
        <div id="bj-player" class="row" style="gap:.5rem; flex-wrap:wrap;"></div>
      </div>
    </div>

    <div class="toolbar" style="margin-top:.5rem; gap:.75rem; flex-wrap:wrap; justify-content:space-between;">
      <div class="stack">
        <div class="muted">Bet</div>
        <div class="controls">
          <button id="bj-bet-dec" class="glass xl">−</button>
          <div id="bj-bet" class="tag" style="cursor:pointer">$10</div>
          <button id="bj-bet-inc" class="glass xl">+</button>
          <button id="bj-bet-max" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Max</button>
        </div>
      </div>
      <div class="controls">
        <button id="bj-deal" class="primary xl" style="background: linear-gradient(180deg, rgba(170,0,255,.25), rgba(255,255,255,.06)); border-color: rgba(170,0,255,.45);">Deal</button>
        <button id="bj-hit" class="glass xl" style="background: linear-gradient(180deg, rgba(0,212,255,.18), rgba(255,255,255,.06)); border-color: rgba(0,212,255,.3);">Hit</button>
        <button id="bj-stand" class="glass xl" style="background: linear-gradient(180deg, rgba(255,204,0,.16), rgba(255,255,255,.06)); border-color: rgba(255,204,0,.3);">Stand</button>
        <button id="bj-cheat" class="glass xl" style="display:none; background: linear-gradient(180deg, rgba(255,0,0,.4), rgba(255,255,255,.06)); border-color: rgba(255,0,0,.6); color:#fff;">Use Cheat</button>
      </div>
    </div>

    <div id="bj-log" class="log"></div>
  `;
  root.appendChild(wrap);

  // Elements
  const balEl = wrap.querySelector('#bj-balance');
  const betEl = wrap.querySelector('#bj-bet');
  const betMaxBtn = wrap.querySelector('#bj-bet-max');
  const dealBtn = wrap.querySelector('#bj-deal');
  const hitBtn = wrap.querySelector('#bj-hit');
  const standBtn = wrap.querySelector('#bj-stand');
  const logEl = wrap.querySelector('#bj-log');
  const dealerEl = wrap.querySelector('#bj-dealer');
  const playerEl = wrap.querySelector('#bj-player');
  const dealerValEl = wrap.querySelector('#bj-dealer-value');
  const playerValEl = wrap.querySelector('#bj-player-value');
  const cheatBtn = wrap.querySelector('#bj-cheat');

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); updateUI(); });
  balEl.textContent = fmt(getBalance());

  // State
  const state = {
    bet: 10,
    minBet: 1,
    maxBet: 500,
    inHand: false,
    deck: [],
    player: [],
    dealer: [],
    dealerHoleRevealed: false,
  };

  function fmt(n) { return `$${n.toLocaleString()}`; }

  // Deck helpers
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const SUITS = ['♠','♥','♦','♣'];
  function newShuffledDecks(decks = 4) {
    const cards = [];
    for (let d = 0; d < decks; d++) {
      for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
    }
    // Fisher-Yates
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  function valueOf(card) { if (card.r === 'A') return 11; if (card.r === 'K' || card.r === 'Q' || card.r === 'J' || card.r === '10') return 10; return parseInt(card.r, 10); }
  function handValue(hand) {
    let total = 0, aces = 0;
    for (const c of hand) { const v = valueOf(c); total += v; if (c.r === 'A') aces++; }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }
  function isBlackjack(hand) { return hand.length === 2 && handValue(hand) === 21; }

  function ensureDeck() { if (state.deck.length < 15) state.deck = newShuffledDecks(4); }
  function drawCard() { ensureDeck(); return state.deck.pop(); }

  // Rendering
  function renderCard(c, hidden = false) {
    const el = document.createElement('div');
    el.style.width = '48px';
    el.style.height = '68px';
    el.style.border = '1px solid #2b3a52';
    el.style.borderRadius = '8px';
    el.style.background = hidden ? 'linear-gradient(135deg, #1b263a, #0f1626)' : 'linear-gradient(180deg, #0b1322, #0e1524)';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.boxShadow = 'inset 0 2px 6px rgba(255,255,255,.06), 0 6px 16px rgba(0,0,0,.35)';
    el.style.fontWeight = '700';
    el.style.fontSize = '18px';
    el.style.color = (c.s === '♥' || c.s === '♦') && !hidden ? '#ff6b81' : '#e6ebf2';
    el.textContent = hidden ? '' : `${c.r}${c.s}`;
    return el;
  }
  function renderHands() {
    dealerEl.innerHTML = '';
    playerEl.innerHTML = '';
    // Dealer: show first card face up, second hidden until reveal
    dealerEl.appendChild(renderCard(state.dealer[0] || { r:'', s:'' }));
    if (state.dealer[1]) dealerEl.appendChild(renderCard(state.dealer[1], state.inHand && !state.dealerHoleRevealed));
    for (let i = 2; i < state.dealer.length; i++) dealerEl.appendChild(renderCard(state.dealer[i]));
    // Player
    for (const c of state.player) playerEl.appendChild(renderCard(c));
    // Values
    playerValEl.textContent = state.player.length ? String(handValue(state.player)) : '—';
    if (!state.inHand || state.dealerHoleRevealed) dealerValEl.textContent = state.dealer.length ? String(handValue(state.dealer)) : '—';
    else dealerValEl.textContent = state.dealer.length ? String(valueOf(state.dealer[0])) + ' + ?' : '—';
  }

  // Game flow
  let cheatNext = false;
  function updateUI() {
    betEl.textContent = fmt(state.bet);
    balEl.textContent = fmt(getBalance());
    dealBtn.disabled = state.inHand || !canAfford(state.bet);
    hitBtn.disabled = !state.inHand;
    standBtn.disabled = !state.inHand;
    const cs = getCheatState(CHEAT_IDS.blackjack);
    cheatBtn.style.display = cs.charge ? 'inline-block' : 'none';
    cheatBtn.disabled = state.inHand;
  }

  function log(msg, cls = '') { logEl.textContent = msg; logEl.className = 'log ' + cls; }

  function onCheat() {
    if (state.inHand) return;
    const cs = getCheatState(CHEAT_IDS.blackjack);
    if (!cs.charge) return;
    cheatNext = true;
    consumeCheat(CHEAT_IDS.blackjack);
    updateUI();
  }

  function startHand() {
    if (state.inHand) return;
    if (!canAfford(state.bet)) return;
    state.inHand = true;
    state.player = [];
    state.dealer = [];
    state.dealerHoleRevealed = false;
    addBalance(-state.bet);
    ensureDeck();
    if (cheatNext) {
      // Force player blackjack, dealer not blackjack
      state.player.push({ r:'A', s:'♠' });
      state.player.push({ r:'K', s:'♦' });
      state.dealer.push(drawCard());
      state.dealer.push({ r:'9', s:'♣' });
      cheatNext = false;
    } else {
      // initial deal
      state.player.push(drawCard());
      state.dealer.push(drawCard());
      state.player.push(drawCard());
      state.dealer.push(drawCard()); // hole card
    }
    renderHands();
    updateUI();

    const pBJ = isBlackjack(state.player);
    const dBJ = isBlackjack(state.dealer);
    if (pBJ || dBJ) {
      state.dealerHoleRevealed = true;
      renderHands();
      if (pBJ && dBJ) {
        log('Push: both have Blackjack', '');
        addBalance(state.bet); // return bet
      } else if (pBJ) {
        const win = Math.floor(state.bet * 2.5); // 3:2
        addBalance(win);
        log(`Blackjack! You win ${fmt(win)}`, 'win');
      } else {
        log('Dealer has Blackjack. You lose.', 'loss');
      }
      state.inHand = false;
      updateUI();
    } else {
      log('Your move: Hit or Stand?');
    }
  }

  function hit() {
    if (!state.inHand) return;
    state.player.push(drawCard());
    renderHands();
    const v = handValue(state.player);
    if (v > 21) {
      state.inHand = false;
      state.dealerHoleRevealed = true;
      renderHands();
      log('Bust! You lose.', 'loss');
      updateUI();
    }
  }

  function stand() {
    if (!state.inHand) return;
    state.dealerHoleRevealed = true;
    // Dealer draws to 17 (stand on soft 17)
    while (handValue(state.dealer) < 17) {
      state.dealer.push(drawCard());
    }
    renderHands();
    const pv = handValue(state.player);
    const dv = handValue(state.dealer);
    let outcome = '';
    if (dv > 21) outcome = 'win';
    else if (pv > dv) outcome = 'win';
    else if (pv < dv) outcome = 'loss';
    else outcome = 'push';

    if (outcome === 'win') {
      const win = state.bet * 2;
      addBalance(win);
      log(`You win ${fmt(win)}!`, 'win');
    } else if (outcome === 'push') {
      addBalance(state.bet);
      log('Push. Your bet is returned.');
    } else {
      log('Dealer wins. You lose.', 'loss');
    }
    state.inHand = false;
    updateUI();
  }

  // Events
  function onBetInc() { if (state.inHand) return; state.bet = Math.min(state.maxBet, state.bet + 1); updateUI(); }
  function onBetDec() { if (state.inHand) return; state.bet = Math.max(state.minBet, state.bet - 1); updateUI(); }
  function onBetMax() { if (state.inHand) return; state.bet = Math.max(state.minBet, getBalance()); updateUI(); }
  function onBetEdit() { if (state.inHand) return; const v = prompt('Enter bet amount', String(state.bet)); if (v==null) return; const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n<=0) return; state.bet = Math.max(state.minBet, Math.min(n, getBalance())); updateUI(); }
  wrap.querySelector('#bj-bet-inc').addEventListener('click', onBetInc);
  wrap.querySelector('#bj-bet-dec').addEventListener('click', onBetDec);
  betMaxBtn.addEventListener('click', onBetMax);
  betEl.addEventListener('click', onBetEdit);
  dealBtn.addEventListener('click', startHand);
  hitBtn.addEventListener('click', hit);
  standBtn.addEventListener('click', stand);
  cheatBtn.addEventListener('click', onCheat);

  renderHands();
  updateUI();

  cleanup = () => {
    unsub();
    wrap.querySelector('#bj-bet-inc')?.removeEventListener('click', onBetInc);
    wrap.querySelector('#bj-bet-dec')?.removeEventListener('click', onBetDec);
    betMaxBtn?.removeEventListener('click', onBetMax);
    betEl?.removeEventListener('click', onBetEdit);
    dealBtn?.removeEventListener('click', startHand);
    hitBtn?.removeEventListener('click', hit);
    standBtn?.removeEventListener('click', stand);
    cheatBtn?.removeEventListener('click', onCheat);
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
