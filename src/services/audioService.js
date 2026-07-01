const fs = require('fs');
const { FLINS_VOICELINE_MAX_VOLUME, DEFAULT_ALARM, LEVEL_UP_SFX } = require('../app/constants');
const { readAudioAsDataUrl, resolveSoundPath } = require('../scheduler/audioHelper');
const { getGreetingVoiceline, getOpeningVoiceline, getVoicelinePayload } = require('../../assets/audio/voicelines');
const { resolvePetImageSrc } = require('../utils/petAssets');

function getFlinsVoicelinePlayVolume(settingsOrUserVolume) {
  const userVolume = typeof settingsOrUserVolume === 'object' && settingsOrUserVolume !== null
    ? settingsOrUserVolume.voicelineVolume ?? 0.25
    : settingsOrUserVolume;
  const clamped = Math.min(1, Math.max(0, Number(userVolume) || 0));
  return clamped * FLINS_VOICELINE_MAX_VOLUME;
}

function broadcastVoicelineVolume(ctx, userVolume) {
  ctx.sendToPetWindow('voiceline-volume', getFlinsVoicelinePlayVolume(userVolume));
}

function playVoicelineFile(ctx, filePath, text, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const petForm = ctx.getPetForm();
  const payload = getVoicelinePayload(filePath, {
    petForm,
    forceSprite: options.forceSprite || null,
  });
  const settings = ctx.dataStore.settings.get();
  const dataUrl = readAudioAsDataUrl(filePath);
  const volume = getFlinsVoicelinePlayVolume(settings);
  const sprite = options.forceSprite || payload.sprite;

  ctx.sendToPetWindow('play-voiceline', {
    dataUrl,
    volume,
    text: text || payload.text,
    imageSrc: resolvePetImageSrc(sprite),
    spriteHoldMs: options.spriteHoldMs || 0,
  });
}

function playVoicelinePayload(ctx, voicelinePayload, options = {}) {
  if (!voicelinePayload?.filePath) return;
  const petForm = ctx.getPetForm();
  const resolved = getVoicelinePayload(voicelinePayload.filePath, {
    petForm,
    forceSprite: options.forceSprite || null,
  });
  playVoicelineFile(ctx, voicelinePayload.filePath, voicelinePayload.text, {
    forceSprite: options.forceSprite || resolved.sprite,
    spriteHoldMs: options.spriteHoldMs,
  });
}

function playVoicelineSequence(ctx, voicelinePayloads) {
  if (!Array.isArray(voicelinePayloads) || !voicelinePayloads.length) return;

  const petForm = ctx.getPetForm();
  const settings = ctx.dataStore.settings.get();
  const volume = getFlinsVoicelinePlayVolume(settings);
  const items = voicelinePayloads
    .filter((payload) => payload?.filePath && fs.existsSync(payload.filePath))
    .map((payload) => {
      const sprite = getVoicelinePayload(payload.filePath, { petForm }).sprite;
      return {
        dataUrl: readAudioAsDataUrl(payload.filePath),
        volume,
        text: payload.text || '',
        imageSrc: resolvePetImageSrc(sprite),
      };
    });

  if (!items.length) return;
  ctx.sendToPetWindow('play-voiceline-sequence', { items });
}

function playGreetingVoiceline(ctx) {
  const greeting = getGreetingVoiceline();
  if (greeting) {
    playVoicelineFile(ctx, greeting);
  }
}

function playOpeningVoiceline(ctx) {
  const opening = getOpeningVoiceline();
  if (opening) {
    playVoicelineFile(ctx, opening);
  }
}

function playLevelUpSfx(ctx) {
  if (!fs.existsSync(LEVEL_UP_SFX)) return;
  const settings = ctx.dataStore.settings.get();
  const dataUrl = readAudioAsDataUrl(LEVEL_UP_SFX);
  const volume = getFlinsVoicelinePlayVolume(settings);
  ctx.sendToAudioTarget('play-audio', { dataUrl, volume, playCount: 1 });
}

function playTimerAlarm(ctx) {
  const settings = ctx.dataStore.settings.get();
  const soundPath = resolveSoundPath(settings.timerSoundPath, DEFAULT_ALARM);

  if (!fs.existsSync(soundPath)) {
    console.error('Timer alarm file not found:', soundPath);
    return;
  }

  const dataUrl = readAudioAsDataUrl(soundPath);
  const playCount = settings.timerPlayCount ?? 1;
  const volume = settings.volume ?? 1;

  ctx.sendToAudioTarget('play-audio', { dataUrl, volume, playCount });
  if (ctx.isPetVisible()) {
    ctx.sendToAudioTarget('pet:react');
  }
}

function playAlarmOnce(ctx, soundPath, { preserveSpeech = false } = {}) {
  const settings = ctx.dataStore.settings.get();
  const resolved = resolveSoundPath(soundPath, DEFAULT_ALARM);

  if (!fs.existsSync(resolved)) {
    console.error('Alarm file not found:', resolved);
    return;
  }

  const dataUrl = readAudioAsDataUrl(resolved);
  const volume = settings.volume ?? 1;
  ctx.sendToAudioTarget('play-audio', { dataUrl, volume, playCount: 1, preserveSpeech });
}

function playReminderAlarm(ctx, reminder) {
  const { formatReminderSpeech } = require('../pet/petSpeak');
  const settings = ctx.dataStore.settings.get();
  const soundPath = resolveSoundPath(reminder.soundPath, DEFAULT_ALARM);

  ctx.speakPetMessage(formatReminderSpeech(settings, reminder), { autoDismissMs: 30000 });

  if (!fs.existsSync(soundPath)) {
    console.error('Alarm file not found:', soundPath);
    return;
  }

  const dataUrl = readAudioAsDataUrl(soundPath);
  const playCount = reminder.playCount ?? 1;
  const volume = settings.volume ?? 1;

  ctx.sendToAudioTarget('play-audio', { dataUrl, volume, playCount, preserveSpeech: true });
  ctx.sendToAudioTarget('pet:react');
}

function initAudioService(ctx) {
  ctx.getFlinsVoicelinePlayVolume = getFlinsVoicelinePlayVolume;
  ctx.broadcastVoicelineVolume = (userVolume) => broadcastVoicelineVolume(ctx, userVolume);
  ctx.playVoicelineFile = (filePath, text, options) => playVoicelineFile(ctx, filePath, text, options);
  ctx.playVoicelinePayload = (payload, options) => playVoicelinePayload(ctx, payload, options);
  ctx.playVoicelineSequence = (payloads) => playVoicelineSequence(ctx, payloads);
  ctx.playGreetingVoiceline = () => playGreetingVoiceline(ctx);
  ctx.playOpeningVoiceline = () => playOpeningVoiceline(ctx);
  ctx.playLevelUpSfx = () => playLevelUpSfx(ctx);
  ctx.playAlarmOnce = (soundPath, options) => playAlarmOnce(ctx, soundPath, options);
  ctx.playTimerAlarm = () => playTimerAlarm(ctx);
  ctx.playReminderAlarm = (reminder) => playReminderAlarm(ctx, reminder);
}

module.exports = { initAudioService };
