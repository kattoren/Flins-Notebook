function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function createPetTimer(callbacks) {
  const { onTick, onBreakStart, onPhaseEnd, onStop } = callbacks;
  let timer = null;
  let state = null;

  function emitTick() {
    if (!state) return;
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

    if (state.type === 'pomodoro' && state.phase === 'work') {
      state.phase = 'break';
      state.endAt = Date.now() + state.breakMin * 60_000;
      onBreakStart();
      emitTick();
      return;
    }

    if (state.type === 'pomodoro' && state.phase === 'break') {
      state.phase = 'work';
      state.endAt = Date.now() + state.workMin * 60_000;
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

  function startSimple(minutes) {
    const mins = Math.max(1, Math.round(Number(minutes) || 1));
    state = {
      type: 'simple',
      phase: 'countdown',
      endAt: Date.now() + mins * 60_000,
    };
    startInterval();
    return state;
  }

  function startPomodoro(workMinutes, breakMinutes) {
    const workMin = Math.max(1, Math.round(Number(workMinutes) || 25));
    const breakMin = Math.max(1, Math.round(Number(breakMinutes) || 5));
    state = {
      type: 'pomodoro',
      phase: 'work',
      workMin,
      breakMin,
      endAt: Date.now() + workMin * 60_000,
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

module.exports = { createPetTimer, formatRemaining };
