const DRAG_THRESHOLD = 5;

const img = document.getElementById('flins');
const bubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
let idleSrc = '';
let dragging = false;
let moved = false;
let startMouse = { x: 0, y: 0 };
let lastDragSample = { x: 0, y: 0, t: 0 };
let dragVelocity = { vx: 0, vy: 0 };
let dragFrame = null;
let pendingDragPos = null;

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

  const dims = await window.petApi.getDimensions();
  idleSrc = await window.petApi.getImageSrc();
  applyFixedSize(dims.width, dims.height, dims.windowHeight);
  setPetSprite(idleSrc);

  window.petApi.notifyReady();
}

img.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  dragging = true;
  moved = false;
  startMouse = { x: e.screenX, y: e.screenY };
  lastDragSample = { x: e.screenX, y: e.screenY, t: performance.now() };
  dragVelocity = { vx: 0, vy: 0 };
  img.style.cursor = 'grabbing';
  window.petApi.dragStart(e.screenX, e.screenY);
});

function flushDragMove() {
  dragFrame = null;
  if (!dragging || !pendingDragPos) return;
  window.petApi.dragMove(pendingDragPos.x, pendingDragPos.y);
  pendingDragPos = null;
}

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

  pendingDragPos = { x: e.screenX, y: e.screenY };
  if (!dragFrame) {
    dragFrame = requestAnimationFrame(flushDragMove);
  }
});

window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  const wasClick = !moved && e.button === 0;
  dragging = false;
  img.style.cursor = 'grab';
  if (dragFrame) {
    cancelAnimationFrame(dragFrame);
    dragFrame = null;
  }
  pendingDragPos = null;

  window.petApi.dragEnd({
    vx: dragVelocity.vx,
    vy: dragVelocity.vy,
    moved,
  });

  if (wasClick && !window.PetAudioPlayer.isBusy()) {
    window.petApi.playChatVoiceline();
  }
});

img.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petApi.showContextMenu();
});

init();
