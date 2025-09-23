// Lightweight player stats tracker persisted in localStorage.
const STORAGE_KEY = 'tgx_casino_stats_v1';
const VERSION = 1;

const TRACKED_GAMES = {
  slots: 'Slots',
  blackjack: 'Blackjack',
  horse: 'Horse Race',
  plinko: 'Plinko',
  coinflip: 'Coin Flip',
  roulette: 'Roulette',
  lottery: 'Lottery',
  scratchers: 'Scratchers',
};

function now() {
  return Date.now();
}

function createDefaultStats() {
  return {
    version: VERSION,
    firstSeen: now(),
    lastUpdated: now(),
    highestBalance: 0,
    highestBalanceAt: null,
    lastBalance: 0,
    totalGamePlays: 0,
    games: {},
    lastGameKey: null,
  };
}

function normalizeStats(raw) {
  const base = createDefaultStats();
  if (!raw || typeof raw !== 'object') return base;
  const stats = { ...base, ...raw };
  if (!stats.games || typeof stats.games !== 'object') stats.games = {};
  stats.version = VERSION;
  return stats;
}

function readStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStats();
    const parsed = JSON.parse(raw);
    return normalizeStats(parsed);
  } catch {
    return createDefaultStats();
  }
}

function saveStats(stats, { notify = true } = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (err) {
    try { console.warn('Failed to persist stats', err); } catch {}
  }
  if (notify) {
    try {
      window.dispatchEvent(new CustomEvent('tgx:stats-updated', { detail: stats }));
    } catch {}
  }
}

export function initStatsTracking(currentBalance = 0) {
  const stats = readStats();
  const ts = now();
  let changed = false;
  if (!stats.firstSeen) { stats.firstSeen = ts; changed = true; }
  const balance = Math.max(0, Math.floor(Number(currentBalance) || 0));
  if (stats.lastBalance !== balance) { stats.lastBalance = balance; changed = true; }
  if (!stats.highestBalance || balance > stats.highestBalance) {
    stats.highestBalance = balance;
    stats.highestBalanceAt = ts;
    changed = true;
  }
  if (changed) {
    stats.lastUpdated = ts;
    saveStats(stats, { notify: false });
  }
  return stats;
}

export function recordBalanceSnapshot(balance) {
  const stats = readStats();
  const normalized = Math.max(0, Math.floor(Number(balance) || 0));
  let changed = false;
  if (stats.lastBalance !== normalized) {
    stats.lastBalance = normalized;
    changed = true;
  }
  if (!stats.highestBalance || normalized > stats.highestBalance) {
    stats.highestBalance = normalized;
    stats.highestBalanceAt = now();
    changed = true;
  }
  if (changed) {
    stats.lastUpdated = now();
    saveStats(stats);
  }
}

export function recordGameVisit(gameKey) {
  if (!TRACKED_GAMES[gameKey]) return;
  const stats = readStats();
  const ts = now();
  const entry = stats.games[gameKey] || { plays: 0, lastPlayed: null };
  entry.plays = (entry.plays || 0) + 1;
  entry.lastPlayed = ts;
  stats.games[gameKey] = entry;
  stats.lastGameKey = gameKey;
  stats.totalGamePlays = (stats.totalGamePlays || 0) + 1;
  stats.lastUpdated = ts;
  saveStats(stats);
}

function deriveFavorite(stats) {
  let favorite = null;
  for (const [key, entry] of Object.entries(stats.games || {})) {
    if (!TRACKED_GAMES[key]) continue;
    const plays = entry?.plays || 0;
    if (!favorite || plays > favorite.plays || (plays === favorite.plays && (entry.lastPlayed || 0) > (favorite.lastPlayed || 0))) {
      favorite = { key, plays, lastPlayed: entry.lastPlayed || 0 };
    }
  }
  return favorite;
}

export function getStatsSnapshot() {
  const stats = readStats();
  const favorite = deriveFavorite(stats);
  const games = Object.entries(TRACKED_GAMES).map(([key, label]) => ({
    key,
    label,
    plays: stats.games?.[key]?.plays || 0,
    lastPlayed: stats.games?.[key]?.lastPlayed || null,
  }));
  return {
    stats,
    favoriteKey: favorite ? favorite.key : null,
    favoriteLabel: favorite ? TRACKED_GAMES[favorite.key] : null,
    favoriteCount: favorite ? favorite.plays : 0,
    games,
  };
}
