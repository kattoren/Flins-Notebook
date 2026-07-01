const DRAG_THRESHOLD = 5;

const img = document.getElementById('flins');
const flinsWrap = document.getElementById('flins-wrap');
const bubblesColumn = document.getElementById('pet-bubbles');
const bubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const pinBubble = document.getElementById('pin-bubble');
const pinText = document.getElementById('pin-text');
const timerBubble = document.getElementById('timer-bubble');
const timerDisplay = document.getElementById('timer-display');
const timerCloseBtn = document.getElementById('timer-close');
const speechCloseBtn = document.getElementById('speech-close');

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
let bubbleWidthPx = null;
let speechDismissTimer = null;
let layoutDims = null;

function applyBubbleWidth(width) {
  if (!width) return;
  bubbleWidthPx = width;
  document.documentElement.style.setProperty('--pet-bubble-width', `${width}px`);
  bubblesColumn.style.width = `${width}px`;
  bubblesColumn.style.maxWidth = `${width}px`;
}

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

function playHops(count = 1) {
  const total = Math.max(1, Math.min(6, Number(count) || 1));
  for (let i = 0; i < total; i += 1) {
    setTimeout(() => playHop(), i * 480);
  }
}

function applyFixedSize(dims) {
  layoutDims = dims;
  const petW = dims.width;
  const petH = dims.height;
  const winW = dims.windowWidth || petW;
  const winH = dims.windowHeight || petH;
  const stack = document.querySelector('.flins-stack');

  document.documentElement.style.setProperty('--pet-height', `${petH}px`);
  document.documentElement.style.width = `${winW}px`;
  document.documentElement.style.height = `${winH}px`;
  document.body.style.width = `${winW}px`;
  document.body.style.height = `${winH}px`;
  document.getElementById('pet-root').style.width = `${winW}px`;
  document.getElementById('pet-root').style.height = `${winH}px`;
  stack.style.width = `${winW}px`;
  stack.style.height = `${petH}px`;
  flinsWrap.style.width = `${petW}px`;
  flinsWrap.style.height = `${petH}px`;
  img.style.width = `${petW}px`;
  img.style.height = `${petH}px`;
}

function applyPetForm(form, imageSrc, dims) {
  petForm = form;
  formBaseSrc = imageSrc;
  const petRoot = document.getElementById('pet-root');
  const isLantern = form === 'lantern';
  petRoot.classList.toggle('pet-form-lantern', isLantern);
  flinsWrap.classList.toggle('pet-form-lantern', isLantern);

  if (dims) {
    applyFixedSize(dims);
  }
  if (dims?.bubbleWidth) {
    applyBubbleWidth(dims.bubbleWidth);
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

function playVoiceline({ dataUrl, volume, text, imageSrc, spriteHoldMs = 0 }) {
  const player = window.PetAudioPlayer;
  playHop();
  showSpeechBubble(text);
  if (petForm === 'sticker' && imageSrc) {
    setPetSprite(imageSrc);
  }
  player.playDataUrl(dataUrl, volume, {
    interrupt: true,
    onEnded: () => {
      if (spriteHoldMs > 0 && petForm === 'sticker') {
        setTimeout(resetSpeechOnly, spriteHoldMs);
      } else {
        resetSpeechOnly();
      }
    },
  });
}

async function playVoicelineSequence({ items }) {
  const player = window.PetAudioPlayer;
  const queue = Array.isArray(items) ? items : [];
  if (!queue.length) return;

  for (const item of queue) {
    playHop();
    showSpeechBubble(item.text || '');
    if (petForm === 'sticker' && item.imageSrc) {
      setPetSprite(item.imageSrc);
    }
    await player.playDataUrl(item.dataUrl, item.volume, { interrupt: true });
  }

  resetSpeechOnly();
}

function showSpeechBubble(text, { autoDismissMs = 0 } = {}) {
  if (speechDismissTimer) {
    clearTimeout(speechDismissTimer);
    speechDismissTimer = null;
  }

  speechText.textContent = text || '';
  bubble.classList.remove('hidden');
  bubble.setAttribute('aria-hidden', 'false');

  if (autoDismissMs > 0) {
    speechDismissTimer = setTimeout(() => hideSpeechBubble(), autoDismissMs);
  }
}

function hideSpeechBubble() {
  if (speechDismissTimer) {
    clearTimeout(speechDismissTimer);
    speechDismissTimer = null;
  }
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

function updateTimerBubble(payload) {
  timerRunning = Boolean(payload?.running);
  timerVisible = payload?.visible !== false;

  if (!timerRunning || !timerVisible) {
    timerBubble.classList.add('hidden');
    timerBubble.setAttribute('aria-hidden', 'true');
    return;
  }

  const title = payload.title || 'TIMER';
  timerDisplay.textContent = `${title} ${payload.display || '0:00'}`;
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

  window.petApi.onPlayVoicelineSequence((payload) => {
    playVoicelineSequence(payload).catch(() => resetSpeechOnly());
  });

  window.petApi.onSpeak((payload) => {
    playHops(payload?.hops ?? 1);
    showSpeechBubble(payload?.text || '', { autoDismissMs: payload?.autoDismissMs || 0 });
  });

  window.petApi.onPinMessage((payload) => {
    setPinMessage(payload?.text);
  });

  window.petApi.onTimerTick((payload) => {
    updateTimerBubble(payload);
  });

  window.petApi.onVoicelineVolumeChange((volume) => {
    player.setVolume(volume);
  });

  window.petApi.onPlayAudio(({ dataUrl, volume, playCount, preserveSpeech }) => {
    if (!preserveSpeech) {
      resetSpeechOnly();
    }
    player.playSequence(dataUrl, volume, playCount);
  });

  window.petApi.onReact(() => {
    playHop();
  });

  window.petApi.onHop((payload) => {
    playHops(payload?.count ?? 1);
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
  if (dims.bubbleWidth) {
    applyBubbleWidth(dims.bubbleWidth);
  }
  setPinMessage(state.pinMessage);
  timerVisible = state.timerVisible !== false;
  if (state.timer) {
    updateTimerBubble({ ...state.timer, visible: timerVisible });
  }

  timerCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.petApi.hideTimer();
  });

  speechCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideSpeechBubble();
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
