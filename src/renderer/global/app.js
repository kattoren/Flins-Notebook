const MARK_YES = 'Book/Mark_yes current.svg';
const MARK_NO = 'Book/Mark_not current.svg';
const MARK_VERTICAL = 'Book/Mark_vertical.svg';

const ASSET_PATHS = {
  bookClose: 'Book/Book_close.png',
  bookBg: 'Book/Book_open_bg.png',
  bookTop: 'Book/Book_open_top.png',
};

let currentView = 'home';
let volumeExpanded = false;

function applyBookScale() {
  const layout = window.BookLayout;
  if (!layout) return;

  const scale = layout.BOOK_SCALE;
  const openSize = layout.getBookWindowSize(true);
  const closedSize = layout.getBookWindowSize(false);

  document.documentElement.style.setProperty('--book-scale', String(scale));
  document.documentElement.style.setProperty('--book-open-shell-w', `${openSize.width}px`);
  document.documentElement.style.setProperty('--book-closed-shell-w', `${closedSize.width}px`);
  document.documentElement.style.setProperty('--book-shell-h', `${openSize.height}px`);

  const bookOpenShell = document.getElementById('book-open');
  const bookClosedShell = document.getElementById('book-closed');
  if (bookOpenShell) {
    bookOpenShell.style.width = `${openSize.width}px`;
    bookOpenShell.style.height = `${openSize.height}px`;
  }
  if (bookClosedShell) {
    bookClosedShell.style.width = `${closedSize.width}px`;
    bookClosedShell.style.height = `${closedSize.height}px`;
  }
}

async function loadUiAsset(relativePath) {
  return window.api.getUiAssetUrl(relativePath);
}

function applyMaskIcon(el, url) {
  const mask = `url("${url}")`;
  el.style.webkitMaskImage = mask;
  el.style.maskImage = mask;
  el.removeAttribute('src');
}

async function initBookAssets() {
  const [bookClose, bookBg, bookTop, markYes, markNo, markVertical] = await Promise.all([
    loadUiAsset(ASSET_PATHS.bookClose),
    loadUiAsset(ASSET_PATHS.bookBg),
    loadUiAsset(ASSET_PATHS.bookTop),
    loadUiAsset(MARK_YES),
    loadUiAsset(MARK_NO),
    loadUiAsset(MARK_VERTICAL),
  ]);

  document.getElementById('img-book-close').src = bookClose;
  document.getElementById('img-book-bg').src = bookBg;
  document.getElementById('img-book-top').src = bookTop;

  window.bookMarkAssets = { yes: markYes, no: markNo };

  document.querySelectorAll('.mark-bg-img').forEach((img) => {
    img.src = markNo;
  });

  document.querySelectorAll('.win-mark-bg-img').forEach((img) => {
    img.src = markVertical;
  });

  const bookIconLoads = [...document.querySelectorAll('.book-mark-icon[data-icon]')].map(async (el) => {
    applyMaskIcon(el, await loadUiAsset(el.dataset.icon));
  });

  const winIconLoads = [...document.querySelectorAll('.win-tab-icon[data-icon]')].map(async (img) => {
    img.src = await loadUiAsset(img.dataset.icon);
  });

  await Promise.all([...bookIconLoads, ...winIconLoads]);
}

function setBookShell(open) {
  document.getElementById('book-closed').classList.toggle('hidden', open);
  document.getElementById('book-open').classList.toggle('hidden', !open);
  document.body.classList.toggle('book-is-open', open);
  document.body.classList.toggle('book-is-closed', !open);
}

async function openBook({ playSound = true } = {}) {
  collapseVolumeDrawer();
  await window.api.setBookOpen(true);
  setBookShell(true);
  if (playSound && window.BookSfx) {
    window.BookSfx.playBookOpen();
  }
  switchView('home', { playSound: false });
}

async function closeBook({ playSound = true } = {}) {
  collapseVolumeDrawer();
  if (playSound && window.BookSfx) {
    window.BookSfx.playBookClose();
  }
  await window.api.setBookOpen(false);
  setBookShell(false);
}

function updateMarkVisuals() {
  const { yes, no } = window.bookMarkAssets || {};
  if (!yes || !no) return;

  document.querySelectorAll('.mark-bg-img').forEach((img) => {
    const key = img.dataset.markFor;
    let useYes = false;

    if (key === currentView) {
      useYes = true;
    } else if (key === 'volume' && volumeExpanded) {
      useYes = true;
    }

    img.src = useYes ? yes : no;
  });
}

function updateMarkStates() {
  updateMarkVisuals();

  document.querySelectorAll('.book-mark[data-view]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === currentView);
  });

  const volumeBtn = document.getElementById('mark-volume');
  if (volumeBtn) {
    volumeBtn.classList.toggle('is-active', volumeExpanded);
  }

  const summonBtn = document.getElementById('mark-summon');
  if (summonBtn) {
    window.api.isPetVisible()
      .then((visible) => {
        summonBtn.disabled = visible;
      })
      .catch(() => {
        summonBtn.disabled = false;
      });
  }
}

