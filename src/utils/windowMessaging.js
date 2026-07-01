function sendToWindow(target, channel, payload) {
  if (!target || target.isDestroyed()) return;

  const send = () => {
    if (!target.isDestroyed()) {
      if (payload === undefined) {
        target.webContents.send(channel);
      } else {
        target.webContents.send(channel, payload);
      }
    }
  };

  if (target.webContents.isLoading()) {
    target.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

module.exports = { sendToWindow };
