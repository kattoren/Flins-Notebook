const { Menu, Tray } = require('electron');
const { getAppIcon } = require('../utils/petAssets');

function createTray(ctx) {
  const icon = getAppIcon();
  ctx.tray = new Tray(icon.resize({ width: 16, height: 16 }));
  ctx.tray.setToolTip('Flins Notes');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => ctx.showMainWindow() },
    { label: 'Quit', click: () => ctx.quitApp() },
  ]);
  ctx.tray.setContextMenu(contextMenu);
  ctx.tray.on('click', () => ctx.showMainWindow());
}

function initTray(ctx) {
  ctx.createTray = () => createTray(ctx);
}

module.exports = { initTray };
