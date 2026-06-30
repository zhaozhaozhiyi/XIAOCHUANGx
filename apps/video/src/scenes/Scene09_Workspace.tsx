import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import {
  FolderTree,
  Folder,
  ChevronDown,
  FileText,
  Check,
  Cpu,
  Terminal,
  Command,
  PanelTop,
  ShieldCheck,
  LayoutGrid,
  CloudOff,
  RefreshCw,
  Bell,
  Power,
} from "lucide-react";
import { ProductScreenFrame } from "../components/ProductScreenFrame";
import { SubtitleBar } from "../components/SubtitleBar";
import { Icon } from "../components/Icon";
import { FONT, COLORS } from "../constants";

/** 多引擎适配 — 支持的 CLI 引擎全集 */
const ENGINES: { name: string; color: string }[] = [
  { name: "Codex CLI", color: "#10a37f" },
  { name: "Claude Code", color: "#c96442" },
  { name: "Hermes CLI", color: "#6366f1" },
  { name: "Gemini CLI", color: "#4285f4" },
  { name: "Qwen Code", color: "#7c3aed" },
  { name: "Cursor Agent", color: "#0ea5e9" },
  { name: "Copilot CLI", color: "#6e40c9" },
  { name: "Aider", color: "#14b8a6" },
  { name: "Cline", color: "#2563eb" },
  { name: "OpenCode", color: "#f59e0b" },
  { name: "Goose", color: "#ec4899" },
  { name: "Continue", color: "#22c55e" },
  { name: "Amp", color: "#ef4444" },
  { name: "Crush", color: "#a855f7" },
  { name: "Grok CLI", color: "#334155" },
  { name: "Kimi CLI", color: "#1d4ed8" },
  { name: "DeepSeek", color: "#4f46e5" },
  { name: "Roo Code", color: "#db2777" },
];

/** 文件类型图标色 */
const FILE_COLORS: Record<string, string> = {
  ".md": "#2d6a4f",
  ".docx": "#2563eb",
  ".pptx": "#d97757",
  ".html": "#f59e0b",
  ".scad": "#8b5cf6",
  ".dxf": "#0891b2",
};

/** 文件树数据 */
const FILE_TREE = [
  { name: "研究/", type: "dir", indent: 0, highlight: false },
  { name: "成品油市场复盘.md", type: "file", indent: 1, highlight: true },
  { name: "写作/", type: "dir", indent: 0, highlight: false },
  { name: "行业分析报告.md", type: "file", indent: 1, highlight: false },
  { name: "行业分析报告.docx", type: "file", indent: 1, highlight: false },
  { name: "PPT/", type: "dir", indent: 0, highlight: false },
  { name: "产品介绍.pptx", type: "file", indent: 1, highlight: false },
  { name: "产品介绍.html", type: "file", indent: 1, highlight: false },
  { name: "制图/", type: "dir", indent: 0, highlight: false },
  { name: "储罐.scad", type: "file", indent: 1, highlight: false },
  { name: "drawing.dxf", type: "file", indent: 1, highlight: false },
  { name: "推演/", type: "dir", indent: 0, highlight: false },
  { name: "OPEC减产推演报告.md", type: "file", indent: 1, highlight: false },
];

function getFileColor(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf("."));
  return FILE_COLORS[ext] || COLORS.fgTertiary;
}

/**
 * 第九幕 · 工作区 + 多模型引擎（92–104s，帧 0–360）— v2 高级版
 */
