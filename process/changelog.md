# Changelog

Short entries, added as direction changed. Newest at the bottom. Write
these yourself, in your own words — see `docs/PROMPTS.md`.

- **Scaffold.** Forked from `reusable-studio-engine`. Kept `src/utils/math.js`
  as-is. `src/input/input.js`, `src/canvas/setupCanvas.js`, `src/canvas/loop.js`,
  and `main.js` kept their names and roles but changed substance: the engine
  used to draw pixels to a `<canvas>`; this fork clones the live page DOM into
  a fixed, circular lens and repositions it with CSS transforms, because a
  hover-magnifier has to show real page content, not a synthetic drawing.
  Packaged as a Manifest V3 Chrome extension (`manifest.json`, `background.js`)
  instead of a page you open directly, since the tool has to run on top of
  arbitrary sites rather than its own `index.html`.
