const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  toggleStealth: (enable) => ipcRenderer.invoke('toggle-stealth', enable),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  onTriggerScreenCapture: (callback) => ipcRenderer.on('trigger-screen-capture', () => callback())
});
