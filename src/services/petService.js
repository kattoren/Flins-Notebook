const { Menu } = require('electron');
const { PET_FORM_ASSETS, PET_BUBBLE_AREA } = require('../app/constants');
const { createPetTimer, formatRemaining } = require('../pet/petTimer');
const {
  formatPomodoroWorkTitle,
  formatPomodoroBreakTitle,
} = require('../pet/petSpeak');
const { pickAchievementLine, pickDailyAffirmation } = require('../../assets/audio/flinsLines');
const { getLevelInfo } = require('../utils/levels');
const { getReceivingGiftVoiceline } = require('../../assets/audio/voicelines');
const { sendToWindow } = require('../utils/windowMessaging');

const RECEIVING_GIFT_COOLDOWN_MS = 30000;
const STICKER_BOW_SPRITE = 'flins_bow.png';

function speakPetMessage(ctx, text, { hops = 1, autoDismissMs = 0 } = {}) {
  if (!ctx.isPetVisible() || !text) return;
  ctx.sendToPetWindow('pet:speak', { text, hops, autoDismissMs });
}

function stopPetAudio(ctx) {
  ctx.sendToPetWindow('stop-audio');
  if (ctx.audioWindow && !ctx.audioWindow.isDestroyed()) {
    sendToWindow(ctx.audioWindow, 'stop-audio');
  }
}

function getReceivingGiftOptions(ctx, { holdSpriteAfter = false } = {}) {
  if (ctx.getPetForm() !== 'sticker') return {};
  const options = { forceSprite: STICKER_BOW_SPRITE };
  if (holdSpriteAfter) {
    options.spriteHoldMs = 5000;
  }
  return options;
}

function tryPlayReceivingGift(ctx, { skipCooldown = false, holdSpriteAfter = false } = {}) {
  if (!ctx.isPetVisible()) return false;

  const now = Date.now();
  if (!skipCooldown && now - ctx.lastReceivingGiftAt < RECEIVING_GIFT_COOLDOWN_MS) {
    return false;
  }

  const voiceline = getReceivingGiftVoiceline();
  if (!voiceline) return false;

  ctx.lastReceivingGiftAt = now;
  ctx.playVoicelinePayload(voiceline, getReceivingGiftOptions(ctx, { holdSpriteAfter }));
  return true;
}

function handleAchievementCreated(ctx, { beforeCount, afterCount }) {
  if (!ctx.dataStore) return;

  const levelBefore = getLevelInfo(beforeCount).level;
  const levelAfter = getLevelInfo(afterCount).level;

  if (levelAfter > levelBefore) {
    ctx.playLevelUpSfx();
    tryPlayReceivingGift(ctx, { skipCooldown: true });
    return;
  }

  if (tryPlayReceivingGift(ctx, { holdSpriteAfter: true })) {
    return;
  }

  const settings = ctx.dataStore.settings.get();
  const { key, text } = pickAchievementLine(settings.lastAchievementLineKey || null);
  if (key) {
    ctx.dataStore.settings.update({ lastAchievementLineKey: key });
  }
  speakPetMessage(ctx, text, { hops: 1, autoDismissMs: 10000 });
}

function getDailyAffirmationText(ctx) {
  const settings = ctx.dataStore.settings.get();
  const picked = pickDailyAffirmation(settings);
  if (picked.key && picked.date) {
    ctx.dataStore.settings.update({
      dailyAffirmationDate: picked.date,
      dailyAffirmationKey: picked.key,
    });
  }
  return picked.text || '';
}

function syncPinToPet(ctx) {
  if (!ctx.dataStore) return;
  const { pinMessage } = ctx.dataStore.settings.get();
  ctx.sendToPetWindow('pet:pinMessage', { text: pinMessage || '' });
}

function pushTimerToPet(ctx, tick) {
  if (!ctx.dataStore) return;
  const settings = ctx.dataStore.settings.get();
  const { timerVisible } = settings;
  let title = 'TIMER';
  if (tick.type === 'pomodoro') {
    title = tick.phase === 'break'
      ? formatPomodoroBreakTitle(settings)
      : formatPomodoroWorkTitle(settings);
  }
  ctx.sendToPetWindow('pet:timerTick', {
    ...tick,
    title,
    visible: timerVisible !== false,
  });
}

function getTimerTickPayload(ctx) {
  if (!ctx.petTimer || !ctx.petTimer.isRunning()) {
    return { running: false, display: '0:00', phase: '', type: '' };
  }
  const state = ctx.petTimer.getState();
  const remaining = state.endAt - Date.now();
  return {
    display: formatRemaining(remaining),
    phase: state.phase,
    type: state.type,
    running: remaining > 0,
  };
}

function endPetTimer(ctx) {
  if (ctx.petTimer) {
    ctx.petTimer.stop();
  }
  ctx.dataStore.settings.update({ timerVisible: false });
  pushTimerToPet(ctx, { running: false, display: '0:00', phase: '', type: '' });
}

function initPetTimer(ctx) {
  ctx.petTimer = createPetTimer({
    onTick: (tick) => pushTimerToPet(ctx, tick),
    onBreakStart: () => {},
    onTimerComplete: () => {
      ctx.playTimerAlarm();
    },
    onPhaseEnd: () => {},
    onStop: () => pushTimerToPet(ctx, { running: false, display: '0:00' }),
  });
}

