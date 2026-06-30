const { app, BrowserWindow, ipcMain, nativeImage, screen, Menu, Tray, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { initDataStore } = require('./store/dataStore');
const { registerDataIpc } = require('./ipc/dataHandlers');
const { startScheduler } = require('./scheduler/scheduler');
const { readAudioAsDataUrl, resolveSoundPath } = require('./scheduler/audioHelper');
const { getGreetingVoiceline, getRandomChatVoiceline, getVoicelinePayload } = require('./audio/voicelines');
const { createPetTimer, formatRemaining } = require('./pet/petTimer');
const {
  formatReminderSpeech,
  formatPreAlertSpeech,
  formatBreakSpeech,
  formatTime12From24,
} = require('./pet/petSpeak');

const PET_ASSETS_DIR = path.join(__dirname, '..', 'assets', 'flins');
const PET_IDLE_IMAGE = path.join(PET_ASSETS_DIR, 'flins_idle.png');
const PET_ICON_IMAGE = PET_IDLE_IMAGE;
const PET_DEFAULT_FORM = 'gif';
const PET_FORM_ASSETS = {
  gif: 'flins_stand.gif',
  lantern: 'flins lantern.png',
  sticker: 'flins_idle.png',
};
const DEFAULT_ALARM = path.join(__dirname, 'audio', 'alarm', 'alarm_columbina_end.mp3');
const PET_MAX_SIZE = 240;
const PET_BUBBLE_GAP = 32;
const PET_BUBBLE_MAX_HEIGHT = 360;
const PET_BUBBLE_AREA = PET_BUBBLE_GAP + PET_BUBBLE_MAX_HEIGHT;

const { getBookWindowSize } = require('./bookLayout');

let mainWindow = null;
let petWindow = null;
let tray = null;
let dataStore = null;
let petAlwaysOnTop = true;
let isQuitting = false;
let petWidth = 0;
let petHeight = 0;
let audioWindow = null;
let stopScheduler = null;
let hasPlayedStartupGreeting = false;
let pendingSummonGreeting = false;
let petDrag = null;
let petTimer = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.flins.notes');
    }

    const appPath = path.join(__dirname, '..');
    appRootPath = appPath;
    dataStore = initDataStore(appPath, app.getPath('userData'), PET_IDLE_IMAGE);
    registerDataIpc(dataStore, () => mainWindow);
    initPetTimer();

    Menu.setApplicationMenu(null);
    createTray();
    createMainWindow();
    createPetWindow();
    startReminderScheduler();

    app.on('activate', () => {
      showMainWindow();
    });
  });
}

function getAppIcon() {
  return nativeImage.createFromPath(PET_ICON_IMAGE);
}

