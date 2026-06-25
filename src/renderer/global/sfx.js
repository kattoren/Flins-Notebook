window.BookSfx = (function createBookSfx() {
  const cache = new Map();

  const FILES = {
    bookOpen: 'sfx_book_open.mp3',
    bookClose: 'sfx_book_close.mp3',
  };

  async function resolve(file) {
    if (!cache.has(file)) {
      cache.set(file, window.api.getSfxUrl(file));
    }
    return cache.get(file);
  }

  async function play(file) {
    try {
      const src = await resolve(file);
      const audio = new Audio(src);
      audio.volume = 1;
      await audio.play();
    } catch {
      // ignore autoplay / missing file errors
    }
  }

  function preloadAll() {
    return Promise.all(Object.values(FILES).map(resolve));
  }

  return {
    preloadAll,
    playBookOpen: () => play(FILES.bookOpen),
    playBookClose: () => play(FILES.bookClose),
  };
})();
