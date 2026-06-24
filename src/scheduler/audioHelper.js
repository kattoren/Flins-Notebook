const fs = require('fs');
const path = require('path');

function getAudioMimeType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.m4a':
      return 'audio/mp4';
    default:
      return 'audio/mpeg';
  }
}

function readAudioAsDataUrl(filePath) {
  const buffer = fs.readFileSync(filePath);
  const mime = getAudioMimeType(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function resolveSoundPath(reminderSoundPath, defaultAlarmPath) {
  const chosen = (reminderSoundPath || '').trim();
  if (chosen && fs.existsSync(chosen)) {
    return chosen;
  }
  return defaultAlarmPath;
}

module.exports = {
  readAudioAsDataUrl,
  resolveSoundPath,
};
