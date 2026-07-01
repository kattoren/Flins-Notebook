const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petPanelApi', {
  submitPanel: (payload) => ipcRenderer.invoke('pet:submitPanel', payload),
  panelClosed: () => ipcRenderer.invoke('pet:panelClosed'),
  pickAudio: () => ipcRenderer.invoke('dialog:pickAudio'),
  previewAlarm: (soundPath) => ipcRenderer.invoke('audio:getAlarmPreviewUrl', soundPath),
  getTimerDefaults: () => ipcRenderer.invoke('pet:getTimerDefaults'),
  notifyReady: () => ipcRenderer.invoke('pet:panelReady'),
  onOpenPanel: (callback) => {
    ipcRenderer.on('pet:openPanel', (_event, payload) => callback(payload));
  },
});
