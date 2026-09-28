const video = document.getElementById('feed');
const canvas = document.getElementById('crop-canvas');
const ctx = canvas.getContext('2d');

let mediaRecorder = null;
let recordedChunks = [];
let rafId = null;
let captureStream = null;

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

function drawRegion(region) {
  rafId = requestAnimationFrame(() => drawRegion(region));
  if (!video.videoWidth) return;
  ctx.drawImage(
    video,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height
  );
}

// region: { x, y, width, height } in the target display's own physical
// (device) pixels -- main.js already converted the drag rectangle out of
// logical points before sending this, the same way lens.js's crop math does.
async function startRegionRecording(region) {
  canvas.width = region.width;
  canvas.height = region.height;

  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
  } catch (err) {
    console.error('Could not start region capture:', err.message);
    window.magnifier.regionRecordingStopped();
    return;
  }
  video.srcObject = captureStream;
  await video.play();
  drawRegion(region);

  const canvasStream = canvas.captureStream(30);
  const mimeType = pickRecordingMimeType();
  recordedChunks = [];
  try {
    mediaRecorder = new MediaRecorder(
      canvasStream,
      mimeType ? { mimeType } : undefined
    );
  } catch (err) {
    console.error('Could not start recording:', err.message);
    stopEverything();
    window.magnifier.regionRecordingStopped();
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
    stopEverything();
    if (blob.size > 0) {
      const extension = type.includes('mp4') ? 'mp4' : 'webm';
      const buffer = await blob.arrayBuffer();
      try {
        const savedPath = await window.magnifier.saveRecording(buffer, extension);
        console.log('Region recording saved to', savedPath);
      } catch (err) {
        console.error('Could not save region recording:', err.message);
      }
    }
    window.magnifier.regionRecordingStopped();
  });
  mediaRecorder.start();
}

function stopEverything() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (captureStream) {
    captureStream.getTracks().forEach((track) => track.stop());
    captureStream = null;
  }
}

window.magnifier.onStartRegionRecording((region) => {
  startRegionRecording(region);
});

window.magnifier.onStopRegionRecording(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  } else {
    // Never actually got a recorder going (e.g. capture failed) -- still
    // need to tell main so it can clean up and stop treating us as active.
    stopEverything();
    window.magnifier.regionRecordingStopped();
  }
});
