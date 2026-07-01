const path = require('path');
const fs = require('fs');
const { ipcMain } = require('electron');
const { pathToFileURL } = require('url');
const { DEFAULT_ALARM, AUDIO_DIR } = require('../app/constants');
const { readAudioAsDataUrl, resolveSoundPath } = require('../scheduler/audioHelper');

function registerWindowIpc(ctx) {
  ipcMain.handle('ping', () => 'pong');

  ipcMain.handle('window:minimize', () => {
    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
      ctx.mainWindow.minimize();
    }
  });

  ipcMain.handle('window:close', () => {
    ctx.hideMainWindow();
  });

  ipcMain.handle('flins:getDailyAffirmation', () => ctx.getDailyAffirmationText());

  ipcMain.handle('voiceline:setVolume', (_event, volume) => {
    const clamped = Math.min(1, Math.max(0, Number(volume) || 0));
    ctx.dataStore.settings.update({ voicelineVolume: clamped });
    ctx.broadcastVoicelineVolume(clamped);
    return clamped;
  });

  ipcMain.handle('audio:getSfxUrl', (_event, filename) => {
    const safeName = path.basename(filename);
    const fullPath = path.join(AUDIO_DIR, 'sound effects', safeName);
    return pathToFileURL(fullPath).href;
  });

  ipcMain.handle('ui:getAssetUrl', (_event, relativePath) => {
    const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(ctx.getAppRootPath(), 'assets', 'ui', safePath);
    return pathToFileURL(fullPath).href;
  });

  ipcMain.handle('book:getOpen', () => ctx.dataStore.settings.get().bookOpen ?? false);

  ipcMain.handle('book:setOpen', (_event, open) => {
    const isOpen = Boolean(open);
    try {
      ctx.dataStore.settings.update({ bookOpen: isOpen });
    } catch (err) {
      console.error('Failed to save book open state:', err);
    }
    ctx.resizeMainWindowForBook(isOpen);
    return isOpen;
  });

  ipcMain.handle('app:quit', () => {
    ctx.quitApp();
  });

  ipcMain.handle('audio:getDefaultAlarmLabel', () => 'Columbina alarm (default)');

  ipcMain.handle('audio:getAlarmPreviewUrl', (_event, soundPath) => {
    const soundFile = resolveSoundPath(soundPath || '', DEFAULT_ALARM);
    if (!fs.existsSync(soundFile)) return null;
    return readAudioAsDataUrl(soundFile);
  });
}

module.exports = { registerWindowIpc };
