const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  getPetForm: () => ipcRenderer.invoke('pet:getPetForm'),
  getImageSrc: () => ipcRenderer.invoke('pet:getImageSrc'),
  getDimensions: () => ipcRenderer.invoke('pet:getDimensions'),
  getPetState: () => ipcRenderer.invoke('pet:getPetState'),
  dragStart: (screenX, screenY) => ipcRenderer.send('pet:dragStart', screenX, screenY),
  dragMove: (screenX, screenY) => ipcRenderer.send('pet:dragMove', screenX, screenY),
  dragEnd: () => ipcRenderer.send('pet:dragEnd'),
  showContextMenu: () => ipcRenderer.invoke('pet:showContextMenu'),
  playChatVoiceline: () => ipcRenderer.invoke('pet:playChatVoiceline'),
  hideTimer: () => ipcRenderer.invoke('pet:hideTimer'),
  submitPanel: (payload) => ipcRenderer.invoke('pet:submitPanel', payload),
  panelClosed: () => ipcRenderer.invoke('pet:panelClosed'),
  onPlayVoiceline: (callback) => {
    ipcRenderer.on('play-voiceline', (_event, payload) => callback(payload));
  },
  onPlayAudio: (callback) => {
    ipcRenderer.on('play-audio', (_event, payload) => callback(payload));
  },
  onStopAudio: (callback) => {
    ipcRenderer.on('stop-audio', () => callback());
  },
  onSpeak: (callback) => {
    ipcRenderer.on('pet:speak', (_event, payload) => callback(payload));
  },
  onPinMessage: (callback) => {
    ipcRenderer.on('pet:pinMessage', (_event, payload) => callback(payload));
  },
  onTimerTick: (callback) => {
    ipcRenderer.on('pet:timerTick', (_event, payload) => callback(payload));
  },
  onOpenPanel: (callback) => {
    ipcRenderer.on('pet:openPanel', (_event, payload) => callback(payload));
  },
  onReact: (callback) => {
    ipcRenderer.on('pet:react', () => callback());
  },
  onVoicelineVolumeChange: (callback) => {
    ipcRenderer.on('voiceline-volume', (_event, volume) => callback(volume));
  },
  onFormChanged: (callback) => {
    ipcRenderer.on('pet:formChanged', (_event, payload) => callback(payload));
  },
  onHop: (callback) => {
    ipcRenderer.on('pet:hop', (_event, payload) => callback(payload));
  },
  resizeForContent: (payload) => ipcRenderer.invoke('pet:resizeForContent', payload),
  onContentResized: (callback) => {
    ipcRenderer.on('pet:contentResized', (_event, payload) => callback(payload));
  },
  notifyReady: () => ipcRenderer.invoke('pet:ready'),
});
