const DRAG_THRESHOLD = 5;
const LAG_FOLLOW = 0.18;
const LAG_RETURN = 0.14;

const img = document.getElementById('flins');
const bubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
let dragging = false;
let moved = false;
let startMouse = { x: 0, y: 0 };
let startWin = { x: 0, y: 0 };
let petWidth = 0;
let petHeight = 0;
let lagX = 0;
let lagY = 0;
let targetLagX = 0;
let targetLagY = 0;
let lagAnimating = false;

function applyFixedSize(width, height, windowHeight) {
  petWidth = width;
  petHeight = height;
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
}

function applyBubbleTransform() {
  bubble.style.transform = `translate(calc(-50% + ${lagX}px), ${lagY}px)`;
}

function tickBubbleLag() {
  if (dragging) {
    lagX += (targetLagX - lagX) * LAG_FOLLOW;
    lagY += (targetLagY - lagY) * LAG_FOLLOW;
  } else {
    lagX += (0 - lagX) * LAG_RETURN;
    lagY += (0 - lagY) * LAG_RETURN;
    if (Math.abs(lagX) < 0.2) lagX = 0;
    if (Math.abs(lagY) < 0.2) lagY = 0;
  }
  applyBubbleTransform();

  if (dragging || Math.abs(lagX) > 0.2 || Math.abs(lagY) > 0.2) {
    requestAnimationFrame(tickBubbleLag);
  } else {
    lagAnimating = false;
  }
}

function startLagLoop() {
  if (!lagAnimating) {
    lagAnimating = true;
    requestAnimationFrame(tickBubbleLag);
  }
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
    hideBubble();
  });

  window.petApi.onPlayVoiceline(({ dataUrl, volume, text }) => {
    showBubble(text);
    player.playDataUrl(dataUrl, volume, { interrupt: true, onEnded: hideBubble });
  });

  window.petApi.onPlayAudio(({ dataUrl, volume, playCount }) => {
    hideBubble();
    player.playSequence(dataUrl, volume, playCount);
  });

  window.petApi.onReact(() => {
    img.classList.add('react');
    setTimeout(() => img.classList.remove('react'), 1400);
  });
}

async function init() {
  setupAudioListeners();
  window.petApi.notifyReady();

  const dims = await window.petApi.getDimensions();
  const src = await window.petApi.getImageSrc();
  applyFixedSize(dims.width, dims.height, dims.windowHeight);
  img.src = src;
}

img.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  dragging = true;
  moved = false;
  startMouse = { x: e.screenX, y: e.screenY };
  startLagLoop();
  window.petApi.getPosition().then((pos) => {
    if (dragging) startWin = pos;
  });
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - startMouse.x;
  const dy = e.screenY - startMouse.y;
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;
  targetLagX = -dx * 0.14;
  targetLagY = -dy * 0.1;
  startLagLoop();
  window.petApi.setPosition(startWin.x + dx, startWin.y + dy);
});

window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  const wasClick = !moved && e.button === 0;
  dragging = false;
  targetLagX = 0;
  targetLagY = 0;
  startLagLoop();
  if (wasClick && !window.PetAudioPlayer.isBusy()) {
    window.petApi.playChatVoiceline();
  }
});

img.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petApi.showContextMenu();
});

init();
