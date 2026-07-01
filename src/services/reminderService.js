const { Notification } = require('electron');
const { startScheduler } = require('../scheduler/scheduler');
const { formatPreAlertSpeech } = require('../pet/petSpeak');
const { getAppIcon } = require('../utils/petAssets');

function announcePreAlert(ctx, reminder) {
  const settings = ctx.dataStore.settings.get();
  ctx.speakPetMessage(
    formatPreAlertSpeech(settings, reminder, reminder.preAlertMinutes),
  );
}

function showReminderNotification(reminder) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: 'Reminder',
    body: reminder.title,
    icon: getAppIcon(),
  });
  notification.show();
}

function startReminderScheduler(ctx) {
  if (ctx.stopScheduler) {
    ctx.stopScheduler();
  }

  ctx.stopScheduler = startScheduler({
    dataStore: ctx.dataStore,
    onFire: (reminder) => {
      showReminderNotification(reminder);
      ctx.playReminderAlarm(reminder);
    },
    onPreAlert: (reminder) => {
      announcePreAlert(ctx, reminder);
    },
  });
}

function initReminderService(ctx) {
  ctx.startReminderScheduler = () => startReminderScheduler(ctx);
}

module.exports = { initReminderService };
