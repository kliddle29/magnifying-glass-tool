function draw() {
  if (!input.active) return;
  positionLens(input.x, input.y);
}

function startLoop() {
  function frame() {
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
