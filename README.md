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

Two independent features, each with its own toggle. Turning one on or
off never affects the other.

- **Magnifier — click the 🔍 in the menu bar, or press ⌘⇧M.** Hover
  anywhere on screen and the lens follows the cursor with a live 3x
  zoomed view.
- **Region recording — pick "Record a Region..." from the menu bar, or
  press ⌘⇧R.** The screen dims and you drag out a rectangle, the same
  way macOS's own screenshot tool works. Release to start recording just
  that region; press ⌘⇧R again (or "Stop Recording" in the menu) to stop
  and save it to your Desktop. Press Esc while dragging to cancel
  without recording anything.

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
| `main.js` | Electron main process: owns both toggles, the tray menu, and all three windows below |
| `preload.js` | Exposes a narrow IPC bridge (`window.magnifier`) to every renderer under context isolation |
| `renderer/lens.js` | The magnifier: captures the screen, crops/scales the region under the cursor onto the lens canvas each frame |
| `renderer/selection.js` | The full-screen, non-click-through overlay used to drag out a recording region |
| `renderer/recorder.js` | Hidden window: captures the screen, crops to the selected region, and records that with `MediaRecorder` |
| `src/utils/math.js` | `clamp`/`lerp`/`mapRange` — shared by the main-process cursor clamping and the renderer's crop math |

## Back-end architecture

- **What data does this tool need?** The cursor's screen position (polled ~60 times a second) for the magnifier, and a live video feed of whichever display is relevant for whichever feature is active.
- **Where is it stored?** The cursor position and both features' live video feeds stay in memory only, for as long as that feature is active. The one exception: a region recording is saved to a file on the Desktop (`Magnifier Recording <timestamp>.mp4`) when you stop it. Nothing else is written anywhere.
- **Temporary or persistent?** A saved recording is the one persistent thing this tool produces; everything else is fully temporary and doesn't survive that feature turning off, let alone an app restart.
- **Does it need memory between sessions?** No.
- **Does it require AI inference?** No — ruled out explicitly in `docs/TOOL_INTENT_STATEMENT.md`'s Refusal Clause.
- **How many API calls are realistically required?** Zero network calls. The only capture API involved is macOS's own screen-recording API (`getDisplayMedia`), called once per activation of either feature.
- **What happens if it fails?** The magnifier switches to a visibly distinct state (red ring, plain-language reason) instead of freezing or going blank — see `renderer/lens.js`'s `showNotSensing()`. If a region recording fails to start (capture denied, etc.), it logs the error and cleanly resets instead of leaving a stuck "recording" state in the tray menu.

### Layers

| Layer | Where | What it does |
|---|---|---|
| Input | `main.js` `startTracking()`, `renderer/selection.js` | Polls cursor position for the magnifier; catches the drag that defines a recording region |
| Logic | `main.js` + `renderer/lens.js` / `renderer/recorder.js` | Clamps the lens window to display bounds and computes its crop region; converts a dragged selection from logical points into the physical-pixel region the recorder crops to |
| Output | `renderer/lens.js` `draw()`, `renderer/recorder.js` `drawRegion()` | Repaints the magnifier canvas every frame; repaints the recording canvas every frame and feeds it to `MediaRecorder` |

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
- The system cursor gets blurred out inside the lens (see
  `blurCursorArea()` in `renderer/lens.js`), since there's no OS or
  Electron option to exclude the cursor from the capture itself (a
  known, still-open Chromium limitation). An earlier version tried to
  paste a same-size patch of nearby pixels over the cursor instead;
  that was a real mistake, since `getDisplayMedia()` has capture
  latency independent of anything this app controls, and a wrong guess
  at the cursor's position didn't just fail to hide it, it pasted in a
  second, visibly wrong patch of its own. Blurring the same source
  pixels in place instead of replacing them fixes that failure mode by
  construction: a wrong guess just blurs harmless nearby content. Still
  a heuristic, not a guarantee, on a fast enough swipe. An unusually
  large custom cursor may not be fully covered either way.
- Region recording only covers a single display: the selection window
  opens on whichever display the cursor is on when you start, and a
  drag can't span onto a second monitor.
- If a region recording is running and the display it's capturing goes
  to sleep or gets disconnected, the recording just ends with whatever
  was captured up to that point rather than recovering — there's no
  reacquire-and-continue behavior here the way the magnifier has for
  its own capture.

## Break log

See `process/break-log.md`.
