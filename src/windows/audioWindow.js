const path = require('path');
const { BrowserWindow } = require('electron');
const { SRC_DIR } = require('../app/constants');
const { sendToWindow } = require('../utils/windowMessaging');

function createAudioWindow(ctx) {
  ctx.audioWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(SRC_DIR, 'pet', 'pet-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ctx.audioWindow.loadFile(path.join(SRC_DIR, 'renderer', 'pet', 'pet-audio.html'));

  ctx.audioWindow.on('closed', () => {
    ctx.audioWindow = null;
  });
}

function getAudioTarget(ctx) {
  if (ctx.petWindow && !ctx.petWindow.isDestroyed()) {
    return ctx.petWindow;
  }
  if (!ctx.audioWindow || ctx.audioWindow.isDestroyed()) {
    createAudioWindow(ctx);
  }
  return ctx.audioWindow;
}

function sendToAudioTarget(ctx, channel, payload) {
  const target = getAudioTarget(ctx);
  sendToWindow(target, channel, payload);
}

function initAudioWindow(ctx) {
  ctx.createAudioWindow = () => createAudioWindow(ctx);
  ctx.getAudioTarget = () => getAudioTarget(ctx);
  ctx.sendToAudioTarget = (channel, payload) => sendToAudioTarget(ctx, channel, payload);
}

module.exports = { initAudioWindow };
