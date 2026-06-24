const { shouldFireReminder } = require('./reminderMatch');

const CHECK_INTERVAL_MS = 25000;

function startScheduler({ dataStore, onFire }) {
  function tick() {
    const now = new Date();
    const reminders = dataStore.reminders.list();

    for (const reminder of reminders) {
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
