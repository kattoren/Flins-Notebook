window.petPanelApi.onOpenPanel((payload) => {
  window.PetPanels.openPanel(payload.panel, payload);
});

window.petPanelApi.notifyReady();
