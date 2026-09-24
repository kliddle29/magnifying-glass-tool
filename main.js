'use strict';

const path = require('path');
const {
  app,
  BrowserWindow,
  Tray,
  screen,
  desktopCapturer,
  globalShortcut,
  session,
  nativeImage,
  powerMonitor,
} = require('electron');

const { clamp } = require('./src/utils/math.js');

const LENS_SIZE = 180;
const WINDOW_WIDTH = LENS_SIZE + 40;
const WINDOW_HEIGHT = LENS_SIZE + 16;
const TRACK_INTERVAL_MS = 16;
const TOGGLE_SHORTCUT = 'CommandOrControl+Shift+M';
// Matches the CSS fade duration in lens.css -- the window waits for the
// fade-out to finish playing before it actually disappears, instead of
// cutting the animation off mid-flight.
const FADE_MS = 150;

function forwardConsole(win, label) {
  win.webContents.on('console-message', (details) => {
    console.log(`[${label}:${details.level}] ${details.message}`);
  });
}

let lensWindow = null;
let tray = null;
let trackTimer = null;
let active = false;

function createLensWindow() {
  lensWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    // Without this, Mission Control's window-sweep (including the "Show
    // Desktop" gesture) sweeps this window away with everything else.
    hiddenInMissionControl: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  lensWindow.setAlwaysOnTop(true, 'screen-saver');
  lensWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lensWindow.setIgnoreMouseEvents(true, { forward: true });
  // Excludes this window from desktopCapturer/getDisplayMedia output. Without
  // this the lens captures itself — a mirror inside the mirror, and the same
  // "background doesn't hide" failure this tool started from, just moved
  // from the DOM to the OS compositor.
  lensWindow.setContentProtection(true);

  lensWindow.loadFile(path.join(__dirname, 'renderer', 'lens.html'));
  forwardConsole(lensWindow, 'lens');
}

function setupDisplayMediaHandler() {
  // A custom handler makes getDisplayMedia() in the renderer resolve
  // silently with the display under the cursor instead of popping the OS
  // source picker every time the lens turns on.
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      const cursor = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(cursor);

      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        const match =
          sources.find((s) => s.display_id === String(display.id)) ||
          sources[0];
        callback({ video: match });
      });
    },
    { useSystemPicker: false }
  );
}

function startTracking() {
  if (trackTimer) return;
  trackTimer = setInterval(() => {
    if (!lensWindow || lensWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);

    const x = clamp(
      Math.round(cursor.x - WINDOW_WIDTH / 2),
      display.bounds.x,
      display.bounds.x + display.bounds.width - WINDOW_WIDTH
    );
    const y = clamp(
      Math.round(cursor.y - LENS_SIZE / 2),
      display.bounds.y,
      display.bounds.y + display.bounds.height - WINDOW_HEIGHT
    );
    lensWindow.setPosition(x, y);

    lensWindow.webContents.send('cursor-update', {
      cursor,
      display: { id: display.id, bounds: display.bounds, scaleFactor: display.scaleFactor },
    });
  }, TRACK_INTERVAL_MS);
}

function stopTracking() {
  if (trackTimer) {
    clearInterval(trackTimer);
    trackTimer = null;
  }
}

function setActive(next) {
  if (active === next) return;
  active = next;

  if (active) {
    // Re-assert on every activation, not just once at window creation --
    // best-effort against macOS sometimes dropping these flags around
    // full-screen Space changes. Not confirmed to fully fix it; see
    // process/break-log.md.
    lensWindow.setAlwaysOnTop(true, 'screen-saver');
    lensWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    lensWindow.show();
    startTracking();
    lensWindow.webContents.send('magnifier-active', true);
  } else {
    stopTracking();
    lensWindow.webContents.send('magnifier-active', false);
    // Give the renderer's fade-out time to actually play before the
    // window disappears -- hiding it immediately would cut the
    // animation off on frame one and defeat the point of having it.
    setTimeout(() => {
      if (!active) lensWindow.hide();
    }, FADE_MS);
  }
  if (tray) tray.setTitle(active ? '•' : '');
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip(`Magnifier — click or ${TOGGLE_SHORTCUT.replace('CommandOrControl', '⌘')} to toggle`);
  tray.on('click', () => setActive(!active));
}

function registerPowerEvents() {
  // A getDisplayMedia() stream doesn't reliably signal its own death across
  // system sleep -- the video track can just freeze on its last frame
  // instead of firing 'ended'. powerMonitor's 'resume' is the OS telling us
  // directly the machine just woke up, which is a real signal instead of a
  // guess about media-track event behavior across sleep.
  powerMonitor.on('resume', () => {
    if (lensWindow && !lensWindow.isDestroyed()) {
      lensWindow.webContents.send('system-resumed');
    }
  });
}

function registerShortcuts() {
  const toggleOk = globalShortcut.register(TOGGLE_SHORTCUT, () => setActive(!active));
  if (!toggleOk) {
    console.warn(`Could not register ${TOGGLE_SHORTCUT} — another app is probably using it.`);
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  setupDisplayMediaHandler();
  createLensWindow();
  createTray();
  registerShortcuts();
  registerPowerEvents();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopTracking();
});

app.on('window-all-closed', (event) => {
  // Menu-bar utility, not a document-window app — don't quit when the
  // (hidden, click-through) lens window closes.
  event.preventDefault();
});
