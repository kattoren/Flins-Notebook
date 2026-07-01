const path = require('path');
const { BrowserWindow } = require('electron');
const { getBookWindowSize } = require('../utils/bookLayout');
const { SRC_DIR } = require('../app/constants');
const { getAppIcon } = require('../utils/petAssets');

function getBookWindowSizeForState(open) {
  return getBookWindowSize(open);
}

function resizeMainWindowForBook(ctx, open) {
  if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) return;
  const { width, height } = getBookWindowSizeForState(open);
  ctx.mainWindow.setContentSize(width, height);
  ctx.mainWindow.center();
}

function hideMainWindow(ctx) {
  if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) return;
  ctx.mainWindow.hide();
  ctx.mainWindow.setSkipTaskbar(true);
}

function showMainWindow(ctx) {
  if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) {
    createMainWindow(ctx);
    return;
  }
  ctx.mainWindow.setSkipTaskbar(false);
  if (ctx.mainWindow.isMinimized()) {
    ctx.mainWindow.restore();
  }
  ctx.mainWindow.show();
  ctx.mainWindow.focus();
}

function openBookWindow(ctx) {
  ctx.dataStore.settings.update({ bookOpen: true });
  if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) {
    createMainWindow(ctx);
  } else {
    resizeMainWindowForBook(ctx, true);
    showMainWindow(ctx);
    ctx.mainWindow.webContents.send('book:open');
  }
}

function notifyPetVisibility(ctx, visible) {
  if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) return;
  ctx.mainWindow.webContents.send('pet:visibility', visible);
}

function createMainWindow(ctx) {
  const icon = getAppIcon();
  const bookOpen = ctx.dataStore?.settings?.get()?.bookOpen ?? false;
  const { width, height } = getBookWindowSizeForState(bookOpen);

  ctx.mainWindow = new BrowserWindow({
    width,
    height,
    center: true,
    maximizable: false,
    resizable: false,
    frame: false,
    skipTaskbar: false,
    transparent: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    icon,
    webPreferences: {
      preload: path.join(SRC_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ctx.mainWindow.on('close', (e) => {
    if (!ctx.isQuitting) {
      e.preventDefault();
      hideMainWindow(ctx);
    }
  });

  ctx.mainWindow.on('closed', () => {
    ctx.mainWindow = null;
  });

  ctx.mainWindow.loadFile(path.join(SRC_DIR, 'renderer', 'global', 'index.html'));

  if (!ctx.app.isPackaged) {
    ctx.mainWindow.webContents.on('console-message', (_event, _level, message) => {
      console.log('[book]', message);
    });
  }
}

function initMainWindow(ctx) {
  ctx.createMainWindow = () => createMainWindow(ctx);
  ctx.showMainWindow = () => showMainWindow(ctx);
  ctx.hideMainWindow = () => hideMainWindow(ctx);
  ctx.openBookWindow = () => openBookWindow(ctx);
  ctx.resizeMainWindowForBook = (open) => resizeMainWindowForBook(ctx, open);
  ctx.notifyPetVisibility = (visible) => notifyPetVisibility(ctx, visible);
}

module.exports = { initMainWindow };
