const { shouldFireReminder, shouldFirePreAlert } = require('./reminderMatch');

const CHECK_INTERVAL_MS = 25000;

function startScheduler({ dataStore, onFire, onPreAlert }) {
  function tick() {
    const now = new Date();
    const reminders = dataStore.reminders.list();

    for (const reminder of reminders) {
      if (shouldFirePreAlert(reminder, now)) {
        dataStore.reminders.update(reminder.id, { lastPreAlertFiredAt: now.getTime() });
        if (onPreAlert) onPreAlert(reminder);
        continue;
      }

      if (!shouldFireReminder(reminder, now)) {
        continue;
      }

      dataStore.reminders.update(reminder.id, { lastFiredAt: now.getTime() });
      onFire(reminder);
    }
  }

  tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}

module.exports = { startScheduler };
