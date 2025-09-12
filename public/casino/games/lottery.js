import { getBalance, canAfford, addBalance, subscribe } from '../store.js';
import { formatMoneyExtended as fmt } from '../format.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'lottery';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Lottery</h2>
      <div class="tag">Opens every 3 minutes</div>
      <div class="spacer"></div>
      <div class="stack" style="align-items:end;">
        <div class="muted">Balance</div>
        <div id="lt-balance" class="money">$0</div>
      </div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a;">
      <div class="stack">
        <div class="row" style="gap:.75rem; align-items:center; flex-wrap:wrap;">
          <div id="lt-jackpot" class="money" style="font-size:1.4rem; font-weight:900;">TOTAL JACKPOT: $0</div>
          <div id="lt-price" class="tag">Ticket: —</div>
          <div id="lt-phase" class="tag">—</div>
          <div class="spacer"></div>
          <button id="lt-buy" class="primary xl">Buy Ticket</button>
        </div>
        <div style="height:10px; border-radius:999px; background:#132032; overflow:hidden;">
          <div id="lt-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #00d4ff, #ffd166);"></div>
        </div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <div id="lt-timer" class="muted">Next round soon…</div>
          <div class="spacer"></div>
          <div id="lt-entrants" class="tag">0 entrants</div>
        </div>
        <div id="lt-note" class="muted"></div>
        <div id="lt-winner" class="tag" style="display:none"></div>
      </div>
    </div>
    <div id="lt-closed" style="display:none; position:absolute; inset:0; z-index:5; align-items:center; justify-content:center; padding:2rem; background:repeating-linear-gradient(45deg, #ffcc00 0 16px, #111 16px 32px);">
      <div style="max-width:640px; width:100%; text-align:center; background:rgba(0,0,0,.8); color:#ffcc00; border:2px solid #ffcc00; padding:1.25rem 1.5rem; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,.5); font-weight:900;">
        <div style="font-size:1.4rem; letter-spacing:.3px;">Lottery closed</div>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  const balEl = wrap.querySelector('#lt-balance');
  const buyBtn = wrap.querySelector('#lt-buy');
  const priceEl = wrap.querySelector('#lt-price');
  const jackpotEl = wrap.querySelector('#lt-jackpot');
  const timerEl = wrap.querySelector('#lt-timer');
  const barEl = wrap.querySelector('#lt-bar');
  const phaseEl = wrap.querySelector('#lt-phase');
  const entrantsEl = wrap.querySelector('#lt-entrants');
  const winnerEl = wrap.querySelector('#lt-winner');
  const noteEl = wrap.querySelector('#lt-note');
  wrap.style.position = 'relative';
  const closedEl = wrap.querySelector('#lt-closed');

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); updateBuyState(); });
  balEl.textContent = fmt(getBalance());

  let status = null;
  let boughtRound = null;
  let pollT = 0;
  const BASE = (localStorage.getItem('tgx_ngrok_base') || '').replace(/\/$/, '');
  if (!BASE) { noteEl.textContent = 'Lottery closed'; closedEl.style.display = 'flex'; }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem('tgx_lottery_local_v1') || '{}'); } catch { return {}; }
  }
  function saveLocal(s) { try { localStorage.setItem('tgx_lottery_local_v1', JSON.stringify(s)); } catch {} }

  function markBought(roundId) { const s = loadLocal(); s.boughtId = roundId; saveLocal(s); }
  function getBought() { const s = loadLocal(); return s.boughtId || null; }
  function markClaimed(roundId) { const s = loadLocal(); s.claimed = s.claimed || {}; s.claimed[roundId] = true; saveLocal(s); }
  function isClaimed(roundId) { const s = loadLocal(); return !!(s.claimed && s.claimed[roundId]); }

  async function fetchStatus() {
    if (!BASE) return;
    try {
      const res = await fetch(`${BASE}/lottery?ngrok_skip_browser_warning=true`, { cache:'no-store', headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      status = await res.json();
      closedEl.style.display = 'none';
      renderStatus();
    } catch (e) {
      noteEl.textContent = 'Lottery closed';
      closedEl.style.display = 'flex';
    }
  }

  function full(n){ return `$${Math.floor(Math.max(0,n)).toLocaleString()}`; }

  function renderStatus() {
    if (!status || !status.ok) return;
    const r = status.round;
    boughtRound = getBought();
    // Price & jackpot
    priceEl.textContent = `Ticket: ${fmt(r.price)}`;
    priceEl.title = `Ticket: ${full(r.price)}`;
    jackpotEl.textContent = `TOTAL JACKPOT: ${fmt(r.jackpot)}`;
    jackpotEl.title = `Jackpot: ${full(r.jackpot)}`;
    entrantsEl.textContent = `${r.entrants} entrant${r.entrants===1?'':'s'}`;
    // Phase and timer
    const now = status.now;
    if (r.phase === 'open') {
      phaseEl.textContent = 'Open';
      const remain = Math.max(0, r.saleEnd - now);
      const pct = Math.max(0, Math.min(100, Math.floor((remain / 60000) * 100)));
      barEl.style.width = `${pct}%`;
      timerEl.textContent = `Sale ends in ${(remain/1000).toFixed(0)}s`;
    } else {
      phaseEl.textContent = 'Waiting';
      const remain = Math.max(0, r.nextStart - now);
      const pct = 0;
      barEl.style.width = `${pct}%`;
      timerEl.textContent = `Next round in ${(remain/1000).toFixed(0)}s`;
    }
    // Winner broadcast: always display latest winner and attempt payout once
    if (status.lastWinner) {
      const w = status.lastWinner;
      winnerEl.style.display = 'inline-block';
      winnerEl.textContent = `${w.username} won ${fmt(w.amount)}!`;
      const me = (localStorage.getItem('tgx_username') || '').trim();
      if (me && me.toLowerCase() === String(w.username || '').toLowerCase() && !isClaimed(w.roundId)) {
        const amt = Math.floor(Number(w.amount || 0));
        if (Number.isFinite(amt) && amt > 0) {
          addBalance(amt);
          markClaimed(w.roundId);
        }
      }
    } else {
      winnerEl.style.display = 'none';
    }
    updateBuyState();
  }

  function updateBuyState() {
    if (!status || !status.ok) { buyBtn.disabled = true; return; }
    const r = status.round;
    const me = (localStorage.getItem('tgx_username') || '').trim();
    const already = boughtRound && String(boughtRound) === String(r.start);
    buyBtn.disabled = r.phase !== 'open' || already || !canAfford(r.price) || !me;
    buyBtn.textContent = already ? 'Ticket Purchased' : 'Buy Ticket';
  }

  async function onBuy() {
    if (!status || !status.ok) return;
    const r = status.round;
    const me = (localStorage.getItem('tgx_username') || '').trim();
    if (!me) { noteEl.textContent = 'Set a username first.'; return; }
    if (r.phase !== 'open') return;
    if (!canAfford(r.price)) { noteEl.textContent = 'Insufficient funds for this ticket.'; return; }
    try {
      buyBtn.disabled = true;
      const res = await fetch(`${BASE}/lottery/buy`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: me }) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok || !j || !j.ok) { noteEl.textContent = (j && j.error) ? `Purchase failed: ${j.error}` : 'Purchase failed.'; updateBuyState(); return; }
      const paid = Math.floor(Number(j.price || r.price || 0));
      if (Number.isFinite(paid) && paid > 0 && canAfford(paid)) {
        addBalance(-paid);
      }
      const rid = j.roundId || r.start;
      markBought(rid);
      boughtRound = rid;
      updateBuyState();
      noteEl.textContent = 'You are in this round!';
      fetchStatus();
    } catch (e) {
      noteEl.textContent = 'Purchase failed.';
    }
  }
  buyBtn.addEventListener('click', onBuy);

  async function loop() {
    await fetchStatus();
    pollT = setTimeout(loop, 2000);
  }
  loop();

  cleanup = () => {
    clearTimeout(pollT);
    buyBtn?.removeEventListener('click', onBuy);
    unsub();
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
