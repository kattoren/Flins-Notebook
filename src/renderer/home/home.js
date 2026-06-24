(function () {
  if (!window.AppShared) {
    console.error('home.js: AppShared missing');
    return;
  }

const {
  escapeHtml,
  formatTime12,
  formatDateTime,
  getLevelInfo,
  getUpcomingToday,
} = window.AppShared;

const levelNumberEl = document.getElementById('home-level');
const totalEl = document.getElementById('home-total');
const progressFill = document.getElementById('home-progress-fill');
const progressLabel = document.getElementById('home-progress-label');
const upcomingEl = document.getElementById('home-upcoming');
const recentEl = document.getElementById('home-recent');

function renderProgress(info) {
  levelNumberEl.textContent = String(info.level);
  totalEl.textContent = String(info.total);
  progressFill.style.width = `${Math.round(info.progress * 100)}%`;

  if (info.isMax) {
    progressLabel.textContent = 'Max level reached — keep going!';
  } else {
    progressLabel.textContent = `${info.untilNext} achievements until Level ${info.level + 1}`;
  }
}

function renderUpcoming(reminders) {
  const upcoming = getUpcomingToday(reminders);
  upcomingEl.innerHTML = '';

  if (!upcoming.length) {
    upcomingEl.innerHTML = '<div class="empty-state compact">No more reminders today.</div>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'home-list';
  upcoming.forEach((reminder) => {
    const row = document.createElement('div');
    row.className = 'home-list-item';
    row.innerHTML = `
      <span class="home-list-time">${formatTime12(reminder.time)}</span>
      <span class="home-list-title">${escapeHtml(reminder.title)}</span>
    `;
    list.appendChild(row);
  });
  upcomingEl.appendChild(list);
}

function renderRecent(achievements) {
  const sorted = [...achievements].sort((a, b) => b.completedAt - a.completedAt).slice(0, 3);
  recentEl.innerHTML = '';

  if (!sorted.length) {
    recentEl.innerHTML = '<div class="empty-state compact">No achievements yet.</div>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'home-list';
  sorted.forEach((achievement) => {
    const row = document.createElement('div');
    row.className = 'home-list-item';
    row.innerHTML = `
      <span class="home-list-title">${escapeHtml(achievement.name)}</span>
      <span class="home-list-meta">${formatDateTime(achievement.completedAt)}</span>
    `;
    list.appendChild(row);
  });
  recentEl.appendChild(list);
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
