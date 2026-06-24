const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  summonFlins: () => ipcRenderer.invoke('pet:summon'),
  isPetVisible: () => ipcRenderer.invoke('pet:isVisible'),
  onPetVisibilityChange: (callback) => {
    ipcRenderer.on('pet:visibility', (_event, visible) => callback(visible));
  },
  quitApp: () => ipcRenderer.invoke('app:quit'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  pickAudio: () => ipcRenderer.invoke('dialog:pickAudio'),
  remindersList: () => ipcRenderer.invoke('reminders:list'),
  remindersGet: (id) => ipcRenderer.invoke('reminders:get', id),
  remindersCreate: (input) => ipcRenderer.invoke('reminders:create', input),
  remindersUpdate: (id, input) => ipcRenderer.invoke('reminders:update', id, input),
  remindersDelete: (id) => ipcRenderer.invoke('reminders:delete', id),
  achievementsList: () => ipcRenderer.invoke('achievements:list'),
  achievementsCreate: (input) => ipcRenderer.invoke('achievements:create', input),
  achievementsDelete: (id) => ipcRenderer.invoke('achievements:delete', id),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsUpdate: (input) => ipcRenderer.invoke('settings:update', input),
  getDefaultAlarmLabel: () => ipcRenderer.invoke('audio:getDefaultAlarmLabel'),
});
