const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  // 平台标记：渲染层用它判断是否渲染 DesktopTitleBar 外壳
  // - "win32" / "linux" → 渲染自定义标题栏
  // - "darwin" → 不渲染（交通灯由系统保留，菜单走屏幕顶栏）
  platform: process.platform,
  pickAndImportFolder: () => ipcRenderer.invoke("desktop:pick-and-import"),
  getCompanionHealth: () => ipcRenderer.invoke("desktop:companion-health"),
  showItemInFolder: (input) =>
    ipcRenderer.invoke("desktop:show-item-in-folder", input),
  /** 标题栏内嵌菜单按钮点击时，请求主进程在按钮位置弹原生菜单 */
  popupTitlebarMenu: (id, x, y) =>
    ipcRenderer.invoke("desktop:popup-menu", { id, x, y }),
});
