const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { SRC_DIR } = require('../app/constants');
const { sendToWindow } = require('../utils/windowMessaging');

function flushPendingPetPanelOpen(ctx) {
  if (!ctx.petPanelReady || !ctx.pendingPetPanelOpen || !ctx.petPanelWindow || ctx.petPanelWindow.isDestroyed()) {
    return;
  }
  sendToWindow(ctx.petPanelWindow, 'pet:openPanel', ctx.pendingPetPanelOpen);
  ctx.pendingPetPanelOpen = null;
}

function centerPetPanelWindow(ctx) {
  if (!ctx.petPanelWindow || ctx.petPanelWindow.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const width = 440;
  const height = 560;
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);
  ctx.petPanelWindow.setBounds({ x, y, width, height });
}

function createPetPanelWindow(ctx) {
  if (ctx.petPanelWindow && !ctx.petPanelWindow.isDestroyed()) {
    return ctx.petPanelWindow;
  }

  ctx.petPanelWindow = new BrowserWindow({
    width: 440,
    height: 560,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(SRC_DIR, 'pet', 'pet-panel-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ctx.petPanelReady = false;
  ctx.petPanelWindow.webContents.on('did-start-loading', () => {
    ctx.petPanelReady = false;
  });

  ctx.petPanelWindow.loadFile(path.join(SRC_DIR, 'renderer', 'pet', 'petPanelShell.html'));

  ctx.petPanelWindow.on('closed', () => {
    ctx.petPanelWindow = null;
    ctx.petPanelReady = false;
    ctx.pendingPetPanelOpen = null;
  });

  return ctx.petPanelWindow;
}

function closePetPanelWindow(ctx) {
  if (ctx.petPanelWindow && !ctx.petPanelWindow.isDestroyed()) {
    ctx.petPanelWindow.hide();
  }
}

function openPetPanel(ctx, panel, extra = {}) {
  createPetPanelWindow(ctx);
  if (!ctx.petPanelWindow || ctx.petPanelWindow.isDestroyed()) return;

  ctx.pendingPetPanelOpen = { panel, ...extra };

  const showWindow = () => {
    centerPetPanelWindow(ctx);
    ctx.petPanelWindow.show();
    ctx.petPanelWindow.focus();
    flushPendingPetPanelOpen(ctx);
  };

  if (ctx.petPanelWindow.webContents.isLoading()) {
    ctx.petPanelWindow.webContents.once('did-finish-load', showWindow);
  } else {
    showWindow();
  }
}

function releasePetPanelFocus(ctx) {
  closePetPanelWindow(ctx);
}

function initPetPanelWindow(ctx) {
  ctx.createPetPanelWindow = () => createPetPanelWindow(ctx);
  ctx.openPetPanel = (panel, extra) => openPetPanel(ctx, panel, extra);
  ctx.closePetPanelWindow = () => closePetPanelWindow(ctx);
  ctx.releasePetPanelFocus = () => releasePetPanelFocus(ctx);
  ctx.flushPendingPetPanelOpen = () => flushPendingPetPanelOpen(ctx);
  ctx.setPetPanelReady = (ready) => { ctx.petPanelReady = ready; };
}

module.exports = { initPetPanelWindow };
