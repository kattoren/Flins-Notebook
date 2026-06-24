const fs = require('fs');
const path = require('path');

function readJsonFile(filePath, defaults) {
  try {
    if (!fs.existsSync(filePath)) {
      return structuredClone(defaults);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaults),
      ...parsed,
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : defaults.reminders,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : defaults.achievements,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return structuredClone(defaults);
  }
}

function writeJsonFileAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function createJsonStore(filePath, defaults) {
  return {
    read() {
      return readJsonFile(filePath, defaults);
    },
    write(data) {
      writeJsonFileAtomic(filePath, data);
    },
    update(mutator) {
      const data = readJsonFile(filePath, defaults);
      const next = mutator(data) ?? data;
      writeJsonFileAtomic(filePath, next);
      return next;
    },
  };
}

module.exports = { createJsonStore };
