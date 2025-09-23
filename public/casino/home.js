import store, { subscribe, getBalance, addBalance, setBalance } from './store.js';
import { formatMoneyExtended as formatMoney } from './format.js';
import { triggerFeaturePromo } from './feature_promoter.js';
import { getStatsSnapshot } from './player_stats.js';

let cleanup = () => {};

export async function mount(root) {
  const el = document.createElement('section');
  el.className = 'home-wrap';

  const LIQUID_UI_KEY = 'tgx_liquid_ui_pref';

  const quickCards = [
    { icon: '🎰', title: 'Slots', blurb: 'Spin the neon reels and chase multipliers', hash: '#/slots' },
    { icon: '🃏', title: 'Blackjack', blurb: 'Beat the dealer and stack the deck', hash: '#/blackjack' },
    { icon: '📬', title: 'Email', blurb: 'Check casino mail for quests and lore', hash: '#/email' },
    { icon: '📊', title: 'Stats', blurb: 'Track your records and favorites', hash: '#/stats' },
    { icon: '🏆', title: 'Leaderboard', blurb: 'Scope the whales and chase them', hash: '#/leaderboard' },
    { icon: '🍹', title: 'Bar', blurb: 'Grab perks and boosts before games', hash: '#/bar' },
  ];

  const quickMarkup = quickCards.map((card) => `
    <a class="card home-card" href="${card.hash}" data-home-nav="${card.hash}">
      <span class="home-card-icon">${card.icon}</span>
      <div class="home-card-text">
        <h3>${card.title}</h3>
        <p>${card.blurb}</p>
      </div>
      <span class="home-card-cta">Enter</span>
    </a>
  `).join('');

  el.innerHTML = `
    <section class="card home-hero">
      <div class="home-hero-copy">
        <span class="home-eyebrow">Welcome to thegraxisreal casino</span>
        <h2 class="home-title">Run the tables. Keep the chips.</h2>
        <p class="home-sub">Your balance, unlocks, and secret perks stay with you wherever you play. Dive into a spotlight room or pick a favorite.</p>
        <div class="home-cta">
          <a class="btn primary" href="#/slots" data-home-nav="#/slots">Jump into Slots</a>
          <button class="btn glass" id="home-surprise">Surprise me</button>
        </div>
      </div>
      <div class="home-hero-metrics">
        <div class="home-metric">
          <span class="home-metric-label">Current balance</span>
          <span class="home-metric-value" data-home-balance>$0</span>
        </div>
        <div class="home-metric">
          <span class="home-metric-label">Favorite hangout</span>
          <span class="home-metric-value" data-home-favorite>—</span>
          <span class="home-metric-sub" data-home-favorite-plays></span>
        </div>
        <div class="home-metric">
          <span class="home-metric-label">Highest stack</span>
          <span class="home-metric-value" data-home-highest>$0</span>
          <span class="home-metric-sub" data-home-highest-time></span>
        </div>
      </div>
    </section>

    <section class="home-grid">
      ${quickMarkup}
    </section>

    <section class="card home-info">
      <div class="home-info-block">
        <h3>Quick tips</h3>
        <ul>
          <li>Every game shares the same bankroll — watch the HUD.</li>
          <li>Bar boosts and shop unlocks tweak payouts and visuals.</li>
          <li>Check your stats after hot streaks to lock in milestones.</li>
        </ul>
      </div>
      <div class="home-info-tools">
        <h3>Account tools</h3>
        <p class="muted">Need a fresh start? Resetting money keeps everything else intact.</p>
        <div class="home-tool-row">
          <button id="reset-money" class="btn glass">Reset Money to $100,000</button>
        </div>
        <div class="home-tool-row">
          <span class="muted">Liquid UI</span>
          <button id="home-liquid-toggle" class="btn glass">Turn On</button>
        </div>
      </div>
    </section>
  `;
  root.appendChild(el);

  // Update HUD in case home is first load
  const moneyEl = document.getElementById('money-amount');
  const balanceSummary = el.querySelector('[data-home-balance]');
  const favoriteEl = el.querySelector('[data-home-favorite]');
  const favoritePlaysEl = el.querySelector('[data-home-favorite-plays]');
  const highestEl = el.querySelector('[data-home-highest]');
  const highestTimeEl = el.querySelector('[data-home-highest-time]');

  function formatTimestamp(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return '';
    }
  }

  function updateHomeSummary() {
    const snap = getStatsSnapshot();
    const bal = getBalance();
    if (balanceSummary) balanceSummary.textContent = formatMoney(bal);
    if (favoriteEl) favoriteEl.textContent = snap.favoriteLabel || 'Explore to claim a favorite spot';
    if (favoritePlaysEl) favoritePlaysEl.textContent = snap.favoriteCount ? `${snap.favoriteCount.toLocaleString()} sessions` : '';
    if (highestEl) highestEl.textContent = formatMoney(snap.stats?.highestBalance || 0);
    if (highestTimeEl) {
      const at = snap.stats?.highestBalanceAt;
      highestTimeEl.textContent = at ? `Set ${formatTimestamp(at)}` : '';
    }
  }
  const renderHud = (b) => {
    if (!moneyEl) return;
    // If hovered, show full digits; else compact
    const hovered = moneyEl.matches(':hover');
    moneyEl.textContent = hovered ? `$${Math.floor(Math.max(0,b)).toLocaleString()}` : formatMoney(b);
    updateHomeSummary();
  };
  const unsub = subscribe(({ balance }) => { renderHud(balance); });
  renderHud(getBalance());
  updateHomeSummary();

  // Username capture on first visit (or if missing)
  const NAME_KEY = 'tgx_username';
  function ensureUsername() {
    const existing = localStorage.getItem(NAME_KEY);
    if (existing && existing.trim()) return; // already set
    // Modal overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.background = 'rgba(0,0,0,.5)'; overlay.style.display = 'grid'; overlay.style.placeItems = 'center'; overlay.style.zIndex = '80';
    const panel = document.createElement('div');
    panel.className = 'card stack';
    panel.style.maxWidth = '520px'; panel.style.margin = '1rem';
    panel.innerHTML = `
      <h3 style="margin:.25rem 0">Choose a username</h3>
      <p class="muted">This name will appear on the public leaderboard and cannot be changed later.</p>
      <input id="name-input" type="text" placeholder="username (letters, numbers, underscore)" style="padding:.7rem .8rem; border-radius:10px; border:1px solid #2b3a52; background:#0b1322; color:var(--fg);" />
      <div class="row" style="justify-content:flex-end; gap:.5rem">
        <button id="name-submit" class="primary">Confirm</button>
      </div>
      <div id="name-err" class="muted"></div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function validateName(v) {
      if (typeof v !== 'string') return 'Enter a name';
      const s = v.trim();
      if (s.length < 3) return 'At least 3 characters';
      if (s.length > 20) return 'Max 20 characters';
      if (!/^\w+$/.test(s)) return 'Use letters, numbers, underscore only';
      return '';
    }
    function submit() {
      const input = panel.querySelector('#name-input');
      const err = panel.querySelector('#name-err');
      const val = input.value || '';
      const msg = validateName(val);
      if (msg) { err.textContent = msg; return; }
      localStorage.setItem(NAME_KEY, val.trim());
      document.body.removeChild(overlay);
    }
    panel.querySelector('#name-submit').addEventListener('click', submit);
    panel.querySelector('#name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    // focus input
    setTimeout(()=> panel.querySelector('#name-input').focus(), 50);
  }
  ensureUsername();

  // Admin lock (bottom-right)
  const lockBtn = document.createElement('button');
  lockBtn.title = 'Admin';
  lockBtn.textContent = '🔒';
  lockBtn.style.position = 'fixed';
  lockBtn.style.right = '16px';
  lockBtn.style.bottom = '16px';
  lockBtn.style.zIndex = '50';
  lockBtn.className = 'glass';

  let panel = null;
  function closePanel() { panel?.remove(); panel = null; }

  function grant(n) { addBalance(n); flash(`Added $${n.toLocaleString()}`); }
  function flash(msg) {
    const note = document.createElement('div');
    note.className = 'tag';
    note.textContent = msg;
    note.style.position = 'fixed'; note.style.right = '16px'; note.style.bottom = '70px'; note.style.zIndex = '60';
    note.style.background = 'rgba(0,0,0,.55)';
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 1800);
  }

  function showPanel(full = false) {
    if (full && panel) return; // keep admin console persistent once opened
    closePanel();
    panel = document.createElement('div');
    panel.className = 'card stack';
    panel.style.position = 'fixed';
    panel.style.right = '16px';
    panel.style.bottom = '70px';
    panel.style.width = '260px';
    panel.style.zIndex = '60';
    if (!full) {
      // Quick admin panel not used anymore; kept for completeness
      panel.innerHTML = `
        <div class="row"><strong>Quick Admin</strong></div>
        <button id="adm-1m" class="primary">+ $1,000,000</button>
      `;
      panel.querySelector('#adm-1m').addEventListener('click', () => { grant(1_000_000); closePanel(); });
    } else {
      // Persistent admin console (no close button)
      panel.innerHTML = `
        <div class="row"><strong>Admin Console</strong></div>
        <div class="stack">
          <div class="muted" style="margin-bottom:.15rem;">Balance tools</div>
          <button data-give="1000000" class="glass">+ $1,000,000</button>
          <button data-give="1000000000" class="glass">+ $1,000,000,000 (1b)</button>
          <button data-give="1000000000000" class="glass">+ $1,000,000,000,000 (1t)</button>
          <div class="row" style="gap:.5rem; flex-wrap:wrap; margin-top:.25rem;">
            <button data-give="1000000000000000" class="glass">+ 1qu</button>
            <button data-give="1000000000000000000" class="glass">+ 1qi</button>
            <button data-give="1000000000000000000000" class="glass">+ 1s</button>
            <button data-give="1000000000000000000000000" class="glass">+ 1A</button>
          </div>
        </div>
      `;
      panel.querySelectorAll('[data-give]').forEach(btn => {
        btn.addEventListener('click', () => { const v = parseInt(btn.getAttribute('data-give'), 10); grant(v); /* stays open */ });
      });
      // Inject Force Email button for testing
      try {
        const hostStack = panel.querySelector('div.stack');
        if (hostStack) {
          const row = document.createElement('div');
          row.className = 'row';
          row.style.gap = '.5rem';
          row.style.justifyContent = 'flex-end';
          row.style.flexWrap = 'wrap';
          row.style.marginTop = '.25rem';
          const forceBtn = document.createElement('button');
          forceBtn.id = 'adm-force-email';
          forceBtn.className = 'primary';
          forceBtn.textContent = 'Force Email';
          row.appendChild(forceBtn);

          const promoBtn = document.createElement('button');
          promoBtn.id = 'adm-force-promo';
          promoBtn.className = 'glass';
          promoBtn.textContent = 'Force Feature Push';
          row.appendChild(promoBtn);

          hostStack.appendChild(row);

          forceBtn.addEventListener('click', async () => {
            try {
              const mod = await import('./app.js');
              if (mod && typeof mod.__debugAddEmail === 'function') {
                mod.__debugAddEmail();
                flash('Email generated');
                location.hash = '#/email';
              }
            } catch (e) {
              flash('Failed to generate email');
            }
          });

          promoBtn.addEventListener('click', () => {
            triggerFeaturePromo();
            flash('Feature promo triggered');
          });
        }
      } catch {}
    }
    document.body.appendChild(panel);
  }

  // Reset money to $1,000
  const resetBtn = el.querySelector('#reset-money');
  const liquidToggleBtn = el.querySelector('#home-liquid-toggle');
  function onReset() {
    if (confirm('Reset your balance to $100,000?')) {
      setBalance(100000);
      flash('Balance reset to $100,000');
    }
  }
  resetBtn.addEventListener('click', onReset);

  function getLiquidPref() {
    try { return localStorage.getItem(LIQUID_UI_KEY) === '1'; } catch { return false; }
  }

  function refreshLiquidToggle() {
    if (!liquidToggleBtn) return;
    const active = document.body.classList.contains('liquid-ui');
    liquidToggleBtn.textContent = active ? 'Liquid UI: On' : 'Liquid UI: Off';
    liquidToggleBtn.classList.toggle('primary', active);
    liquidToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  const onLiquidState = () => refreshLiquidToggle();

  const onLiquidToggle = (event) => {
    event.preventDefault();
    const nextPref = !getLiquidPref();
    window.dispatchEvent(new CustomEvent('tgx:liquid-ui-toggle', { detail: nextPref }));
  };

  if (liquidToggleBtn) {
    liquidToggleBtn.addEventListener('click', onLiquidToggle);
    refreshLiquidToggle();
  }
  window.addEventListener('tgx:liquid-ui-state', onLiquidState);

  function onLockClick() {
    const code = prompt('Enter admin code');
    if (code === '1234') { grant(1_000_000); }
    else if (code === '55779') { showPanel(true); }
    else if (code != null) { flash('Invalid code'); }
  }
  const navLinks = Array.from(el.querySelectorAll('[data-home-nav]'));
  const navHandlers = [];
  navLinks.forEach((link) => {
    const handler = (event) => {
      const hash = link.getAttribute('data-home-nav');
      if (!hash) return;
      event.preventDefault();
      location.hash = hash;
    };
    navHandlers.push({ link, handler });
    link.addEventListener('click', handler);
  });

  const surpriseBtn = el.querySelector('#home-surprise');
  const onSurprise = (event) => {
    event.preventDefault();
    triggerFeaturePromo();
  };
  if (surpriseBtn) {
    surpriseBtn.addEventListener('click', onSurprise);
  }

  const onStatsUpdated = () => updateHomeSummary();
  window.addEventListener('tgx:stats-updated', onStatsUpdated);

  lockBtn.addEventListener('click', onLockClick);
  document.body.appendChild(lockBtn);

  cleanup = () => {
    unsub();
    el.remove();
    lockBtn?.removeEventListener('click', onLockClick);
    lockBtn?.remove();
    closePanel();
    resetBtn?.removeEventListener('click', onReset);
    if (liquidToggleBtn) liquidToggleBtn.removeEventListener('click', onLiquidToggle);
    window.removeEventListener('tgx:liquid-ui-state', onLiquidState);
    navHandlers.forEach(({ link, handler }) => link.removeEventListener('click', handler));
    if (surpriseBtn) surpriseBtn.removeEventListener('click', onSurprise);
    window.removeEventListener('tgx:stats-updated', onStatsUpdated);
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }

function format(n) { return formatMoney(n); }
