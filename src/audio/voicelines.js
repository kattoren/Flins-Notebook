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

function listVoicelines(prefix) {
  if (!fs.existsSync(VOICELINES_DIR)) return [];
  return fs.readdirSync(VOICELINES_DIR)
    .filter((file) => file.startsWith(prefix) && file.toLowerCase().endsWith('.mp3'))
    .map((file) => path.join(VOICELINES_DIR, file))
    .sort();
}

function getDialogueForFile(filePath) {
  const base = path.basename(filePath, '.mp3').toLowerCase();
  if (base.includes('greeting')) return DIALOGUE_LINES.greeting;
  if (base.includes('patience')) return DIALOGUE_LINES.patience;
  if (base.includes('wild')) return DIALOGUE_LINES.wild_hunt;
  if (base.includes('ghost')) return DIALOGUE_LINES.ghosts;
  return '';
}

function getGreetingVoiceline() {
  return fs.existsSync(GREETING_VOICELINE) ? GREETING_VOICELINE : null;
}

function getRandomChatVoiceline() {
  const chats = listVoicelines('flins_chat_');
  if (!chats.length) return null;
  const filePath = chats[Math.floor(Math.random() * chats.length)];
  return { filePath, text: getDialogueForFile(filePath) };
}

function getVoicelinePayload(filePath) {
  return { filePath, text: getDialogueForFile(filePath) };
}

module.exports = {
  VOICELINES_DIR,
  GREETING_VOICELINE,
  getGreetingVoiceline,
  getRandomChatVoiceline,
  getVoicelinePayload,
  getDialogueForFile,
};
