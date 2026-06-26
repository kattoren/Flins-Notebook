const DRAG_THRESHOLD = 5;
const GRAVITY = 3200;
const BOUNCE = 0.32;
const FRICTION = 0.88;
const ROAM_SPEED = 42;
const MAX_THROW = 1800;

const img = document.getElementById('flins');
const bubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
let idleSrc = '';
let dragging = false;
let moved = false;
let startMouse = { x: 0, y: 0 };
let startWin = { x: 0, y: 0 };
let lastDragSample = { x: 0, y: 0, t: 0 };
let dragVelocity = { vx: 0, vy: 0 };

let roamMode = true;
let physicsActive = false;
let pos = { x: 0, y: 0 };
let vel = { vx: 0, vy: 0 };
let onGround = false;
let bounds = { minX: 0, maxX: 0, floorY: 0, ceilingY: 0 };
let roamTargetX = null;
let roamPause = 0;
let physicsFrame = null;
let lastTick = 0;
let boundsRefreshAt = 0;

function applyFixedSize(width, height, windowHeight) {
  const h = windowHeight || height;
  const stack = document.querySelector('.flins-stack');
  document.documentElement.style.width = `${width}px`;
  document.documentElement.style.height = `${h}px`;
  document.body.style.width = `${width}px`;
  document.body.style.height = `${h}px`;
  document.getElementById('pet-root').style.width = `${width}px`;
  document.getElementById('pet-root').style.height = `${h}px`;
  stack.style.width = `${width}px`;
  stack.style.height = `${height}px`;
  img.style.width = `${width}px`;
  img.style.height = `${height}px`;
  bubble.style.width = `${width}px`;
}

function setPetSprite(src) {
  if (src) img.src = src;
}

function resetToIdle() {
  hideBubble();
  setPetSprite(idleSrc);
}

function showBubble(text) {
  speechText.textContent = text || '';
  bubble.classList.remove('hidden');
  bubble.setAttribute('aria-hidden', 'false');
}

function hideBubble() {
  bubble.classList.add('hidden');
  bubble.setAttribute('aria-hidden', 'true');
  speechText.textContent = '';
}

function capVelocity(vx, vy) {
  const speed = Math.hypot(vx, vy);
  if (speed <= MAX_THROW) return { vx, vy };
  const scale = MAX_THROW / speed;
  return { vx: vx * scale, vy: vy * scale };
}

async function refreshBounds() {
  bounds = await window.petApi.getScreenBounds();
}

function applyPosition(x, y) {
  pos.x = x;
  pos.y = y;
  window.petApi.setPosition(Math.round(x), Math.round(y));
}

function snapToFloor() {
  pos.y = bounds.floorY;
  vel.vx = 0;
  vel.vy = 0;
  onGround = true;
  applyPosition(pos.x, pos.y);
}

function startPhysics() {
  if (!roamMode || physicsActive) return;
  physicsActive = true;
  lastTick = performance.now();
  if (!physicsFrame) {
    physicsFrame = requestAnimationFrame(tickPhysics);
  }
}

function stopPhysics() {
  physicsActive = false;
  if (physicsFrame) {
    cancelAnimationFrame(physicsFrame);
    physicsFrame = null;
  }
}

function settleOnFloor() {
  pos.y = bounds.floorY;
  vel.vx = 0;
  vel.vy = 0;
  onGround = true;
  applyPosition(pos.x, pos.y);
}

function pickRoamTarget() {
  roamTargetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
  roamPause = 0.8 + Math.random() * 2.5;
}

function updateRoam(dt) {
  if (!onGround || dragging || window.PetAudioPlayer.isBusy()) return;

  if (roamPause > 0) {
    roamPause -= dt;
    vel.vx *= 0.9;
    if (vel.vx < 2 && vel.vx > -2) vel.vx = 0;
    return;
  }

  if (roamTargetX === null) {
    if (Math.random() < 0.015) pickRoamTarget();
    return;
  }

  const dx = roamTargetX - pos.x;
  if (Math.abs(dx) < 6) {
    roamTargetX = null;
    vel.vx = 0;
    roamPause = 1.5 + Math.random() * 4;
    return;
  }

  vel.vx = Math.sign(dx) * ROAM_SPEED;
}

function maybeRefreshBounds() {
  const now = performance.now();
  if (now - boundsRefreshAt < 400) return;
  boundsRefreshAt = now;
  window.petApi.getScreenBounds().then((b) => {
    bounds = b;
  });
}

