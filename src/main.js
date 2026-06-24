const { app, BrowserWindow, ipcMain, nativeImage, screen, Menu, Tray, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { initDataStore } = require('./store/dataStore');
const { registerDataIpc } = require('./ipc/dataHandlers');
const { startScheduler } = require('./scheduler/scheduler');
const { readAudioAsDataUrl, resolveSoundPath } = require('./scheduler/audioHelper');
const { getGreetingVoiceline, getRandomChatVoiceline, getVoicelinePayload } = require('./audio/voicelines');

const PET_ASSETS_DIR = path.join(__dirname, '..', 'assets', 'flins');
const PET_IDLE_IMAGE = path.join(PET_ASSETS_DIR, 'flins_idle.png');
const PET_ICON_IMAGE = path.join(PET_ASSETS_DIR, 'flins_bow.png');
const DEFAULT_ALARM = path.join(__dirname, 'audio', 'alarm', 'alarm_columbina_end.mp3');
const PET_MAX_SIZE = 240;
const PET_BUBBLE_GAP = 32;
const PET_BUBBLE_MAX_HEIGHT = 220;
const PET_BUBBLE_AREA = PET_BUBBLE_GAP + PET_BUBBLE_MAX_HEIGHT;

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
    dataStore = initDataStore(appPath, app.getPath('userData'), PET_IDLE_IMAGE);
    registerDataIpc(dataStore, () => mainWindow);

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

function resolvePetImageSrc(spriteFileName) {
  const filePath = path.join(PET_ASSETS_DIR, spriteFileName);
  const resolved = fs.existsSync(filePath) ? filePath : PET_IDLE_IMAGE;
  return pathToFileURL(resolved).href;
}

function scalePetSize(imageWidth, imageHeight) {
  const scale = Math.min(PET_MAX_SIZE / imageWidth, PET_MAX_SIZE / imageHeight);
  return {
    width: Math.round(imageWidth * scale),
    height: Math.round(imageHeight * scale),
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
  win.setMinimumSize(width, height);
  win.setMaximumSize(width, height);
  win.setContentSize(width, height);
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

function showPetContextMenu() {
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
      label: 'Close Notes',
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

function playVoicelineFile(filePath, text) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const payload = getVoicelinePayload(filePath);
  const settings = dataStore.settings.get();
  const dataUrl = readAudioAsDataUrl(filePath);
  const volume = settings.volume ?? 1;

  sendToPetWindow('play-voiceline', {
    dataUrl,
    volume,
    text: text || payload.text,
    imageSrc: resolvePetImageSrc(payload.sprite),
  });
}

function playGreetingVoiceline() {
  const greeting = getGreetingVoiceline();
  if (greeting) {
    playVoicelineFile(greeting);
  }
}

function summonPet() {
  if (!petWindow || petWindow.isDestroyed()) {
    createPetWindow();
    return;
  }

  const { x, y } = getDefaultPetPosition(petWidth, getPetWindowHeight());
  lockPetWindowSize(petWindow, petWidth, getPetWindowHeight());
  petWindow.setPosition(x, y);
  petWindow.show();
  petWindow.focus();
  notifyPetVisibility(true);
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

function createMainWindow() {
  const icon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    center: true,
    maximizable: false,
    frame: false,
    skipTaskbar: false,
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
  });
}

function createPetWindow() {
  const image = nativeImage.createFromPath(PET_IDLE_IMAGE);
  const { width: imageWidth, height: imageHeight } = image.getSize();
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
    useContentSize: true,
    transparent: true,
    frame: false,
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

  lockPetWindowSize(petWindow, petWidth, winH);
  petWindow.webContents.setVisualZoomLevelLimits(1, 1);
  setPetAlwaysOnTop(true);
  petWindow.loadFile(path.join(__dirname, 'renderer', 'pet', 'pet.html'));

  petWindow.once('ready-to-show', () => {
    lockPetWindowSize(petWindow, petWidth, winH);
    petWindow.show();
    notifyPetVisibility(true);
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

ipcMain.handle('pet:getImageSrc', () => pathToFileURL(PET_IDLE_IMAGE).href);

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

ipcMain.handle('pet:setPosition', (_event, x, y) => {
  if (petWindow) {
    petWindow.setPosition(Math.round(x), Math.round(y));
  }
});

ipcMain.handle('pet:showContextMenu', () => {
  showPetContextMenu();
});

ipcMain.handle('pet:summon', () => {
  summonPet();
});

ipcMain.handle('pet:isVisible', () => isPetVisible());

ipcMain.handle('pet:ready', () => {
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

ipcMain.handle('app:quit', () => {
  quitApp();
});

ipcMain.handle('audio:getDefaultAlarmLabel', () => 'Columbina alarm (default)');
