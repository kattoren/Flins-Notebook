function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      navButtons.forEach((b) => b.classList.toggle('active', b === btn));
      views.forEach((view) => {
        view.classList.toggle('active', view.id === `view-${viewId}`);
      });

      if (viewId === 'home' && window.refreshHome) {
        window.refreshHome();
      }
      if (viewId === 'reminders' && window.refreshReminders) {
        window.refreshReminders();
      }
      if (viewId === 'achievements' && window.refreshAchievements) {
        window.refreshAchievements();
      }
    });
  });
}

function initVolumeControl() {
  const slider = document.getElementById('voiceline-volume');

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
}

function initWindowControls() {
  const summonBtn = document.getElementById('summon');

  function setSummonEnabled(visible) {
    summonBtn.disabled = visible;
  }

  document.getElementById('minimize').addEventListener('click', () => {
    window.api.minimizeWindow();
  });

  document.getElementById('close').addEventListener('click', () => {
    window.api.closeWindow();
  });

  summonBtn.addEventListener('click', () => {
    if (!summonBtn.disabled) {
      window.api.summonFlins();
    }
  });

  document.getElementById('close-book').addEventListener('click', () => {
    window.api.quitApp();
  });

  window.api.isPetVisible()
    .then(setSummonEnabled)
    .catch(() => setSummonEnabled(false));

  window.api.onPetVisibilityChange((visible) => {
    setSummonEnabled(visible);
  });
}

function runInit(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`Failed to initialize ${name}:`, err);
  }
}

function bootstrap() {
  if (!window.api) {
    console.error('window.api is not available — preload did not load');
    return;
  }

  if (!window.AppShared) {
    console.error('AppShared is not available — shared.js did not load');
    return;
  }

  initWindowControls();
  initVolumeControl();
  initNavigation();

  runInit('home', () => window.initHome?.());
  runInit('reminders', () => window.initReminders?.());
  runInit('achievements', () => window.initAchievements?.());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}