function readGifDimensions(imagePath) {
  let fd;
  try {
    const buf = Buffer.alloc(10);
    fd = fs.openSync(imagePath, 'r');
    fs.readSync(fd, buf, 0, 10, 0);
    if (buf.toString('ascii', 0, 3) !== 'GIF') return null;
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt16LE(8);
    if (width > 0 && height > 0) return { width, height };
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function getPetAssetDimensions(imagePath) {
  const image = nativeImage.createFromPath(imagePath);
  const size = image.getSize();
  if (size.width > 0 && size.height > 0 && !image.isEmpty()) {
    return size;
  }

  if (path.extname(imagePath).toLowerCase() === '.gif') {
    const gifSize = readGifDimensions(imagePath);
    if (gifSize) return gifSize;
  }

  const fallback = nativeImage.createFromPath(PET_IDLE_IMAGE);
  const fallbackSize = fallback.getSize();
  if (fallbackSize.width > 0 && fallbackSize.height > 0) {
    return fallbackSize;
  }

  return { width: PET_MAX_SIZE, height: PET_MAX_SIZE };
}

function resolvePetFormAsset(form) {
  const key = PET_FORM_ASSETS[form] ? form : PET_DEFAULT_FORM;
  const filePath = path.join(PET_ASSETS_DIR, PET_FORM_ASSETS[key]);
  if (fs.existsSync(filePath)) return filePath;
  const fallback = path.join(PET_ASSETS_DIR, PET_FORM_ASSETS[PET_DEFAULT_FORM]);
  return fs.existsSync(fallback) ? fallback : PET_IDLE_IMAGE;
}

function getPetForm() {
  if (!dataStore) return PET_DEFAULT_FORM;
  const form = dataStore.settings.get().petForm;
  return PET_FORM_ASSETS[form] ? form : PET_DEFAULT_FORM;
}

function getPetFormImageSrc(form = getPetForm()) {
  return pathToFileURL(resolvePetFormAsset(form)).href;
}

function applyPetWindowSize(imagePath) {
  const { width: imageWidth, height: imageHeight } = getPetAssetDimensions(imagePath);
  const size = scalePetSize(imageWidth, imageHeight);
  petWidth = size.width;
  petHeight = size.height;
  const winH = getPetWindowHeight();

  if (!petWindow || petWindow.isDestroyed()) {
    return { width: petWidth, height: petHeight, windowHeight: winH };
  }

  if (petWidth > 0 && winH > 0) {
    lockPetWindowSize(petWindow, petWidth, winH);
  }
  return { width: petWidth, height: petHeight, windowHeight: winH };
}

function notifyPetFormChanged(form = getPetForm()) {
  const assetPath = resolvePetFormAsset(form);
  const dims = applyPetWindowSize(assetPath);
  sendToPetWindow('pet:formChanged', {
    form,
    imageSrc: pathToFileURL(assetPath).href,
    ...dims,
  });
}

function setPetForm(form) {
  if (!PET_FORM_ASSETS[form]) return;
  dataStore.settings.update({ petForm: form });
  notifyPetFormChanged(form);
}

function resolvePetImageSrc(spriteFileName) {
  const filePath = path.join(PET_ASSETS_DIR, spriteFileName);
  const resolved = fs.existsSync(filePath) ? filePath : PET_IDLE_IMAGE;
  return pathToFileURL(resolved).href;
}

function scalePetSize(imageWidth, imageHeight) {
  if (!imageWidth || !imageHeight) {
    return { width: PET_MAX_SIZE, height: PET_MAX_SIZE };
  }
  const scale = Math.min(PET_MAX_SIZE / imageWidth, PET_MAX_SIZE / imageHeight);
  return {
    width: Math.max(1, Math.round(imageWidth * scale)),
    height: Math.max(1, Math.round(imageHeight * scale)),
  };
}

function getPetWindowHeight() {
  return petHeight + PET_BUBBLE_AREA;
}

function getDefaultPetPosition(width, height) {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - width,
    y: workArea.y + workArea.height - height,
  };
}

function lockPetWindowSize(win, width, height) {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return;
  win.setMinimumSize(w, h);
  win.setMaximumSize(w, h);
  win.setContentSize(w, h);
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

function setPetAlwaysOnTop(enabled) {
  petAlwaysOnTop = enabled;
  if (!petWindow) return;
  if (enabled) {
    petWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    petWindow.setAlwaysOnTop(false);
  }
}

function speakPetMessage(text, { hop = false } = {}) {
  if (!isPetVisible() || !text) return;
  if (hop) sendPetHop();
  sendToPetWindow('pet:speak', { text });
}

function syncPinToPet() {
  if (!dataStore) return;
  const { pinMessage } = dataStore.settings.get();
  sendToPetWindow('pet:pinMessage', { text: pinMessage || '' });
}

function pushTimerToPet(tick) {
  if (!dataStore) return;
  const { timerVisible } = dataStore.settings.get();
  sendToPetWindow('pet:timerTick', {
    ...tick,
    visible: timerVisible !== false,
  });
}

function getTimerTickPayload() {
  if (!petTimer || !petTimer.isRunning()) {
    return { running: false, display: '0:00', phase: '', type: '' };
  }
  const state = petTimer.getState();
  const remaining = state.endAt - Date.now();
  return {
    display: formatRemaining(remaining),
    phase: state.phase,
    type: state.type,
    running: remaining > 0,
  };
}

function initPetTimer() {
  petTimer = createPetTimer({
    onTick: (tick) => pushTimerToPet(tick),
    onBreakStart: () => {
      const settings = dataStore.settings.get();
      speakPetMessage(formatBreakSpeech(settings), { hop: true });
      playDefaultAlarm();
    },
    onPhaseEnd: () => {},
    onStop: () => pushTimerToPet({ running: false, display: '0:00' }),
  });
}

function playDefaultAlarm() {
  if (!fs.existsSync(DEFAULT_ALARM)) return;
  const settings = dataStore.settings.get();
  const dataUrl = readAudioAsDataUrl(DEFAULT_ALARM);
  const volume = settings.volume ?? 1;
  sendToAudioTarget('play-audio', { dataUrl, volume, playCount: 1 });
  sendToAudioTarget('pet:react');
}

function openPetPanel(panel, extra = {}) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setFocusable(true);
    petWindow.focus();
  }
  sendToPetWindow('pet:openPanel', { panel, ...extra });
}

