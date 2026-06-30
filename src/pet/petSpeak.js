function getPetName(settings) {
  const name = (settings?.petName || '').trim();
  return name || 'friend';
}

function formatReminderSpeech(settings, reminder, timeLabel) {
  const time = timeLabel || reminder.time;
  return `${getPetName(settings)}, ${reminder.title}, ${time}`;
}

function formatPreAlertSpeech(settings, reminder, minutes) {
  return `${getPetName(settings)}, ${reminder.title} in ${minutes} minutes`;
}

function formatBreakSpeech(settings) {
  return `${getPetName(settings)}, it's break time!`;
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
  formatTime12From24,
};
