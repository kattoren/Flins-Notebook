const FLINS_LINES = {
  levelUp: {
    level_1: 'And so the first flame catches. A modest light, perhaps, but every blaze worth the name begins with a single spark. Welcome.',
    level_2: 'Level two already. You hold the lamp with a steadier hand than most who\'ve tried. Do go on.',
    level_3: 'Three. You keep showing up and getting it done, and I\'ve come to count on seeing it.',
    level_4: 'Four levels now. There\'s a steadiness to the way you work that I\'ve quietly come to respect.',
    level_5: 'Five. You move through your tasks with an ease that\'s a pleasure to watch. Keep at it.',
    level_6: 'The halfway mark. Pause a moment and look behind you. Quite a trail you\'ve left behind, isn\'t it?',
    level_7: 'Seven. Past the midpoint, and your pace hasn\'t faltered. That, I\'ve learned over the centuries, is the rarest thing of all.',
    level_8: 'Level eight. We\'ve reached thinner air, where most turn back. That you press on tells me exactly the sort of person you are.',
    level_9: 'Nine. The summit is nearly within reach. I\'d offer you my arm for the climb, but you seem to need no such thing.',
    level_10: 'Ten levels. I\'ve watched a great many come and go, and few ever see it through the way you have.',
    level_11: 'Eleven. One step shy of the peak. Hold the light steady now. The view from here is worth savoring.',
    level_12: 'The top, at last. You made it. I won\'t pretend I didn\'t hope you would, but seeing it is something else entirely. Hope is a quiet thing; this is not. The honor, truly, is mine.',
  },
  achievement: {
    achievement_1: 'Another one done, and done well. ( ◠‿◠ )',
    achievement_2: 'Mm. Noted, and quietly admired.',
    achievement_3: 'You make it look effortless, though I doubt it was. Well done. ( ◠‿◠ )',
    achievement_4: 'One more done. You\'ve a habit of following through, and it serves you well.',
    achievement_5: 'Splendid. You\'ve a knack for seeing things through, and it suits you. ( ◠‿◠ )',
    achievement_6: 'Logged. You\'ve a talent for finishing things, you know. Few do.',
  },
  affirmation: {
    affirmation_1: 'Whatever you\'ve set your mind to, you\'ve the will to see it through. I\'ve watched you do it enough to be sure. —— Flins',
    affirmation_2: 'Begin where you stand. The light only ever has to reach the next step, not the whole road. —— Flins',
    affirmation_3: 'You needn\'t rush. Even the longest night gives way to morning, in time. —— Flins',
    affirmation_4: 'Doubt visits everyone. It need not be invited to stay. —— Flins',
    affirmation_5: 'Small things, done faithfully, become large things. I\'ve watched it happen more times than I can count. —— Flins',
    affirmation_6: 'You\'re more capable than you give yourself credit for. Your track record rather speaks for itself. —— Flins',
    affirmation_7: 'Rest when you must. A lamp that never dims is a lamp that burns out. —— Flins',
    affirmation_8: 'The hard days pass, same as the easy ones. Keep your hand steady. —— Flins',
    affirmation_9: 'Not every step needs to be grand. Forward is forward. —— Flins',
    affirmation_10: 'Trust the version of you that started this. They knew something worth knowing.',
    affirmation_11: 'Hmm. Whatever you\'re facing, you needn\'t face it alone. You\'ve got more in your corner than you think. —— Flins',
    affirmation_12: 'Hold your own light. It has carried you this far, and it will carry you further yet. —— Flins',
  },
};

function pickRandomKey(keys, excludeKey) {
  if (!keys.length) return null;
  if (keys.length === 1) return keys[0];
  let pick = keys[Math.floor(Math.random() * keys.length)];
  let guard = 0;
  while (pick === excludeKey && guard < 24) {
    pick = keys[Math.floor(Math.random() * keys.length)];
    guard += 1;
  }
  return pick;
}

function getLevelUpLine(level) {
  const clamped = Math.min(12, Math.max(1, level));
  return FLINS_LINES.levelUp[`level_${clamped}`] || '';
}

function pickAchievementLine(excludeKey) {
  const keys = Object.keys(FLINS_LINES.achievement);
  const key = pickRandomKey(keys, excludeKey);
  if (!key) return { key: null, text: '' };
  return { key, text: FLINS_LINES.achievement[key] };
}

function formatDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickDailyAffirmation(settings) {
  const today = formatDateKey();
  const affirmationKeys = Object.keys(FLINS_LINES.affirmation);

  if (settings.dailyAffirmationDate === today && settings.dailyAffirmationKey) {
    const text = FLINS_LINES.affirmation[settings.dailyAffirmationKey];
    if (text) return { key: settings.dailyAffirmationKey, text, date: today };
  }

  const excludeKey = settings.dailyAffirmationKey || null;
  const key = pickRandomKey(affirmationKeys, excludeKey);
  const text = key ? FLINS_LINES.affirmation[key] : '';
  return { key, text, date: today };
}

module.exports = {
  FLINS_LINES,
  getLevelUpLine,
  pickAchievementLine,
  pickDailyAffirmation,
};