function releasePetPanelFocus() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setFocusable(false);
  }
}

function showPetTimer() {
  dataStore.settings.update({ timerVisible: true });
  pushTimerToPet(getTimerTickPayload());
}

function showPetContextMenu() {
  const settings = dataStore.settings.get();
  const timerRunning = petTimer && petTimer.isRunning();
  const timerHidden = settings.timerVisible === false;
  const hasPin = Boolean((settings.pinMessage || '').trim());

  const menu = Menu.buildFromTemplate([
    {
      label: 'Dismiss',
      click: () => {
        dismissPet();
      },
    },
    {
      label: 'Stay on top',
      type: 'checkbox',
      checked: petAlwaysOnTop,
      click: (menuItem) => setPetAlwaysOnTop(menuItem.checked),
    },
    { type: 'separator' },
    {
      label: 'Timer',
      click: () => openPetPanel('timer'),
    },
    {
      label: 'Show timer',
      enabled: timerRunning && timerHidden,
      click: () => showPetTimer(),
    },
    {
      label: 'Set name',
      click: () => openPetPanel('name', { name: settings.petName || '' }),
    },
    {
      label: 'Pin message',
      click: () => openPetPanel('pin', { message: settings.pinMessage || '' }),
    },
    {
      label: 'Clear pin message',
      enabled: hasPin,
      click: () => {
        dataStore.settings.update({ pinMessage: '' });
        syncPinToPet();
      },
    },
    { type: 'separator' },
    {
      label: 'Pet style',
      submenu: [
        {
          label: 'Flins GIF',
          type: 'radio',
          checked: getPetForm() === 'gif',
          click: () => setPetForm('gif'),
        },
        {
          label: 'Lantern',
          type: 'radio',
          checked: getPetForm() === 'lantern',
          click: () => setPetForm('lantern'),
        },
        {
          label: 'Sticker',
          type: 'radio',
          checked: getPetForm() === 'sticker',
          click: () => setPetForm('sticker'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Open Book',
      click: () => openBookWindow(),
    },
    { type: 'separator' },
    {
      label: 'Close Book',
      click: () => quitApp(),
    },
  ]);
  menu.popup({ window: petWindow });
}

function notifyPetVisibility(visible) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('pet:visibility', visible);
}

function isPetVisible() {
  return Boolean(petWindow && !petWindow.isDestroyed() && petWindow.isVisible());
}

function dismissPet() {
  stopPetAudio();
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.hide();
  }
  notifyPetVisibility(false);
}

function stopPetAudio() {
  sendToPetWindow('stop-audio');
  if (audioWindow && !audioWindow.isDestroyed()) {
    sendToWindow(audioWindow, 'stop-audio');
  }
}

function sendToWindow(target, channel, payload) {
  if (!target || target.isDestroyed()) return;

  const send = () => {
    if (!target.isDestroyed()) {
      if (payload === undefined) {
        target.webContents.send(channel);
      } else {
        target.webContents.send(channel, payload);
      }
    }
  };

  if (target.webContents.isLoading()) {
    target.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

function sendToPetWindow(channel, payload) {
  if (!petWindow || petWindow.isDestroyed()) return;
  sendToWindow(petWindow, channel, payload);
}

function broadcastVoicelineVolume(volume) {
  sendToPetWindow('voiceline-volume', volume);
}

function playVoicelineFile(filePath, text) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const payload = getVoicelinePayload(filePath);
  const settings = dataStore.settings.get();
  const dataUrl = readAudioAsDataUrl(filePath);
  const volume = settings.voicelineVolume ?? 0.25;

  sendToPetWindow('play-voiceline', {
    dataUrl,
    volume,
    text: text || payload.text,
    imageSrc: resolvePetImageSrc(payload.sprite),
  });
}

function sendPetHop() {
  sendToPetWindow('pet:hop');
}

function playGreetingVoiceline() {
  const greeting = getGreetingVoiceline();
  if (greeting) {
    playVoicelineFile(greeting);
  }
}

function summonPet() {
  if (!petWindow || petWindow.isDestroyed()) {
    pendingSummonGreeting = true;
    createPetWindow();
    return;
  }

  showSummonedPet();
}

function showSummonedPet() {
  notifyPetFormChanged(getPetForm());
  const winH = getPetWindowHeight();
  const { x, y } = getDefaultPetPosition(petWidth, winH);
  if (petWidth > 0 && winH > 0) {
    lockPetWindowSize(petWindow, petWidth, winH);
  }
  petWindow.setPosition(x, y);
  petWindow.show();
  notifyPetVisibility(true);
  sendPetHop();
  playGreetingVoiceline();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function openBookWindow() {
  dataStore.settings.update({ bookOpen: true });
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  } else {
    resizeMainWindowForBook(true);
    showMainWindow();
    mainWindow.webContents.send('book:open');
  }
}

function createTray() {
  const icon = getAppIcon();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Flins Notes');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => showMainWindow() },
    { label: 'Quit', click: () => quitApp() },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

function getBookWindowSizeForState(open) {
  return getBookWindowSize(open);
}

function resizeMainWindowForBook(open) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { width, height } = getBookWindowSizeForState(open);
  mainWindow.setContentSize(width, height);
  mainWindow.center();
}

function createMainWindow() {
  const icon = getAppIcon();
  const bookOpen = dataStore?.settings?.get()?.bookOpen ?? false;
  const { width, height } = getBookWindowSizeForState(bookOpen);

  mainWindow = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      hideMainWindow();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'global', 'index.html'));
}

