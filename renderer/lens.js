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

// shouldRecord mirrors the toggle (true from activation to deactivation),
// independent of any one capture stream. currentStream gets torn down and
// re-acquired mid-session (multi-monitor moves, sleep/wake); MediaRecorder
// doesn't survive that (confirmed by testing -- swapping or stopping the
// underlying track auto-stops it instead of continuing), so a reacquisition
// while recording ends the current file and starts a new one on the fresh
// stream rather than silently losing what was captured.
let shouldRecord = false;
let mediaRecorder = null;
let recordedChunks = [];

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
    // stopCurrentStream() above already ended any recorder tied to the
    // previous stream (stopping its track auto-stops MediaRecorder), so a
    // reacquisition needs a fresh recorder on the new stream if we're
    // supposed to still be recording.
    if (shouldRecord) startRecording(stream);
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

function pickRecordingMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function startRecording(stream) {
  if (mediaRecorder || !stream) return;
  recordedChunks = [];
  const mimeType = pickRecordingMimeType();
  try {
    mediaRecorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
  } catch (err) {
    console.error('Could not start recording:', err.message);
    mediaRecorder = null;
    return;
  }
  mediaRecorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  });
  mediaRecorder.addEventListener('stop', async () => {
    const type = mediaRecorder.mimeType || 'video/webm';
    const blob = new Blob(recordedChunks, { type });
    recordedChunks = [];
    mediaRecorder = null;
    if (blob.size === 0) return;
    const extension = type.includes('mp4') ? 'mp4' : 'webm';
    const buffer = await blob.arrayBuffer();
    try {
      const savedPath = await window.magnifier.saveRecording(buffer, extension);
      console.log('Recording saved to', savedPath);
    } catch (err) {
      console.error('Could not save recording:', err.message);
    }
  });
  mediaRecorder.start();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
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
  eraseCursorArtifact(sx, sy, cropSize, videoX, videoY, scale);
}

// Chromium's screen capture always burns the real system cursor into the
// captured frame, and there's no constraint or Electron API that turns it
// off (a known, still-open limitation -- crbug.com/1007177, unfixed since
// 2019). Since the crop is always centered on the cursor's own hotspot,
// its position in the frame is known exactly, so this papers over the
// glyph by stamping in a same-size patch sampled from just beside it
// instead. Not pixel-perfect for unusually large custom cursors, but
// covers the standard arrow.
function eraseCursorArtifact(sx, sy, cropSize, videoX, videoY, scale) {
  const destScale = LENS_SIZE / cropSize;
  const patchPts = 20; // covers the standard macOS arrow's glyph extent
  const patchPx = patchPts * scale;

  let srcX = videoX - patchPx;
  if (srcX < 0 || srcX + patchPx > video.videoWidth) srcX = videoX + patchPx;
  if (srcX < 0 || srcX + patchPx > video.videoWidth) return; // no room either side

  const srcY = clamp(videoY, 0, video.videoHeight - patchPx);
  // destY is derived from the cursor's real position, not the (possibly
  // clamped) sample position -- otherwise the patch can land somewhere
  // other than where the cursor actually is once clamping kicks in near
  // a vertical screen edge.
  const destX = (videoX - sx) * destScale;
  const destY = (videoY - sy) * destScale;
  const destSize = patchPx * destScale;

  ctx.drawImage(video, srcX, srcY, patchPx, patchPx, destX, destY, destSize, destSize);
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
  shouldRecord = isActive;
  if (isActive) {
    if (!streamReady) {
      startCapture();
    } else if (!mediaRecorder) {
      startRecording(currentStream);
    }
  } else {
    stopRecording();
  }
});

window.magnifier.onSystemResumed(() => {
  // getDisplayMedia() streams don't reliably signal their own death across
  // system sleep, so on wake we don't wait to find out -- just reacquire.
  if (document.body.classList.contains('active')) startCapture();
});

requestAnimationFrame(draw);
