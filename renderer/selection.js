const box = document.getElementById('box');

let startX = 0;
let startY = 0;
let dragging = false;

function updateBox(x, y, w, h) {
  box.style.left = x + 'px';
  box.style.top = y + 'px';
  box.style.width = w + 'px';
  box.style.height = h + 'px';
}

document.addEventListener('mousedown', (e) => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  updateBox(startX, startY, 0, 0);
  box.style.display = 'block';
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  updateBox(x, y, w, h);
});

document.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const width = Math.abs(e.clientX - startX);
  const height = Math.abs(e.clientY - startY);

  // A drag this small was almost certainly an accidental click, not a
  // deliberate region -- treat it the same as pressing Escape.
  if (width < 4 || height < 4) {
    window.magnifier.cancelSelection();
    return;
  }
  window.magnifier.confirmSelection({ x, y, width, height });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.magnifier.cancelSelection();
});
