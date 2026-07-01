const path = require('path');
const fs = require('fs');

const VOICELINES_DIR = path.join(__dirname, 'voicelines');
const GREETING_VOICELINE = path.join(VOICELINES_DIR, 'flins_greeting.mp3');
const OPENING_VOICELINE = path.join(VOICELINES_DIR, 'flins_opening.mp3');

const DIALOGUE_LINES = {
  greeting: 'キリル・チュードミロヴィッチ・フリンズです——どうぞよろしく。',
  opening: 'どうぞよろしく。 ( ◠‿◠ )',
  patience: '人間の複雑さや多様性には、忍耐強く接するべきです。 少数の愚かで卑劣な者たちの行為に憤る必要などありません。',
  wild_hunt: '深淵を覗きたければ、ナド・クライの夜霧の中を歩むのがおすすめですよ。 ワイルドハントの行軍が、暗闇に引きずり込んでくれるでしょう。',
  ghosts: 'なぜ亡霊を怖がる必要が？彼らはただの話せる影ですよ。 ただ自分の過去を延々と語り続けることしかできません。',
  good_morning: 'おはようございます。 太陽がナド・クライを照らしていますね…これまで何百年もの間、そうしてきたように。',
  good_morning_teapot: 'おはようございます。 あなたの思いが実る 素敵な1日となりますように。 ( ◠‿◠ )',
  good_afternoon: 'こんにちは。 僕に昼寝の習慣はありませんが、仮眠を取りたいのであればどうぞ。 ( ◠‿◠ )',
  good_evening: '活動するなら、夜のほうが好きです。 ランプは暗闇を照らすためにあるものでしょう？ ( ◠‿◠ )',
  good_night: '夜こそが、僕の大切な時間です。 せっかく起きておられるなら、月が出ているうちに古い物語でもお聞かせしましょうか？',
  good_night_teapot: 'おやすみなさい。 良い夢を。( ◠‿◠ )',
  wind_blowing: '「風が目覚め、落ち葉を載せて旅に出る…」',
  favorite_food: '炎の中で沸騰する水を見たことはありますか？ —— 無いのですか…それは残念ですね。 スネージナヤには「炎水」というお酒があるのですが、そのお酒に火を点けると、炎が水の上で燃える様子を見ることができますよ。',
  hobbies: '古銭や古い宝石に興味はありますか？それそのものに価値があるというだけでなく、歳月の刻んだ痕跡はそれらを更に美しく魅せるんです。 長い時間をかけて熟成された美酒のように、趣があると思いませんか？',
  troubles: 'ピラミダ配属の同僚に優しい老紳士がいるのですが、よく僕の近況に関心を寄せる手紙を送ってくれるんです。 ただ、今の環境はとても快適なので、僕は改善の必要性を感じていません。',
  receiving_gift: 'あなたの才能を疑ったことなどありませんよ。 ( ◠‿◠ )',
  joining_party: '道案内しましょうか？ ( ◠‿◠ )',
  virtues: '慎重に、謙虚に、そして忠実に。 僕はライトキーパーが提唱する三つの美徳に賛同しています。',
  illuga: '「ライトキーパー」への加入は自由です。 多くの人が加入しては脱退していくので、よほど粘り強い人しか残らないのですが、彼はその残った一人です。 人間社会では頭の回転が速く機転が利く人が重宝されがちですが、僕は「ひたむきさ」の方が尊いと思いますね。',
  us_fae_and_humans: '気づけば、随分と長い距離を歩いてきましたね。 かつてフェイと人間がスネージナヤを自由に渡り歩いた時代を思い出します。 僕たちの間には共通点が多々ありますが、今は、優しい心の裏には同じような魂があるからだと思っています。',
};

const CHAT_TOPIC_BY_FRAGMENT = [
  ['about flins_virtues', 'virtues'],
  ['about illuga', 'illuga'],
  ['about us_fae and humans', 'us_fae_and_humans'],
  ['when the wind is blowing', 'wind_blowing'],
  ['favorite food', 'favorite_food'],
  ['good afternoon', 'good_afternoon'],
  ['good morning', 'good_morning'],
  ['good evening', 'good_evening'],
  ['good night', 'good_night'],
  ['receiving a gift', 'receiving_gift'],
  ['joining party', 'joining_party'],
  ['wild hunt', 'wild_hunt'],
  ['patience', 'patience'],
  ['ghosts', 'ghosts'],
  ['hobbies', 'hobbies'],
  ['troubles', 'troubles'],
];

