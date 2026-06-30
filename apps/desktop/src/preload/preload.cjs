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
  openPath: (input) => ipcRenderer.invoke("desktop:open-path", input),
  openProjectFolder: (input) =>
    ipcRenderer.invoke("desktop:open-project-folder", input),
  /** 标题栏内嵌菜单按钮点击时，请求主进程在按钮位置弹原生菜单 */
  popupTitlebarMenu: (id, x, y) =>
    ipcRenderer.invoke("desktop:popup-menu", { id, x, y }),

  // V1.1 D1.1：Companion 自动启动 / 健康守护（desktop-v1.1-roadmap.md §3）
  // 渲染层订阅 onStatusChange 同步顶栏 Badge / 设置面板（接线留给后续任务）
  companion: {
    getStatus: () => ipcRenderer.invoke("companion:get-status"),
    restart: () => ipcRenderer.invoke("companion:restart"),
    /**
     * 监听 'companion:status' 广播
     * @param {(status: unknown) => void} cb
     * @returns {() => void} 取消订阅
     */
    onStatusChange: (cb) => {
      const listener = (_event, status) => {
        try {
          cb(status);
        } catch (err) {
          // 渲染层错误不应影响主进程，吞掉
          console.error("[preload] companion onStatusChange callback failed", err);
        }
      };
      ipcRenderer.on("companion:status", listener);
      return () => ipcRenderer.removeListener("companion:status", listener);
    },
  },

  // V1.1 D1.5：自动更新（desktop-v1.1-roadmap.md §7）
  // 设置「关于」页订阅 onStatusChange 渲染进度条 / 更新按钮
  updater: {
    getStatus: () => ipcRenderer.invoke("updater:get-status"),
    check: () => ipcRenderer.invoke("updater:check"),
    installNow: () => ipcRenderer.invoke("updater:install-now"),
    /**
     * 监听 'updater:status' 广播
     * @param {(status: unknown) => void} cb
     * @returns {() => void} 取消订阅
     */
    onStatusChange: (cb) => {
      const listener = (_event, status) => {
        try {
          cb(status);
        } catch (err) {
          console.error("[preload] updater onStatusChange callback failed", err);
        }
      };
      ipcRenderer.on("updater:status", listener);
      return () => ipcRenderer.removeListener("updater:status", listener);
    },
  },

});
