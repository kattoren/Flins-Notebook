const path = require('path');
const fs = require('fs');
const { ipcMain } = require('electron');
const { pathToFileURL } = require('url');
const { PET_BUBBLE_GAP, PET_BUBBLE_AREA, DEFAULT_ALARM } = require('../app/constants');
const { readAudioAsDataUrl, resolveSoundPath } = require('../scheduler/audioHelper');
const {
  getRandomChatVoiceline,
  getRandomOyaVoiceline,
  getRandomOyaTriple,
  shouldPlayOyaTriple,
} = require('../../assets/audio/voicelines');

function registerPetIpc(ctx) {
  ipcMain.handle('pet:getRoamMode', () => false);

  ipcMain.handle('pet:getPetForm', () => ctx.getPetForm());

  ipcMain.handle('pet:getImageSrc', () => ctx.getPetFormImageSrc());

  ipcMain.handle('pet:getDimensions', () => {
    const layout = ctx.getPetWindowLayout(ctx.currentBubbleArea);
    return {
      width: ctx.petWidth,
      height: ctx.petHeight,
      bubbleWidth: ctx.idleBubbleWidth,
      bubbleArea: ctx.currentBubbleArea,
      windowWidth: layout.width,
      windowHeight: layout.height,
    };
  });

  ipcMain.handle('pet:resizeForContent', (_event, { bubbleArea }) => {
    if (!ctx.petWindow || ctx.petWindow.isDestroyed()) return null;
    const nextArea = Math.max(
      PET_BUBBLE_GAP + 48,
      Math.min(Number(bubbleArea) || PET_BUBBLE_AREA, 720),
    );
    ctx.currentBubbleArea = nextArea;
    const width = ctx.getPetWindowWidth();
    const newHeight = ctx.getPetWindowHeight(nextArea);
    const [x, y] = ctx.petWindow.getPosition();
    const [, oldH] = ctx.petWindow.getContentSize();
    const bottom = y + oldH;
    const newY = Math.round(bottom - newHeight);
    ctx.lockPetWindowSize(ctx.petWindow, width, newHeight);
    ctx.petWindow.setPosition(x, newY);
    ctx.sendToPetWindow('pet:contentResized', {
      windowWidth: width,
      windowHeight: newHeight,
      bubbleArea: nextArea,
    });
    return { x, y: newY, width, height: newHeight, bubbleArea: nextArea };
  });

  ipcMain.handle('pet:getTimerDefaults', () => {
    const settings = ctx.dataStore.settings.get();
    return {
      soundPath: settings.timerSoundPath || '',
      playCount: settings.timerPlayCount ?? 1,
    };
  });

  ipcMain.handle('pet:panelReady', () => {
    ctx.setPetPanelReady(true);
    ctx.flushPendingPetPanelOpen();
  });

  ipcMain.handle('pet:getPosition', () => {
    if (!ctx.petWindow) return { x: 0, y: 0 };
    const [x, y] = ctx.petWindow.getPosition();
    return { x, y };
  });

  ipcMain.on('pet:dragStart', (_event, screenX, screenY) => {
    if (!ctx.petWindow || ctx.petWindow.isDestroyed()) return;
    const [x, y] = ctx.petWindow.getPosition();
    ctx.petDrag = {
      startMouse: { x: screenX, y: screenY },
      startWin: { x, y },
    };
  });

  ipcMain.on('pet:dragMove', (_event, screenX, screenY) => {
    if (!ctx.petDrag || !ctx.petWindow || ctx.petWindow.isDestroyed()) return;
    const dx = screenX - ctx.petDrag.startMouse.x;
    const dy = screenY - ctx.petDrag.startMouse.y;
    ctx.petWindow.setPosition(
      Math.round(ctx.petDrag.startWin.x + dx),
      Math.round(ctx.petDrag.startWin.y + dy),
    );
  });

  ipcMain.on('pet:dragEnd', () => {
    ctx.petDrag = null;
  });

  ipcMain.handle('pet:showContextMenu', () => {
    ctx.showPetContextMenu();
  });

  ipcMain.handle('pet:summon', () => {
    ctx.summonPet();
  });

  ipcMain.handle('pet:isVisible', () => ctx.isPetVisible());

  ipcMain.handle('pet:ready', () => {
    ctx.syncPinToPet();
    const settings = ctx.dataStore.settings.get();
    ctx.broadcastVoicelineVolume(settings.voicelineVolume ?? 0.25);
    if (ctx.petTimer && ctx.petTimer.isRunning()) {
      ctx.pushTimerToPet(ctx.getTimerTickPayload());
    }
    ctx.sendPetHop();
    if (ctx.pendingSummonGreeting) {
      ctx.pendingSummonGreeting = false;
      ctx.playGreetingVoiceline();
      return;
    }
    if (!ctx.hasPlayedStartupGreeting) {
      ctx.hasPlayedStartupGreeting = true;
      ctx.playGreetingVoiceline();
    }
  });

  ipcMain.handle('pet:playChatVoiceline', () => {
    const settings = ctx.dataStore.settings.get();
    if (settings.oyaMode) {
      const oya = getRandomOyaVoiceline();
      if (oya) {
        ctx.playVoicelineFile(oya.filePath, oya.text);
      }
      return;
    }

    if (shouldPlayOyaTriple()) {
      const triple = getRandomOyaTriple();
      if (triple?.length === 3) {
        ctx.playVoicelineSequence(triple);
        return;
      }
    }

    const chat = getRandomChatVoiceline();
    if (chat) {
      ctx.playVoicelineFile(chat.filePath, chat.text);
    }
  });

  ipcMain.handle('pet:getPetState', () => {
    const settings = ctx.dataStore.settings.get();
    return {
      pinMessage: settings.pinMessage || '',
      timerVisible: settings.timerVisible !== false,
      timer: ctx.petTimer && ctx.petTimer.isRunning() ? ctx.getTimerTickPayload() : null,
    };
  });

  ipcMain.handle('pet:hideTimer', () => {
    ctx.dataStore.settings.update({ timerVisible: false });
    if (ctx.petTimer && ctx.petTimer.isRunning()) {
      ctx.pushTimerToPet({ ...ctx.getTimerTickPayload(), visible: false });
    }
  });

  ipcMain.handle('pet:submitPanel', (_event, payload) => {
    if (!payload || !payload.panel) {
      ctx.releasePetPanelFocus();
      return;
    }

    if (payload.panel === 'timer') {
      ctx.dataStore.settings.update({
        timerSoundPath: payload.soundPath || '',
        timerPlayCount: payload.playCount ?? 1,
      });
      if (payload.type === 'pomodoro') {
        ctx.petTimer.startPomodoro(payload.workSeconds, payload.breakSeconds, payload.cycles);
      } else {
        ctx.petTimer.startSimple(payload.totalSeconds);
      }
      ctx.dataStore.settings.update({ timerVisible: true });
      ctx.pushTimerToPet(ctx.getTimerTickPayload());
      ctx.releasePetPanelFocus();
      return;
    }

    if (payload.panel === 'name') {
      ctx.dataStore.settings.update({ petName: payload.name || '' });
      ctx.releasePetPanelFocus();
      return;
    }

    if (payload.panel === 'pin') {
      ctx.dataStore.settings.update({ pinMessage: payload.message || '' });
      ctx.syncPinToPet();
      ctx.releasePetPanelFocus();
    }
  });

  ipcMain.handle('pet:panelClosed', () => {
    ctx.releasePetPanelFocus();
  });
}

module.exports = { registerPetIpc };