function createAudioWindow() {
  audioWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'pet-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  audioWindow.loadFile(path.join(__dirname, 'renderer', 'pet', 'pet-audio.html'));

  audioWindow.on('closed', () => {
    audioWindow = null;
  });
}

function getAudioTarget() {
  if (petWindow && !petWindow.isDestroyed()) {
    return petWindow;
  }
  if (!audioWindow || audioWindow.isDestroyed()) {
    createAudioWindow();
  }
  return audioWindow;
}

function sendToAudioTarget(channel, payload) {
  const target = getAudioTarget();
  sendToWindow(target, channel, payload);
}

function playReminderAlarm(reminder) {
  const settings = dataStore.settings.get();
  const soundPath = resolveSoundPath(reminder.soundPath, DEFAULT_ALARM);

  speakPetMessage(
    formatReminderSpeech(settings, reminder, formatTime12From24(reminder.time)),
  );

  if (!fs.existsSync(soundPath)) {
    console.error('Alarm file not found:', soundPath);
    return;
  }

  const dataUrl = readAudioAsDataUrl(soundPath);
  const playCount = reminder.playCount ?? 1;
  const volume = settings.volume ?? 1;

  sendToAudioTarget('play-audio', { dataUrl, volume, playCount });
  sendToAudioTarget('pet:react');
}

