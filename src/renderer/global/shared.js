const LEVEL_THRESHOLDS = [1, 3, 5, 10, 25, 40, 50, 60, 70, 80, 90, 100];

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDateTime(epochMs) {
  return new Date(epochMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

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

function reminderMatchesDay(reminder, date) {
  const day = date.getDay();
  const dateStr = formatDate(date);

  switch (reminder.repeat) {
    case 'once':
      return reminder.date === dateStr;
    case 'daily':
      return true;
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekends':
      return day === 0 || day === 6;
    case 'weekly':
    case 'custom':
      return reminder.days.includes(day);
    default:
      return false;
  }
}

function getRemindersForDay(allReminders, date) {
  return allReminders
    .filter((r) => reminderMatchesDay(r, date))
    .sort((a, b) => a.time.localeCompare(b.time));
}

function isReminderSkippedOnDay(reminder, date) {
  const skipped = reminder.skippedDates || [];
  return skipped.includes(formatDate(date));
}

function isReminderActiveOnDay(reminder, date) {
  if (!reminder.enabled) return false;
  return !isReminderSkippedOnDay(reminder, date);
}

function countWeekOccurrences(reminder, referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  let count = 0;
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    if (reminderMatchesDay(reminder, day)) {
      count += 1;
    }
  }
  return count;
}

function getUpcomingToday(allReminders) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return getRemindersForDay(allReminders, now)
    .filter((r) => isReminderActiveOnDay(r, now))
    .filter((r) => {
      const [h, m] = r.time.split(':').map(Number);
      return h * 60 + m >= nowMinutes;
    });
}

window.AppShared = {
  LEVEL_THRESHOLDS,
  DAY_NAMES: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  DAY_SHORT: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  escapeHtml,
  formatDate,
  formatDisplayDate,
  formatTime12,
  formatDateTime,
  getLevelInfo,
  reminderMatchesDay,
  isReminderSkippedOnDay,
  isReminderActiveOnDay,
  countWeekOccurrences,
  getRemindersForDay,
  getUpcomingToday,
};
