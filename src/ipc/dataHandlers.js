const { ipcMain, dialog } = require('electron');

function registerDataIpc(dataStore, getMainWindow, hooks = {}) {
  ipcMain.handle('reminders:list', () => dataStore.reminders.list());
  ipcMain.handle('reminders:get', (_event, id) => dataStore.reminders.get(id));
  ipcMain.handle('reminders:create', (_event, input) => dataStore.reminders.create(input));
  ipcMain.handle('reminders:update', (_event, id, input) => dataStore.reminders.update(id, input));
  ipcMain.handle('reminders:delete', (_event, id) => dataStore.reminders.delete(id));

  ipcMain.handle('achievements:list', () => dataStore.achievements.list());
  ipcMain.handle('achievements:create', (_event, input) => {
    const beforeCount = dataStore.achievements.list().length;
    const created = dataStore.achievements.create(input);
    if (hooks.onAchievementCreated) {
      hooks.onAchievementCreated({ beforeCount, afterCount: beforeCount + 1, created });
    }
    return created;
  });
  ipcMain.handle('achievements:delete', (_event, id) => dataStore.achievements.delete(id));

  ipcMain.handle('settings:get', () => dataStore.settings.get());
  ipcMain.handle('settings:update', (_event, input) => dataStore.settings.update(input));

  ipcMain.handle('dialog:pickAudio', async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }],
    });
    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  });
}

module.exports = { registerDataIpc };
