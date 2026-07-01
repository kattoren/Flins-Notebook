const DRAG_THRESHOLD = 5;

const img = document.getElementById('flins');
const flinsWrap = document.getElementById('flins-wrap');
const bubblesColumn = document.getElementById('pet-bubbles');
const bubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const levelUpBubble = document.getElementById('levelup-bubble');
const levelUpText = document.getElementById('levelup-text');
const levelUpCloseBtn = document.getElementById('levelup-close');
const pinBubble = document.getElementById('pin-bubble');
const pinText = document.getElementById('pin-text');
const timerBubble = document.getElementById('timer-bubble');
const timerTitle = document.getElementById('timer-title');
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
let layoutDims = null;

const BUBBLE_EXIT_MS = 1500;

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

function resetPetSpriteOnly() {
  flinsWrap.classList.remove('pet-hop');
  setPetSprite(formBaseSrc);
}

function resetSpeechOnly() {
  hideSpeechBubble();
  resetPetSpriteOnly();
}

function resetToIdle() {
  resetSpeechOnly();
}

function playVoiceline({ dataUrl, volume, text, imageSrc, spriteHoldMs = 0, speechChannel = 'speech', speechHoldMs = 0 }) {
  const player = window.PetAudioPlayer;
  playHop();
  if (speechChannel === 'levelUp') {
    showLevelUpBubble(text, { autoDismissMs: speechHoldMs || 30000 });
  } else {
    showSpeechBubble(text);
  }
  if (petForm === 'sticker' && imageSrc) {
    setPetSprite(imageSrc);
  }
  player.playDataUrl(dataUrl, volume, {
    interrupt: true,
    onEnded: () => {
      if (speechChannel === 'levelUp') {
        if (spriteHoldMs > 0 && petForm === 'sticker') {
          setTimeout(resetPetSpriteOnly, spriteHoldMs);
        } else {
          resetPetSpriteOnly();
        }
        return;
      }
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

function showAnimatedBubble(el, textEl, text, {
  dismissTimerRef,
  exitTimerRef,
  autoDismissMs = 0,
  onHide,
} = {}) {
  if (dismissTimerRef.current) {
    clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
  }
  if (exitTimerRef.current) {
    clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }

  textEl.textContent = text || '';
  el.classList.remove('hidden', 'bubble-hiding');
  el.setAttribute('aria-hidden', 'false');

  el.classList.remove('bubble-entering');
  void el.offsetWidth;
  el.classList.add('bubble-entering');

  if (autoDismissMs > 0) {
    dismissTimerRef.current = setTimeout(() => onHide(), autoDismissMs);
  }
}

function hideAnimatedBubble(el, textEl, { dismissTimerRef, exitTimerRef } = {}) {
  if (dismissTimerRef?.current) {
    clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
  }
  if (el.classList.contains('hidden') || el.classList.contains('bubble-hiding')) {
    return;
  }

  el.classList.remove('bubble-entering');
  el.classList.add('bubble-hiding');
  el.setAttribute('aria-hidden', 'true');

  if (exitTimerRef.current) {
    clearTimeout(exitTimerRef.current);
  }
  exitTimerRef.current = setTimeout(() => {
    exitTimerRef.current = null;
    el.classList.remove('bubble-hiding');
    el.classList.add('hidden');
    textEl.textContent = '';
  }, BUBBLE_EXIT_MS);
}

const speechDismissRef = { current: null };
const speechExitRef = { current: null };
const levelUpDismissRef = { current: null };
const levelUpExitRef = { current: null };

function showSpeechBubble(text, { autoDismissMs = 0 } = {}) {
  showAnimatedBubble(bubble, speechText, text, {
    dismissTimerRef: speechDismissRef,
    exitTimerRef: speechExitRef,
    autoDismissMs,
    onHide: hideSpeechBubble,
  });
}

function hideSpeechBubble() {
  hideAnimatedBubble(bubble, speechText, {
    dismissTimerRef: speechDismissRef,
    exitTimerRef: speechExitRef,
  });
}

function showLevelUpBubble(text, { autoDismissMs = 30000 } = {}) {
  showAnimatedBubble(levelUpBubble, levelUpText, text, {
    dismissTimerRef: levelUpDismissRef,
    exitTimerRef: levelUpExitRef,
    autoDismissMs,
    onHide: hideLevelUpBubble,
  });
}

function hideLevelUpBubble() {
  hideAnimatedBubble(levelUpBubble, levelUpText, {
    dismissTimerRef: levelUpDismissRef,
    exitTimerRef: levelUpExitRef,
  });
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

  const isSimple = payload.type === 'simple';
  const title = (payload.title || '').trim();

  timerBubble.classList.toggle('pet-timer-bubble--simple', isSimple);

  if (!isSimple && title) {
    timerTitle.textContent = title;
    timerTitle.classList.remove('hidden');
  } else {
    timerTitle.textContent = '';
    timerTitle.classList.add('hidden');
  }

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

  window.petApi.onPlayVoicelineSequence((payload) => {
    playVoicelineSequence(payload).catch(() => resetSpeechOnly());
  });

  window.petApi.onSpeak((payload) => {
    playHops(payload?.hops ?? 1);
    if (payload?.channel === 'levelUp') {
      showLevelUpBubble(payload?.text || '', { autoDismissMs: payload?.autoDismissMs || 30000 });
      return;
    }
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

  levelUpCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideLevelUpBubble();
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
