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

## Known limitations

- Built and tested for macOS only.
- Single monitor at a time: the screen capture is acquired for whichever
  display the cursor is on when the lens turns on. Dragging the lens to a
  *different* monitor won't re-acquire the capture until you toggle the
  lens off and back on.
- Can't magnify DRM-protected video (blacked out by the OS in any screen
  capture) or the contents of other screen-recording-protected windows.