function switchView(viewId, { playSound = true } = {}) {
  const changed = viewId !== currentView;
  currentView = viewId;
  document.querySelectorAll('.book-page.view').forEach((view) => {
    view.classList.toggle('active', view.id === `view-${viewId}`);
  });
  updateMarkStates();

  if (playSound && changed && window.BookSfx) {
    window.BookSfx.playBookOpen();
  }

  if (viewId === 'home' && window.refreshHome) {
    window.refreshHome();
  }
  if (viewId === 'reminders' && window.refreshReminders) {
    window.refreshReminders();
  }
  if (viewId === 'achievements' && window.refreshAchievements) {
    window.refreshAchievements();
  }
}

function collapseVolumeDrawer() {
  if (!volumeExpanded) return;
  volumeExpanded = false;
  document.getElementById('volume-mark-wrap').classList.remove('expanded');
  updateMarkStates();
}

function toggleVolumeDrawer() {
  volumeExpanded = !volumeExpanded;
  document.getElementById('volume-mark-wrap').classList.toggle('expanded', volumeExpanded);
  updateMarkStates();
}

function initMarkHover() {
  const linkHover = (trigger, bg) => {
    if (!trigger || !bg) return;
    trigger.addEventListener('mouseenter', () => bg.classList.add('mark-hover'));
    trigger.addEventListener('mouseleave', () => bg.classList.remove('mark-hover'));
  };

  document.querySelectorAll('.book-mark[data-mark-for]').forEach((btn) => {
    const bg = document.querySelector(`.mark-bg-img[data-mark-for="${btn.dataset.markFor}"]`);
    linkHover(btn, bg);
  });

  linkHover(
    document.getElementById('win-minimize'),
    document.querySelector('.win-mark-bg-img[data-for="minimize"]'),
  );
  linkHover(
    document.getElementById('win-close'),
    document.querySelector('.win-mark-bg-img[data-for="close"]'),
  );
}

function initNavigation() {
  document.querySelectorAll('.book-mark[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      collapseVolumeDrawer();
      switchView(btn.dataset.view);
    });
  });

  document.getElementById('mark-summon').addEventListener('click', () => {
    collapseVolumeDrawer();
    if (!document.getElementById('mark-summon').disabled) {
      window.api.summonFlins();
    }
  });
}

function initVolumeControl() {
  const slider = document.getElementById('voiceline-volume');
  const wrap = document.getElementById('volume-mark-wrap');
  const drawer = document.getElementById('volume-drawer');
  const volumeBtn = document.getElementById('mark-volume');

  window.api.settingsGet()
    .then((settings) => {
      const volume = settings.voicelineVolume ?? 0.25;
      slider.value = String(Math.round(volume * 100));
    })
    .catch(() => {
      slider.value = '25';
    });

  slider.addEventListener('input', () => {
    const value = Number(slider.value) / 100;
    window.api.setVoicelineVolume(value);
  });

  slider.addEventListener('click', (e) => e.stopPropagation());

  volumeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleVolumeDrawer();
  });

  drawer.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', (e) => {
    if (!volumeExpanded) return;
    if (!wrap.contains(e.target)) {
      collapseVolumeDrawer();
    }
  });
}

function initWindowControls() {
  document.getElementById('win-minimize').addEventListener('click', () => {
    window.api.minimizeWindow();
  });

  document.getElementById('win-close').addEventListener('click', async () => {
    await closeBook({ playSound: true });
    window.api.closeWindow();
  });

  document.getElementById('mark-exit').addEventListener('click', () => {
    window.api.quitApp();
  });

  document.getElementById('close-book-fold').addEventListener('click', () => {
    closeBook({ playSound: true });
  });

  document.getElementById('book-cover-open').addEventListener('click', () => {
    openBook({ playSound: true });
  });

  window.api.onPetVisibilityChange(() => {
    updateMarkStates();
  });

  window.api.onBookOpen(() => {
    openBook({ playSound: true });
  });
}

function initBookState() {
  return window.api.getBookOpen()
    .then((open) => {
      setBookShell(open);
      if (open) {
        switchView('home', { playSound: false });
      }
    })
    .catch(() => {
      setBookShell(false);
    });
}

function runInit(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`Failed to initialize ${name}:`, err);
  }
}

async function bootstrap() {
  if (!window.api) {
    console.error('window.api is not available — preload did not load');
    return;
  }

  if (!window.AppShared) {
    console.error('AppShared is not available — shared.js did not load');
    return;
  }

  applyBookScale();
  if (window.BookSfx) {
    await window.BookSfx.preloadAll();
  }
  await initBookAssets();
  await initBookState();

  initWindowControls();
  initVolumeControl();
  initNavigation();
  initMarkHover();
  updateMarkStates();

  runInit('home', () => window.initHome?.());
  runInit('reminders', () => window.initReminders?.());
  runInit('achievements', () => window.initAchievements?.());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
