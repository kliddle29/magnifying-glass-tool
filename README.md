# magnifying-glass-tool

A restrained hover-magnifier, forked from [reusable-studio-engine](https://github.com/kliddle29/reusable-studio-engine).
Click the toolbar icon to turn it on, then hover over any page to see a
magnified view of whatever is under the cursor. Click again to turn it off.

Built as a Manifest V3 Chrome extension rather than a page you open
directly — see `docs/SYSTEM_CHARTER.md` for the signal/parameter/behavior
mapping and `docs/TOOL_INTENT_STATEMENT.md` for the assignment's intent
statement.

## Run it locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. **Load unpacked** → select this folder.
4. Visit any site, click the extension icon once, then hover.

## Structure

Same shape as the engine it forked from — see `docs/ROADMAP.md` for the
project ritual and `docs/PROMPTS.md` for how this was built with AI
assistance.

| File | Role |
|---|---|
| `manifest.json` / `background.js` | Extension packaging; toolbar click → toggle message |
| `src/input/input.js` | Signal capture: cursor position, toggle state |
| `src/canvas/setupCanvas.js` | Lens setup: builds the DOM clone, positions it |
| `src/canvas/loop.js` | Per-frame update: repositions the lens while active |
| `src/utils/math.js` | Unchanged from the original engine |
| `index.html` / `style.css` | Project landing page (for GitHub Pages), not the tool itself |
| `process/prompts.md` | Verbatim log of prompts used to build this project |
