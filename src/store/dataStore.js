const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function clampPlayCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.min(10, Math.max(1, Math.round(count)));
}

function normalizeReminder(reminder) {
  return {
    ...reminder,
    playCount: clampPlayCount(reminder.playCount ?? 1),
    days: Array.isArray(reminder.days) ? reminder.days : [],
    skippedDates: Array.isArray(reminder.skippedDates) ? reminder.skippedDates : [],
  };
}

function createDefaultData(petImagePath) {
  return {
    reminders: [],
    achievements: [],
    settings: {
      petEnabled: true,
      petAlwaysOnTop: true,
      petRoamMode: true,
      petImage: petImagePath,
      petVoicelines: [],
      autoLaunch: false,
      volume: 1,
      voicelineVolume: 0.25,
      bookOpen: false,
    },
  };
}

function resolveDataFilePath(appPath, userDataPath) {
  const dataDir = path.join(appPath, 'data');
  const dataFilePath = path.join(dataDir, 'data.json');
  const legacyPath = path.join(userDataPath, 'data.json');

  if (!fs.existsSync(dataFilePath) && fs.existsSync(legacyPath)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.copyFileSync(legacyPath, dataFilePath);
  }

  return dataFilePath;
}

function createReminderStore(store, defaults) {
  return {
    list() {
      return store.read().reminders.map(normalizeReminder);
    },
    get(id) {
      const reminder = store.read().reminders.find((r) => r.id === id);
      return reminder ? normalizeReminder(reminder) : null;
    },
    create(input) {
      let created = null;
      store.update((data) => {
        created = {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          time: input.time,
          repeat: input.repeat,
          days: input.days ?? [],
          date: input.date ?? null,
          soundPath: input.soundPath ?? '',
          playCount: clampPlayCount(input.playCount),
          enabled: input.enabled !== false,
          skippedDates: [],
          lastFiredAt: null,
          createdAt: Date.now(),
        };
        data.reminders.push(created);
        return data;
      });
      return created;
    },
    update(id, input) {
      let updated = null;
      store.update((data) => {
        const index = data.reminders.findIndex((r) => r.id === id);
        if (index === -1) return data;
        updated = {
          ...data.reminders[index],
          ...input,
          id,
          title: input.title !== undefined ? input.title.trim() : data.reminders[index].title,
          playCount: input.playCount !== undefined
            ? clampPlayCount(input.playCount)
            : clampPlayCount(data.reminders[index].playCount),
        };
        data.reminders[index] = updated;
        return data;
      });
      return updated;
    },
    delete(id) {
      let deleted = false;
      store.update((data) => {
        const before = data.reminders.length;
        data.reminders = data.reminders.filter((r) => r.id !== id);
        deleted = data.reminders.length < before;
        return data;
      });
      return deleted;
    },
  };
}

function createAchievementStore(store) {
  return {
    list() {
      return store.read().achievements;
    },
    create(input) {
      let created = null;
      store.update((data) => {
        created = {
          id: crypto.randomUUID(),
          name: input.name.trim(),
          completedAt: Date.now(),
        };
        data.achievements.push(created);
        return data;
      });
      return created;
    },
    delete(id) {
      let deleted = false;
      store.update((data) => {
        const before = data.achievements.length;
        data.achievements = data.achievements.filter((a) => a.id !== id);
        deleted = data.achievements.length < before;
        return data;
      });
      return deleted;
    },
  };
}

function createSettingsStore(store) {
  return {
    get() {
      return store.read().settings;
    },
    update(input) {
      let next = null;
      store.update((data) => {
        data.settings = { ...data.settings, ...input };
        next = data.settings;
        return data;
      });
      return next;
    },
  };
}

function initDataStore(appPath, userDataPath, petImagePath) {
  const defaults = createDefaultData(petImagePath);
  const { createJsonStore } = require('./jsonStore');
  const dataFilePath = resolveDataFilePath(appPath, userDataPath);
  const store = createJsonStore(dataFilePath, defaults);

  return {
    dataFilePath,
    reminders: createReminderStore(store, defaults),
    achievements: createAchievementStore(store),
    settings: createSettingsStore(store),
  };
}

module.exports = { initDataStore, createDefaultData, resolveDataFilePath };
