(function () {
  if (!window.AppShared) {
    console.error('reminders.js: AppShared missing');
    return;
  }

const {
  DAY_NAMES,
  DAY_SHORT,
  escapeHtml,
  formatDate,
  formatTime12,
  getRemindersForDay,
} = window.AppShared;

const REPEAT_LABELS = {
  once: 'Once',
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  weekly: 'Weekly',
  custom: 'Custom',
};

let reminders = [];
let listMode = 'day';
let editingId = null;
let formSoundPath = '';
let defaultAlarmLabel = 'Columbina alarm (default)';

let listPanel;
let formTitle;
let titleInput;
let timeInput;
let repeatSelect;
let dateField;
let dateInput;
let daysField;
let daysContainer;
let soundLabel;
let useDefaultBtn;
let pickSoundBtn;
let playCountInput;
let enabledInput;
let cancelBtn;
let deleteBtn;
let saveBtn;
let dayViewBtn;
let weekViewBtn;

function basename(filePath) {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

function getWeekDates(referenceDate) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function repeatSummary(reminder) {
  if (reminder.repeat === 'once' && reminder.date) {
    return `Once on ${reminder.date}`;
  }
  if (reminder.repeat === 'weekly' || reminder.repeat === 'custom') {
    const days = reminder.days.map((d) => DAY_SHORT[d]).join(', ');
    return `${REPEAT_LABELS[reminder.repeat]} (${days || 'no days'})`;
  }
  return REPEAT_LABELS[reminder.repeat] || reminder.repeat;
}

function buildDayPicker() {
  daysContainer.innerHTML = DAY_SHORT.map((label, index) => `
    <label>
      <input type="checkbox" name="reminder-day" value="${index}">
      ${label}
    </label>
  `).join('');
}

function getSelectedDays() {
  return [...daysContainer.querySelectorAll('input[name="reminder-day"]:checked')].map(
    (el) => Number(el.value),
  );
}

function setSelectedDays(days) {
  daysContainer.querySelectorAll('input[name="reminder-day"]').forEach((el) => {
    el.checked = days.includes(Number(el.value));
  });
}

function updateConditionalFields() {
  const repeat = repeatSelect.value;
  dateField.classList.toggle('hidden', repeat !== 'once');
  daysField.classList.toggle('hidden', repeat !== 'weekly' && repeat !== 'custom');
}

function soundSummary(reminder) {
  if (reminder.soundPath) {
    return basename(reminder.soundPath);
  }
  return defaultAlarmLabel;
}

function updateSoundLabel() {
  soundLabel.textContent = formSoundPath ? basename(formSoundPath) : defaultAlarmLabel;
}

function resetForm() {
  editingId = null;
  formSoundPath = '';
  titleInput.value = '';
  timeInput.value = '';
  repeatSelect.value = 'once';
  dateInput.value = formatDate(new Date());
  setSelectedDays([]);
  enabledInput.checked = true;
  playCountInput.value = '1';
  updateConditionalFields();
  updateSoundLabel();
  formTitle.textContent = 'New reminder';
  cancelBtn.classList.add('hidden');
  deleteBtn.classList.add('hidden');
}

function fillForm(reminder) {
  editingId = reminder.id;
  formSoundPath = reminder.soundPath || '';
  titleInput.value = reminder.title;
  timeInput.value = reminder.time;
  repeatSelect.value = reminder.repeat;
  dateInput.value = reminder.date || formatDate(new Date());
  setSelectedDays(reminder.days || []);
  enabledInput.checked = reminder.enabled;
  playCountInput.value = String(reminder.playCount ?? 1);
  updateSoundLabel();
  updateConditionalFields();
  formTitle.textContent = 'Edit reminder';
  cancelBtn.classList.remove('hidden');
  deleteBtn.classList.remove('hidden');
}

function renderReminderCard(reminder) {
  const card = document.createElement('div');
  card.className = `reminder-card${reminder.enabled ? '' : ' disabled'}`;
  card.innerHTML = `
    <div class="reminder-card-main">
      <div class="reminder-card-title">${escapeHtml(reminder.title)}</div>
      <div class="reminder-card-meta">
        ${formatTime12(reminder.time)} · ${repeatSummary(reminder)}
        · ${escapeHtml(soundSummary(reminder))} · ${reminder.playCount ?? 1}×
      </div>
    </div>
    <div class="reminder-card-actions">
      <button class="btn btn-secondary btn-sm" data-action="edit" type="button">Edit</button>
      <button class="btn btn-secondary btn-sm" data-action="toggle" type="button">
        ${reminder.enabled ? 'Disable' : 'Enable'}
      </button>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener('click', () => fillForm(reminder));
  card.querySelector('[data-action="toggle"]').addEventListener('click', async () => {
    await window.api.remindersUpdate(reminder.id, { enabled: !reminder.enabled });
    await loadReminders();
  });

  return card;
}

function renderDayView() {
  const today = new Date();
  const todays = getRemindersForDay(reminders, today);
  listPanel.innerHTML = '';

  const heading = document.createElement('h3');
  heading.textContent = `Today — ${DAY_NAMES[today.getDay()]}, ${formatDate(today)}`;
  heading.style.margin = '0 0 12px';
  listPanel.appendChild(heading);

  if (!todays.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No reminders for today.';
    listPanel.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'reminder-list';
  todays.forEach((r) => list.appendChild(renderReminderCard(r)));
  listPanel.appendChild(list);
}

function renderWeekView() {
  const weekDates = getWeekDates(new Date());
  listPanel.innerHTML = '';

  weekDates.forEach((date) => {
    const dayReminders = getRemindersForDay(reminders, date);
    const group = document.createElement('div');
    group.className = 'week-group';

    const heading = document.createElement('h3');
    heading.textContent = `${DAY_NAMES[date.getDay()]} — ${formatDate(date)}`;
    group.appendChild(heading);

    if (!dayReminders.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.padding = '12px';
      empty.textContent = 'No reminders';
      group.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'reminder-list';
      dayReminders.forEach((r) => list.appendChild(renderReminderCard(r)));
      group.appendChild(list);
    }

    listPanel.appendChild(group);
  });
}

function renderList() {
  if (listMode === 'day') {
    renderDayView();
  } else {
    renderWeekView();
  }
}

async function loadReminders() {
  reminders = await window.api.remindersList();
  renderList();
  if (window.refreshHome) {
    window.refreshHome();
  }
}

window.refreshReminders = loadReminders;

async function saveReminder() {
  const repeat = repeatSelect.value;
  if (!titleInput.value.trim() || !timeInput.value) {
    return;
  }

  const payload = {
    title: titleInput.value,
    time: timeInput.value,
    repeat,
    days: repeat === 'weekly' || repeat === 'custom' ? getSelectedDays() : [],
    date: repeat === 'once' ? dateInput.value : null,
    soundPath: formSoundPath,
    playCount: Number(playCountInput.value),
    enabled: enabledInput.checked,
  };

  if (editingId) {
    await window.api.remindersUpdate(editingId, payload);
  } else {
    await window.api.remindersCreate(payload);
  }

  resetForm();
  await loadReminders();
}

function initReminders() {
  listPanel = document.getElementById('reminders-list-panel');
  formTitle = document.getElementById('form-title');
  titleInput = document.getElementById('reminder-title');
  timeInput = document.getElementById('reminder-time');
  repeatSelect = document.getElementById('reminder-repeat');
  dateField = document.getElementById('reminder-date-field');
  dateInput = document.getElementById('reminder-date');
  daysField = document.getElementById('reminder-days-field');
  daysContainer = document.getElementById('reminder-days');
  soundLabel = document.getElementById('reminder-sound-label');
  useDefaultBtn = document.getElementById('reminder-use-default');
  pickSoundBtn = document.getElementById('reminder-pick-sound');
  playCountInput = document.getElementById('reminder-play-count');
  enabledInput = document.getElementById('reminder-enabled');
  cancelBtn = document.getElementById('reminder-cancel');
  deleteBtn = document.getElementById('reminder-delete');
  saveBtn = document.getElementById('reminder-save');
  dayViewBtn = document.getElementById('reminders-day-view');
  weekViewBtn = document.getElementById('reminders-week-view');

  if (!listPanel || !saveBtn || !dayViewBtn || !weekViewBtn || !playCountInput) {
    throw new Error('Reminders: required elements missing');
  }

  window.api.getDefaultAlarmLabel()
    .then((label) => {
      defaultAlarmLabel = label;
      updateSoundLabel();
    })
    .catch(() => {});

  buildDayPicker();
  dateInput.value = formatDate(new Date());
  playCountInput.value = '1';
  updateConditionalFields();
  updateSoundLabel();

  repeatSelect.addEventListener('change', updateConditionalFields);

  useDefaultBtn.addEventListener('click', () => {
    formSoundPath = '';
    updateSoundLabel();
  });

  pickSoundBtn.addEventListener('click', async () => {
    const pickedPath = await window.api.pickAudio();
    if (pickedPath) {
      formSoundPath = pickedPath;
      updateSoundLabel();
    }
  });

  saveBtn.addEventListener('click', () => {
    saveReminder().catch((err) => console.error('Save reminder failed:', err));
  });

  cancelBtn.addEventListener('click', resetForm);

  deleteBtn.addEventListener('click', () => {
    if (!editingId) return;
    window.api.remindersDelete(editingId)
      .then(() => {
        resetForm();
        return loadReminders();
      })
      .catch((err) => console.error('Delete reminder failed:', err));
  });

  dayViewBtn.addEventListener('click', () => {
    listMode = 'day';
    dayViewBtn.classList.add('active');
    weekViewBtn.classList.remove('active');
    renderList();
  });

  weekViewBtn.addEventListener('click', () => {
    listMode = 'week';
    weekViewBtn.classList.add('active');
    dayViewBtn.classList.remove('active');
    renderList();
  });

  loadReminders().catch((err) => console.error('Load reminders failed:', err));
}

window.initReminders = initReminders;
})();
