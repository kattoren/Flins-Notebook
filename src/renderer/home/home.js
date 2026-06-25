(function () {
  if (!window.AppShared) {
    console.error('home.js: AppShared missing');
    return;
  }

const {
  escapeHtml,
  formatTime12,
  getLevelInfo,
  getUpcomingToday,
} = window.AppShared;

const levelNumberEl = document.getElementById('home-level');
const totalEl = document.getElementById('home-total');
const progressFill = document.getElementById('home-progress-fill');
const progressFraction = document.getElementById('home-progress-fraction');
const progressLabel = document.getElementById('home-progress-label');
const upcomingEl = document.getElementById('home-upcoming');
const recentEl = document.getElementById('home-recent');

function renderProgress(info) {
  levelNumberEl.textContent = String(info.level);
  totalEl.textContent = String(info.total);
  progressFill.style.width = `${Math.round(info.progress * 100)}%`;

  if (info.isMax) {
    progressFraction.textContent = 'MAX';
    progressLabel.textContent = 'Max level reached — keep going!';
  } else {
    const currentInBand = info.total - (info.level > 0 ? window.AppShared.LEVEL_THRESHOLDS[info.level - 1] : 0);
    const bandSize = info.nextThreshold - (info.level > 0 ? window.AppShared.LEVEL_THRESHOLDS[info.level - 1] : 0);
    progressFraction.textContent = `${currentInBand} / ${bandSize}`;
    progressLabel.textContent = `${info.untilNext} achievements until Level ${info.level + 1}`;
  }
}

function renderUpcoming(reminders) {
  const upcoming = getUpcomingToday(reminders);
  upcomingEl.innerHTML = '';

  if (!upcoming.length) {
    upcomingEl.innerHTML = '<div class="home-empty">No more reminders today.</div>';
    return;
  }

  upcoming.forEach((reminder) => {
    const row = document.createElement('div');
    row.className = 'home-reminder-row';
    row.innerHTML = `
      <span class="bullet" aria-hidden="true"></span>
      <span class="title">${escapeHtml(reminder.title)}</span>
      <span class="time">${formatTime12(reminder.time)}</span>
    `;
    upcomingEl.appendChild(row);
  });
}

function renderRecent(achievements) {
  const sorted = [...achievements].sort((a, b) => b.completedAt - a.completedAt).slice(0, 5);
  recentEl.innerHTML = '';

  if (!sorted.length) {
    recentEl.innerHTML = '<div class="home-empty">No achievements yet.</div>';
    return;
  }

  sorted.forEach((achievement) => {
    const row = document.createElement('div');
    row.className = 'home-recent-row';
    row.innerHTML = `
      <span class="bullet" aria-hidden="true"></span>
      <span class="title">${escapeHtml(achievement.name)}</span>
    `;
    recentEl.appendChild(row);
  });
}

async function loadHome() {
  const [reminders, achievements] = await Promise.all([
    window.api.remindersList(),
    window.api.achievementsList(),
  ]);

  renderProgress(getLevelInfo(achievements.length));
  renderUpcoming(reminders);
  renderRecent(achievements);
}

function initHome() {
  if (!levelNumberEl || !upcomingEl) {
    console.error('Home: required elements missing');
    return;
  }
  window.refreshHome = loadHome;
  loadHome();
}

window.initHome = initHome;
})();
