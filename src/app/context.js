const path = require('path');
const { PET_MAX_SIZE, PET_BUBBLE_AREA } = require('./constants');

function createAppContext(app) {
  return {
    app,
    mainWindow: null,
    petWindow: null,
    petPanelWindow: null,
    petPanelReady: false,
    pendingPetPanelOpen: null,
    tray: null,
    dataStore: null,
    petAlwaysOnTop: true,
    isQuitting: false,
    petWidth: 0,
    petHeight: 0,
    idleBubbleWidth: PET_MAX_SIZE,
    currentBubbleArea: PET_BUBBLE_AREA,
    audioWindow: null,
    stopScheduler: null,
    hasPlayedStartupGreeting: false,
    pendingSummonGreeting: false,
    petDrag: null,
    petTimer: null,
    appRootPath: null,

    getAppRootPath() {
      return this.appRootPath || path.join(__dirname, '..', '..');
    },
  };
}

module.exports = { createAppContext };
