(function initPetPanels() {
  const overlay = document.getElementById('pet-panel-overlay');
  const titleEl = document.getElementById('pet-panel-title');
  const bodyEl = document.getElementById('pet-panel-body');
  const confirmBtn = document.getElementById('pet-panel-confirm');
  const cancelBtn = document.getElementById('pet-panel-cancel');

  let currentPanel = null;
  let onConfirm = null;

  function closePanel() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    bodyEl.innerHTML = '';
    currentPanel = null;
    onConfirm = null;
    window.petApi.panelClosed();
  }

  function openPanel(type, initial = {}) {
    currentPanel = type;
    bodyEl.innerHTML = '';

    if (type === 'timer') {
      titleEl.textContent = 'Timer';
      confirmBtn.textContent = 'Start';
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
            <label for="panel-timer-minutes">Minutes</label>
            <input id="panel-timer-minutes" type="number" min="1" max="999" value="25">
          </div>
        </div>
        <div id="panel-pomo-fields" class="hidden">
          <div class="pet-panel-field">
            <label for="panel-work-minutes">Work (minutes)</label>
            <input id="panel-work-minutes" type="number" min="1" max="999" value="25">
          </div>
          <div class="pet-panel-field">
            <label for="panel-break-minutes">Break (minutes)</label>
            <input id="panel-break-minutes" type="number" min="1" max="120" value="5">
          </div>
        </div>
      `;

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
        if (kind === 'pomodoro') {
          return {
            type: 'pomodoro',
            workMin: document.getElementById('panel-work-minutes').value,
            breakMin: document.getElementById('panel-break-minutes').value,
          };
        }
        return {
          type: 'simple',
          minutes: document.getElementById('panel-timer-minutes').value,
        };
      };
    } else if (type === 'name') {
      titleEl.textContent = 'Pet name';
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
    window.petApi.submitPanel({ panel: currentPanel, ...result });
    closePanel();
  });

  cancelBtn.addEventListener('click', closePanel);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });

  window.PetPanels = { openPanel, closePanel };
})();
