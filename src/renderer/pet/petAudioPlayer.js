window.PetAudioPlayer = (function createPetAudioPlayer() {
  let currentAudio = null;
  let busy = false;
  let activeVolume = 1;

  function clampVolume(value) {
    return Math.min(1, Math.max(0, value ?? 1));
  }

  function setIdle() {
    currentAudio = null;
    busy = false;
  }

  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    setIdle();
  }

  function isBusy() {
    return busy;
  }

  function setVolume(volume) {
    activeVolume = clampVolume(volume);
    if (currentAudio) {
      currentAudio.volume = activeVolume;
    }
  }

  function playDataUrl(dataUrl, volume, options = {}) {
    const { interrupt = true, onEnded } = options;
    if (busy && !interrupt) {
      return Promise.resolve(false);
    }

    stop();
    busy = true;
    activeVolume = clampVolume(volume);

    return new Promise((resolve) => {
      const audio = new Audio(dataUrl);
      audio.volume = activeVolume;
      currentAudio = audio;

      const finish = (ok) => {
        if (currentAudio === audio) {
          setIdle();
        }
        resolve(ok);
      };

      audio.addEventListener('ended', () => {
        finish(true);
        if (options.onEnded) options.onEnded();
      });
      audio.addEventListener('error', () => finish(false));
      audio.play().catch(() => finish(false));
    });
  }

  function playSequence(dataUrl, volume, playCount) {
    stop();
    busy = true;
    activeVolume = clampVolume(volume);

    let remaining = Math.max(1, playCount || 1);

    function playNext() {
      if (remaining <= 0) {
        setIdle();
        return;
      }
      remaining -= 1;

      const audio = new Audio(dataUrl);
      audio.volume = activeVolume;
      currentAudio = audio;

      audio.addEventListener('ended', () => {
        if (remaining > 0) {
          playNext();
        } else {
          setIdle();
        }
      });

      audio.addEventListener('error', () => setIdle());
      audio.play().catch(() => setIdle());
    }

    playNext();
  }

  return {
    stop,
    isBusy,
    setVolume,
    playDataUrl,
    playSequence,
  };
})();
