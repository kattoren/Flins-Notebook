const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  getScreenBounds: () => ipcRenderer.invoke('pet:getScreenBounds'),
  getRoamMode: () => ipcRenderer.invoke('pet:getRoamMode'),
  getImageSrc: () => ipcRenderer.invoke('pet:getImageSrc'),
  getDimensions: () => ipcRenderer.invoke('pet:getDimensions'),
  getPosition: () => ipcRenderer.invoke('pet:getPosition'),
  setPosition: (x, y) => ipcRenderer.invoke('pet:setPosition', x, y),
  showContextMenu: () => ipcRenderer.invoke('pet:showContextMenu'),
  playChatVoiceline: () => ipcRenderer.invoke('pet:playChatVoiceline'),
  onPlayVoiceline: (callback) => {
    ipcRenderer.on('play-voiceline', (_event, payload) => callback(payload));
  },
  onPlayAudio: (callback) => {
    ipcRenderer.on('play-audio', (_event, payload) => callback(payload));
  },
  onStopAudio: (callback) => {
    ipcRenderer.on('stop-audio', () => callback());
  },
  onReact: (callback) => {
    ipcRenderer.on('pet:react', () => callback());
  },
  onVoicelineVolumeChange: (callback) => {
    ipcRenderer.on('voiceline-volume', (_event, volume) => callback(volume));
  },
  onRoamModeChange: (callback) => {
    ipcRenderer.on('pet:roamMode', (_event, enabled) => callback(enabled));
  },
  onResetPhysics: (callback) => {
    ipcRenderer.on('pet:resetPhysics', () => callback());
  },
  notifyReady: () => ipcRenderer.invoke('pet:ready'),
});