function announcePreAlert(reminder) {
  const settings = dataStore.settings.get();
  speakPetMessage(
    formatPreAlertSpeech(settings, reminder, reminder.preAlertMinutes),
    { hop: true },
  );
}

function showReminderNotification(reminder) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: 'Reminder',
    body: reminder.title,
    icon: getAppIcon(),
  });
  notification.show();
}

function startReminderScheduler() {
  if (stopScheduler) {
    stopScheduler();
  }

  stopScheduler = startScheduler({
    dataStore,
    onFire: (reminder) => {
      showReminderNotification(reminder);
      playReminderAlarm(reminder);
    },
    onPreAlert: (reminder) => {
      announcePreAlert(reminder);
    },
  });
}

function createPetWindow() {
  const imagePath = resolvePetFormAsset(getPetForm());
  const { width: imageWidth, height: imageHeight } = getPetAssetDimensions(imagePath);
  const size = scalePetSize(imageWidth, imageHeight);
  petWidth = size.width;
  petHeight = size.height;
  const winH = getPetWindowHeight();
  const { x, y } = getDefaultPetPosition(petWidth, winH);

  petWindow = new BrowserWindow({
    width: petWidth,
    height: winH,
    x,
    y,
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
      preload: path.join(__dirname, 'pet-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1,
    },
  });

  configurePetWindow(petWindow);

  lockPetWindowSize(petWindow, petWidth, winH);
  petWindow.webContents.setVisualZoomLevelLimits(1, 1);
  setPetAlwaysOnTop(true);
  petWindow.loadFile(path.join(__dirname, 'renderer', 'pet', 'pet.html'));

  petWindow.once('ready-to-show', () => {
    lockPetWindowSize(petWindow, petWidth, winH);
    petWindow.show();
    notifyPetVisibility(true);
    notifyPetFormChanged(getPetForm());
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function quitApp() {
  if (isQuitting) return;
  isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.destroy();
  }
  if (audioWindow && !audioWindow.isDestroyed()) {
    audioWindow.destroy();
  }
  if (stopScheduler) {
    stopScheduler();
    stopScheduler = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
}


process.on('SIGINT', quitApp);
process.on('SIGTERM', quitApp);

app.on('before-quit', () => {
  isQuitting = true;
});

ipcMain.handle('ping', () => 'pong');

ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:close', () => {
  hideMainWindow();
});

ipcMain.handle('pet:getRoamMode', () => false);

ipcMain.handle('pet:getPetForm', () => getPetForm());

ipcMain.handle('pet:getImageSrc', () => getPetFormImageSrc());

ipcMain.handle('pet:getDimensions', () => ({
  width: petWidth,
  height: petHeight,
  bubbleArea: PET_BUBBLE_AREA,
  windowHeight: getPetWindowHeight(),
}));

ipcMain.handle('pet:getPosition', () => {
  if (!petWindow) return { x: 0, y: 0 };
  const [x, y] = petWindow.getPosition();
  return { x, y };
});

ipcMain.on('pet:dragStart', (_event, screenX, screenY) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [x, y] = petWindow.getPosition();
  petDrag = {
    startMouse: { x: screenX, y: screenY },
    startWin: { x, y },
  };
});

ipcMain.on('pet:dragMove', (_event, screenX, screenY) => {
  if (!petDrag || !petWindow || petWindow.isDestroyed()) return;
  const dx = screenX - petDrag.startMouse.x;
  const dy = screenY - petDrag.startMouse.y;
  petWindow.setPosition(
    Math.round(petDrag.startWin.x + dx),
    Math.round(petDrag.startWin.y + dy),
  );
});

