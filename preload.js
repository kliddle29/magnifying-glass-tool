'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('magnifier', {
  onCursorUpdate: (cb) => ipcRenderer.on('cursor-update', (_e, data) => cb(data)),
  onActiveChange: (cb) => ipcRenderer.on('magnifier-active', (_e, active) => cb(active)),
  onSystemResumed: (cb) => ipcRenderer.on('system-resumed', () => cb()),
  saveRecording: (arrayBuffer, extension) =>
    ipcRenderer.invoke('save-recording', arrayBuffer, extension),

  // Region-selection window -> main
  confirmSelection: (rect) => ipcRenderer.send('selection-confirm', rect),
  cancelSelection: () => ipcRenderer.send('selection-cancel'),

  // Main -> recorder window
  onStartRegionRecording: (cb) =>
    ipcRenderer.on('start-region-recording', (_e, region) => cb(region)),
  onStopRegionRecording: (cb) => ipcRenderer.on('stop-region-recording', () => cb()),
  // Recorder window -> main
  regionRecordingStopped: () => ipcRenderer.send('region-recording-stopped'),
});
