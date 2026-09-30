const LENS_SIZE = 180;
const ZOOM = 3;

const video = document.getElementById('feed');
const canvas = document.getElementById('lens-canvas');
const ctx = canvas.getContext('2d');
const frame = document.getElementById('lens-frame');
const status = document.getElementById('status');
const statusHeadline = document.getElementById('status-headline');
const statusGuide = document.getElementById('status-guide');

canvas.width = LENS_SIZE;
canvas.height = LENS_SIZE;

let latest = null; // { cursor, display: { id, bounds, scaleFactor } } from main's cursor-update
let streamReady = false;
let capturing = false;
let currentStream = null;
let capturedDisplayId = null; // which display the *current* video stream was captured for

function showNotSensing(headline, guide) {
  statusHeadline.textContent = headline;
  statusGuide.textContent = guide || '';
  status.classList.add('visible');
  frame.classList.add('not-sensing');
}

function clearNotSensing() {
  status.classList.remove('visible');
  frame.classList.remove('not-sensing');
}

function stopCurrentStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }
  streamReady = false;
}

async function startCapture() {
  // Guards against overlapping calls -- both a display change and a
  // system-resume event could fire close together and both try to
  // reacquire at once.
  if (capturing) return;
  capturing = true;
  stopCurrentStream();
  const targetDisplayId = latest ? latest.display.id : null;

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
    currentStream = stream;
    video.srcObject = stream;
    await video.play();
    streamReady = true;
    capturedDisplayId = targetDisplayId;
    clearNotSensing();
    // The stream can still die later (permission revoked, display
    // disconnected) -- without this the lens would just freeze on its
    // last frame instead of admitting it stopped working.
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      streamReady = false;
      showNotSensing('Screen sharing stopped', 'Toggle off and on to reconnect.');
    });
  } catch (err) {
    streamReady = false;
    showNotSensing(
      'Screen Recording permission needed',
      'Grant it in System Settings → Privacy & Security, then reopen the app.'
    );
    console.error('Screen capture failed:', err.message);
  } finally {
    capturing = false;
  }
}

function draw() {
  requestAnimationFrame(draw);
  if (!streamReady || !latest || !video.videoWidth) return;

  const { cursor, display } = latest;
  const scale = display.scaleFactor || 1;

  // video pixels are physical (Retina-scaled); cursor/display bounds are
  // logical. Map the cursor into the captured frame's own pixel space
  // before cropping, or the crop drifts off-target on any HiDPI screen.
  const videoX = (cursor.x - display.bounds.x) * scale;
  const videoY = (cursor.y - display.bounds.y) * scale;
  const cropSize = (LENS_SIZE / ZOOM) * scale;

  const sx = clamp(videoX - cropSize / 2, 0, video.videoWidth - cropSize);
  const sy = clamp(videoY - cropSize / 2, 0, video.videoHeight - cropSize);

  ctx.clearRect(0, 0, LENS_SIZE, LENS_SIZE);
  ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, LENS_SIZE, LENS_SIZE);
}

window.magnifier.onCursorUpdate((data) => {
  latest = data;
  const isActive = document.body.classList.contains('active');
  // The video stream is tied to whichever display was captured at
  // toggle-on time. If the cursor has moved to a different display,
  // the crop math below would keep computing coordinates in the new
  // display's space against video content from the old one -- that
  // mismatch is what caused the clipping. Reacquire for the display
  // the cursor is actually on now.
  if (
    isActive &&
    streamReady &&
    !capturing &&
    data.display.id !== capturedDisplayId
  ) {
    startCapture();
  }
});

window.magnifier.onActiveChange((isActive) => {
  document.body.classList.toggle('active', isActive);
  if (isActive && !streamReady) startCapture();
});

window.magnifier.onSystemResumed(() => {
  // getDisplayMedia() streams don't reliably signal their own death across
  // system sleep, so on wake we don't wait to find out -- just reacquire.
  if (document.body.classList.contains('active')) startCapture();
});

requestAnimationFrame(draw);
