function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

// Loaded two different ways: a plain <script> tag in the renderer (no
// `module` global there — nodeIntegration is off) and require() from
// main.js. Guard the export so neither context breaks the other.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clamp, lerp, mapRange };
}
