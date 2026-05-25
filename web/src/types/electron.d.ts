/** Electron 桌面壳 preload 暴露的 API（§5.3.7） */

export type DesktopPickAndImportResult =
  | {
      ok: true;
      projectId: string;
      name: string;
      pathSummary: string;
    }
  | {
      ok: false;
      canceled?: boolean;
      message?: string;
    };

export type DesktopCompanionHealth = {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
};

export type JlcElectronAPI = {
  isDesktop: boolean;
  pickAndImportFolder: () => Promise<DesktopPickAndImportResult>;
  getCompanionHealth?: () => Promise<DesktopCompanionHealth>;
};

declare global {
  interface Window {
    electronAPI?: JlcElectronAPI;
  }
}

export {};
