'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('magnifier', {
  onCursorUpdate: (cb) => ipcRenderer.on('cursor-update', (_e, data) => cb(data)),
  onActiveChange: (cb) => ipcRenderer.on('magnifier-active', (_e, active) => cb(active)),
  onSystemResumed: (cb) => ipcRenderer.on('system-resumed', () => cb()),
});
