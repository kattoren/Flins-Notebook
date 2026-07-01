const fs = require('fs');
const { FLINS_VOICELINE_MAX_VOLUME, DEFAULT_ALARM, LEVEL_UP_SFX } = require('../app/constants');
const { readAudioAsDataUrl, resolveSoundPath } = require('../scheduler/audioHelper');
const { getGreetingVoiceline, getVoicelinePayload } = require('../../assets/audio/voicelines');
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

function playVoicelineFile(ctx, filePath, text) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const payload = getVoicelinePayload(filePath);
  const settings = ctx.dataStore.settings.get();
  const dataUrl = readAudioAsDataUrl(filePath);
  const volume = getFlinsVoicelinePlayVolume(settings);

  ctx.sendToPetWindow('play-voiceline', {
    dataUrl,
    volume,
    text: text || payload.text,
    imageSrc: resolvePetImageSrc(payload.sprite),
  });
}

function playVoicelineSequence(ctx, voicelinePayloads) {
  if (!Array.isArray(voicelinePayloads) || !voicelinePayloads.length) return;

  const settings = ctx.dataStore.settings.get();
  const volume = getFlinsVoicelinePlayVolume(settings);
  const items = voicelinePayloads
    .filter((payload) => payload?.filePath && fs.existsSync(payload.filePath))
    .map((payload) => ({
      dataUrl: readAudioAsDataUrl(payload.filePath),
      volume,
      text: payload.text || '',
      imageSrc: resolvePetImageSrc(payload.sprite),
    }));

  if (!items.length) return;
  ctx.sendToPetWindow('play-voiceline-sequence', { items });
}

function playGreetingVoiceline(ctx) {
  const greeting = getGreetingVoiceline();
  if (greeting) {
    playVoicelineFile(ctx, greeting);
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

function playReminderAlarm(ctx, reminder) {
  const { formatReminderSpeech, formatTime12From24 } = require('../pet/petSpeak');
  const settings = ctx.dataStore.settings.get();
  const soundPath = resolveSoundPath(reminder.soundPath, DEFAULT_ALARM);

  ctx.speakPetMessage(
    formatReminderSpeech(settings, reminder, formatTime12From24(reminder.time)),
  );

  if (!fs.existsSync(soundPath)) {
    console.error('Alarm file not found:', soundPath);
    return;
  }

  const dataUrl = readAudioAsDataUrl(soundPath);
  const playCount = reminder.playCount ?? 1;
  const volume = settings.volume ?? 1;

  ctx.sendToAudioTarget('play-audio', { dataUrl, volume, playCount });
  ctx.sendToAudioTarget('pet:react');
}

function initAudioService(ctx) {
  ctx.getFlinsVoicelinePlayVolume = getFlinsVoicelinePlayVolume;
  ctx.broadcastVoicelineVolume = (userVolume) => broadcastVoicelineVolume(ctx, userVolume);
  ctx.playVoicelineFile = (filePath, text) => playVoicelineFile(ctx, filePath, text);
  ctx.playVoicelineSequence = (payloads) => playVoicelineSequence(ctx, payloads);
  ctx.playGreetingVoiceline = () => playGreetingVoiceline(ctx);
  ctx.playLevelUpSfx = () => playLevelUpSfx(ctx);
  ctx.playTimerAlarm = () => playTimerAlarm(ctx);
  ctx.playReminderAlarm = (reminder) => playReminderAlarm(ctx, reminder);
}

module.exports = { initAudioService };
