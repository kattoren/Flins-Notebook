const LEVEL_THRESHOLDS = [1, 3, 5, 10, 25, 40, 50, 60, 70, 80, 90, 100];

function getLevelInfo(total) {
  let level = 0;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (total >= threshold) {
      level += 1;
    } else {
      break;
    }
  }

  const nextThreshold = LEVEL_THRESHOLDS[level] ?? null;
  if (nextThreshold === null) {
    return {
      level,
      total,
      untilNext: 0,
      progress: 1,
      isMax: true,
    };
  }

  const prevThreshold = level > 0 ? LEVEL_THRESHOLDS[level - 1] : 0;
  const untilNext = nextThreshold - total;
  const progress = Math.min(1, Math.max(0, (total - prevThreshold) / (nextThreshold - prevThreshold)));

  return {
    level,
    total,
    untilNext,
    progress,
    isMax: false,
    nextThreshold,
  };
}

module.exports = {
  LEVEL_THRESHOLDS,
  getLevelInfo,
};
