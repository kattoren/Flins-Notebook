window.PetAudioPlayer = (function createPetAudioPlayer() {
  let currentAudio = null;
  let busy = false;

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

  function playDataUrl(dataUrl, volume, options = {}) {
    const { interrupt = true, onEnded } = options;
    if (busy && !interrupt) {
      return Promise.resolve(false);
    }

    stop();
    busy = true;

    return new Promise((resolve) => {
      const audio = new Audio(dataUrl);
      audio.volume = Math.min(1, Math.max(0, volume ?? 1));
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

    let remaining = Math.max(1, playCount || 1);

    function playNext() {
      if (remaining <= 0) {
        setIdle();
        return;
      }
      remaining -= 1;

      const audio = new Audio(dataUrl);
      audio.volume = Math.min(1, Math.max(0, volume ?? 1));
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
    playDataUrl,
    playSequence,
  };
})();
