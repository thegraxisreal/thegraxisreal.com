import { addBalance, canAfford } from './store.js';
import { CHEAT_IDS, canBuyCheat, secondsUntilRestock, setCheatCharge, startCooldown, getCheatState } from './cheats.js';

let cleanup = () => {};

const PRICE = 100000; // 100k each

const ITEMS = [
  { id: CHEAT_IDS.slots, name: 'Lucky Slots Drink', desc: 'A legendary concoction from the original thegraxisreal casino. Guarantees a jackpot on your next spin.', game: 'Slots' },
  { id: CHEAT_IDS.horse, name: 'Horse Steroids', desc: 'Makes your chosen horse run like the wind. Guarantees a win next race.', game: 'Horse Race' },
  { id: CHEAT_IDS.plinko, name: 'Peg Grease', desc: 'Greases the pegs just right. Your next drop finds the best payout.', game: 'Plinko' },
  { id: CHEAT_IDS.coinflip, name: 'Two‑Heads Coin', desc: 'A weighted coin for the bold. Your next flip lands your pick.', game: 'Coin Flip' },
  { id: CHEAT_IDS.blackjack, name: 'Cold Deck', desc: 'The house has a cold deck tonight. Your next hand is unbeatable.', game: 'Blackjack' },
];

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'blackmarket';
  wrap.innerHTML = `
    <div class="row" style="align-items:center;">
      <h2 style="margin:0">Black Market</h2>
      <div class="tag">Off the books</div>
    </div>
    <div class="store-grid" id="bm-grid"></div>
    <div class="muted" style="font-size:.9rem;">Each item can be purchased once per 90s and grants a single use in its game. Use it wisely.</div>
  `;
  root.appendChild(wrap);

  const grid = wrap.querySelector('#bm-grid');
  let timer = 0;

  function icon(id) {
    if (id === CHEAT_IDS.slots) return `<svg width="140" height="100" viewBox="0 0 140 100"><rect x="10" y="20" width="120" height="60" rx="10" fill="#1a122a"/><text x="70" y="58" text-anchor="middle" font-size="26" fill="#ffd166">777</text></svg>`;
    if (id === CHEAT_IDS.horse) return `<svg width="140" height="100" viewBox="0 0 140 100"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0a1e14"/><text x="70" y="60" text-anchor="middle" font-size="44">🐎</text></svg>`;
    if (id === CHEAT_IDS.plinko) return `<svg width="140" height="100" viewBox="0 0 140 100"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0e1526"/>${Array.from({length:5},(_,r)=>Array.from({length:r+1},(_,c)=>`<circle cx="${40 + c*16 + (4-r)*8}" cy="${24 + r*12}" r="3" fill="#e6ebf2"/>`).join('')).join('')}</svg>`;
    if (id === CHEAT_IDS.coinflip) return `<svg width="140" height="100" viewBox="0 0 140 100"><rect x="10" y="10" width="120" height="80" rx="12" fill="#201a0a"/><circle cx="70" cy="50" r="28" fill="#ffd166"/><text x="70" y="56" text-anchor="middle" font-size="22" font-weight="700" fill="#3b2b05">H</text></svg>`;
    if (id === CHEAT_IDS.blackjack) return `<svg width="140" height="100" viewBox="0 0 140 100"><rect x="8" y="8" width="124" height="84" rx="12" fill="#0f1420"/><rect x="40" y="26" width="32" height="46" rx="6" fill="#0b1322" stroke="#2b3a52"/><rect x="64" y="30" width="32" height="46" rx="6" fill="#0b1322" stroke="#2b3a52"/><text x="56" y="56" font-size="16">A♠</text><text x="80" y="60" font-size="16">K♦</text></svg>`;
    return '';
  }

  function render() {
    grid.innerHTML = '';
    ITEMS.forEach(it => {
      const st = getCheatState(it.id);
      const canBuy = canBuyCheat(it.id);
      const card = document.createElement('div');
      card.className = 'store-card';
      const timerTag = `<div class="tag" data-timer="${it.id}">Restock in ${secondsUntilRestock(it.id)}s</div>`;
      const cta = st.charge
        ? (canBuy ? '<div class="tag">Activate in game</div>' : `<div class="stack" style="align-items:end; gap:.35rem"><div class="tag">Activate in game</div>${timerTag}</div>`)
        : (canBuy ? `<button data-buy="${it.id}" class="primary xl">Buy</button>` : timerTag);
      card.innerHTML = `
        <div class="store-thumb">${icon(it.id)}</div>
        <div class="stack">
          <div class="store-name">${it.name} <span class="store-badge">${it.game}</span></div>
          <div class="store-desc">${it.desc}</div>
        </div>
        <div class="store-cta">
          <div class="price">$${PRICE.toLocaleString()}</div>
          ${cta}
        </div>
      `;
      const buyBtn = card.querySelector('[data-buy]');
      if (buyBtn) buyBtn.addEventListener('click', () => {
        if (!canAfford(PRICE)) return;
        if (!canBuyCheat(it.id)) return;
        addBalance(-PRICE);
        setCheatCharge(it.id, true);
        startCooldown(it.id, 90);
        render();
      });
      grid.appendChild(card);
    });

    clearInterval(timer);
    timer = setInterval(() => {
      const nodes = grid.querySelectorAll('[data-timer]');
      nodes.forEach(n => {
        const id = n.getAttribute('data-timer');
        const s = secondsUntilRestock(id);
        if (s <= 0) { render(); }
        else n.textContent = `Restock in ${s}s`;
      });
    }, 500);
  }

  render();
  cleanup = () => { clearInterval(timer); wrap.remove(); };
}

export function unmount() { cleanup(); cleanup = () => {}; }
