const DRAG_THRESHOLD = 5;

const img = document.getElementById('flins');
const flinsWrap = document.getElementById('flins-wrap');
const bubblesColumn = document.getElementById('pet-bubbles');
const bubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const pinBubble = document.getElementById('pin-bubble');
const pinText = document.getElementById('pin-text');
const timerBubble = document.getElementById('timer-bubble');
const timerLabel = document.getElementById('timer-label');
const timerDisplay = document.getElementById('timer-display');
const timerCloseBtn = document.getElementById('timer-close');

let formBaseSrc = '';
let petForm = 'gif';
let dragging = false;
let moved = false;
let startMouse = { x: 0, y: 0 };
let dragFrame = null;
let pendingDragPos = null;
let hopTimer = null;
let timerRunning = false;
let timerVisible = true;

function playHop() {
  flinsWrap.classList.remove('pet-hop');
  void flinsWrap.offsetWidth;
  flinsWrap.classList.add('pet-hop');
  if (hopTimer) clearTimeout(hopTimer);
  hopTimer = setTimeout(() => {
    flinsWrap.classList.remove('pet-hop');
    hopTimer = null;
  }, 450);
}

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
  flinsWrap.style.width = `${width}px`;
  flinsWrap.style.height = `${height}px`;
  img.style.width = `${width}px`;
  img.style.height = `${height}px`;
  bubblesColumn.style.width = `${width}px`;
}

function applyPetForm(form, imageSrc, dims) {
  petForm = form;
  formBaseSrc = imageSrc;
  flinsWrap.classList.toggle('pet-form-lantern', form === 'lantern');

  if (dims) {
    applyFixedSize(dims.width, dims.height, dims.windowHeight);
  }

  setPetSprite(imageSrc);
}

function setPetSprite(src) {
  if (src) img.src = src;
}

function resetSpeechOnly() {
  hideSpeechBubble();
  flinsWrap.classList.remove('pet-hop');
  setPetSprite(formBaseSrc);
}

function resetToIdle() {
  resetSpeechOnly();
}

function playVoiceline({ dataUrl, volume, text, imageSrc }) {
  const player = window.PetAudioPlayer;
  showSpeechBubble(text);
  if (petForm === 'sticker') {
    setPetSprite(imageSrc);
  }
  player.playDataUrl(dataUrl, volume, {
    interrupt: true,
    onEnded: resetSpeechOnly,
  });
}

function showSpeechBubble(text) {
  speechText.textContent = text || '';
  bubble.classList.remove('hidden');
  bubble.setAttribute('aria-hidden', 'false');
}

function hideSpeechBubble() {
  bubble.classList.add('hidden');
  bubble.setAttribute('aria-hidden', 'true');
  speechText.textContent = '';
}

function setPinMessage(text) {
  const message = (text || '').trim();
  if (!message) {
    pinBubble.classList.add('hidden');
    pinBubble.setAttribute('aria-hidden', 'true');
    pinText.textContent = '';
    return;
  }
  pinText.textContent = message;
  pinBubble.classList.remove('hidden');
  pinBubble.setAttribute('aria-hidden', 'false');
}

function phaseLabel(phase, type) {
  if (type === 'pomodoro') {
    return phase === 'break' ? 'Break' : 'Work';
  }
  return 'Timer';
}

function updateTimerBubble(payload) {
  timerRunning = Boolean(payload?.running);
  timerVisible = payload?.visible !== false;

  if (!timerRunning || !timerVisible) {
    timerBubble.classList.add('hidden');
    timerBubble.setAttribute('aria-hidden', 'true');
    return;
  }

  timerLabel.textContent = phaseLabel(payload.phase, payload.type);
  timerDisplay.textContent = payload.display || '0:00';
  timerBubble.classList.remove('hidden');
  timerBubble.setAttribute('aria-hidden', 'false');
}

function setupAudioListeners() {
  const player = window.PetAudioPlayer;

  window.petApi.onStopAudio(() => {
    player.stop();
    resetSpeechOnly();
  });

  window.petApi.onPlayVoiceline((payload) => {
    playVoiceline(payload);
  });

  window.petApi.onSpeak((payload) => {
    showSpeechBubble(payload?.text || '');
  });

  window.petApi.onPinMessage((payload) => {
    setPinMessage(payload?.text);
  });

  window.petApi.onTimerTick((payload) => {
    updateTimerBubble(payload);
  });

  window.petApi.onOpenPanel((payload) => {
    window.PetPanels.openPanel(payload.panel, payload);
  });

  window.petApi.onVoicelineVolumeChange((volume) => {
    player.setVolume(volume);
  });

  window.petApi.onPlayAudio(({ dataUrl, volume, playCount }) => {
    resetSpeechOnly();
    player.playSequence(dataUrl, volume, playCount);
  });

  window.petApi.onReact(() => {
    playHop();
  });

  window.petApi.onHop(() => {
    playHop();
  });

  window.petApi.onFormChanged((payload) => {
    applyPetForm(payload.form, payload.imageSrc, payload);
  });
}

async function init() {
  setupAudioListeners();

  const dims = await window.petApi.getDimensions();
  const form = await window.petApi.getPetForm();
  const imageSrc = await window.petApi.getImageSrc();
  const state = await window.petApi.getPetState();
  applyPetForm(form, imageSrc, dims);
  setPinMessage(state.pinMessage);
  timerVisible = state.timerVisible !== false;
  if (state.timer) {
    updateTimerBubble({ ...state.timer, visible: timerVisible });
  }

  timerCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.petApi.hideTimer();
  });

  window.petApi.notifyReady();
}

img.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  dragging = true;
  moved = false;
  startMouse = { x: e.screenX, y: e.screenY };
  img.style.cursor = 'grabbing';
  flinsWrap.classList.add('pet-dragging');
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
  flinsWrap.classList.remove('pet-dragging');
  if (dragFrame) {
    cancelAnimationFrame(dragFrame);
    dragFrame = null;
  }
  pendingDragPos = null;
  window.petApi.dragEnd();

  if (wasClick) {
    playHop();
    window.petApi.playChatVoiceline();
  }
});

img.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petApi.showContextMenu();
});

init();
