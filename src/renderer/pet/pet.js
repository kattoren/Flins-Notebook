const DRAG_THRESHOLD = 5;

const img = document.getElementById('flins');
const bubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
let idleSrc = '';
let dragging = false;
let moved = false;
let startMouse = { x: 0, y: 0 };
let startWin = { x: 0, y: 0 };

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
  window.petApi.getPosition().then((pos) => {
    if (dragging) startWin = pos;
  });
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - startMouse.x;
  const dy = e.screenY - startMouse.y;
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;
  window.petApi.setPosition(startWin.x + dx, startWin.y + dy);
});

window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  const wasClick = !moved && e.button === 0;
  dragging = false;
  if (wasClick && !window.PetAudioPlayer.isBusy()) {
    window.petApi.playChatVoiceline();
  }
});

img.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petApi.showContextMenu();
});

init();