const TIME_SLOT_TOPICS = {
  morning: ['good_morning', 'good_morning_teapot'],
  afternoon: ['good_afternoon'],
  night: ['good_evening', 'good_night', 'good_night_teapot'],
};

const ALL_TIME_TOPICS = new Set([
  ...TIME_SLOT_TOPICS.morning,
  ...TIME_SLOT_TOPICS.afternoon,
  ...TIME_SLOT_TOPICS.night,
]);

const IDLE_SPRITE = 'flins_idle.png';
const STICKER_FALLBACK_SPRITES = ['flins_bow.png', 'flins_night.png', 'flins_think.png'];

const SPRITE_BY_TOPIC = {
  greeting: 'flins_bow.png',
  opening: 'flins_bow.png',
  receiving_gift: 'flins_bow.png',
  patience: 'flins_think.png',
  wild_hunt: 'flins_night.png',
  ghosts: 'flins_angry.png',
  good_evening: 'flins_night.png',
  good_night: 'flins_night.png',
  good_night_teapot: 'flins_night.png',
};

const VOLUME_GAIN_BY_BASENAME = {
  'flins_teapot_good night': 1.85,
};

function getVolumeGainForFile(filePath) {
  const base = path.basename(filePath, '.mp3').toLowerCase();
  return VOLUME_GAIN_BY_BASENAME[base] ?? 1;
}

let lastChatVoicelinePath = null;
let lastOyaVoicelinePath = null;
let lastStickerFallbackSprite = null;

function getTimeSlot(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 3 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'night';
}

function getTopicForFile(filePath) {
  const base = path.basename(filePath, '.mp3').toLowerCase();
  if (base.startsWith('oya_')) return null;
  if (base === 'flins_greeting') return 'greeting';
  if (base === 'flins_opening') return 'opening';
  if (base.startsWith('flins_teapot_')) {
    const teapotPart = base.slice('flins_teapot_'.length);
    if (teapotPart === 'good morning') return 'good_morning_teapot';
    if (teapotPart === 'good night') return 'good_night_teapot';
    return null;
  }
  if (!base.startsWith('flins_chat_')) return null;

  const chatPart = base.slice('flins_chat_'.length);
  for (const [fragment, topic] of CHAT_TOPIC_BY_FRAGMENT) {
    if (chatPart === fragment) return topic;
  }
  return null;
}

function isTimeSpecificTopic(topic) {
  return ALL_TIME_TOPICS.has(topic);
}

function isChatFileAllowedForSlot(filePath, slot = getTimeSlot()) {
  const topic = getTopicForFile(filePath);
  if (!topic) return false;
  if (!isTimeSpecificTopic(topic)) return true;
  return TIME_SLOT_TOPICS[slot]?.includes(topic) ?? false;
}

function getDialogueForFile(filePath) {
  const base = path.basename(filePath, '.mp3').toLowerCase();
  if (base === 'oya_oya') return 'オヤ〜 オヤ〜';
  if (/^oya_\d+$/.test(base)) return 'オヤ';

  const topic = getTopicForFile(filePath);
  return topic ? DIALOGUE_LINES[topic] : '';
}

function pickStickerFallbackSprite() {
  if (STICKER_FALLBACK_SPRITES.length === 1) {
    return STICKER_FALLBACK_SPRITES[0];
  }
  let pick = STICKER_FALLBACK_SPRITES[Math.floor(Math.random() * STICKER_FALLBACK_SPRITES.length)];
  let guard = 0;
  while (pick === lastStickerFallbackSprite && guard < 8) {
    pick = STICKER_FALLBACK_SPRITES[Math.floor(Math.random() * STICKER_FALLBACK_SPRITES.length)];
    guard += 1;
  }
  lastStickerFallbackSprite = pick;
  return pick;
}

