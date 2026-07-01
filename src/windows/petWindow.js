const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { pathToFileURL } = require('url');
const {
  SRC_DIR,
  PET_IDLE_IMAGE,
  PET_DEFAULT_FORM,
  PET_FORM_ASSETS,
  PET_MAX_SIZE,
  PET_BUBBLE_AREA,
} = require('../app/constants');
const { sendToWindow } = require('../utils/windowMessaging');
const {
  getPetAssetDimensions,
  resolvePetFormAsset,
  scalePetSize,
} = require('../utils/petAssets');

function getPetForm(ctx) {
  if (!ctx.dataStore) return PET_DEFAULT_FORM;
  const form = ctx.dataStore.settings.get().petForm;
  return PET_FORM_ASSETS[form] ? form : PET_DEFAULT_FORM;
}

function getPetFormImageSrc(ctx, form = getPetForm(ctx)) {
  return pathToFileURL(resolvePetFormAsset(form)).href;
}

function refreshIdleBubbleWidth(ctx) {
  const { width, height } = getPetAssetDimensions(PET_IDLE_IMAGE);
  ctx.idleBubbleWidth = scalePetSize(width, height, 'sticker').width;
}

function getIdleReferenceDims() {
  const { width, height } = getPetAssetDimensions(PET_IDLE_IMAGE);
  return scalePetSize(width, height, 'sticker');
}

function getPetWindowWidth(ctx) {
  return Math.max(ctx.petWidth, ctx.idleBubbleWidth);
}

function getPetWindowHeight(ctx, bubbleArea = ctx.currentBubbleArea) {
  return ctx.petHeight + bubbleArea;
}

function getIdleAnchorCenter(ctx) {
  const idleDims = getIdleReferenceDims();
  const idleWinW = Math.max(idleDims.width, ctx.idleBubbleWidth);
  const idleWinH = idleDims.height + PET_BUBBLE_AREA;
  const { workArea } = screen.getPrimaryDisplay();
  const winX = workArea.x + workArea.width - idleWinW;
  const winY = workArea.y + workArea.height - idleWinH;
  return {
    x: winX + idleWinW / 2,
    y: winY + idleWinH - idleDims.height / 2,
  };
}

function getPetWindowLayout(ctx, bubbleArea = ctx.currentBubbleArea) {
  const anchor = getIdleAnchorCenter(ctx);
  const width = getPetWindowWidth(ctx);
  const height = getPetWindowHeight(ctx, bubbleArea);
  const x = Math.round(anchor.x - width / 2);
  const y = Math.round(anchor.y - height + ctx.petHeight / 2);
  return { x, y, width, height, bubbleArea };
}

function lockPetWindowSize(win, width, height) {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return;
  win.setMinimumSize(w, h);
  win.setMaximumSize(w, h);
  win.setContentSize(w, h);
}

function repositionPetWindow(ctx, bubbleArea = ctx.currentBubbleArea) {
  if (!ctx.petWindow || ctx.petWindow.isDestroyed()) return;
  ctx.currentBubbleArea = bubbleArea;
  const layout = getPetWindowLayout(ctx, bubbleArea);
  lockPetWindowSize(ctx.petWindow, layout.width, layout.height);
  ctx.petWindow.setPosition(layout.x, layout.y);
  return layout;
}

function configurePetWindow(win) {
  win.setTitle('');

  if (process.platform !== 'win32') return;

  const nudgeWindowSize = () => {
    if (win.isDestroyed()) return;
    const [width, height] = win.getContentSize();
    win.setContentSize(width, height + 1);
    win.setContentSize(width, height);
  };

  win.on('blur', nudgeWindowSize);
  win.on('focus', nudgeWindowSize);
}

function setPetAlwaysOnTop(ctx, enabled) {
  ctx.petAlwaysOnTop = enabled;
  if (!ctx.petWindow) return;
  if (enabled) {
    ctx.petWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    ctx.petWindow.setAlwaysOnTop(false);
  }
}

function sendToPetWindow(ctx, channel, payload) {
  if (!ctx.petWindow || ctx.petWindow.isDestroyed()) return;
  sendToWindow(ctx.petWindow, channel, payload);
}

function isPetVisible(ctx) {
  return Boolean(ctx.petWindow && !ctx.petWindow.isDestroyed() && ctx.petWindow.isVisible());
}

