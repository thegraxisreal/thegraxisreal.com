const FEATURES = [
  { key: 'stats', title: 'Stats', blurb: 'tracking your grind and favorites' },
  { key: 'email', title: 'Email', blurb: 'quests and casino lore drops' },
  { key: 'leaderboard', title: 'Leaderboard', blurb: 'checking who tops the chip charts' },
  { key: 'bar', title: 'Bar', blurb: 'boosts and perks between games' },
  { key: 'blackmarket', title: 'Black Market', blurb: 'exclusive secret stash deals' },
  { key: 'lottery', title: 'Lottery', blurb: 'daily shots at massive payouts' },
  { key: 'scratchers', title: 'Scratchers', blurb: 'quick instant-win action' },
  { key: 'plinko', title: 'Plinko', blurb: 'gravity-fueled multipliers' },
];

const MIN_MINUTES = 1;
const MAX_MINUTES = 5;
const TOAST_LIFETIME = 12000;

let timerId = 0;
let started = false;
let activeToast = null;
let lastKey = null;

function randomDelayMs() {
  const minutes = Math.floor(Math.random() * (MAX_MINUTES - MIN_MINUTES + 1)) + MIN_MINUTES;
  return minutes * 60_000;
}

function pickFeature(preferredKey) {
  if (preferredKey) {
    const match = FEATURES.find((f) => f.key === preferredKey);
    if (match) return match;
  }
  const pool = FEATURES.filter((f) => f.key !== lastKey);
  const chosen = pool[Math.floor(Math.random() * pool.length)] || FEATURES[0];
  lastKey = chosen?.key || null;
  return chosen;
}

function closeToast() {
  if (!activeToast) return;
  activeToast.classList.add('feature-toast-hide');
  const node = activeToast;
  activeToast = null;
  setTimeout(() => node.remove(), 280);
}

function navigateTo(feature) {
  const targetHash = `#/${feature.key}`;
  if (location.hash === targetHash) {
    // Trigger hashchange manually for same-route clicks
    const event = new HashChangeEvent('hashchange', { newURL: location.href, oldURL: location.href });
    window.dispatchEvent(event);
  } else {
    location.hash = targetHash;
  }
}

function renderToast(feature) {
  closeToast();

  const toast = document.createElement('button');
  toast.type = 'button';
  toast.className = 'feature-toast';
  toast.setAttribute('aria-label', `Check out ${feature.title}`);
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = `
    <div class="feature-toast-glow"></div>
    <div class="feature-toast-content">
      <span class="feature-toast-eyebrow">New to try</span>
      <strong class="feature-toast-title">Check out ${feature.title}</strong>
      <span class="feature-toast-blurb">for ${feature.blurb}</span>
    </div>
    <span class="feature-toast-arrow">&rarr;</span>
    <span class="feature-toast-close" aria-hidden="true">&times;</span>
  `;

  toast.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.target;
    if (target && target.classList.contains('feature-toast-close')) {
      closeToast();
      return;
    }
    navigateTo(feature);
    closeToast();
  });

  activeToast = toast;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (activeToast === toast) closeToast();
  }, TOAST_LIFETIME);
}

function scheduleNext() {
  clearTimeout(timerId);
  timerId = window.setTimeout(() => {
    showFeature();
  }, randomDelayMs());
}

function showFeature(key) {
  const feature = pickFeature(key);
  if (!feature) return;
  renderToast(feature);
  scheduleNext();
}

export function startFeaturePromoter() {
  if (started) return;
  started = true;
  scheduleNext();
}

export function stopFeaturePromoter() {
  started = false;
  clearTimeout(timerId);
  timerId = 0;
  closeToast();
}

export function triggerFeaturePromo(key) {
  if (!started) {
    started = true;
  }
  clearTimeout(timerId);
  showFeature(key);
}

// Expose for debugging if needed
export const __featureList = FEATURES;
