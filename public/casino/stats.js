import { formatMoneyExtended as formatMoney } from './format.js';
import { getStatsSnapshot } from './player_stats.js';

let cleanup = () => {};
let container = null;

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '—';
  }
}

function render() {
  if (!container) return;
  const snapshot = getStatsSnapshot();
  const { stats, favoriteLabel, favoriteCount, favoriteKey, games } = snapshot;
  const currentBalance = stats.lastBalance || 0;
  const highestBalance = stats.highestBalance || 0;
  const totalPlays = stats.totalGamePlays || 0;
  const favoriteDisplay = favoriteLabel
    ? `${favoriteLabel}${favoriteCount ? ` (${favoriteCount.toLocaleString()} plays)` : ''}`
    : '—';

  const summaryRows = [
    { label: 'Current Balance', value: formatMoney(currentBalance) },
    { label: 'Highest Balance Reached', value: formatMoney(highestBalance) },
    { label: 'Favorite Game', value: favoriteDisplay },
    { label: 'Total Game Sessions', value: totalPlays.toLocaleString() },
    { label: 'First Seen', value: formatTimestamp(stats.firstSeen) },
    { label: 'Last Updated', value: formatTimestamp(stats.lastUpdated) },
  ];

  const playedAny = games.some((g) => g.plays > 0);
  const gameRows = games.map((game) => {
    const playCount = game.plays || 0;
    const lastPlayed = playCount ? formatTimestamp(game.lastPlayed) : '—';
    const highlight = favoriteKey === game.key && playCount > 0;
    return `
      <div class="stats-game-row${highlight ? ' favorite' : ''}">
        <div class="stats-game-name">${game.label}</div>
        <div class="stats-game-meta">
          <span class="stats-game-plays">${playCount.toLocaleString()} plays</span>
          <span class="stats-game-last">${lastPlayed}</span>
        </div>
        ${highlight ? '<span class="tag stats-favorite-tag">Favorite</span>' : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <section class="card stats-hero stack">
      <div class="row stats-hero-head">
        <h2>Player Stats</h2>
        <span class="tag">Local profile</span>
      </div>
      <p class="muted stats-hero-copy">Track your balance milestones and go-to games — all saved to this device.</p>
    </section>

    <section class="stats-summary">
      ${summaryRows.map((row) => `
        <div class="card stats-summary-card">
          <span class="stats-summary-label">${row.label}</span>
          <span class="stats-summary-value">${row.value}</span>
        </div>
      `).join('')}
    </section>

    <section class="card stats-games stack">
      <div class="row stats-games-head">
        <h3>Game Activity</h3>
        <span class="muted">Based on sessions opened</span>
      </div>
      ${playedAny
        ? `<div class="stats-game-list">${gameRows}</div>`
        : '<div class="muted stats-games-empty">Play a game to start building your stats.</div>'}
    </section>
  `;
}

export async function mount(root) {
  container = document.createElement('div');
  container.className = 'stats-wrap';
  container.id = 'stats-page';
  root.appendChild(container);
  render();
  const listener = () => render();
  window.addEventListener('tgx:stats-updated', listener);
  cleanup = () => {
    window.removeEventListener('tgx:stats-updated', listener);
    container = null;
  };
}

export function unmount() {
  cleanup();
  cleanup = () => {};
}