function getSpriteForFile(filePath, { petForm, forceSprite } = {}) {
  if (forceSprite) return forceSprite;

  const topic = getTopicForFile(filePath);
  if (!topic) {
    return petForm === 'sticker' ? pickStickerFallbackSprite() : IDLE_SPRITE;
  }
  if (SPRITE_BY_TOPIC[topic]) return SPRITE_BY_TOPIC[topic];
  if (petForm === 'sticker') return pickStickerFallbackSprite();
  return IDLE_SPRITE;
}

function listVoicelines(prefix) {
  if (!fs.existsSync(VOICELINES_DIR)) return [];
  return fs.readdirSync(VOICELINES_DIR)
    .filter((file) => file.startsWith(prefix) && file.toLowerCase().endsWith('.mp3'))
    .map((file) => path.join(VOICELINES_DIR, file))
    .sort();
}

function listChatVoicelines() {
  if (!fs.existsSync(VOICELINES_DIR)) return [];
  return fs.readdirSync(VOICELINES_DIR)
    .filter((file) => {
      const lower = file.toLowerCase();
      return lower.endsWith('.mp3')
        && (lower.startsWith('flins_chat_') || lower.startsWith('flins_teapot_'));
    })
    .map((file) => path.join(VOICELINES_DIR, file))
    .sort();
}

function getGreetingVoiceline() {
  return fs.existsSync(GREETING_VOICELINE) ? GREETING_VOICELINE : null;
}

function getOpeningVoiceline() {
  return fs.existsSync(OPENING_VOICELINE) ? OPENING_VOICELINE : null;
}

function getReceivingGiftVoiceline() {
  const files = listChatVoicelines().filter((filePath) => getTopicForFile(filePath) === 'receiving_gift');
  return files.length ? getVoicelinePayload(files[0]) : null;
}

function listOyaVoicelines() {
  return listVoicelines('oya_');
}

function pickRandomFile(files, lastPathRef) {
  if (!files.length) return null;
  if (files.length === 1) return files[0];
  let pick = files[Math.floor(Math.random() * files.length)];
  let guard = 0;
  while (pick === lastPathRef && guard < 16) {
    pick = files[Math.floor(Math.random() * files.length)];
    guard += 1;
  }
  return pick;
}

function getRandomOyaVoiceline(options = {}) {
  const filePath = pickRandomFile(listOyaVoicelines(), lastOyaVoicelinePath);
  if (!filePath) return null;
  lastOyaVoicelinePath = filePath;
  return getVoicelinePayload(filePath, { petForm: options.petForm });
}

function getRandomOyaTriple(options = {}) {
  const oyaFiles = listOyaVoicelines();
  if (!oyaFiles.length) return null;
  return Array.from({ length: 3 }, () => {
    const filePath = oyaFiles[Math.floor(Math.random() * oyaFiles.length)];
    return getVoicelinePayload(filePath, { petForm: options.petForm });
  });
}

function shouldPlayOyaTriple() {
  return Math.random() < 0.1;
}

function getRandomChatVoiceline(options = {}) {
  const slot = options.timeSlot || getTimeSlot();
  const petForm = options.petForm || null;
  const chats = listChatVoicelines().filter((filePath) => isChatFileAllowedForSlot(filePath, slot));
  const pool = [...chats, ...listOyaVoicelines()];

  const filePath = pickRandomFile(pool, lastChatVoicelinePath);
  if (!filePath) return null;
  lastChatVoicelinePath = filePath;
  return getVoicelinePayload(filePath, { petForm });
}

function getVoicelinePayload(filePath, options = {}) {
  return {
    filePath,
    text: getDialogueForFile(filePath),
    sprite: getSpriteForFile(filePath, options),
    volumeGain: getVolumeGainForFile(filePath),
  };
}

module.exports = {
  VOICELINES_DIR,
  GREETING_VOICELINE,
  OPENING_VOICELINE,
  IDLE_SPRITE,
  STICKER_FALLBACK_SPRITES,
  getTimeSlot,
  getGreetingVoiceline,
  getOpeningVoiceline,
  getReceivingGiftVoiceline,
  getRandomChatVoiceline,
  getRandomOyaVoiceline,
  getRandomOyaTriple,
  shouldPlayOyaTriple,
  getVoicelinePayload,
  getDialogueForFile,
  getSpriteForFile,
  getTopicForFile,
  getVolumeGainForFile,
};
