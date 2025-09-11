// Global store for universal money system
// Persists to localStorage and notifies subscribers

const KEY = 'tgx_casino_balance_v1';

function readInitial() {
  const raw = localStorage.getItem(KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 100000; // default starting balance
  return n;
}

const state = {
  balance: readInitial(),
};

/** @type {Set<Function>} */
const subs = new Set();

function notify() {
  localStorage.setItem(KEY, String(state.balance));
  for (const fn of subs) {
    try { fn(state); } catch {}
  }
}

export function getBalance() { return state.balance; }
export function setBalance(n) {
  const v = Math.max(0, Math.floor(n));
  if (v !== state.balance) {
    state.balance = v;
    notify();
  }
}
export function addBalance(delta) { setBalance(state.balance + Math.floor(delta)); }
export function canAfford(n) { return state.balance >= n; }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

// Expose a tiny API for games
const store = { getBalance, setBalance, addBalance, canAfford, subscribe };
export default store;
