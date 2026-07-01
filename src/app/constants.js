const path = require('path');

const SRC_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(SRC_DIR, '..', 'assets');
const AUDIO_DIR = path.join(ASSETS_DIR, 'audio');
const PET_ASSETS_DIR = path.join(ASSETS_DIR, 'flins');
const PET_IDLE_IMAGE = path.join(PET_ASSETS_DIR, 'flins_idle.png');

module.exports = {
  SRC_DIR,
  ASSETS_DIR,
  AUDIO_DIR,
  PET_ASSETS_DIR,
  PET_IDLE_IMAGE,
  PET_ICON_IMAGE: PET_IDLE_IMAGE,
  PET_DEFAULT_FORM: 'gif',
  PET_FORM_ASSETS: {
    gif: 'flins_stand.gif',
    lantern: 'flins lantern.png',
    sticker: 'flins_idle.png',
  },
  DEFAULT_ALARM: path.join(AUDIO_DIR, 'alarm', 'alarm_columbina_end.mp3'),
  LEVEL_UP_SFX: path.join(AUDIO_DIR, 'sound effects', 'sfx_level up.mp3'),
  PET_MAX_SIZE: 240,
  PET_BUBBLE_GAP: 32,
  PET_BUBBLE_MAX_HEIGHT: 360,
  PET_BUBBLE_AREA: 32 + 360,
  FLINS_VOICELINE_MAX_VOLUME: 0.25,
};
