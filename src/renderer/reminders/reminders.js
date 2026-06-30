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
  isReminderActiveOnDay,
  countWeekOccurrences,
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
let selectionMode = false;
let selectedIds = new Set();

let layoutEl;
let listPanelWrap;
let formPanel;
let listPanel;
let formTitle;
let titleInput;
let timeInput;
let repeatSelect;
let dateField;
let dateInput;
let daysField;
let daysContainer;
let pickSoundBtn;
let playCountInput;
let preAlertInput;
let cancelBtn;
let deleteBtn;
let saveBtn;
let dayViewBtn;
let weekViewBtn;
let bulkEditBtn;
let bulkDeleteBtn;
let addFabBtn;
let formCloseBtn;
let disableMenuEl = null;

function dismissDisableMenu() {
  if (!disableMenuEl) return;
  disableMenuEl.remove();
  disableMenuEl = null;
}

async function skipReminderOnDay(reminder, date) {
  const dateStr = formatDate(date);
  const skippedDates = [...(reminder.skippedDates || [])];
  if (!skippedDates.includes(dateStr)) {
    skippedDates.push(dateStr);
  }
  await window.api.remindersUpdate(reminder.id, { skippedDates });
  await loadReminders();
}

async function disableReminderEntirely(reminderId) {
  await window.api.remindersUpdate(reminderId, { enabled: false, skippedDates: [] });
  await loadReminders();
}

async function enableReminderOnDay(reminder, date) {
  const dateStr = formatDate(date);
  const skippedDates = (reminder.skippedDates || []).filter((d) => d !== dateStr);

  if (!reminder.enabled) {
    await window.api.remindersUpdate(reminder.id, {
      enabled: true,
      skippedDates,
    });
  } else if (skippedDates.length !== (reminder.skippedDates || []).length) {
    await window.api.remindersUpdate(reminder.id, { skippedDates });
  }
  await loadReminders();
}

