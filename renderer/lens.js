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

let latest = null; // { cursor, display } from main's cursor-update
let streamReady = false;

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

async function startCapture() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    streamReady = true;
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
});

window.magnifier.onActiveChange((isActive) => {
  document.body.classList.toggle('active', isActive);
  if (isActive && !streamReady) startCapture();
});

requestAnimationFrame(draw);
