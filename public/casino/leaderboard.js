let cleanup = () => {};

const NGROK_KEY = 'tgx_ngrok_base';

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'leaderboard';
  wrap.innerHTML = `
    <div class="row">
      <h2 style="margin:0">Leaderboard</h2>
      <div class="tag">Top balances</div>
    </div>

    <div class="row" style="gap:.5rem; flex-wrap:wrap;">
      <div id="lb-status" class="muted">—</div>
    </div>

    <div class="card" style="background:#0e1524; border-color:#20304a;">
      <div id="lb-list" class="stack"></div>
    </div>
  `;
  root.appendChild(wrap);

  const listEl = wrap.querySelector('#lb-list');
  const statusEl = wrap.querySelector('#lb-status');

  function fmtNum(n) {
    const abs = Math.floor(Math.max(0, n));
    if (abs < 10_000_000) return `$${abs.toLocaleString()}`;
    const units = [ ['q',1e15], ['t',1e12], ['b',1e9], ['m',1e6] ];
    for (const [s,v] of units) if (abs >= v) return `$${Math.floor(abs / v)}${s}`;
    return `$${abs.toLocaleString()}`;
  }

  let timer = 0;
  async function fetchNow() {
    const base = localStorage.getItem(NGROK_KEY);
    if (!base) { statusEl.textContent = 'Ask admin to configure endpoint.'; return; }
    try {
      // Fetch leaderboard top 10
      const url = `${base.replace(/\/$/,'')}/leaderboard?ngrok_skip_browser_warning=true`;
      const res = await fetch(url, { cache:'no-store', mode:'cors', credentials:'omit', headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const top = (data && data.top) || [];
      listEl.innerHTML = '';
      if (!top.length) {
        listEl.innerHTML = '<div class="muted">No data yet. It updates as players report in.</div>';
      } else {
        top.slice(0, 10).forEach((row, i) => {
          const line = document.createElement('div');
          line.className = 'row';
          line.style.padding = '.35rem .25rem';
          line.style.borderBottom = '1px solid #1b263a';
          const rank = `<div class="tag" style="min-width:38px; text-align:center">#${i+1}</div>`;
          const name = `<strong style="margin-left:.5rem">${escapeHtml(row.username)}</strong>`;
          const money = `<div class="money" style="margin-left:auto">${fmtNum(row.balance)}</div>`;
          line.innerHTML = `${rank}${name}${money}`;
          listEl.appendChild(line);
        });
      }
      statusEl.textContent = 'Updated ' + new Date().toLocaleTimeString();
    } catch (e) {
      try { console.error('Leaderboard fetch failed:', e); } catch {}
      statusEl.textContent = 'Failed to load leaderboard. Ensure server is running.';
    }
  }

  function escapeHtml(s) { return s.replace(/[&<>"]+/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]||c)); }

  fetchNow();
  timer = setInterval(fetchNow, 30000);

  cleanup = () => {
    clearInterval(timer);
    wrap.remove();
  };
}

export function unmount() { cleanup(); cleanup = () => {}; }
