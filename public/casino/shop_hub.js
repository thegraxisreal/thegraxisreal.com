// Shop Hub: tabs for Gift Shop, Bar, Black Market, Scratchers

let cleanup = () => {};
let active = { unmount: null };

export async function mount(root) {
  const wrap = document.createElement('div');
  wrap.className = 'card stack';
  wrap.id = 'shop-hub';
  wrap.innerHTML = `
    <div class="row" style="align-items:center; gap:.5rem">
      <h2 style="margin:0">Shop</h2>
      <div class="tag">Lobbies</div>
    </div>
    <div class="row" style="gap:.5rem; flex-wrap:wrap">
      <button class="glass" data-tab="gift">Gift Shop</button>
      <button class="glass" data-tab="bar">Bar</button>
      <button class="glass" data-tab="blackmarket">Black Market</button>
      <button class="glass" data-tab="scratchers">Scratchers</button>
    </div>
    <div class="card" style="background:#0e1524; border-color:#20304a; padding:.5rem">
      <div id="shop-tab-root"></div>
    </div>
  `;
  root.appendChild(wrap);

  const tabRoot = wrap.querySelector('#shop-tab-root');
  const btns = wrap.querySelectorAll('[data-tab]');

  const select = async (key) => {
    // update selected styles
    btns.forEach(b => b.classList.toggle('primary', b.getAttribute('data-tab')===key));
    // unmount previous
    try { active.unmount && active.unmount(); } catch {}
    tabRoot.innerHTML = '';
    // mount new
    if (key === 'gift') {
      const mod = await import('./shop.js');
      await mod.mount(tabRoot); active.unmount = () => mod.unmount && mod.unmount();
    } else if (key === 'bar') {
      const mod = await import('./bar.js');
      await mod.mount(tabRoot); active.unmount = () => mod.unmount && mod.unmount();
    } else if (key === 'blackmarket') {
      const mod = await import('./blackmarket.js');
      await mod.mount(tabRoot); active.unmount = () => mod.unmount && mod.unmount();
    } else if (key === 'scratchers') {
      const mod = await import('./scratchers.js');
      await mod.mount(tabRoot); active.unmount = () => mod.unmount && mod.unmount();
    }
  };

  btns.forEach(b => b.addEventListener('click', () => select(b.getAttribute('data-tab'))));
  await select('gift');

  cleanup = () => { try { active.unmount && active.unmount(); } finally { wrap.remove(); } };
}

export function unmount() { cleanup(); cleanup = () => {}; }

