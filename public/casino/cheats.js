const KEY = 'tgx_casino_black_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function getCheatState(id) {
  const s = load();
  s.items = s.items || {};
  const it = s.items[id] || { charge:false, restockUntil:0 };
  return { charge: !!it.charge, restockUntil: it.restockUntil || 0 };
}

export function setCheatCharge(id, charge) {
  const s = load();
  s.items = s.items || {};
  const it = s.items[id] || { charge:false, restockUntil:0 };
  it.charge = !!charge;
  s.items[id] = it;
  save(s);
}

export function startCooldown(id, seconds = 90) {
  const until = Date.now() + seconds * 1000;
  const s = load();
  s.items = s.items || {};
  const it = s.items[id] || { charge:false, restockUntil:0 };
  it.restockUntil = until;
  s.items[id] = it;
  save(s);
}

export function canBuyCheat(id) {
  const { restockUntil } = getCheatState(id);
  const now = Date.now();
  return now >= restockUntil;
}

export function secondsUntilRestock(id) {
  const { restockUntil } = getCheatState(id);
  const diff = Math.ceil((restockUntil - Date.now()) / 1000);
  return Math.max(0, diff);
}

export function consumeCheat(id) {
  const s = load();
  s.items = s.items || {};
  const it = s.items[id] || { charge:false, restockUntil:0 };
  it.charge = false;
  s.items[id] = it;
  save(s);
}

export const CHEAT_IDS = {
  slots: 'slots_cheat',
  horse: 'horse_cheat',
  plinko: 'plinko_cheat',
  coinflip: 'coinflip_cheat',
  blackjack: 'blackjack_cheat',
  roulette: 'roulette_green_ball',
};