export const Scene09_Workspace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cliEnterFrame = 120;
  const desktopFrame = 300;

  return (
    <AbsoluteFill style={{ backgroundColor: "#e8e6dc" }}>
      {frame < desktopFrame && (
        <>
          <ProductScreenFrame x={100} y={40} width={1720} height={1000} enterFrom="scale" enterDelay={5} title="Xiaochuang — 工作区">
            <div style={{ display: "flex", height: "100%" }}>
              {/* 文件树 — 颜色编码 + 展开箭头 */}
              <div style={{ width: 280, padding: 16, borderRight: `1px solid ${COLORS.border}`, fontFamily: FONT.mono, fontSize: 13 }}>
                <div style={{ fontWeight: 600, fontFamily: FONT.ui, fontSize: 14, color: COLORS.fgSecondary, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon={FolderTree} size={15} color={COLORS.fgSecondary} />
                  工作区
                </div>
                <div style={{ color: COLORS.fg }}>
                  {FILE_TREE.map((file, i) => (
                    <div key={i} style={{
                      paddingLeft: file.indent * 16,
                      color: file.highlight ? COLORS.accent : file.type === "dir" ? COLORS.fg : getFileColor(file.name),
                      padding: "3px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      {file.type === "dir" ? (
                        <>
                          <Icon icon={ChevronDown} size={12} color={COLORS.fgTertiary} />
                          <Icon icon={Folder} size={14} color={COLORS.accent} />
                          <span>{file.name}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getFileColor(file.name), flexShrink: 0, marginLeft: 12 }} />
                          <Icon icon={FileText} size={14} color={getFileColor(file.name)} />
                          <span>{file.name}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 预览区 — 标签页加品牌色指示条 */}
              <div style={{ flex: 1, padding: 24 }}>
                <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
                  {["成品油市场复盘.md", "行业分析报告.md", "产品介绍.html", "drawing.dxf"].map((tab, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: FONT.ui,
                        fontSize: 12,
                        padding: "8px 16px",
                        backgroundColor: i === 0 ? COLORS.surfaceElevated : COLORS.surface,
                        borderBottom: i === 0 ? `2px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                        color: i === 0 ? COLORS.fg : COLORS.fgTertiary,
                        borderRight: `1px solid ${COLORS.border}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getFileColor(tab) }} />
                      {tab}
                      <span style={{ color: COLORS.fgMuted, fontSize: 10 }}>×</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: FONT.display, color: COLORS.fg, lineHeight: 1.8, fontSize: 14 }}>
                  <h3 style={{ fontSize: 20, marginBottom: 12 }}>2026年上半年中国成品油市场复盘</h3>
                  <p style={{ color: COLORS.fgSecondary }}>
                    上半年国内成品油需求温和修复，汽油消费受出行恢复支撑，
                    柴油受基建与物流节奏影响仍有波动，主营炼厂库存压力较去年同期下降。
                  </p>
                </div>
              </div>

              {/* 活动日志 — 时间轴竖线 + 状态色点 */}
              <div style={{ width: 300, padding: 16, borderLeft: `1px solid ${COLORS.border}`, fontFamily: FONT.ui, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: COLORS.fgSecondary, marginBottom: 12 }}>活动日志</div>
                <div style={{ position: "relative", paddingLeft: 12, borderLeft: `2px solid ${COLORS.border}` }}>
                  {[
                    { time: "10:52", text: "推演报告生成", status: "done" },
                    { time: "10:48", text: "DXF 导出完成", status: "done" },
                    { time: "10:32", text: "生成 Markdown 成稿", status: "done" },
                    { time: "10:20", text: "会话开始", status: "done" },
                  ].map((log, i) => (
                    <div key={i} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 0 4px 8px",
                      color: COLORS.fgTertiary,
                      position: "relative",
                    }}>
                      <div style={{ position: "absolute", left: -13, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, border: `2px solid ${COLORS.surface}` }} />
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon icon={Check} size={13} color={COLORS.success} />
                        {log.text}
                      </span>
                      <span style={{ color: COLORS.fgMuted }}>{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ProductScreenFrame>

          {/* 多引擎适配看板 */}
          {frame >= cliEnterFrame && (() => {
            const boardSp = spring({ frame: frame - cliEnterFrame, fps, config: { damping: 16, stiffness: 110 } });
            const boardOpacity = interpolate(boardSp, [0, 1], [0, 1]);
            return (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `rgba(232, 230, 220, ${0.66 * boardOpacity})`,
                backdropFilter: `blur(${4 * boardOpacity}px)`,
                WebkitBackdropFilter: `blur(${4 * boardOpacity}px)`,
              }}>
                <div style={{
                  width: 1280,
                  backgroundColor: "rgba(250, 249, 245, 0.96)",
                  border: `1px solid ${COLORS.borderStrong}`,
                  borderRadius: 24,
                  padding: 32,
                  opacity: boardOpacity,
                  transform: `scale(${interpolate(boardSp, [0, 1], [0.9, 1])})`,
                  boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
                }}>
                  {/* 标题行 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 16px ${COLORS.accent}33` }}>
                        <Icon icon={Cpu} size={24} color="#ffffff" strokeWidth={1.8} />
                      </div>
                      <div>
                        <div style={{ fontFamily: FONT.display, fontSize: 26, fontWeight: 700, color: COLORS.fg }}>多引擎适配</div>
                        <div style={{ fontFamily: FONT.ui, fontSize: 13, color: COLORS.fgTertiary }}>一套工作流，自由切换底层 CLI 引擎</div>
                      </div>
                    </div>
                    <span style={{ padding: "6px 14px", borderRadius: 999, backgroundColor: COLORS.accentMuted, color: COLORS.accent, fontFamily: FONT.ui, fontSize: 12, fontWeight: 600 }}>
                      {ENGINES.length} 引擎
                    </span>
                  </div>

                  {/* 引擎网格 6 列 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
                    {ENGINES.map((e, i) => {
                      const sp = spring({ frame: frame - cliEnterFrame - 6 - i * 4, fps, config: { damping: 14, stiffness: 120 } });
                      const cardOpacity = interpolate(sp, [0, 1], [0, 1]);
                      const ty = interpolate(sp, [0, 1], [24, 0]);
                      return (
                        <div key={e.name} style={{
                          backgroundColor: COLORS.surfaceElevated,
                          border: `1px solid ${e.color}66`,
                          borderRadius: 14,
                          padding: "14px 12px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 9,
                          opacity: cardOpacity,
                          transform: `translateY(${ty}px)`,
                          boxShadow: `0 4px 14px ${e.color}1f`,
                        }}>
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: `linear-gradient(135deg, ${e.color}, ${e.color}cc)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                            <Icon icon={Terminal} size={22} color="#ffffff" strokeWidth={1.9} />
                          </div>
                          <span style={{ fontFamily: FONT.ui, fontSize: 13, color: COLORS.fg, fontWeight: 600, whiteSpace: "nowrap" }}>{e.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 18, fontFamily: FONT.ui, fontSize: 12, color: COLORS.fgTertiary, textAlign: "center" }}>
                    持续扩展中 · 同一任务可在不同引擎间无缝迁移
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* 桌面壳模拟 — 原生桌面体验 */}
      {frame >= desktopFrame && (() => {
        const dFrame = frame - desktopFrame;
        const features = [
          { i: Command, t: "全局快捷键", d: "⌘ \\ 随处唤起" },
          { i: PanelTop, t: "系统托盘常驻", d: "后台静默待命" },
          { i: ShieldCheck, t: "本地优先", d: "数据留在本机" },
          { i: LayoutGrid, t: "多窗口并行", d: "任务互不打断" },
          { i: CloudOff, t: "离线可用", d: "断网也能跑" },
          { i: RefreshCw, t: "自动更新", d: "始终保持最新" },
        ];
        const traySp = spring({ frame: dFrame - 24, fps, config: { damping: 16, stiffness: 120 } });
        const trayOpacity = interpolate(traySp, [0, 1], [0, 1]);
        return (
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <ProductScreenFrame x={200} y={80} width={1520} height={920} enterFrom="scale" enterDelay={5} title="小窗 · 桌面版">
              <div style={{ padding: 44, fontFamily: FONT.ui, height: "100%", display: "flex", flexDirection: "column" }}>
                {/* Hero */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 18, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 10px 28px ${COLORS.accent}33` }}>
                    <svg viewBox="0 0 16 16" width={36} height={36} fill="none"><circle cx="8" cy="8" r="4.5" stroke="#faf9f5" strokeWidth="4" /></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 700, color: COLORS.fg }}>小窗 桌面版</div>
                    <div style={{ fontSize: 14, color: COLORS.fgTertiary, marginTop: 4 }}>原生桌面体验 · 开机即在，随时待命</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <span style={{ padding: "5px 12px", borderRadius: 999, backgroundColor: COLORS.accentMuted, color: COLORS.accent, fontSize: 12, fontWeight: 600 }}>v0.1.0-alpha</span>
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.fgTertiary }}>Electron + Companion</span>
                  </div>
                </div>

                {/* 桌面原生能力网格 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "1fr 1fr", gap: 18, flex: 1 }}>
                  {features.map((f, i) => {
                    const sp = spring({ frame: dFrame - 8 - i * 5, fps, config: { damping: 15, stiffness: 120 } });
                    const op = interpolate(sp, [0, 1], [0, 1]);
                    const ty = interpolate(sp, [0, 1], [22, 0]);
                    return (
                      <div key={i} style={{
                        backgroundColor: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 16,
                        padding: 22,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        opacity: op,
                        transform: `translateY(${ty}px)`,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: COLORS.accentMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon icon={f.i} size={24} color={COLORS.accent} strokeWidth={1.8} />
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.fg }}>{f.t}</div>
                        <div style={{ fontSize: 13, color: COLORS.fgTertiary }}>{f.d}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ProductScreenFrame>

            {/* 浮动系统托盘弹窗 */}
            <div style={{
              position: "absolute",
              top: 120,
              right: 150,
              width: 300,
              backgroundColor: "rgba(250, 249, 245, 0.98)",
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: 16,
              padding: 16,
              boxShadow: "0 18px 48px rgba(0,0,0,0.20)",
              opacity: trayOpacity,
              transform: `translateY(${interpolate(traySp, [0, 1], [-16, 0])}px)`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 16 16" width={16} height={16} fill="none"><circle cx="8" cy="8" r="4.5" stroke="#faf9f5" strokeWidth="4" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.fg }}>小窗</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: COLORS.success }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success }} />
                    运行中
                  </div>
                </div>
              </div>
              {[
                { i: Command, t: "唤起小窗", k: "⌘ \\" },
                { i: Bell, t: "通知中心", k: "3" },
                { i: Power, t: "退出", k: "" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 8, backgroundColor: i === 0 ? COLORS.accentMuted : "transparent" }}>
                  <Icon icon={row.i} size={16} color={i === 0 ? COLORS.accent : COLORS.fgSecondary} />
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.fg }}>{row.t}</span>
                  {row.k && <span style={{ fontFamily: FONT.mono, fontSize: 11, color: COLORS.fgTertiary }}>{row.k}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 字幕 */}
      <SubtitleBar text="所有产出，一目了然" visibleFrom={10} visibleUntil={100} />
      <SubtitleBar text="多引擎适配" visibleFrom={125} visibleUntil={200} />
      <SubtitleBar text="你选引擎，小窗跑任务" visibleFrom={210} visibleUntil={280} />
      <SubtitleBar text="桌面原生体验" visibleFrom={300} visibleUntil={350} />
    </AbsoluteFill>
  );
};
