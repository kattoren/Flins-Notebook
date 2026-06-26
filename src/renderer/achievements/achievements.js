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
let progressFraction;
let progressLabel;
let listEl;

async function loadIcon(img) {
  if (!img?.dataset?.icon) return;
  img.src = await window.api.getUiAssetUrl(img.dataset.icon);
}

async function loadAchievementIcons(root = document) {
  const loads = [...root.querySelectorAll('img[data-icon]')].map(loadIcon);
  await Promise.all(loads);
}

function renderLevelSummary(total) {
  const info = getLevelInfo(total);
  totalEl.textContent = String(total);
  levelEl.textContent = String(info.level);

  progressFill.style.width = `${Math.round(info.progress * 100)}%`;
  if (info.isMax) {
    if (progressFraction) progressFraction.textContent = 'MAX';
    progressLabel.textContent = 'Max level reached';
  } else {
    const currentInBand = total - (info.level > 0 ? window.AppShared.LEVEL_THRESHOLDS[info.level - 1] : 0);
    const bandSize = info.nextThreshold - (info.level > 0 ? window.AppShared.LEVEL_THRESHOLDS[info.level - 1] : 0);
    if (progressFraction) progressFraction.textContent = `${currentInBand} / ${bandSize}`;
    progressLabel.textContent = `${info.untilNext} more to reach Level ${info.level + 1}`;
  }
}

function renderAchievementItem(achievement) {
  const item = document.createElement('div');
  item.className = 'book-achievement-row';
  item.innerHTML = `
    <span class="achievement-dot" aria-hidden="true"></span>
    <div class="main">
      <div class="name">${escapeHtml(achievement.name)}</div>
      <div class="date">${formatDateTime(achievement.completedAt)}</div>
    </div>
    <div class="row-hover-actions">
      <button class="reminders-icon-btn row-delete-btn" type="button" aria-label="Delete achievement">
        <img data-icon="Icons/icon_delete.svg" alt="">
      </button>
    </div>
  `;

  item.querySelector('.row-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    window.api.achievementsDelete(achievement.id)
      .then(loadAchievements)
      .catch((err) => console.error('Delete achievement failed:', err));
  });

  loadAchievementIcons(item);
  return item;
}

async function loadAchievements() {
  const achievements = await window.api.achievementsList();
  const sorted = [...achievements].sort((a, b) => b.completedAt - a.completedAt);

  renderLevelSummary(sorted.length);
  listEl.innerHTML = '';

  if (!sorted.length) {
    listEl.innerHTML = '<div class="home-empty">No achievements logged yet. Complete a task above!</div>';
    return;
  }

  sorted.forEach((a) => listEl.appendChild(renderAchievementItem(a)));

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
  progressFraction = document.getElementById('achievements-progress-fraction');
  progressLabel = document.getElementById('achievements-progress-label');
  listEl = document.getElementById('achievements-list');

  if (!form || !nameInput || !logBtn || !listEl) {
    throw new Error('Achievements: required elements missing');
  }

  loadAchievementIcons(document.getElementById('view-achievements'));

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