function applyPetWindowSize(ctx, imagePath, form = getPetForm(ctx)) {
  const { width: imageWidth, height: imageHeight } = getPetAssetDimensions(imagePath);
  const size = scalePetSize(imageWidth, imageHeight, form);
  ctx.petWidth = size.width;
  ctx.petHeight = size.height;
  const layout = getPetWindowLayout(ctx, ctx.currentBubbleArea);
  const winH = layout.height;
  const winW = layout.width;

  if (!ctx.petWindow || ctx.petWindow.isDestroyed()) {
    return {
      width: ctx.petWidth,
      height: ctx.petHeight,
      windowWidth: winW,
      windowHeight: winH,
      bubbleWidth: ctx.idleBubbleWidth,
    };
  }

  repositionPetWindow(ctx, ctx.currentBubbleArea);
  return {
    width: ctx.petWidth,
    height: ctx.petHeight,
    windowWidth: winW,
    windowHeight: winH,
    bubbleWidth: ctx.idleBubbleWidth,
  };
}

function notifyPetFormChanged(ctx, form = getPetForm(ctx)) {
  const assetPath = resolvePetFormAsset(form);
  const dims = applyPetWindowSize(ctx, assetPath, form);
  sendToPetWindow(ctx, 'pet:formChanged', {
    form,
    imageSrc: pathToFileURL(assetPath).href,
    bubbleWidth: ctx.idleBubbleWidth,
    ...dims,
  });
}

function createPetWindow(ctx) {
  const form = getPetForm(ctx);
  const imagePath = resolvePetFormAsset(form);
  const { width: imageWidth, height: imageHeight } = getPetAssetDimensions(imagePath);
  const size = scalePetSize(imageWidth, imageHeight, form);
  ctx.petWidth = size.width;
  ctx.petHeight = size.height;
  ctx.currentBubbleArea = PET_BUBBLE_AREA;
  const layout = getPetWindowLayout(ctx, PET_BUBBLE_AREA);

  ctx.petWindow = new BrowserWindow({
    width: layout.width,
    height: layout.height,
    x: layout.x,
    y: layout.y,
    title: '',
    useContentSize: true,
    transparent: true,
    frame: false,
    thickFrame: false,
    titleBarStyle: 'hidden',
    roundedCorners: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(SRC_DIR, 'pet', 'pet-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1,
    },
  });

  configurePetWindow(ctx.petWindow);

  lockPetWindowSize(ctx.petWindow, layout.width, layout.height);
  ctx.petWindow.webContents.setVisualZoomLevelLimits(1, 1);
  setPetAlwaysOnTop(ctx, true);
  ctx.petWindow.loadFile(path.join(SRC_DIR, 'renderer', 'pet', 'pet.html'));

  ctx.petWindow.webContents.on('did-finish-load', () => {
    if (ctx.petWindow && !ctx.petWindow.isDestroyed() && !ctx.petWindow.isVisible()) {
      const nextLayout = repositionPetWindow(ctx, PET_BUBBLE_AREA);
      lockPetWindowSize(ctx.petWindow, nextLayout.width, nextLayout.height);
      ctx.petWindow.show();
      ctx.notifyPetVisibility(true);
      notifyPetFormChanged(ctx, getPetForm(ctx));
    }
  });

  ctx.petWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error('Pet window failed to load:', code, desc);
  });

  ctx.petWindow.once('ready-to-show', () => {
    const nextLayout = repositionPetWindow(ctx, PET_BUBBLE_AREA);
    lockPetWindowSize(ctx.petWindow, nextLayout.width, nextLayout.height);
    ctx.petWindow.show();
    ctx.notifyPetVisibility(true);
    notifyPetFormChanged(ctx, getPetForm(ctx));
  });

  ctx.petWindow.on('closed', () => {
    ctx.petWindow = null;
  });
}

function initPetWindow(ctx) {
  ctx.getPetForm = () => getPetForm(ctx);
  ctx.getPetFormImageSrc = (form) => getPetFormImageSrc(ctx, form);
  ctx.refreshIdleBubbleWidth = () => refreshIdleBubbleWidth(ctx);
  ctx.getPetWindowLayout = (bubbleArea) => getPetWindowLayout(ctx, bubbleArea);
  ctx.repositionPetWindow = (bubbleArea) => repositionPetWindow(ctx, bubbleArea);
  ctx.lockPetWindowSize = lockPetWindowSize;
  ctx.setPetAlwaysOnTop = (enabled) => setPetAlwaysOnTop(ctx, enabled);
  ctx.sendToPetWindow = (channel, payload) => sendToPetWindow(ctx, channel, payload);
  ctx.isPetVisible = () => isPetVisible(ctx);
  ctx.notifyPetFormChanged = (form) => notifyPetFormChanged(ctx, form);
  ctx.createPetWindow = () => createPetWindow(ctx);
  ctx.getPetWindowWidth = () => getPetWindowWidth(ctx);
  ctx.getPetWindowHeight = (bubbleArea) => getPetWindowHeight(ctx, bubbleArea);
}

module.exports = { initPetWindow };
