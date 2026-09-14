const LENS_SIZE = 160;
const ZOOM = 2.5;

let lensEl = null;
let cloneEl = null;
let scrollScheduled = false;

function cloneStyle() {
  // Explicit width, matching the real viewport: a cloned <html> re-inserted
  // as a nested, absolutely-positioned element has no containing block of
  // its own, so anything sized with `width: %` inside it would otherwise
  // reflow narrower/wider than the live page and drift out of alignment.
  return `
    position: absolute;
    top: 0;
    left: 0;
    width: ${window.innerWidth}px;
    transform-origin: 0 0;
    margin: 0;
  `;
}

function buildLens() {
  lensEl = document.createElement('div');
  lensEl.style.cssText = `
    position: fixed;
    width: ${LENS_SIZE}px;
    height: ${LENS_SIZE}px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 0 0 2px #64ffda, 0 8px 24px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    z-index: 2147483647;
    display: none;
  `;

  cloneEl = document.documentElement.cloneNode(true);
  cloneEl.style.cssText = cloneStyle();

  lensEl.appendChild(cloneEl);
  document.body.appendChild(lensEl);
}

function refreshClone() {
  lensEl.remove();
  const fresh = document.documentElement.cloneNode(true);
  fresh.style.cssText = cloneStyle();
  document.body.appendChild(lensEl);
  lensEl.replaceChild(fresh, cloneEl);
  cloneEl = fresh;
}

function positionLens(x, y) {
  lensEl.style.left = `${x - LENS_SIZE / 2}px`;
  lensEl.style.top = `${y - LENS_SIZE / 2}px`;

  const offsetX = LENS_SIZE / 2 - (x + window.scrollX) * ZOOM;
  const offsetY = LENS_SIZE / 2 - (y + window.scrollY) * ZOOM;
  cloneEl.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${ZOOM})`;
}

function setLensVisible(visible) {
  if (!lensEl) buildLens();
  lensEl.style.display = visible ? 'block' : 'none';
  if (visible) refreshClone();
}

function initLens() {
  buildLens();
  window.addEventListener(
    'scroll',
    () => {
      if (!input.active || scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(() => {
        refreshClone();
        scrollScheduled = false;
      });
    },
    { passive: true }
  );
}
