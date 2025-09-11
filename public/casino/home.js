import store, { subscribe, getBalance, addBalance, setBalance } from './store.js';
import { formatMoneyExtended as formatMoney } from './format.js';

let cleanup = () => {};

export async function mount(root) {
  const el = document.createElement('section');
  el.className = 'card stack';
  el.innerHTML = `
    <div class="hero">
      <div class="sign neon mega">thegraxisreal casino</div>
      <p class="muted">Welcome! Pick a game from the menu to start playing. Your balance carries across all games.</p>
    </div>
    <div class="stack">
      <h3 style="margin:.25rem 0">How it works</h3>
      <ul class="guide">
        <li>You start with a balance. It’s shared across games.</li>
        <li>Slots: set your bet, hit Spin. Payouts are shown below the reels.</li>
        <li>Blackjack, Horse Race, Plinko, and Coin Flip are coming soon.</li>
      </ul>
    </div>
    <div class="toolbar" style="justify-content:flex-end; margin-top:.5rem;">
      <button id="reset-money" class="glass">Reset Money to $1,000</button>
    </div>
  `;
  root.appendChild(el);

  // Update HUD in case home is first load
  const moneyEl = document.getElementById('money-amount');
  const renderHud = (b) => {
    if (!moneyEl) return;
    // If hovered, show full digits; else compact
    const hovered = moneyEl.matches(':hover');
    moneyEl.textContent = hovered ? `$${Math.floor(Math.max(0,b)).toLocaleString()}` : formatMoney(b);
  };
  const unsub = subscribe(({ balance }) => { renderHud(balance); });
  renderHud(getBalance());

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
      const currentName = localStorage.getItem('tgx_username') || '';
      panel.innerHTML = `
        <div class="row"><strong>Admin Console</strong></div>
        <div class="stack">
          <div class="stack" style="margin-bottom:.25rem">
            <div class="muted">Set username (admin override)</div>
            <div class="controls" style="gap:.5rem; flex-wrap:wrap;">
              <input id="adm-name" type="text" value="${currentName.replace(/"/g,'&quot;')}" style="flex:1; min-width: 180px; padding:.6rem .7rem; border-radius:10px; border:1px solid #2b3a52; background:#0b1322; color:var(--fg);" />
              <button id="adm-name-save" class="primary">Save</button>
            </div>
          </div>
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
      panel.querySelector('#adm-name-save').addEventListener('click', () => {
        const v = panel.querySelector('#adm-name').value || '';
        const s = v.trim();
        if (!/^\w{3,20}$/.test(s)) { flash('Invalid username'); return; }
        localStorage.setItem('tgx_username', s);
        flash('Username updated');
      });
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
        }
      } catch {}
    }
    document.body.appendChild(panel);
  }

  // Reset money to $1,000
  const resetBtn = el.querySelector('#reset-money');
  function onReset() {
    if (confirm('Reset your balance to $1,000?')) {
      setBalance(1000);
      flash('Balance reset to $1,000');
    }
  }
  resetBtn.addEventListener('click', onReset);

  function onLockClick() {
    const code = prompt('Enter admin code');
    if (code === '1234') { grant(1_000_000); }
    else if (code === '852585') { showPanel(true); }
    else if (code != null) { flash('Invalid code'); }
  }
  lockBtn.addEventListener('click', onLockClick);
  document.body.appendChild(lockBtn);

  cleanup = () => {
    unsub();
    el.remove();
    lockBtn?.removeEventListener('click', onLockClick);
    lockBtn?.remove();
    closePanel();
    resetBtn?.removeEventListener('click', onReset);
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }

function format(n) { return formatMoney(n); }
