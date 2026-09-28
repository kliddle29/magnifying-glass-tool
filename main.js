'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  screen,
  desktopCapturer,
  globalShortcut,
  session,
  nativeImage,
  powerMonitor,
  ipcMain,
} = require('electron');

const { clamp } = require('./src/utils/math.js');

const LENS_SIZE = 180;
const WINDOW_WIDTH = LENS_SIZE + 40;
const WINDOW_HEIGHT = LENS_SIZE + 16;
const TRACK_INTERVAL_MS = 16;
const ZOOM_SHORTCUT = 'CommandOrControl+Shift+M';
const RECORD_SHORTCUT = 'CommandOrControl+Shift+R';
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
let selectionWindow = null;
let recorderWindow = null;
let tray = null;
let trackTimer = null;
let active = false; // zoom lens on/off
let recording = false; // region recording on/off -- entirely independent of `active`
let selectionDisplay = null; // the display the open selection window covers

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
  // source picker every time a capture starts.
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
  updateTrayMenu();
}

// --- Region recording: fully independent of the zoom lens above. Toggling
// one never starts or stops the other. ---

function createSelectionWindow(display) {
  selectionWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hiddenInMissionControl: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Deliberately NOT setIgnoreMouseEvents -- this window exists to catch
  // the drag that defines the recording region, unlike the click-through lens.
  selectionWindow.setAlwaysOnTop(true, 'screen-saver');
  selectionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  selectionWindow.setContentProtection(true);
  selectionWindow.loadFile(path.join(__dirname, 'renderer', 'selection.html'));
  forwardConsole(selectionWindow, 'selection');
  selectionWindow.once('ready-to-show', () => selectionWindow.show());
}

function closeSelectionWindow() {
  if (selectionWindow && !selectionWindow.isDestroyed()) selectionWindow.close();
  selectionWindow = null;
}

function createRecorderWindow() {
  recorderWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  recorderWindow.setContentProtection(true);
  recorderWindow.loadFile(path.join(__dirname, 'renderer', 'recorder.html'));
  forwardConsole(recorderWindow, 'recorder');
}

function startRecordingFlow() {
  if (recording || selectionWindow) return;
  const cursor = screen.getCursorScreenPoint();
  selectionDisplay = screen.getDisplayNearestPoint(cursor);
  createSelectionWindow(selectionDisplay);
}

function stopRecordingFlow() {
  if (!recording || !recorderWindow || recorderWindow.isDestroyed()) return;
  recorderWindow.webContents.send('stop-region-recording');
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setTitle(active || recording ? '•' : '');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: active ? 'Turn Off Magnifier' : 'Turn On Magnifier',
        click: () => setActive(!active),
      },
      {
        label: recording ? 'Stop Recording' : 'Record a Region...',
        click: () => (recording ? stopRecordingFlow() : startRecordingFlow()),
      },
    ])
  );
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip(
    `Magnifier — ${ZOOM_SHORTCUT.replace('CommandOrControl', '⌘')} to zoom, ` +
      `${RECORD_SHORTCUT.replace('CommandOrControl', '⌘')} to record a region`
  );
  updateTrayMenu();
}

function registerRecordingHandler() {
  // The renderer can't write files directly under contextIsolation, so it
  // hands the recorded bytes over here to actually save them.
  ipcMain.handle('save-recording', (event, arrayBuffer, extension) => {
    const buffer = Buffer.from(arrayBuffer);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(
      os.homedir(),
      'Desktop',
      `Magnifier Recording ${stamp}.${extension}`
    );
    fs.writeFileSync(filePath, buffer);
    return filePath;
  });

  ipcMain.on('selection-confirm', (event, localRect) => {
    // Use the display the selection window was actually created for, not a
    // fresh cursor lookup -- the pointer has already moved by the time this
    // arrives (it's sitting wherever the drag ended), and re-querying here
    // could resolve to the wrong display in a multi-monitor setup.
    const scale = (selectionDisplay && selectionDisplay.scaleFactor) || 1;
    closeSelectionWindow();

    createRecorderWindow();
    recording = true;
    updateTrayMenu();
    recorderWindow.webContents.once('did-finish-load', () => {
      recorderWindow.webContents.send('start-region-recording', {
        x: Math.round(localRect.x * scale),
        y: Math.round(localRect.y * scale),
        width: Math.round(localRect.width * scale),
        height: Math.round(localRect.height * scale),
      });
    });
  });

  ipcMain.on('selection-cancel', () => {
    closeSelectionWindow();
  });

  ipcMain.on('region-recording-stopped', () => {
    recording = false;
    updateTrayMenu();
    if (recorderWindow && !recorderWindow.isDestroyed()) recorderWindow.close();
    recorderWindow = null;
  });
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
  const zoomOk = globalShortcut.register(ZOOM_SHORTCUT, () => setActive(!active));
  if (!zoomOk) {
    console.warn(`Could not register ${ZOOM_SHORTCUT} — another app is probably using it.`);
  }
  const recordOk = globalShortcut.register(RECORD_SHORTCUT, () => {
    if (recording) {
      stopRecordingFlow();
    } else {
      startRecordingFlow();
    }
  });
  if (!recordOk) {
    console.warn(`Could not register ${RECORD_SHORTCUT} — another app is probably using it.`);
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  setupDisplayMediaHandler();
  createLensWindow();
  createTray();
  registerShortcuts();
  registerPowerEvents();
  registerRecordingHandler();
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
