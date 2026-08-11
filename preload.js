const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  getAudioSources: () => ipcRenderer.invoke('get-audio-sources'),
  toggleStealth: (enable) => ipcRenderer.invoke('toggle-stealth', enable),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  parsePdf: (filePath) => ipcRenderer.invoke('parse-pdf', filePath),
  onTriggerScreenCapture: (callback) => ipcRenderer.on('trigger-screen-capture', () => callback()),
  onScrollWindow: (callback) => ipcRenderer.on('scroll-window', (event, deltaY) => callback(deltaY)),
  onToggleSession: (callback) => ipcRenderer.on('toggle-session-hotkey', () => callback())
});

