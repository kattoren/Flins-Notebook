const BOOK_DESIGN_HEIGHT = 970;
const BOOK_DESIGN_OPEN_WIDTH = 1445;
const BOOK_DESIGN_CLOSED_WIDTH = 723;
const BOOK_WINDOW_HEIGHT = 780;

const BOOK_SCALE = BOOK_WINDOW_HEIGHT / BOOK_DESIGN_HEIGHT;

function getBookWindowSize(open) {
  const designWidth = open ? BOOK_DESIGN_OPEN_WIDTH : BOOK_DESIGN_CLOSED_WIDTH;
  return {
    width: Math.round(designWidth * BOOK_SCALE),
    height: BOOK_WINDOW_HEIGHT,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BOOK_SCALE,
    BOOK_WINDOW_HEIGHT,
    BOOK_DESIGN_HEIGHT,
    BOOK_DESIGN_OPEN_WIDTH,
    BOOK_DESIGN_CLOSED_WIDTH,
    getBookWindowSize,
  };
}

if (typeof window !== 'undefined') {
  window.BookLayout = {
    BOOK_SCALE,
    BOOK_WINDOW_HEIGHT,
    BOOK_DESIGN_HEIGHT,
    BOOK_DESIGN_OPEN_WIDTH,
    BOOK_DESIGN_CLOSED_WIDTH,
    getBookWindowSize,
  };
}
