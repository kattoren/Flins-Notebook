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
const upcomingEl = document.getElementById('home-upcoming');
const recentEl = document.getElementById('home-recent');

function renderProgress(info) {
  levelNumberEl.textContent = String(info.level);
  totalEl.textContent = String(info.total);
}

function renderUpcoming(reminders) {
  const upcoming = getUpcomingToday(reminders)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));
  const nextId = upcoming[0]?.id;
  upcomingEl.innerHTML = '';

  if (!upcoming.length) {
    upcomingEl.innerHTML = '<div class="home-empty">No more reminders today.</div>';
    return;
  }

  upcoming.forEach((reminder) => {
    const row = document.createElement('div');
    row.className = `home-reminder-row${reminder.id === nextId ? ' is-next-up' : ''}`;
    row.innerHTML = `
      <span class="bullet" aria-hidden="true"></span>
      <span class="title">${escapeHtml(reminder.title)}</span>
      <span class="time">${formatTime12(reminder.time)}</span>
    `;
    upcomingEl.appendChild(row);
  });
}

function renderRecent(achievements) {
  const sorted = [...achievements].sort((a, b) => b.completedAt - a.completedAt).slice(0, 10);
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
  loadHome().catch((err) => console.error('Load home failed:', err));
}

window.initHome = initHome;
})();
