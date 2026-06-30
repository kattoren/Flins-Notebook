function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTimeLocal(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function reminderMatchesDay(reminder, date) {
  const day = date.getDay();
  const dateStr = formatDateLocal(date);

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
      return Array.isArray(reminder.days) && reminder.days.includes(day);
    default:
      return false;
  }
}

function minutesToTime24(totalMinutes) {
  const wrapped = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function firedInSameMinute(lastFiredAt, now) {
  if (!lastFiredAt) return false;
  const last = new Date(lastFiredAt);
  return (
    last.getFullYear() === now.getFullYear()
    && last.getMonth() === now.getMonth()
    && last.getDate() === now.getDate()
    && last.getHours() === now.getHours()
    && last.getMinutes() === now.getMinutes()
  );
}

function isSkippedOnDay(reminder, date) {
  const skipped = Array.isArray(reminder.skippedDates) ? reminder.skippedDates : [];
  return skipped.includes(formatDateLocal(date));
}

function shouldFireReminder(reminder, now) {
  if (!reminder.enabled) return false;
  if (isSkippedOnDay(reminder, now)) return false;
  if (reminder.time !== formatTimeLocal(now)) return false;
  if (!reminderMatchesDay(reminder, now)) return false;
  if (firedInSameMinute(reminder.lastFiredAt, now)) return false;
  return true;
}

function shouldFirePreAlert(reminder, now) {
  const minutes = Number(reminder.preAlertMinutes);
  if (!reminder.enabled || !minutes || minutes <= 0) return false;
  if (isSkippedOnDay(reminder, now)) return false;
  if (!reminderMatchesDay(reminder, now)) return false;
  if (firedInSameMinute(reminder.lastPreAlertFiredAt, now)) return false;

  const [h, m] = reminder.time.split(':').map(Number);
  const targetMinutes = h * 60 + m - minutes;
  const nowTime = formatTimeLocal(now);
  const alertTime = minutesToTime24(targetMinutes);
  return nowTime === alertTime;
}

module.exports = {
  formatDateLocal,
  formatTimeLocal,
  reminderMatchesDay,
  shouldFireReminder,
  shouldFirePreAlert,
  minutesToTime24,
};
