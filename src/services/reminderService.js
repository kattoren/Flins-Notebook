const { Notification } = require('electron');
const { startScheduler } = require('../scheduler/scheduler');
const { formatPreAlertSpeech, formatReminderSpeech } = require('../pet/petSpeak');
const { getAppIcon } = require('../utils/petAssets');
const { APP_DISPLAY_NAME } = require('../app/constants');

function showAppNotification(body, { subtitle } = {}) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: APP_DISPLAY_NAME,
    subtitle: subtitle || '',
    body,
    icon: getAppIcon(),
    silent: false,
  });
  notification.show();
}

function announcePreAlert(ctx, reminder) {
  const settings = ctx.dataStore.settings.get();
  const speech = formatPreAlertSpeech(settings, reminder, reminder.preAlertMinutes);
  ctx.speakPetMessage(speech, { autoDismissMs: 15000 });
  ctx.playAlarmOnce(reminder.soundPath, { preserveSpeech: true });
  showAppNotification(speech, { subtitle: 'Pre-alert' });
}

function fireReminder(ctx, reminder) {
  const settings = ctx.dataStore.settings.get();
  const speech = formatReminderSpeech(settings, reminder);
  showAppNotification(speech, { subtitle: reminder.title });
  ctx.playReminderAlarm(reminder);
}

function startReminderScheduler(ctx) {
  if (ctx.stopScheduler) {
    ctx.stopScheduler();
  }

  ctx.stopScheduler = startScheduler({
    dataStore: ctx.dataStore,
    onFire: (reminder) => {
      fireReminder(ctx, reminder);
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