function showDisableMenu(reminder, occurrenceDate, anchorEl) {
  dismissDisableMenu();

  const menu = document.createElement('div');
  menu.className = 'reminder-disable-menu';
  menu.innerHTML = `
    <button type="button" class="reminder-disable-menu-item" data-action="one">
      Disable this reminder only
    </button>
    <button type="button" class="reminder-disable-menu-item" data-action="all">
      Disable all reminders of "${escapeHtml(reminder.title)}"
    </button>
  `;

  menu.querySelector('[data-action="one"]').addEventListener('click', (e) => {
    e.stopPropagation();
    dismissDisableMenu();
    skipReminderOnDay(reminder, occurrenceDate).catch((err) => {
      console.error('Skip reminder failed:', err);
    });
  });

  menu.querySelector('[data-action="all"]').addEventListener('click', (e) => {
    e.stopPropagation();
    dismissDisableMenu();
    disableReminderEntirely(reminder.id).catch((err) => {
      console.error('Disable reminder failed:', err);
    });
  });

  document.body.appendChild(menu);
  disableMenuEl = menu;

  const rect = anchorEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;

  if (left + menuRect.width > window.innerWidth - 8) {
    left = window.innerWidth - menuRect.width - 8;
  }
  if (top + menuRect.height > window.innerHeight - 8) {
    top = rect.top - menuRect.height - 6;
  }

  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
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

async function loadIcon(img) {
  if (!img?.dataset?.icon) return;
  img.src = await window.api.getUiAssetUrl(img.dataset.icon);
}

async function loadReminderIcons(root = document) {
  const loads = [...root.querySelectorAll('img[data-icon]')].map(loadIcon);
  await Promise.all(loads);
}

function openForm() {
  layoutEl.classList.add('form-open');
  formPanel.classList.remove('hidden');
}

function closeForm() {
  layoutEl.classList.remove('form-open');
  formPanel.classList.add('hidden');
  resetForm();
}

function resetForm() {
  editingId = null;
  formSoundPath = '';
  titleInput.value = '';
  timeInput.value = '';
  repeatSelect.value = 'once';
  dateInput.value = formatDate(new Date());
  setSelectedDays([]);
  playCountInput.value = '1';
  if (preAlertInput) preAlertInput.value = '0';
  updateConditionalFields();
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
  playCountInput.value = String(reminder.playCount ?? 1);
  if (preAlertInput) {
    preAlertInput.value = String(reminder.preAlertMinutes ?? 0);
  }
  updateConditionalFields();
  formTitle.textContent = 'Edit reminder';
  cancelBtn.classList.remove('hidden');
  deleteBtn.classList.remove('hidden');
  openForm();
}

function setSelectionMode(on) {
  selectionMode = on;
  selectedIds.clear();
  bulkEditBtn.classList.toggle('is-active', on);
  bulkDeleteBtn.classList.toggle('hidden', !on);
  listPanelWrap.classList.toggle('selection-mode', on);
  renderList();
}

function toggleSelectionMode() {
  setSelectionMode(!selectionMode);
}

async function deleteReminderById(id) {
  await window.api.remindersDelete(id);
  await loadReminders();
}

async function deleteSelectedReminders() {
  if (!selectedIds.size) return;
  const ids = [...selectedIds];
  await Promise.all(ids.map((id) => window.api.remindersDelete(id)));
  setSelectionMode(false);
  await loadReminders();
}

function renderReminderRow(reminder, occurrenceDate) {
  const row = document.createElement('div');
  const activeOnDay = isReminderActiveOnDay(reminder, occurrenceDate);
  row.className = `book-reminder-row${activeOnDay ? '' : ' disabled'}`;
  row.dataset.id = reminder.id;

  const isOn = selectionMode
    ? selectedIds.has(reminder.id)
    : activeOnDay;

  row.innerHTML = `
    <button
      type="button"
      class="reminder-toggle${isOn ? ' is-on' : ''}"
      aria-label="${selectionMode ? 'Select reminder' : 'Enable or disable reminder'}"
      aria-pressed="${isOn}"
    ></button>
    <div class="main">
      <div class="title">${escapeHtml(reminder.title)}</div>
      <div class="meta">${repeatSummary(reminder)} · ${reminder.playCount ?? 1}×</div>
    </div>
    <span class="time">${formatTime12(reminder.time)}</span>
    <div class="row-hover-actions">
      <button class="reminders-icon-btn row-edit-btn" type="button" aria-label="Edit reminder">
        <img data-icon="Icons/icon_edit.svg" alt="">
      </button>
      <button class="reminders-icon-btn row-delete-btn" type="button" aria-label="Delete reminder">
        <img data-icon="Icons/icon_delete.svg" alt="">
      </button>
    </div>
  `;

  const toggle = row.querySelector('.reminder-toggle');
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();

    if (selectionMode) {
      const nowOn = !toggle.classList.contains('is-on');
      toggle.classList.toggle('is-on', nowOn);
      toggle.setAttribute('aria-pressed', String(nowOn));
      if (nowOn) {
        selectedIds.add(reminder.id);
      } else {
        selectedIds.delete(reminder.id);
      }
      return;
    }

    const turningOn = !toggle.classList.contains('is-on');

    if (turningOn) {
      enableReminderOnDay(reminder, occurrenceDate).catch((err) => {
        console.error('Enable reminder failed:', err);
      });
      return;
    }

    if (countWeekOccurrences(reminder) > 1) {
      showDisableMenu(reminder, occurrenceDate, toggle);
      return;
    }

    disableReminderEntirely(reminder.id).catch((err) => {
      console.error('Disable reminder failed:', err);
    });
  });

  row.querySelector('.row-edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectionMode) return;
    fillForm(reminder);
  });

  row.querySelector('.row-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectionMode) return;
    deleteReminderById(reminder.id).catch((err) => console.error('Delete reminder failed:', err));
  });

  loadReminderIcons(row);
  return row;
}

function renderDayView() {
  const today = new Date();
  const todays = getRemindersForDay(reminders, today);
  const headingEl = document.getElementById('reminders-list-heading');
  if (headingEl) {
    headingEl.textContent = `Today — ${DAY_NAMES[today.getDay()]}, ${formatDate(today)}`;
  }
  listPanel.innerHTML = '';

  if (!todays.length) {
    listPanel.innerHTML = '<div class="home-empty">No reminders for today.</div>';
    return;
  }

  todays.forEach((r) => listPanel.appendChild(renderReminderRow(r, today)));
}

