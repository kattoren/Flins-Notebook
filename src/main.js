const path = require('path');
const { app, Menu } = require('electron');
const { initDataStore } = require('./store/dataStore');
const { registerDataIpc } = require('./ipc/dataHandlers');
const { createAppContext } = require('./app/context');
const { PET_IDLE_IMAGE } = require('./app/constants');
const { initLifecycle } = require('./app/lifecycle');
const { initMainWindow } = require('./windows/mainWindow');
const { initPetWindow } = require('./windows/petWindow');
const { initPetPanelWindow } = require('./windows/petPanelWindow');
const { initAudioWindow } = require('./windows/audioWindow');
const { initAudioService } = require('./services/audioService');
const { initPetService } = require('./services/petService');
const { initReminderService } = require('./services/reminderService');
const { initTray } = require('./services/tray');
const { registerPetIpc } = require('./ipc/petHandlers');
const { registerWindowIpc } = require('./ipc/windowHandlers');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  const ctx = createAppContext(app);

  initLifecycle(ctx);
  initMainWindow(ctx);
  initPetWindow(ctx);
  initPetPanelWindow(ctx);
  initAudioWindow(ctx);
  initAudioService(ctx);
  initPetService(ctx);
  initReminderService(ctx);
  initTray(ctx);

  app.on('second-instance', () => {
    ctx.showMainWindow();
  });

  app.whenReady().then(() => {
    try {
      if (process.platform === 'win32') {
        app.setAppUserModelId('com.flins.notes');
      }

      const appPath = path.join(__dirname, '..');
      ctx.appRootPath = appPath;
      ctx.dataStore = initDataStore(appPath, app.getPath('userData'), PET_IDLE_IMAGE, app.isPackaged);
      ctx.refreshIdleBubbleWidth();
      registerDataIpc(ctx.dataStore, () => ctx.mainWindow, {
        onAchievementCreated: (payload) => ctx.handleAchievementCreated(payload),
      });
      ctx.initPetTimer();

      registerPetIpc(ctx);
      registerWindowIpc(ctx);

      Menu.setApplicationMenu(null);
      ctx.createTray();
      ctx.createMainWindow();
      try {
        ctx.createPetWindow();
      } catch (err) {
        console.error('Failed to create pet window:', err);
      }
      ctx.startReminderScheduler();

      app.on('activate', () => {
        ctx.showMainWindow();
      });
    } catch (err) {
      console.error('Startup failed:', err);
      app.quit();
    }
  }).catch((err) => {
    console.error('whenReady failed:', err);
  });
}
