const GRAVITY = 1350;
const BOUNCE = 0.34;
const FRICTION = 0.88;
const ROAM_SPEED = 42;
const MAX_THROW = 1800;
const TICK_MS = 16;

function capVelocity(vx, vy) {
  const speed = Math.hypot(vx, vy);
  if (speed <= MAX_THROW) return { vx, vy };
  const scale = MAX_THROW / speed;
  return { vx: vx * scale, vy: vy * scale };
}

function createPetPhysics(deps) {
  const {
    getPetWindow,
    getScreenBounds,
    getRoamMode,
    isPetBusy,
  } = deps;

  let pos = { x: 0, y: 0 };
  let vel = { vx: 0, vy: 0 };
  let onGround = false;
  let bounds = { minX: 0, maxX: 0, floorY: 0, ceilingY: 0 };
  let roamTargetX = null;
  let roamPause = 0;
  let lastAppliedX = null;
  let lastAppliedY = null;
  let lastTick = 0;
  let boundsRefreshAt = 0;
  let physicsTimer = null;
  let roamWakeTimer = null;
  let dragging = false;
  let dragStartMouse = { x: 0, y: 0 };
  let dragStartWin = { x: 0, y: 0 };

  function applyPosition(x, y) {
    const win = getPetWindow();
    if (!win || win.isDestroyed()) return;
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (rx === lastAppliedX && ry === lastAppliedY) return;
    lastAppliedX = rx;
    lastAppliedY = ry;
    pos.x = x;
    pos.y = y;
    win.setPosition(rx, ry);
  }

  function refreshBounds() {
    bounds = getScreenBounds();
    boundsRefreshAt = Date.now();
  }

  function clearRoamWake() {
    if (roamWakeTimer) {
      clearTimeout(roamWakeTimer);
      roamWakeTimer = null;
    }
  }

  function stopLoop() {
    if (physicsTimer) {
      clearInterval(physicsTimer);
      physicsTimer = null;
    }
  }

  function stop() {
    stopLoop();
    clearRoamWake();
    dragging = false;
  }

  function needsPhysicsLoop() {
    if (!onGround || pos.y < bounds.floorY - 1) return true;
    if (Math.abs(vel.vy) > 1) return true;
    if (Math.abs(vel.vx) > 1) return true;
    if (roamTargetX !== null) return true;
    if (roamPause > 0 && Math.abs(vel.vx) > 0.5) return true;
    return false;
  }

  function pickRoamTarget() {
    roamTargetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    roamPause = 0.8 + Math.random() * 2.5;
  }

  function scheduleRoamWake() {
    clearRoamWake();
    if (!getRoamMode() || dragging) return;

    const wait = 1500 + Math.random() * 3500;
    roamWakeTimer = setTimeout(() => {
      roamWakeTimer = null;
      if (!getRoamMode() || dragging) return;
      if (isPetBusy()) {
        scheduleRoamWake();
        return;
      }
      pickRoamTarget();
      startLoop();
    }, wait);
  }

  function settleOnFloor() {
    pos.y = bounds.floorY;
    vel.vx = 0;
    vel.vy = 0;
    onGround = true;
    applyPosition(pos.x, pos.y);
    scheduleRoamWake();
  }

  function updateRoam(dt) {
    if (!onGround || dragging || isPetBusy()) return;

    if (roamPause > 0) {
      roamPause -= dt;
      vel.vx *= 0.9;
      if (Math.abs(vel.vx) < 2) vel.vx = 0;
      return;
    }

    if (roamTargetX === null) return;

    const dx = roamTargetX - pos.x;
    if (Math.abs(dx) < 6) {
      roamTargetX = null;
      vel.vx = 0;
      roamPause = 1.5 + Math.random() * 4;
      return;
    }

    vel.vx = Math.sign(dx) * ROAM_SPEED;
  }

  function tick() {
    if (!getRoamMode() || dragging) {
      stopLoop();
      return;
    }

    const now = Date.now();
    const dt = Math.min(0.032, Math.max(0.001, (now - lastTick) / 1000));
    lastTick = now;

    if (now - boundsRefreshAt > 2000) {
      refreshBounds();
    }

    if (!onGround || pos.y < bounds.floorY - 1) {
      vel.vy += GRAVITY * dt;
    }

    updateRoam(dt);

    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;

    if (pos.x < bounds.minX) {
      pos.x = bounds.minX;
      vel.vx = Math.abs(vel.vx) * 0.35;
    } else if (pos.x > bounds.maxX) {
      pos.x = bounds.maxX;
      vel.vx = -Math.abs(vel.vx) * 0.35;
    }

    if (pos.y < bounds.ceilingY) {
      pos.y = bounds.ceilingY;
      vel.vy = Math.abs(vel.vy) * 0.25;
    }

    if (pos.y >= bounds.floorY) {
      pos.y = bounds.floorY;
      if (Math.abs(vel.vy) > 100) {
        vel.vy = -vel.vy * BOUNCE;
        vel.vx *= FRICTION;
        onGround = false;
      } else {
        vel.vy = 0;
        onGround = true;
        vel.vx *= 0.96;
        if (Math.abs(vel.vx) < 3) vel.vx = 0;
      }
    } else {
      onGround = false;
    }

    applyPosition(pos.x, pos.y);

    if (!needsPhysicsLoop()) {
      stopLoop();
      scheduleRoamWake();
    }
  }

  function startLoop() {
    if (!getRoamMode() || dragging || physicsTimer) return;
    lastTick = Date.now();
    clearRoamWake();
    physicsTimer = setInterval(tick, TICK_MS);
  }

  function reset() {
    stop();
    refreshBounds();
    const win = getPetWindow();
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition();
      pos.x = x;
      pos.y = y;
      lastAppliedX = Math.round(x);
      lastAppliedY = Math.round(y);
    }
    vel.vx = 0;
    vel.vy = 0;
    roamTargetX = null;
    roamPause = 0;

    if (getRoamMode()) {
      settleOnFloor();
    } else {
      onGround = false;
    }
  }

  function onRoamModeChanged(enabled) {
    if (enabled) {
      refreshBounds();
      if (pos.y >= bounds.floorY - 2) {
        settleOnFloor();
      } else {
        startLoop();
      }
    } else {
      stop();
      vel.vx = 0;
      vel.vy = 0;
      roamTargetX = null;
    }
  }

  function dragStart(screenX, screenY) {
    dragging = true;
    stop();
    dragStartMouse = { x: screenX, y: screenY };
    const win = getPetWindow();
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition();
      dragStartWin = { x, y };
      pos.x = x;
      pos.y = y;
      lastAppliedX = Math.round(x);
      lastAppliedY = Math.round(y);
    }
  }

  function dragMove(screenX, screenY) {
    if (!dragging) return;
    const dx = screenX - dragStartMouse.x;
    const dy = screenY - dragStartMouse.y;
    applyPosition(dragStartWin.x + dx, dragStartWin.y + dy);
  }

  function dragEnd({ vx, vy, moved }) {
    dragging = false;

    if (!getRoamMode()) {
      onGround = false;
      return;
    }

    refreshBounds();

    if (!moved) {
      if (pos.y >= bounds.floorY - 2) {
        settleOnFloor();
      } else {
        startLoop();
      }
      return;
    }

    const capped = capVelocity(vx, vy);
    vel.vx = capped.vx;
    vel.vy = capped.vy;
    onGround = false;
    roamTargetX = null;
    startLoop();
  }

  return {
    reset,
    stop,
    onRoamModeChanged,
    dragStart,
    dragMove,
    dragEnd,
  };
}

module.exports = { createPetPhysics };