function renderWeekView() {
  const weekDates = getWeekDates(new Date());
  const headingEl = document.getElementById('reminders-list-heading');
  if (headingEl) {
    headingEl.textContent = 'This Week';
  }
  listPanel.innerHTML = '';

  weekDates.forEach((date) => {
    const dayReminders = getRemindersForDay(reminders, date);
    const group = document.createElement('div');
    group.className = 'book-week-group';

    const heading = document.createElement('h4');
    heading.className = 'book-week-heading';
    heading.textContent = `${DAY_NAMES[date.getDay()]} — ${formatDate(date)}`;
    group.appendChild(heading);

    if (!dayReminders.length) {
      const empty = document.createElement('div');
      empty.className = 'home-empty';
      empty.style.padding = '16px';
      empty.textContent = 'No reminders';
      group.appendChild(empty);
    } else {
      dayReminders.forEach((r) => group.appendChild(renderReminderRow(r, date)));
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
    preAlertMinutes: preAlertInput ? Number(preAlertInput.value) : 0,
    enabled: true,
  };

  if (editingId) {
    const existing = reminders.find((r) => r.id === editingId);
    if (existing) {
      payload.enabled = existing.enabled;
      payload.skippedDates = existing.skippedDates || [];
    }
    await window.api.remindersUpdate(editingId, payload);
  } else {
    await window.api.remindersCreate(payload);
  }

  closeForm();
  await loadReminders();
}

function initReminders() {
  layoutEl = document.getElementById('reminders-book-layout');
  listPanelWrap = document.getElementById('reminders-list-panel-wrap');
  formPanel = document.getElementById('reminder-form-panel');
  listPanel = document.getElementById('reminders-list-panel');
  formTitle = document.getElementById('form-title');
  titleInput = document.getElementById('reminder-title');
  timeInput = document.getElementById('reminder-time');
  repeatSelect = document.getElementById('reminder-repeat');
  dateField = document.getElementById('reminder-date-field');
  dateInput = document.getElementById('reminder-date');
  daysField = document.getElementById('reminder-days-field');
  daysContainer = document.getElementById('reminder-days');
  pickSoundBtn = document.getElementById('reminder-pick-sound');
  playCountInput = document.getElementById('reminder-play-count');
  preAlertInput = document.getElementById('reminder-pre-alert');
  cancelBtn = document.getElementById('reminder-cancel');
  deleteBtn = document.getElementById('reminder-delete');
  saveBtn = document.getElementById('reminder-save');
  dayViewBtn = document.getElementById('reminders-day-view');
  weekViewBtn = document.getElementById('reminders-week-view');
  bulkEditBtn = document.getElementById('reminders-bulk-edit');
  bulkDeleteBtn = document.getElementById('reminders-bulk-delete');
  addFabBtn = document.getElementById('reminder-add-fab');
  formCloseBtn = document.getElementById('reminder-form-close');

  if (!layoutEl || !listPanel || !saveBtn || !dayViewBtn || !weekViewBtn || !playCountInput) {
    throw new Error('Reminders: required elements missing');
  }

  buildDayPicker();
  dateInput.value = formatDate(new Date());
  playCountInput.value = '1';
  updateConditionalFields();

  loadReminderIcons(document.getElementById('view-reminders'));

  repeatSelect.addEventListener('change', updateConditionalFields);

  pickSoundBtn.addEventListener('click', async () => {
    const pickedPath = await window.api.pickAudio();
    if (pickedPath) {
      formSoundPath = pickedPath;
    }
  });

  saveBtn.addEventListener('click', () => {
    saveReminder().catch((err) => console.error('Save reminder failed:', err));
  });

  cancelBtn.addEventListener('click', closeForm);

  formCloseBtn?.addEventListener('click', closeForm);

  deleteBtn.addEventListener('click', () => {
    if (!editingId) return;
    window.api.remindersDelete(editingId)
      .then(() => {
        closeForm();
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

  bulkEditBtn.addEventListener('click', toggleSelectionMode);

  bulkDeleteBtn.addEventListener('click', () => {
    deleteSelectedReminders().catch((err) => console.error('Bulk delete failed:', err));
  });

  addFabBtn.addEventListener('click', () => {
    dismissDisableMenu();
    resetForm();
    openForm();
  });

  document.addEventListener('click', (e) => {
    if (!disableMenuEl) return;
    if (disableMenuEl.contains(e.target)) return;
    dismissDisableMenu();
  });

  loadReminders().catch((err) => console.error('Load reminders failed:', err));
}

window.initReminders = initReminders;
})();
