import { formatMoneyExtended as formatMoney } from './format.js';
let cleanup = () => {};

const TUNNEL_KEY = 'tgx_ngrok_base';
const CACHE_KEY = 'tgx_lb_cache_v1';

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.top)) return null;
    return parsed;
  } catch { return null; }
}

function saveCache(payload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch {}
}

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
    <div id="lb-closed" style="display:none; position:absolute; inset:0; z-index:5; align-items:center; justify-content:center; padding:2rem; background:repeating-linear-gradient(45deg, #ffcc00 0 16px, #111 16px 32px);">
      <div style="max-width:640px; width:100%; text-align:center; background:rgba(0,0,0,.8); color:#ffcc00; border:2px solid #ffcc00; padding:1.25rem 1.5rem; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,.5); font-weight:900;">
        <div style="font-size:1.4rem; letter-spacing:.3px;">Leaderboard closed — logan probably crashed it</div>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  const listEl = wrap.querySelector('#lb-list');
  const statusEl = wrap.querySelector('#lb-status');
  wrap.style.position = 'relative';
  const closedEl = wrap.querySelector('#lb-closed');

  const fmtNum = (n) => formatMoney(n);

  let timer = 0;
  const renderList = (rows = []) => {
    listEl.innerHTML = '';
    if (!rows.length) {
      listEl.innerHTML = '<div class="muted">No data yet. It updates as players report in.</div>';
      return;
    }
    rows.slice(0, 10).forEach((row, i) => {
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
  };

  const cached = loadCache();
  if (cached && Array.isArray(cached.top)) {
    setClosed(false);
    renderList(cached.top);
    const ts = cached.updated ? new Date(cached.updated).toLocaleTimeString() : null;
    statusEl.textContent = ts ? `Cached ${ts}` : 'Cached data';
  }

  function setClosed(on, msg) {
    if (on) {
      if (msg) closedEl.querySelector('div > div')?.textContent && (closedEl.querySelector('div > div').textContent = msg);
      closedEl.style.display = 'flex';
    } else {
      closedEl.style.display = 'none';
    }
  }
  async function fetchNow() {
    const base = localStorage.getItem(TUNNEL_KEY);
    if (!base) {
      const cached = loadCache();
      if (cached && Array.isArray(cached.top)) {
        setClosed(false);
        renderList(cached.top);
        const ts = cached.updated ? new Date(cached.updated).toLocaleTimeString() : null;
        statusEl.textContent = ts ? `Offline — showing data from ${ts}` : 'Offline — showing cached data';
        return;
      }
      statusEl.textContent = 'Leaderboard closed — logan probably crashed it';
      setClosed(true, 'Leaderboard closed — logan probably crashed it');
      return;
    }
    try {
      // Fetch leaderboard top 10
      const url = `${base.replace(/\/$/,'')}/leaderboard?ngrok_skip_browser_warning=true`;
      const res = await fetch(url, { cache:'no-store', mode:'cors', credentials:'omit', headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const top = (data && data.top) || [];
      setClosed(false);
      renderList(top);
      const now = Date.now();
      saveCache({ top, updated: now });
      statusEl.textContent = 'Updated ' + new Date(now).toLocaleTimeString();
    } catch (e) {
      try { console.error('Leaderboard fetch failed:', e); } catch {}
      const cached = loadCache();
      if (cached && Array.isArray(cached.top)) {
        setClosed(false);
        renderList(cached.top);
        const ts = cached.updated ? new Date(cached.updated).toLocaleTimeString() : null;
        statusEl.textContent = ts ? `Connection hiccup — showing ${ts}` : 'Connection hiccup — showing cached data';
      } else {
        statusEl.textContent = 'Leaderboard closed — logan probably crashed it';
        setClosed(true, 'Leaderboard closed — logan probably crashed it');
      }
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
