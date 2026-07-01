function createPetTimer(callbacks) {
  const { onTick, onBreakStart, onTimerComplete, onPhaseEnd, onStop } = callbacks;
  let timer = null;
  let state = null;

  function emitTick() {
    if (!state) return 0;
    const remaining = state.endAt - Date.now();
    onTick({
      display: formatRemaining(remaining),
      phase: state.phase,
      type: state.type,
      running: remaining > 0,
    });
    return remaining;
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function stop() {
    clearTimer();
    state = null;
    onStop();
  }

  function handlePhaseComplete() {
    if (!state) return;

    if (state.type === 'simple') {
      onTimerComplete({ type: 'simple', phase: state.phase });
      onPhaseEnd({ phase: state.phase });
      stop();
      return;
    }

    if (state.type === 'pomodoro' && state.phase === 'work') {
      state.cyclesCompleted += 1;

      if (state.cyclesCompleted >= state.cyclesTotal) {
        onTimerComplete({ type: 'pomodoro', phase: 'work', nextPhase: null });
        onPhaseEnd({ phase: 'work', completedAll: true });
        stop();
        return;
      }

      onTimerComplete({ type: 'pomodoro', phase: 'work', nextPhase: 'break' });
      state.phase = 'break';
      state.endAt = Date.now() + state.breakSec * 1000;
      onBreakStart();
      emitTick();
      return;
    }

    if (state.type === 'pomodoro' && state.phase === 'break') {
      onTimerComplete({ type: 'pomodoro', phase: 'break', nextPhase: 'work' });
      state.phase = 'work';
      state.endAt = Date.now() + state.workSec * 1000;
      onPhaseEnd({ phase: 'break' });
      emitTick();
      return;
    }

    onPhaseEnd({ phase: state.phase });
    stop();
  }

  function startInterval() {
    clearTimer();
    emitTick();
    timer = setInterval(() => {
      const remaining = emitTick();
      if (remaining <= 0) {
        handlePhaseComplete();
      }
    }, 1000);
  }

  function startSimple(totalSeconds) {
    const secs = Math.max(1, Math.round(Number(totalSeconds) || 1));
    state = {
      type: 'simple',
      phase: 'countdown',
      endAt: Date.now() + secs * 1000,
    };
    startInterval();
    return state;
  }

  function startPomodoro(workSeconds, breakSeconds, cycles = 4) {
    const workSec = Math.max(1, Math.round(Number(workSeconds) || 25 * 60));
    const breakSec = Math.max(1, Math.round(Number(breakSeconds) || 5 * 60));
    const cycleCount = Math.max(1, Math.round(Number(cycles) || 1));
    state = {
      type: 'pomodoro',
      phase: 'work',
      workSec,
      breakSec,
      cyclesTotal: cycleCount,
      cyclesCompleted: 0,
      endAt: Date.now() + workSec * 1000,
    };
    startInterval();
    return state;
  }

  function isRunning() {
    return Boolean(state);
  }

  function getState() {
    return state ? { ...state } : null;
  }

  return {
    startSimple,
    startPomodoro,
    stop,
    isRunning,
    getState,
    formatRemaining,
  };
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

module.exports = { createPetTimer, formatRemaining };
