(function () {
  if (!window.AppShared) {
    console.error('achievements.js: AppShared missing');
    return;
  }

const { escapeHtml, formatDateTime, getLevelInfo } = window.AppShared;

let form;
let nameInput;
let logBtn;
let totalEl;
let levelEl;
let progressFill;
let progressLabel;
let listEl;

function renderLevelSummary(total) {
  const info = getLevelInfo(total);
  totalEl.textContent = String(total);
  levelEl.textContent = String(info.level);

  progressFill.style.width = `${Math.round(info.progress * 100)}%`;
  if (info.isMax) {
    progressLabel.textContent = 'Max level reached';
  } else {
    progressLabel.textContent = `${info.untilNext} more to reach Level ${info.level + 1}`;
  }
}

function renderAchievementItem(achievement) {
  const item = document.createElement('div');
  item.className = 'achievement-item';
  item.innerHTML = `
    <div class="achievement-item-main">
      <div class="achievement-item-name">${escapeHtml(achievement.name)}</div>
      <div class="achievement-item-date">${formatDateTime(achievement.completedAt)}</div>
    </div>
    <button class="btn btn-danger btn-sm" type="button">Delete</button>
  `;

  item.querySelector('button').addEventListener('click', () => {
    window.api.achievementsDelete(achievement.id)
      .then(loadAchievements)
      .catch((err) => console.error('Delete achievement failed:', err));
  });

  return item;
}

async function loadAchievements() {
  const achievements = await window.api.achievementsList();
  const sorted = [...achievements].sort((a, b) => b.completedAt - a.completedAt);

  renderLevelSummary(sorted.length);
  listEl.innerHTML = '';

  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No achievements logged yet. Complete a task above!';
    listEl.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'achievement-list';
  sorted.forEach((a) => list.appendChild(renderAchievementItem(a)));
  listEl.appendChild(list);

  if (window.refreshHome) {
    window.refreshHome();
  }
}

window.refreshAchievements = loadAchievements;

async function logAchievement() {
  const name = nameInput.value.trim();
  if (!name) return;

  await window.api.achievementsCreate({ name });
  nameInput.value = '';
  await loadAchievements();
}

function initAchievements() {
  form = document.getElementById('achievement-form');
  nameInput = document.getElementById('achievement-name');
  logBtn = document.getElementById('achievement-log');
  totalEl = document.getElementById('achievements-total');
  levelEl = document.getElementById('achievements-level');
  progressFill = document.getElementById('achievements-progress-fill');
  progressLabel = document.getElementById('achievements-progress-label');
  listEl = document.getElementById('achievements-list');

  if (!form || !nameInput || !logBtn || !listEl) {
    throw new Error('Achievements: required elements missing');
  }

  logBtn.addEventListener('click', () => {
    logAchievement().catch((err) => console.error('Log achievement failed:', err));
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      logAchievement().catch((err) => console.error('Log achievement failed:', err));
    }
  });

  loadAchievements().catch((err) => console.error('Load achievements failed:', err));
}

window.initAchievements = initAchievements;
})();
