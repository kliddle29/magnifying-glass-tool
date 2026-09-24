# magnifying-glass-tool

A system-wide screen magnifier for macOS. It floats an always-on-top,
click-through lens that follows your cursor and shows a zoomed view of
whatever's under it — any app, not just a browser tab.

Started as a Chrome extension (DOM-clone based, browser-only); rewritten
as an Electron app so it can see the whole screen. Pure magnifier — no AI.

## Setup

Requires [Node.js](https://nodejs.org) (includes `npm`).

1. `npm install`
2. `npm start`

To run it as a standalone app instead of from source:
```
npm install --save-dev @electron/packager
npx @electron/packager . "Magnifying Glass" --platform=darwin --arch=arm64 --out=dist --overwrite
open "dist/Magnifying Glass-darwin-arm64/Magnifying Glass.app"
```

### macOS Screen Recording permission

The first time you toggle the lens on, macOS will prompt for **Screen
Recording** permission (for Electron, or Terminal if you launched it from
there). Grant it in **System Settings → Privacy & Security → Screen
Recording**, then **quit and re-run `npm start`** — macOS only applies a
freshly-granted Screen Recording permission after the app restarts.

## Use

- **Click the 🔍 in the menu bar**, or press **⌘⇧M**, to toggle the lens
  on/off.
- Hover anywhere on screen — the lens follows the cursor and shows a 3x
  zoomed view.

The app has no Dock icon or window chrome — it's a menu-bar-only utility.

## How the lens hides the background

The old Chrome-extension version cloned the page DOM into a floating div;
its bug (and the reason for filing this rewrite) was that the clone had
no guaranteed opaque background, so the real page could bleed through.

This version works differently: the lens window renders a live
`getDisplayMedia()` capture of the real screen, cropped and scaled onto a
canvas every frame (`renderer/lens.js`) — since the canvas is fully
repainted each frame from real captured pixels, there's no transparent
gap for the background to show through. The equivalent failure mode here
is the lens capturing *itself* (a mirror in the mirror); that's prevented
with `lensWindow.setContentProtection(true)` in `main.js`, which excludes
the lens window from any screen capture, including its own.

## Structure

| File | Role |
|---|---|
| `main.js` | Electron main process: creates the lens window, tracks the global cursor, owns the tray icon and toggle hotkey |
| `preload.js` | Exposes a narrow IPC bridge (`window.magnifier`) to the renderer under context isolation |
| `renderer/lens.js` | Captures the screen, crops/scales the region under the cursor onto the lens canvas each frame |
| `src/utils/math.js` | `clamp`/`lerp`/`mapRange` — shared by the main-process cursor clamping and the renderer's crop math |

## Back-end architecture

- **What data does this tool need?** The cursor's screen position (polled ~60 times a second) and a live video feed of whichever display it's on.
- **Where is it stored?** Nowhere. Both live in memory only for as long as the lens is active.
- **Temporary or persistent?** Fully temporary — nothing survives a toggle-off, let alone an app restart.
- **Does it need memory between sessions?** No.
- **Does it require AI inference?** No — ruled out explicitly in `docs/TOOL_INTENT_STATEMENT.md`'s Refusal Clause.
- **How many API calls are realistically required?** Zero network calls. The only capture API involved is macOS's own screen-recording API (`getDisplayMedia`), called once per toggle-on.
- **What happens if it fails?** The lens switches to a visibly distinct state (red ring, plain-language reason) instead of freezing or going blank — see `renderer/lens.js`'s `showNotSensing()`. The same state covers a mid-use failure (permission revoked, display disconnected), not just startup failure.

### Layers

| Layer | Where | What it does |
|---|---|---|
| Input | `main.js` `startTracking()` | Polls cursor position and the toggle trigger (tray click / ⌘⇧M) |
| Logic | `main.js` + `renderer/lens.js` | Clamps window position to the display bounds; maps the cursor into the captured video's pixel space and computes the crop region |
| Output | `renderer/lens.js` `draw()` | Repaints the cropped, scaled region onto the canvas every frame; falls back to the not-sensing state on capture failure |

### Behavior integrity check

- **Does it interrupt where claimed?** It doesn't interrupt at all — correctly, since the Tool Intent Statement never claimed an interruption point. No craving, no choice point to build.
- **Does it avoid shame, surveillance, or manipulation?** Nothing leaves the device, nothing is logged, and the only judgment call in the whole flow is telling you plainly whether it's currently working.
- **Friction: exploited or intentional?** None exists anywhere in this build, matching the Instrument Panel direction picked over Speed Bump in the Interface Ritual Sketch.
- **Minimal, or feature-stacking?** Still minimal — this build only added the failure-state indicator, which was already named as a gap in the Signature Interaction sketch, not a new feature bolted on.

## Known limitations

- Built and tested for macOS only.
- Multi-monitor: the lens reacquires its capture automatically when the
  cursor crosses onto a different display (see `process/break-log.md`
  entry 2). Verified in code by simulating a display change; not yet
  confirmed on real multi-monitor hardware.
- Full-screen apps and the Mission Control / Show Desktop gesture have
  caused the lens to disappear. A mitigation is in place
  (`hiddenInMissionControl: false`, re-asserting `alwaysOnTop` on every
  activation) but is not yet confirmed to fully resolve either case.
- Can't magnify DRM-protected video (blacked out by the OS in any screen
  capture) or the contents of other screen-recording-protected windows.
- Breaks if macOS's own Accessibility Zoom is active at the same time
  (double magnification — see `process/break-log.md`). Not fixable from
  inside this app: Accessibility Zoom magnifies the whole composited
  screen, including this app's own lens window, and there's no API for
  a regular app to exclude itself from it.

## Break log

See `process/break-log.md`.