function showPetTimer(ctx) {
  ctx.dataStore.settings.update({ timerVisible: true });
  pushTimerToPet(ctx, getTimerTickPayload(ctx));
}

function setPetForm(ctx, form) {
  if (!PET_FORM_ASSETS[form]) return;
  ctx.dataStore.settings.update({ petForm: form });
  ctx.notifyPetFormChanged(form);
}

function showPetContextMenu(ctx) {
  const settings = ctx.dataStore.settings.get();
  const timerRunning = ctx.petTimer && ctx.petTimer.isRunning();
  const timerHidden = settings.timerVisible === false;
  const hasPin = Boolean((settings.pinMessage || '').trim());

  const menuItems = [
    {
      label: 'Timer',
      click: () => ctx.openPetPanel('timer'),
    },
  ];

  if (timerRunning && timerHidden) {
    menuItems.push({
      label: 'Show timer',
      click: () => showPetTimer(ctx),
    });
  }

  if (timerRunning) {
    menuItems.push({
      label: 'End timer',
      click: () => endPetTimer(ctx),
    });
  }

  menuItems.push({
    label: 'Pin message',
    click: () => ctx.openPetPanel('pin', { message: settings.pinMessage || '' }),
  });

  if (hasPin) {
    menuItems.push({
      label: 'Clear pin message',
      click: () => {
        ctx.dataStore.settings.update({ pinMessage: '' });
        syncPinToPet(ctx);
      },
    });
  }

  menuItems.push(
    { type: 'separator' },
    {
      label: 'Flins options',
      submenu: [
        {
          label: 'Flins GIF',
          type: 'radio',
          checked: ctx.getPetForm() === 'gif',
          click: () => setPetForm(ctx, 'gif'),
        },
        {
          label: 'Lantern',
          type: 'radio',
          checked: ctx.getPetForm() === 'lantern',
          click: () => setPetForm(ctx, 'lantern'),
        },
        {
          label: 'Sticker',
          type: 'radio',
          checked: ctx.getPetForm() === 'sticker',
          click: () => setPetForm(ctx, 'sticker'),
        },
        { type: 'separator' },
        {
          label: 'Oya mode',
          type: 'checkbox',
          checked: settings.oyaMode === true,
          click: (menuItem) => ctx.dataStore.settings.update({ oyaMode: menuItem.checked }),
        },
        { type: 'separator' },
        {
          label: 'Set name',
          click: () => ctx.openPetPanel('name', { name: settings.petName || '' }),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Dismiss',
      click: () => dismissPet(ctx),
    },
    {
      label: 'Stay on seme ( ◠‿◠ )',
      type: 'checkbox',
      checked: ctx.petAlwaysOnTop,
      click: (menuItem) => ctx.setPetAlwaysOnTop(menuItem.checked),
    },
    { type: 'separator' },
    {
      label: 'Open book',
      click: () => ctx.openBookWindow(),
    },
    { type: 'separator' },
    {
      label: 'Close book',
      click: () => ctx.quitApp(),
    },
  );

  const menu = Menu.buildFromTemplate(menuItems);
  menu.popup({ window: ctx.petWindow });
}

function dismissPet(ctx) {
  stopPetAudio(ctx);
  if (ctx.petWindow && !ctx.petWindow.isDestroyed()) {
    ctx.petWindow.hide();
  }
  ctx.notifyPetVisibility(false);
}

function sendPetHop(ctx) {
  ctx.sendToPetWindow('pet:hop');
}

function showSummonedPet(ctx) {
  ctx.notifyPetFormChanged(ctx.getPetForm());
  const layout = ctx.repositionPetWindow(PET_BUBBLE_AREA);
  if (layout && ctx.petWidth > 0 && layout.height > 0) {
    ctx.lockPetWindowSize(ctx.petWindow, layout.width, layout.height);
    ctx.petWindow.setPosition(layout.x, layout.y);
  }
  ctx.petWindow.show();
  ctx.notifyPetVisibility(true);
  ctx.playOpeningVoiceline();
}

function summonPet(ctx) {
  if (!ctx.petWindow || ctx.petWindow.isDestroyed()) {
    ctx.pendingSummonOpening = true;
    ctx.createPetWindow();
    return;
  }

  showSummonedPet(ctx);
}

function initPetService(ctx) {
  ctx.speakPetMessage = (text, opts) => speakPetMessage(ctx, text, opts);
  ctx.stopPetAudio = () => stopPetAudio(ctx);
  ctx.handleAchievementCreated = (payload) => handleAchievementCreated(ctx, payload);
  ctx.getDailyAffirmationText = () => getDailyAffirmationText(ctx);
  ctx.syncPinToPet = () => syncPinToPet(ctx);
  ctx.pushTimerToPet = (tick) => pushTimerToPet(ctx, tick);
  ctx.getTimerTickPayload = () => getTimerTickPayload(ctx);
  ctx.endPetTimer = () => endPetTimer(ctx);
  ctx.initPetTimer = () => initPetTimer(ctx);
  ctx.showPetTimer = () => showPetTimer(ctx);
  ctx.setPetForm = (form) => setPetForm(ctx, form);
  ctx.showPetContextMenu = () => showPetContextMenu(ctx);
  ctx.dismissPet = () => dismissPet(ctx);
  ctx.sendPetHop = () => sendPetHop(ctx);
  ctx.summonPet = () => summonPet(ctx);
}

module.exports = { initPetService };
