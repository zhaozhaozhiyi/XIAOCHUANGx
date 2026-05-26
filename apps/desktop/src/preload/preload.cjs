const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  pickAndImportFolder: () => ipcRenderer.invoke("desktop:pick-and-import"),
  getCompanionHealth: () => ipcRenderer.invoke("desktop:companion-health"),
  showItemInFolder: (input) =>
    ipcRenderer.invoke("desktop:show-item-in-folder", input),
});
