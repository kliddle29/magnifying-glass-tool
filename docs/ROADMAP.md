# Roadmap

The ritual for turning this engine into a new assignment. Every project
in this course starts here, in this order.

## 1. Fork

Fork `reusable-studio-engine` on GitHub. Don't edit this repository in
place — it stays the clean template every future assignment forks from.

## 2. Write the charter first

Open `docs/SYSTEM_CHARTER.md` and answer every section before touching
code: intent, signal, parameter, behavior, constraints, non-goals. If
you can't fill in a section in one sentence, the sketch isn't defined
yet — figuring that out now is cheaper than discovering it in code.

## 3. Build the sketch

The charter maps directly onto the existing modules:

| Charter section | Where it lives in code |
|---|---|
| Signal | `src/input/input.js` — what gets captured |
| Parameter + Behavior | `src/canvas/loop.js` — what gets drawn, and how the signal maps to it |
| Constraints | Everything you deliberately leave out of `loop.js` |

Leave `setupCanvas.js` and `src/utils/math.js` alone unless the sketch
genuinely needs a new utility — HiDPI setup and `mapRange`/`clamp`/`lerp`
cover almost everything a single-signal sketch needs.

## 4. Log decisions as you go

Add a line to `process/changelog.md` each time direction changes, not
just at the end. See that file for the format.

## 5. Deploy

Repo Settings → Pages → Deploy from a branch → `main` / `/` (root).
Confirm the live URL actually shows the running sketch before
submitting — a page that only works locally isn't done.

## 6. Submit

Submit the live GitHub Pages link, not the repository link.