ipcMain.on('pet:dragEnd', () => {
  petDrag = null;
});

ipcMain.handle('pet:showContextMenu', () => {
  showPetContextMenu();
});

ipcMain.handle('pet:summon', () => {
  summonPet();
});

ipcMain.handle('pet:isVisible', () => isPetVisible());

ipcMain.handle('pet:ready', () => {
  syncPinToPet();
  if (petTimer && petTimer.isRunning()) {
    pushTimerToPet(getTimerTickPayload());
  }
  sendPetHop();
  if (pendingSummonGreeting) {
    pendingSummonGreeting = false;
    playGreetingVoiceline();
    return;
  }
  if (!hasPlayedStartupGreeting) {
    hasPlayedStartupGreeting = true;
    playGreetingVoiceline();
  }
});

ipcMain.handle('pet:playChatVoiceline', () => {
  const chat = getRandomChatVoiceline();
  if (chat) {
    playVoicelineFile(chat.filePath, chat.text);
  }
});

ipcMain.handle('pet:getPetState', () => {
  const settings = dataStore.settings.get();
  return {
    pinMessage: settings.pinMessage || '',
    timerVisible: settings.timerVisible !== false,
    timer: petTimer && petTimer.isRunning() ? getTimerTickPayload() : null,
  };
});

ipcMain.handle('pet:hideTimer', () => {
  dataStore.settings.update({ timerVisible: false });
  if (petTimer && petTimer.isRunning()) {
    pushTimerToPet({ ...getTimerTickPayload(), visible: false });
  }
});

ipcMain.handle('pet:submitPanel', (_event, payload) => {
  if (!payload || !payload.panel) {
    releasePetPanelFocus();
    return;
  }

  if (payload.panel === 'timer') {
    if (payload.type === 'pomodoro') {
      petTimer.startPomodoro(payload.workMin, payload.breakMin);
    } else {
      petTimer.startSimple(payload.minutes);
    }
    dataStore.settings.update({ timerVisible: true });
    releasePetPanelFocus();
    return;
  }

  if (payload.panel === 'name') {
    dataStore.settings.update({ petName: payload.name || '' });
    releasePetPanelFocus();
    return;
  }

  if (payload.panel === 'pin') {
    dataStore.settings.update({ pinMessage: payload.message || '' });
    syncPinToPet();
    releasePetPanelFocus();
  }
});

ipcMain.handle('pet:panelClosed', () => {
  releasePetPanelFocus();
});

ipcMain.handle('voiceline:setVolume', (_event, volume) => {
  const clamped = Math.min(1, Math.max(0, Number(volume) || 0));
  dataStore.settings.update({ voicelineVolume: clamped });
  broadcastVoicelineVolume(clamped);
  return clamped;
});

ipcMain.handle('audio:getSfxUrl', (_event, filename) => {
  const safeName = path.basename(filename);
  const fullPath = path.join(appRootPath, 'src', 'audio', 'sound effects', safeName);
  return pathToFileURL(fullPath).href;
});

ipcMain.handle('ui:getAssetUrl', (_event, relativePath) => {
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(appRootPath, 'assets', 'ui', safePath);
  return pathToFileURL(fullPath).href;
});

ipcMain.handle('book:getOpen', () => dataStore.settings.get().bookOpen ?? false);

ipcMain.handle('book:setOpen', (_event, open) => {
  const isOpen = Boolean(open);
  dataStore.settings.update({ bookOpen: isOpen });
  resizeMainWindowForBook(isOpen);
  return isOpen;
});

ipcMain.handle('app:quit', () => {
  quitApp();
});

ipcMain.handle('audio:getDefaultAlarmLabel', () => 'Columbina alarm (default)');
