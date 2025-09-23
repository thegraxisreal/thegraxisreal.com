const FETCH_INTERVAL = 45000;
const STYLE_ID = 'tgx-rank-indicator-style';

const state = {
  initialized: false,
  indicator: null,
  medalEl: null,
  counterWrap: null,
  counterHost: null,
  counterText: null,
  placeholder: null,
  toast: null,
  prefix: null,
  suffix: null,
  prevRank: null,
  timer: 0,
  username: null,
  medalClass: '',
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rank-indicator {
      position: fixed;
      top: .9rem;
      left: .9rem;
      z-index: 70;
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .7rem 1rem;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(135deg, rgba(12,24,40,.9), rgba(6,14,26,.94));
      box-shadow: 0 16px 30px rgba(0,0,0,.28);
      pointer-events: none;
      color: var(--fg);
      min-width: 195px;
    }
    .rank-indicator--unranked .rank-medal { opacity: .35; }
    .rank-medal {
      font-size: 1.65rem;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,.4));
      width: 2rem;
      text-align: center;
      transition: transform .3s ease;
    }
    .rank-prefix {
      font-weight: 700;
      font-size: 1.35rem;
      letter-spacing: .08em;
      opacity: .85;
      transition: opacity .25s ease;
    }
    .rank-indicator--unranked .rank-prefix {
      opacity: 0;
    }
    .rank-indicator.gold .rank-medal { filter: drop-shadow(0 0 12px rgba(255,215,0,.45)); }
    .rank-indicator.silver .rank-medal { filter: drop-shadow(0 0 10px rgba(200,215,255,.35)); }
    .rank-indicator.bronze .rank-medal { filter: drop-shadow(0 0 10px rgba(255,180,120,.35)); }
    .rank-counter-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 90px;
      min-height: 40px;
    }
    .rank-counter-rolling {
      font-size: 1.55rem;
      font-weight: 700;
      letter-spacing: .05em;
      font-variant-numeric: tabular-nums;
      transition: opacity .25s ease;
    }
    .rank-counter-text {
      display: inline-block;
      min-width: 2ch;
      text-align: right;
    }
    .rank-suffix {
      margin-left: .18rem;
      font-size: 1.05rem;
      font-weight: 600;
      opacity: .85;
      transition: opacity .25s ease;
      text-transform: lowercase;
    }
    .rank-indicator--unranked .rank-suffix { opacity: 0; }
    .rank-counter-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.35rem;
      letter-spacing: .1em;
      opacity: 0;
      transition: opacity .25s ease;
    }
    .rank-indicator--unranked .rank-counter-rolling { opacity: 0; }
    .rank-indicator--unranked .rank-counter-placeholder { opacity: .75; }
    .rank-label {
      font-size: .78rem;
      text-transform: uppercase;
      letter-spacing: .28em;
      color: var(--muted);
    }
    .rank-toast {
      position: fixed;
      top: 1.1rem;
      right: 1.1rem;
      padding: .55rem .85rem;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(12,24,40,.92);
      color: var(--fg);
      font-weight: 600;
      box-shadow: 0 18px 30px rgba(0,0,0,.3);
      z-index: 94;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-10px);
      transition: transform .3s ease, opacity .3s ease;
    }
    .rank-toast.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .rank-toast.up { border-color: rgba(80,255,173,.4); color: #7fffd4; }
    .rank-toast.down { border-color: rgba(255,120,120,.4); color: #ff9c9c; }
  `;
  document.head.appendChild(style);
}

function createIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'rank-indicator';
  indicator.className = 'rank-indicator rank-indicator--unranked';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');

  const medal = document.createElement('div');
  medal.className = 'rank-medal';
  medal.textContent = '🏅';

  const prefix = document.createElement('div');
  prefix.className = 'rank-prefix';
  prefix.textContent = '#';
  prefix.setAttribute('aria-hidden', 'true');

  const counterWrap = document.createElement('div');
  counterWrap.className = 'rank-counter-wrap';
  const counterHost = document.createElement('div');
  counterHost.className = 'rank-counter-rolling';
  const counterText = document.createElement('span');
  counterText.className = 'rank-counter-text';
  counterText.textContent = '--';
  counterHost.appendChild(counterText);
  const suffix = document.createElement('div');
  suffix.className = 'rank-suffix';
  suffix.setAttribute('aria-hidden', 'true');
  const placeholder = document.createElement('div');
  placeholder.className = 'rank-counter-placeholder';
  placeholder.textContent = 'NC';
  counterWrap.appendChild(counterHost);
  counterWrap.appendChild(suffix);
  counterWrap.appendChild(placeholder);

  const label = document.createElement('div');
  label.className = 'rank-label';
  label.textContent = 'POSITION';

  indicator.appendChild(medal);
  indicator.appendChild(prefix);
  indicator.appendChild(counterWrap);
  indicator.appendChild(label);

  document.body.appendChild(indicator);

  const toast = document.createElement('div');
  toast.id = 'rank-toast';
  toast.className = 'rank-toast';
  document.body.appendChild(toast);

  state.indicator = indicator;
  state.medalEl = medal;
  state.counterWrap = counterWrap;
  state.counterHost = counterHost;
  state.placeholder = placeholder;
  state.toast = toast;
  state.suffix = suffix;
  state.counterText = counterText;
  state.prefix = prefix;
}

function setMedal(rank) {
  const medalEl = state.medalEl;
  if (!medalEl) return;
  let symbol = '🏅';
  let cls = '';
  if (rank === 1) { symbol = '🥇'; cls = 'gold'; }
  else if (rank === 2) { symbol = '🥈'; cls = 'silver'; }
  else if (rank === 3) { symbol = '🥉'; cls = 'bronze'; }
  medalEl.textContent = symbol;
  if (state.medalClass) state.indicator.classList.remove(state.medalClass);
  state.medalClass = cls || '';
  state.indicator.classList.remove('gold','silver','bronze');
  if (cls) state.indicator.classList.add(cls);
}

function showToast(text, type) {
  const toast = state.toast;
  if (!toast || !text) return;
  toast.textContent = text;
  toast.classList.remove('up','down','visible');
  if (type) toast.classList.add(type);
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 2600);
}

function updateIndicator(rank, total) {
  const indicator = state.indicator;
  if (!indicator) return;
  const prevRank = state.prevRank;
  if (rank == null || rank <= 0) {
    indicator.classList.add('rank-indicator--unranked');
    state.placeholder.textContent = 'NC';
    if (state.counterText) state.counterText.textContent = '--';
    if (state.suffix) state.suffix.textContent = '';
  } else {
    indicator.classList.remove('rank-indicator--unranked');
    if (state.counterText) state.counterText.textContent = String(rank);
    if (state.suffix) state.suffix.textContent = ordinalSuffix(rank);
  }
  setMedal(rank != null && rank > 0 && rank <= 3 ? rank : null);
  if (prevRank !== rank) handleRankChange(prevRank, rank);
  state.prevRank = rank;
}

function handleRankChange(previous, current) {
  if (previous == null && current == null) return;
  if (previous == null && current != null) {
    showToast(`Entered Top 10 at #${current}!`, 'up');
    return;
  }
  if (previous != null && current == null) {
    showToast('Dropped out of Top 10', 'down');
    return;
  }
  if (previous != null && current != null) {
    if (current < previous) {
      if (current === 1) showToast('You took the #1 spot!', 'up');
      else showToast(`▲ Up to #${current}!`, 'up');
    } else if (current > previous) {
      showToast(`▼ Down to #${current}`, 'down');
    }
  }
}

function ordinalSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

async function fetchRank() {
  const base = localStorage.getItem('tgx_ngrok_base');
  const usernameRaw = localStorage.getItem('tgx_username');
  state.username = usernameRaw ? usernameRaw.trim() : '';
  if (!base || !state.username) {
    updateIndicator(null, 0);
    scheduleFetch();
    return;
  }
  try {
    const url = `${base.replace(/\/$/, '')}/leaderboard?ngrok_skip_browser_warning=true`;
    const res = await fetch(url, {
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = Array.isArray(data?.top) ? data.top : [];
    const total = Number.isFinite(data?.count) ? data.count : rows.length;
    const me = state.username.toLowerCase();
    const idx = rows.findIndex((row) => String(row.username || '').trim().toLowerCase() === me);
    const rank = idx !== -1 ? idx + 1 : null;
    updateIndicator(rank, total);
  } catch (err) {
    // keep previous rank, but show toast? skip
  } finally {
    scheduleFetch();
  }
}

function scheduleFetch(delay = FETCH_INTERVAL) {
  clearTimeout(state.timer);
  state.timer = setTimeout(fetchRank, delay);
}

export function refreshRankNow() {
  if (!state.initialized) return;
  clearTimeout(state.timer);
  fetchRank();
}

export function initRankTracker() {
  if (state.initialized) return;
  ensureStyles();
  createIndicator();
  state.initialized = true;
  fetchRank();
  window.addEventListener('tgx:username-updated', () => refreshRankNow());
}
