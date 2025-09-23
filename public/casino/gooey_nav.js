const DEFAULTS = {
  animationTime: 600,
  particleCount: 15,
  particleDistances: [90, 10],
  particleR: 100,
  timeVariance: 300,
  colors: [1, 2, 3, 1, 2, 3, 1, 4],
  initialActiveIndex: 0,
  reducedEffects: false,
};

function noise(n = 1) {
  return n / 2 - Math.random() * n;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function getXY(distance, pointIndex, totalPoints) {
  const angle = ((360 + noise(8)) / totalPoints) * pointIndex;
  const rad = degToRad(angle);
  return [distance * Math.cos(rad), distance * Math.sin(rad)];
}

function createParticle({ index, animationTime, distances, radius, particleCount, colors, timeVariance }) {
  const rotate = noise(radius / 10);
  const time = animationTime * 2 + noise(timeVariance * 2);
  return {
    start: getXY(distances[0], particleCount - index, particleCount),
    end: getXY(distances[1] + noise(7), particleCount - index, particleCount),
    time,
    scale: 1 + noise(0.2),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotate: rotate > 0 ? (rotate + radius / 20) * 10 : (rotate - radius / 20) * 10,
  };
}

function makeParticles({ element, config }) {
  if (config.reducedEffects) {
    element.classList.remove('active');
    return;
  }
  const {
    particleCount,
    animationTime,
    particleDistances,
    particleR,
    timeVariance,
    colors,
  } = config;
  const bubbleTime = animationTime * 2 + timeVariance;
  element.style.setProperty('--time', `${bubbleTime}ms`);
  element.classList.remove('active');

  for (let i = 0; i < particleCount; i += 1) {
    const particleData = createParticle({
      index: i,
      animationTime,
      distances: particleDistances,
      radius: particleR,
      particleCount,
      colors,
      timeVariance,
    });

    const delay = 30;
    setTimeout(() => {
      const particle = document.createElement('span');
      const point = document.createElement('span');
      particle.classList.add('particle');
      particle.style.setProperty('--start-x', `${particleData.start[0]}px`);
      particle.style.setProperty('--start-y', `${particleData.start[1]}px`);
      particle.style.setProperty('--end-x', `${particleData.end[0]}px`);
      particle.style.setProperty('--end-y', `${particleData.end[1]}px`);
      particle.style.setProperty('--time', `${particleData.time}ms`);
      particle.style.setProperty('--scale', `${particleData.scale}`);
      particle.style.setProperty('--color', `var(--color-${particleData.color}, white)`);
      particle.style.setProperty('--rotate', `${particleData.rotate}deg`);

      point.classList.add('point');
      particle.appendChild(point);
      element.appendChild(particle);
      requestAnimationFrame(() => {
        element.classList.add('active');
      });
      setTimeout(() => {
        try {
          element.removeChild(particle);
        } catch {
          // noop
        }
      }, particleData.time);
    }, delay);
  }
}

function updateEffectPosition({ target, containerRef, filterRef, textRef }) {
  if (!containerRef.current || !target || !filterRef.current || !textRef.current) return;
  const baseEl = filterRef.current.parentElement || containerRef.current;
  const baseRect = baseEl.getBoundingClientRect();
  const pos = target.getBoundingClientRect();
  const left = pos.left - baseRect.left;
  const top = pos.top - baseRect.top;
  const styles = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${pos.width}px`,
    height: `${pos.height}px`,
  };
  Object.assign(filterRef.current.style, styles);
  Object.assign(textRef.current.style, styles);
  textRef.current.innerText = target.innerText;
}

export function initGooeyNav(root, options = {}) {
  if (!root) return null;
  const config = { ...DEFAULTS, ...options };
  const state = {
    activeIndex: config.initialActiveIndex || 0,
    items: config.items || [],
  };

  const navContainer = document.createElement('div');
  navContainer.className = 'gooey-nav-container';
  if (config.reducedEffects) navContainer.classList.add('gooey-lite');
  const containerRef = { current: navContainer };
  const navEl = document.createElement('nav');
  const listEl = document.createElement('ul');
  navEl.appendChild(listEl);
  navContainer.appendChild(navEl);

  const filterEl = document.createElement('span');
  filterEl.className = 'effect filter';
  const textEl = document.createElement('span');
  textEl.className = 'effect text';
  navContainer.appendChild(filterEl);
  navContainer.appendChild(textEl);

  root.innerHTML = '';
  root.appendChild(navContainer);

  const filterRef = { current: filterEl };
  const textRef = { current: textEl };
  const navRef = { current: listEl };

  const listItems = [];

  function activate(index, { emitParticles = true } = {}) {
    if (index < 0 || index >= state.items.length) return;
    state.activeIndex = index;
    listItems.forEach((li, idx) => {
      if (idx === index) li.classList.add('active');
      else li.classList.remove('active');
    });
    const current = listItems[index];
    if (current) {
      if (!config.reducedEffects) {
        updateEffectPosition({
          target: current,
          containerRef,
          filterRef,
          textRef,
        });
        textRef.current?.classList.remove('active');
        // Force reflow to restart animation
        void textRef.current?.offsetWidth;
        textRef.current?.classList.add('active');
      }
      if (!config.reducedEffects && emitParticles && filterRef.current) {
        filterRef.current.querySelectorAll('.particle').forEach((particle) => {
          try { filterRef.current.removeChild(particle); } catch {}
        });
        makeParticles({ element: filterRef.current, config });
      }
    }
  }

  function handleClick(index, evt) {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    if (state.activeIndex === index) return;
    activate(index);
    const item = state.items[index];
    if (item && item.href) {
      const href = item.href;
      if (href.startsWith('#')) {
        if (location.hash !== href) {
          location.hash = href;
        } else {
          const event = new HashChangeEvent('hashchange', { newURL: location.href, oldURL: location.href });
          window.dispatchEvent(event);
        }
      } else {
        window.location.assign(href);
      }
    }
  }

  function handleKeyDown(index, evt) {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      const li = listItems[index];
      if (li) {
        handleClick(index, evt);
      }
    }
  }

  state.items.forEach((item, index) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.href || '#';
    link.textContent = item.label || `Item ${index + 1}`;
    link.setAttribute('role', 'link');
    link.setAttribute('tabindex', '0');
    link.addEventListener('click', (evt) => handleClick(index, evt));
    link.addEventListener('keydown', (evt) => handleKeyDown(index, evt));
    li.appendChild(link);
    if (index === state.activeIndex) li.classList.add('active');
    listEl.appendChild(li);
    listItems.push(li);
  });

  let resizeObserver = null;
  if (!config.reducedEffects) {
    resizeObserver = new ResizeObserver(() => {
      const current = listItems[state.activeIndex];
      if (current) {
        updateEffectPosition({ target: current, containerRef, filterRef, textRef });
      }
    });
    resizeObserver.observe(navContainer);
  }

  requestAnimationFrame(() => {
    activate(state.activeIndex, { emitParticles: false });
    if (!config.reducedEffects) {
      textRef.current?.classList.add('active');
    }
  });

  function findIndexByHref(href = '') {
    if (!href) return -1;
    return state.items.findIndex((item) => item && item.href === href);
  }

  function setActiveByHref(href, { emitParticles = false } = {}) {
    const index = findIndexByHref(href);
    if (index === -1) return;
    state.activeIndex = index;
    activate(index, { emitParticles });
  }

  function destroy() {
    resizeObserver?.disconnect();
    listItems.forEach((li) => {
      const link = li.querySelector('a');
      if (link) {
        link.replaceWith(link.cloneNode(true));
      }
    });
    if (root.contains(navContainer)) root.removeChild(navContainer);
  }

  return {
    setActive(index) { activate(index, { emitParticles: false }); },
    setActiveByHref,
    destroy,
  };
}
