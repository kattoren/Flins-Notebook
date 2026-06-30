(function initPetPanels() {
  const overlay = document.getElementById('pet-panel-overlay');
  const titleEl = document.getElementById('pet-panel-title');
  const bodyEl = document.getElementById('pet-panel-body');
  const confirmBtn = document.getElementById('pet-panel-confirm');
  const cancelBtn = document.getElementById('pet-panel-cancel');
  const panelApi = () => window.petPanelApi || window.petApi;

  let currentPanel = null;
  let onConfirm = null;
  let timerSoundPath = '';

  function closePanel() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    bodyEl.innerHTML = '';
    currentPanel = null;
    onConfirm = null;
    timerSoundPath = '';
    panelApi().panelClosed();
  }

  function durationPickerHtml(prefix, defaults = {}) {
    const hours = defaults.hours ?? 0;
    const minutes = defaults.minutes ?? 0;
    const seconds = defaults.seconds ?? 0;
    return `
      <div class="pet-duration-picker" data-prefix="${prefix}">
        <div class="pet-duration-unit">
          <label for="panel-${prefix}-hours">Hours</label>
          <input id="panel-${prefix}-hours" type="number" min="0" max="99" value="${hours}">
        </div>
        <div class="pet-duration-unit">
          <label for="panel-${prefix}-minutes">Min</label>
          <input id="panel-${prefix}-minutes" type="number" min="0" max="59" value="${minutes}">
        </div>
        <div class="pet-duration-unit">
          <label for="panel-${prefix}-seconds">Sec</label>
          <input id="panel-${prefix}-seconds" type="number" min="0" max="59" value="${seconds}">
        </div>
      </div>
    `;
  }

  function readDurationSeconds(prefix) {
    const hours = Number(document.getElementById(`panel-${prefix}-hours`)?.value) || 0;
    const minutes = Number(document.getElementById(`panel-${prefix}-minutes`)?.value) || 0;
    const seconds = Number(document.getElementById(`panel-${prefix}-seconds`)?.value) || 0;
    return Math.max(0, hours * 3600 + minutes * 60 + seconds);
  }

  function basename(filePath) {
    if (!filePath) return 'Default alarm';
    const parts = filePath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || filePath;
  }

  function wireTimerSoundControls(defaults = {}) {
    timerSoundPath = defaults.soundPath || '';
    const labelEl = document.getElementById('panel-timer-sound-label');
    const playCountInput = document.getElementById('panel-timer-play-count');
    const previewBtn = document.getElementById('panel-timer-preview-sound');
    const changeBtn = document.getElementById('panel-timer-change-sound');

    if (labelEl) {
      labelEl.textContent = timerSoundPath ? basename(timerSoundPath) : 'Default alarm';
    }
    if (playCountInput) {
      playCountInput.value = String(defaults.playCount ?? 1);
    }

    previewBtn?.addEventListener('click', async () => {
      const api = panelApi();
      if (!api.previewAlarm) return;
      const url = await api.previewAlarm(timerSoundPath || '');
      if (!url) return;
      const audio = new Audio(url);
      audio.volume = 1;
      audio.play().catch(() => {});
    });

    changeBtn?.addEventListener('click', async () => {
      const api = panelApi();
      if (!api.pickAudio) return;
      const picked = await api.pickAudio();
      if (picked) {
        timerSoundPath = picked;
        if (labelEl) labelEl.textContent = basename(picked);
      }
    });
  }

  async function openPanel(type, initial = {}) {
    currentPanel = type;
    bodyEl.innerHTML = '';

    if (type === 'timer') {
      titleEl.textContent = 'Timer';
      confirmBtn.textContent = 'Start';

      const defaults = panelApi().getTimerDefaults
        ? await panelApi().getTimerDefaults()
        : { soundPath: '', playCount: 1 };

      bodyEl.innerHTML = `
        <div class="pet-panel-field">
          <div class="pet-panel-radio-group">
            <label class="pet-panel-radio">
              <input type="radio" name="timer-type" value="simple" checked>
              <span>Simple countdown</span>
            </label>
            <label class="pet-panel-radio">
              <input type="radio" name="timer-type" value="pomodoro">
              <span>Pomodoro</span>
            </label>
          </div>
        </div>
        <div id="panel-simple-fields">
          <div class="pet-panel-field">
            <span class="pet-panel-field-label">Duration</span>
            ${durationPickerHtml('timer', { hours: 0, minutes: 25, seconds: 0 })}
          </div>
        </div>
        <div id="panel-pomo-fields" class="hidden">
          <div class="pet-panel-field">
            <span class="pet-panel-field-label">Work</span>
            ${durationPickerHtml('work', { hours: 0, minutes: 25, seconds: 0 })}
          </div>
          <div class="pet-panel-field">
            <span class="pet-panel-field-label">Break</span>
            ${durationPickerHtml('break', { hours: 0, minutes: 5, seconds: 0 })}
          </div>
          <div class="pet-panel-field">
            <label for="panel-pomo-cycles">Cycles</label>
            <input id="panel-pomo-cycles" type="number" min="1" max="99" value="4">
          </div>
        </div>
        <div class="pet-panel-field">
          <span class="pet-panel-field-label">Alarm sound</span>
          <div class="pet-timer-sound-row">
            <button id="panel-timer-preview-sound" class="pet-timer-sound-btn" type="button" aria-label="Preview alarm">&#128266;</button>
            <span id="panel-timer-sound-label" class="pet-timer-sound-label">Default alarm</span>
            <button id="panel-timer-change-sound" class="pet-panel-btn pet-panel-btn-secondary pet-timer-change-btn" type="button">Change audio</button>
          </div>
        </div>
        <div class="pet-panel-field">
          <label for="panel-timer-play-count">Times to play</label>
          <input id="panel-timer-play-count" type="number" min="1" max="10" value="1">
        </div>
      `;

      wireTimerSoundControls(defaults);

      const simpleFields = document.getElementById('panel-simple-fields');
      const pomoFields = document.getElementById('panel-pomo-fields');
      bodyEl.querySelectorAll('input[name="timer-type"]').forEach((radio) => {
        radio.addEventListener('change', () => {
          const isPomo = bodyEl.querySelector('input[name="timer-type"]:checked').value === 'pomodoro';
          simpleFields.classList.toggle('hidden', isPomo);
          pomoFields.classList.toggle('hidden', !isPomo);
        });
      });

      onConfirm = () => {
        const kind = bodyEl.querySelector('input[name="timer-type"]:checked').value;
        const playCount = Number(document.getElementById('panel-timer-play-count')?.value) || 1;
        const soundPath = timerSoundPath;
        if (kind === 'pomodoro') {
          const workSeconds = readDurationSeconds('work');
          const breakSeconds = readDurationSeconds('break');
          const cycles = Number(document.getElementById('panel-pomo-cycles')?.value) || 4;
          return {
            type: 'pomodoro',
            workSeconds: workSeconds > 0 ? workSeconds : 25 * 60,
            breakSeconds: breakSeconds > 0 ? breakSeconds : 5 * 60,
            cycles: Math.max(1, Math.min(99, cycles)),
            soundPath,
            playCount,
          };
        }
        const totalSeconds = readDurationSeconds('timer');
        return {
          type: 'simple',
          totalSeconds: totalSeconds > 0 ? totalSeconds : 60,
          soundPath,
          playCount,
        };
      };
    } else if (type === 'name') {
      titleEl.textContent = 'What do you want Flins to call you?';
      confirmBtn.textContent = 'Save';
      bodyEl.innerHTML = `
        <div class="pet-panel-field">
          <label for="panel-pet-name">Name</label>
          <input id="panel-pet-name" type="text" maxlength="40" placeholder="What should Flins call you?" value="${escapeAttr(initial.name || '')}">
        </div>
      `;
      onConfirm = () => ({
        name: document.getElementById('panel-pet-name').value.trim(),
      });
    } else if (type === 'pin') {
      titleEl.textContent = 'Pin message';
      confirmBtn.textContent = 'Save';
      bodyEl.innerHTML = `
        <div class="pet-panel-field">
          <label for="panel-pin-message">Message above pet</label>
          <textarea id="panel-pin-message" rows="3" maxlength="120" placeholder="Pinned text stays visible">${escapeAttr(initial.message || '')}</textarea>
        </div>
      `;
      onConfirm = () => ({
        message: document.getElementById('panel-pin-message').value.trim(),
      });
    }

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    const firstInput = bodyEl.querySelector('input, textarea');
    if (firstInput) firstInput.focus();
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  confirmBtn.addEventListener('click', () => {
    if (!onConfirm) return;
    const result = onConfirm();
    panelApi().submitPanel({ panel: currentPanel, ...result });
    closePanel();
  });

  cancelBtn.addEventListener('click', closePanel);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });

  window.PetPanels = { openPanel, closePanel };
})();
