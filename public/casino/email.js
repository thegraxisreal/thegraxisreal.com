import { getBalance, addBalance, canAfford, subscribe } from './store.js';

let cleanup = () => {};

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'email';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Inbox</h2>
      <div class="tag">Requests</div>
      <div class="spacer"></div>
      <div class="stack" style="margin-left:auto; align-items:end;">
        <div class="muted">Balance</div>
        <div id="em-balance" class="money">$0</div>
      </div>
    </div>

    <div class="row" style="gap:.5rem; flex-wrap:wrap;">
      <div id="em-status" class="muted">No new messages yet.</div>
      <div class="spacer"></div>
      <button id="em-clear" class="glass sm">Clear All</button>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a; display:grid; grid-template-columns: 1fr; gap:1rem;">
      <div id="em-list" class="stack" style="overflow:auto;"></div>
      <div id="em-detail" class="stack">
        <div class="muted">Select an email to view.</div>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  const balEl = wrap.querySelector('#em-balance');
  const statusEl = wrap.querySelector('#em-status');
  const listEl = wrap.querySelector('#em-list');
  const detailEl = wrap.querySelector('#em-detail');
  const clearBtn = wrap.querySelector('#em-clear');

  const unsub = subscribe(({ balance }) => { balEl.textContent = fmt(balance); render(); });
  const onNew = () => render();
  window.addEventListener('tgx-email-added', onNew);
  balEl.textContent = fmt(getBalance());

  // Mark all as read when opening the tab
  const s0 = loadState(); s0.unread = 0; saveState(s0); tryShowPing(false);

  function fmt(n) { return `$${Math.floor(n).toLocaleString()}`; }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem('tgx_email_state_v1') || '{}');
      s.emails = Array.isArray(s.emails) ? s.emails : [];
      s.unread = Math.max(0, s.unread | 0);
      return s;
    } catch { return { emails: [], unread: 0 }; }
  }
  function saveState(s) { try { localStorage.setItem('tgx_email_state_v1', JSON.stringify(s)); } catch {} }
  function tryShowPing(v) { const p = document.getElementById('email-ping'); if (p) p.style.display = v ? 'block' : 'none'; }

  function render() {
    const s = loadState();
    listEl.innerHTML = '';
    if (!s.emails.length) statusEl.textContent = 'No new messages yet.'; else statusEl.textContent = `${s.emails.length} message(s)`;
    s.emails.slice().reverse().forEach((m) => {
      const row = document.createElement('button');
      row.className = 'glass';
      row.style.textAlign = 'left';
      row.style.padding = '.5rem .6rem';
      row.style.borderRadius = '10px';
      row.style.borderColor = m.read ? 'rgba(255,255,255,.14)' : 'rgba(0,212,255,.35)';
      row.style.background = m.read ? 'linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03))' : 'linear-gradient(180deg, rgba(0,212,255,.18), rgba(255,255,255,.04))';
      row.setAttribute('data-id', m.id);
      row.innerHTML = `<div class="stack">
        <div class="row" style="gap:.5rem">
          <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escape(m.subject)}</strong>
          <div class="tag" style="margin-left:auto;">From: ${escape(m.sender)}</div>
        </div>
        <div class="muted" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Request: $${m.requested.toLocaleString()}</div>
      </div>`;
      row.addEventListener('click', () => openDetail(m.id));
      listEl.appendChild(row);
    });
  }

  function openDetail(id) {
    const s = loadState();
    const m = s.emails.find(e => e.id === id);
    if (!m) { detailEl.innerHTML = '<div class="muted">This message was removed.</div>'; return; }
    m.read = true; saveState(s);
    detailEl.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'stack';
    panel.innerHTML = `
      <div class="row"><strong>${escape(m.subject)}</strong> <div class="tag">From: ${escape(m.sender)}</div></div>
      <div class="card" style="background:#0b1322; border-color:#20304a;">${escape(m.body)}</div>
      <div class="row" style="gap:.5rem; flex-wrap:wrap; justify-content:flex-end;">
        <button id="em-send" class="primary sm">Yes, send $${m.requested.toLocaleString()}</button>
        <button id="em-decline" class="glass sm">No</button>
        <button id="em-delete" class="glass sm">Delete</button>
      </div>
      <div id="em-msg" class="muted"></div>
    `;
    detailEl.appendChild(panel);
    try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}

    const msgEl = panel.querySelector('#em-msg');
    const btnSend = panel.querySelector('#em-send');
    const btnDecline = panel.querySelector('#em-decline');
    const btnDelete = panel.querySelector('#em-delete');

    const refreshBtns = () => { btnSend.disabled = !canAfford(m.requested); };
    refreshBtns();

    btnSend.addEventListener('click', () => {
      if (!canAfford(m.requested)) { msgEl.textContent = 'Insufficient funds.'; return; }
      addBalance(-m.requested);
      msgEl.textContent = 'Sent.';
      // remove email after sending
      const s2 = loadState();
      const i = s2.emails.findIndex(e => e.id === m.id);
      if (i !== -1) { s2.emails.splice(i, 1); saveState(s2); render(); }
      setTimeout(()=> { detailEl.innerHTML = '<div class="muted">Select an email to view.</div>'; }, 600);
    });
    btnDecline.addEventListener('click', () => {
      msgEl.textContent = 'Declined.';
      const s2 = loadState();
      const i = s2.emails.findIndex(e => e.id === m.id);
      if (i !== -1) { s2.emails.splice(i, 1); saveState(s2); render(); }
      setTimeout(()=> { detailEl.innerHTML = '<div class="muted">Select an email to view.</div>'; }, 200);
    });
    btnDelete.addEventListener('click', () => {
      const s2 = loadState();
      const i = s2.emails.findIndex(e => e.id === m.id);
      if (i !== -1) { s2.emails.splice(i, 1); saveState(s2); render(); }
      detailEl.innerHTML = '<div class="muted">Select an email to view.</div>';
    });
  }

  clearBtn.addEventListener('click', () => {
    const s = loadState(); s.emails = []; s.unread = 0; saveState(s); render(); detailEl.innerHTML = '<div class="muted">Select an email to view.</div>';
  });

  function escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

  render();

  cleanup = () => {
    unsub();
    window.removeEventListener('tgx-email-added', onNew);
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
