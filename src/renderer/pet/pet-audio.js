if (window.petApi?.onPlayAudio) {
  window.petApi.onStopAudio(() => {
    window.PetAudioPlayer.stop();
  });

  window.petApi.onPlayVoiceline(({ dataUrl, volume }) => {
    window.PetAudioPlayer.playDataUrl(dataUrl, volume, { interrupt: true });
  });

  window.petApi.onPlayAudio(({ dataUrl, volume, playCount }) => {
    window.PetAudioPlayer.playSequence(dataUrl, volume, playCount);
  });
}
