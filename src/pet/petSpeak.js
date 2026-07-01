function getPetName(settings) {
  const name = (settings?.petName || '').trim();
  return name || 'friend';
}

function formatReminderSpeech(settings, reminder) {
  return `${getPetName(settings)}, it is time for ${reminder.title} !`;
}

function formatPreAlertSpeech(settings, reminder, minutes) {
  return `${getPetName(settings)}, ${reminder.title} in ${minutes} minutes!`;
}

function formatBreakSpeech(settings) {
  return `Break time, ${getPetName(settings)}!`;
}

function formatPomodoroWorkTitle(settings) {
  return `Time to work, ${getPetName(settings)}!`;
}

function formatPomodoroBreakTitle(settings) {
  return `Break time, ${getPetName(settings)}!`;
}

function formatTimerUpNotification(settings) {
  return `The time is up, ${getPetName(settings)}!`;
}

function formatPomodoroWorkNotification(settings) {
  return `${getPetName(settings)}, work time!`;
}

function formatPomodoroBreakNotification(settings) {
  return `${getPetName(settings)}, break time!`;
}

function formatTime12From24(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

module.exports = {
  getPetName,
  formatReminderSpeech,
  formatPreAlertSpeech,
  formatBreakSpeech,
  formatPomodoroWorkTitle,
  formatPomodoroBreakTitle,
  formatPomodoroWorkNotification,
  formatPomodoroBreakNotification,
  formatTimerUpNotification,
  formatTime12From24,
};
