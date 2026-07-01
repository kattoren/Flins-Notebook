function quitApp(ctx) {
  if (ctx.isQuitting) return;
  ctx.isQuitting = true;
  if (ctx.tray) {
    ctx.tray.destroy();
    ctx.tray = null;
  }
  if (ctx.petWindow && !ctx.petWindow.isDestroyed()) {
    ctx.petWindow.destroy();
  }
  if (ctx.petPanelWindow && !ctx.petPanelWindow.isDestroyed()) {
    ctx.petPanelWindow.destroy();
  }
  if (ctx.audioWindow && !ctx.audioWindow.isDestroyed()) {
    ctx.audioWindow.destroy();
  }
  if (ctx.stopScheduler) {
    ctx.stopScheduler();
    ctx.stopScheduler = null;
  }
  if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
    ctx.mainWindow.destroy();
  }
  ctx.app.quit();
}

function initLifecycle(ctx) {
  ctx.quitApp = () => quitApp(ctx);

  process.on('SIGINT', () => quitApp(ctx));
  process.on('SIGTERM', () => quitApp(ctx));

  ctx.app.on('before-quit', () => {
    ctx.isQuitting = true;
  });
}

module.exports = { initLifecycle };