function tickPhysics(now) {
  physicsFrame = requestAnimationFrame(tickPhysics);

  if (!roamMode || dragging) {
    stopPhysics();
    return;
  }

  const dt = Math.min(0.032, (now - lastTick) / 1000);
  lastTick = now;
  if (dt <= 0) return;

  maybeRefreshBounds();

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
    if (Math.abs(vel.vy) > 120) {
      vel.vy = -vel.vy * BOUNCE;
      vel.vx *= FRICTION;
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
}

function releaseDrag() {
  if (!roamMode) {
    onGround = false;
    return;
  }

  refreshBounds().then(() => {
    const capped = capVelocity(dragVelocity.vx, dragVelocity.vy);
    vel.vx = capped.vx;
    vel.vy = capped.vy;
    onGround = false;
    roamTargetX = null;
    startPhysics();
  });
}

function setRoamMode(enabled) {
  roamMode = enabled;
  img.style.cursor = 'grab';

  if (roamMode) {
    refreshBounds().then(() => {
      if (pos.y >= bounds.floorY - 2) {
        settleOnFloor();
      } else {
        startPhysics();
      }
    });
  } else {
    stopPhysics();
    vel.vx = 0;
    vel.vy = 0;
    roamTargetX = null;
  }
}

async function resetPhysicsState() {
  stopPhysics();
  await refreshBounds();
  const current = await window.petApi.getPosition();
  pos.x = current.x;
  pos.y = current.y;
  vel.vx = 0;
  vel.vy = 0;
  roamTargetX = null;
  roamPause = 0;

  if (roamMode) {
    settleOnFloor();
    startPhysics();
  } else {
    onGround = false;
  }
}

function setupAudioListeners() {
  const player = window.PetAudioPlayer;

  window.petApi.onStopAudio(() => {
    player.stop();
    resetToIdle();
  });

  window.petApi.onPlayVoiceline(({ dataUrl, volume, text, imageSrc }) => {
    showBubble(text);
    setPetSprite(imageSrc);
    player.playDataUrl(dataUrl, volume, { interrupt: true, onEnded: resetToIdle });
  });

  window.petApi.onVoicelineVolumeChange((volume) => {
    player.setVolume(volume);
  });

  window.petApi.onPlayAudio(({ dataUrl, volume, playCount }) => {
    resetToIdle();
    player.playSequence(dataUrl, volume, playCount);
  });

  window.petApi.onReact(() => {
    img.classList.add('react');
    setTimeout(() => img.classList.remove('react'), 1400);
  });
}

async function init() {
  setupAudioListeners();
  window.petApi.onRoamModeChange((enabled) => setRoamMode(enabled));
  window.petApi.onResetPhysics(() => {
    resetPhysicsState().catch((err) => console.error('Reset physics failed:', err));
  });

  const dims = await window.petApi.getDimensions();
  idleSrc = await window.petApi.getImageSrc();
  roamMode = await window.petApi.getRoamMode();
  applyFixedSize(dims.width, dims.height, dims.windowHeight);
  setPetSprite(idleSrc);

  await resetPhysicsState();

  window.petApi.notifyReady();
}

img.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  dragging = true;
  moved = false;
  stopPhysics();
  startMouse = { x: e.screenX, y: e.screenY };
  lastDragSample = { x: e.screenX, y: e.screenY, t: performance.now() };
  dragVelocity = { vx: 0, vy: 0 };
  img.style.cursor = 'grabbing';

  window.petApi.getPosition().then((current) => {
    if (dragging) {
      startWin = current;
      pos.x = current.x;
      pos.y = current.y;
    }
  });
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - startMouse.x;
  const dy = e.screenY - startMouse.y;
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;

  const now = performance.now();
  const dt = (now - lastDragSample.t) / 1000;
  if (dt > 0) {
    dragVelocity.vx = (e.screenX - lastDragSample.x) / dt;
    dragVelocity.vy = (e.screenY - lastDragSample.y) / dt;
    lastDragSample = { x: e.screenX, y: e.screenY, t: now };
  }

  const nextX = startWin.x + dx;
  const nextY = startWin.y + dy;
  pos.x = nextX;
  pos.y = nextY;
  window.petApi.setPosition(Math.round(nextX), Math.round(nextY));
});

window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  const wasClick = !moved && e.button === 0;
  dragging = false;
  img.style.cursor = 'grab';

  if (!wasClick) {
    releaseDrag();
  } else {
    if (roamMode) {
      refreshBounds().then(() => {
        if (pos.y >= bounds.floorY - 2) settleOnFloor();
        startPhysics();
      });
    }
    if (!window.PetAudioPlayer.isBusy()) {
      window.petApi.playChatVoiceline();
    }
  }
});

img.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petApi.showContextMenu();
});

init();
