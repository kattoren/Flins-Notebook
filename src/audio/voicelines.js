const path = require('path');
const fs = require('fs');

const VOICELINES_DIR = path.join(__dirname, 'voicelines');
const GREETING_VOICELINE = path.join(VOICELINES_DIR, 'flins_greeting.mp3');

const DIALOGUE_LINES = {
  greeting: 'キリル・チュードミロヴィッチ・フリンズです——どうぞよろしく',
  patience: '人間の複雑さや多様性には、忍耐強く接するべきです。少数の愚かで卑劣な者たちの行為に憤る必要などありません。',
  wild_hunt: '深淵を覗きたければ、ナド・クライの夜霧の中を歩むのがおすすめですよ。ワイルドハントの行軍が、暗闇に引きずり込んでくれるでしょう。',
  ghosts: 'なぜ亡霊を怖がる必要が？彼らはただの話せる影ですよ。ただ自分の過去を延々と語り続けることしかできません。',
};

const IDLE_SPRITE = 'flins_idle.png';

const SPRITE_BY_TOPIC = {
  greeting: 'flins_bow.png',
  patience: 'flins_think.png',
  wild_hunt: 'flins_night.png',
  ghosts: 'flins_angry.png',
};

function getTopicForFile(filePath) {
  const base = path.basename(filePath, '.mp3').toLowerCase();
  if (base.includes('greeting')) return 'greeting';
  if (base.includes('patience')) return 'patience';
  if (base.includes('wild')) return 'wild_hunt';
  if (base.includes('ghost')) return 'ghosts';
  return null;
}

function getDialogueForFile(filePath) {
  const base = path.basename(filePath, '.mp3').toLowerCase();
  if (base === 'oya_oya') return 'オヤ〜 オヤ〜';
  if (/^oya_\d+$/.test(base)) return 'オヤ';

  const topic = getTopicForFile(filePath);
  return topic ? DIALOGUE_LINES[topic] : '';
}

function getSpriteForFile(filePath) {
  const topic = getTopicForFile(filePath);
  return topic ? SPRITE_BY_TOPIC[topic] : IDLE_SPRITE;
}

function listVoicelines(prefix) {
  if (!fs.existsSync(VOICELINES_DIR)) return [];
  return fs.readdirSync(VOICELINES_DIR)
    .filter((file) => file.startsWith(prefix) && file.toLowerCase().endsWith('.mp3'))
    .map((file) => path.join(VOICELINES_DIR, file))
    .sort();
}
function getGreetingVoiceline() {
  return fs.existsSync(GREETING_VOICELINE) ? GREETING_VOICELINE : null;
}

let lastChatVoicelinePath = null;

function pickRandomChatFile(files) {
  if (!files.length) return null;
  if (files.length === 1) return files[0];
  let pick = files[Math.floor(Math.random() * files.length)];
  let guard = 0;
  while (pick === lastChatVoicelinePath && guard < 16) {
    pick = files[Math.floor(Math.random() * files.length)];
    guard += 1;
  }
  lastChatVoicelinePath = pick;
  return pick;
}

function getRandomChatVoiceline() {
  const chats = [
    ...listVoicelines('flins_chat_'),
    ...listVoicelines('oya_'),
  ];
  const filePath = pickRandomChatFile(chats);
  if (!filePath) return null;
  return getVoicelinePayload(filePath);
}

function getVoicelinePayload(filePath) {
  return {
    filePath,
    text: getDialogueForFile(filePath),
    sprite: getSpriteForFile(filePath),
  };
}

module.exports = {
  VOICELINES_DIR,
  GREETING_VOICELINE,
  IDLE_SPRITE,
  getGreetingVoiceline,
  getRandomChatVoiceline,
  getVoicelinePayload,
  getDialogueForFile,
  getSpriteForFile,
};
