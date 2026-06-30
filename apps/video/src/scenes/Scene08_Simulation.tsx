import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import {
  MessageSquare,
  PenLine,
  Presentation,
  Ruler,
  Network,
  MousePointer2,
  Hand,
  Square,
  Spline,
  StickyNote,
  Type as TypeIcon,
  Crosshair,
  Factory,
  Landmark,
  Users,
  Gauge,
  Activity,
  Leaf,
  GitBranch,
  TriangleAlert,
  Shuffle,
  SlidersHorizontal,
  ClipboardList,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { ProductScreenFrame } from "../components/ProductScreenFrame";
import { SubtitleBar } from "../components/SubtitleBar";
import { Icon } from "../components/Icon";
import { FONT, COLORS } from "../constants";

const TAB_ICONS: Record<string, typeof MessageSquare> = {
  对话: MessageSquare,
  写作: PenLine,
  PPT: Presentation,
  制图: Ruler,
  推演: Network,
};

const PATH_COLORS = {
  R1: COLORS.accent,
  R2: "#d4a042",
  R3: "#6b8ba4",
};

/** 节点类型样式（亮色） */
type NodeType = "topic" | "entity" | "variable";
const NODE_STYLE: Record<NodeType, { color: string }> = {
  topic: { color: COLORS.accent },
  entity: { color: "#d4a042" },
  variable: { color: "#6b8ba4" },
};

/** 沙盘节点（stage 坐标系 1160 x 660） */
const NODES: {
  id: string;
  label: string;
  x: number;
  y: number;
  type: NodeType;
  icon: typeof MessageSquare;
}[] = [
  { id: "topic", label: "OPEC+ 减产延长", x: 560, y: 56, type: "topic", icon: Crosshair },
  { id: "opec", label: "OPEC+", x: 220, y: 190, type: "entity", icon: Factory },
  { id: "usa", label: "美国", x: 560, y: 190, type: "entity", icon: Landmark },
  { id: "consumer", label: "消费国", x: 900, y: 190, type: "entity", icon: Users },
  { id: "cut", label: "减产幅度", x: 150, y: 330, type: "variable", icon: Gauge },
  { id: "demand", label: "需求弹性", x: 470, y: 330, type: "variable", icon: Activity },
  { id: "alt", label: "替代能源", x: 790, y: 330, type: "variable", icon: Leaf },
];

const EDGES = [
  { from: "topic", to: "opec" },
  { from: "topic", to: "usa" },
  { from: "topic", to: "consumer" },
  { from: "opec", to: "cut" },
  { from: "consumer", to: "demand" },
  { from: "consumer", to: "alt" },
];

const PATHS = [
  { id: "R1", label: "R1 最可能", color: PATH_COLORS.R1, x: 250, y: 520, prob: 65, icon: GitBranch },
  { id: "R2", label: "R2 风险", color: PATH_COLORS.R2, x: 560, y: 520, prob: 25, icon: TriangleAlert },
  { id: "R3", label: "R3 反事实", color: PATH_COLORS.R3, x: 870, y: 520, prob: 10, icon: Shuffle },
];

const REPORT_SECTIONS = ["执行摘要", "当前局势", "各方动机", "情景研判", "风险与应对", "决策建议"];

const STAGE_W = 1160;
const STAGE_H = 660;

function nodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

/** 竖向 bezier 路径 */
function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

/**
 * 第八幕 · 推演（76–92s，帧 0–480）— v3 亮色无限画布
 *
 * 左侧结构化拆解面板 + 右侧亮色无限画布（点阵网格 + 卡片节点 + 曲线连接 +
 * 路径分叉 + 变量面板 + 小地图 + 缩放控件 + 报告面板）。
 */
export const Scene08_Simulation: React.FC = () => {
  const frame = useCurrentFrame();

  // 结构化卡片
  const cardTypes = [
    { label: "主体", items: ["OPEC+", "美国", "消费国"], color: COLORS.accent },
    { label: "变量", items: ["减产幅度", "需求弹性", "替代能源"], color: "#d4a042" },
    { label: "假设", items: ["减产协议延长", "全球需求温和修复"], color: "#6b8ba4" },
  ];

  const nodeProgress = interpolate(frame, [120, 230], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pathProgress = interpolate(frame, [240, 330], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const selectedPath = frame >= 330 ? "R1" : null;
  const pathHighlight = interpolate(frame, [330, 360], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sliderValue = interpolate(frame, [360, 390], [100, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const probR1 = interpolate(frame, [370, 400], [65, 72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reportProgress = interpolate(frame, [420, 460], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 无限画布平移感（点阵缓慢漂移）
  const panX = (Math.sin(frame * 0.01) * 14) % 28;
  const panY = (Math.cos(frame * 0.012) * 10) % 28;

  const tools = [MousePointer2, Hand, Square, Spline, StickyNote, TypeIcon];

  return (
    <AbsoluteFill style={{ backgroundColor: "#e8e6dc" }}>
      <ProductScreenFrame x={160} y={60} width={1600} height={960} enterFrom="scale" enterDelay={5} title="Xiaochuang — 推演">
        <div style={{ display: "flex", height: "100%", position: "relative" }}>
          {/* ── 左侧：结构化拆解面板 ── */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              padding: 24,
              borderRight: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.surface,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", gap: 16, marginBottom: 22, fontFamily: FONT.ui, flexWrap: "wrap" }}>
              {["对话", "写作", "PPT", "制图", "推演"].map((tab) => (
                <span key={tab} style={{
                  fontSize: 13,
                  color: tab === "推演" ? COLORS.accent : COLORS.fgTertiary,
                  fontWeight: tab === "推演" ? 600 : 400,
                  borderBottom: tab === "推演" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                  paddingBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}>
                  <Icon icon={TAB_ICONS[tab]} size={14} color={tab === "推演" ? COLORS.accent : COLORS.fgTertiary} />
                  {tab}
                </span>
              ))}
            </div>

            {frame >= 15 && (
              <div style={{
                backgroundColor: COLORS.accentMuted,
                borderRadius: 14,
                padding: "12px 16px",
                fontFamily: FONT.ui,
                fontSize: 14,
                color: COLORS.fg,
                marginBottom: 18,
                borderLeft: `3px solid ${COLORS.accent}`,
              }}>
                OPEC+ 减产协议延长对油价的影响
              </div>
            )}

            {cardTypes.map((card, ci) => {
              const cardEnter = interpolate(frame, [40 + ci * 28, 64 + ci * 28], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                frame >= 40 + ci * 28 && (
                  <div key={ci} style={{
                    backgroundColor: COLORS.surfaceElevated,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    opacity: cardEnter,
                    border: `1px solid ${card.color}33`,
                    boxShadow: `0 2px 8px ${card.color}11`,
                  }}>
                    <div style={{ fontFamily: FONT.ui, fontSize: 12, color: card.color, fontWeight: 600, marginBottom: 8 }}>
                      {card.label}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {card.items.map((item, ii) => (
                        <span key={ii} style={{
                          fontFamily: FONT.ui,
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 6,
                          backgroundColor: `${card.color}11`,
                          color: COLORS.fg,
                          border: `1px solid ${card.color}33`,
                        }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              );
            })}
          </div>

          {/* ── 右侧：亮色无限画布 ── */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: COLORS.bg }}>
            {/* 点阵网格（缓慢漂移 = 无限画布） */}
            <div style={{
              position: "absolute",
              inset: -40,
              backgroundImage: `radial-gradient(${COLORS.borderStrong} 1.4px, transparent 1.4px)`,
              backgroundSize: "28px 28px",
              backgroundPosition: `${panX}px ${panY}px`,
              opacity: 0.7,
            }} />
            {/* 中央柔光 */}
            <div style={{
              position: "absolute",
              top: "30%",
              left: "50%",
              width: 600,
              height: 400,
              transform: "translate(-50%,-50%)",
              background: `radial-gradient(ellipse at center, ${COLORS.accent}10, transparent 70%)`,
            }} />

            {/* 顶部工具条 */}
            <div style={{
              position: "absolute",
              top: 20,
              left: 24,
              right: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                backgroundColor: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 6,
                boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
              }}>
                {tools.map((T, i) => (
                  <div key={i} style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: i === 0 ? COLORS.accent : "transparent",
                    color: i === 0 ? "#fff" : COLORS.fgSecondary,
                  }}>
                    <Icon icon={T} size={18} color={i === 0 ? "#fff" : COLORS.fgSecondary} strokeWidth={1.8} />
                  </div>
                ))}
              </div>

              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                backgroundColor: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: "8px 16px",
                fontFamily: FONT.ui,
                boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
              }}>
                <Icon icon={Network} size={16} color={COLORS.accent} />
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.fg }}>沙盘观察舱</span>
                <span style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>· 轮次 R1</span>
              </div>
            </div>

            {/* 画布舞台 */}
            <div style={{
              position: "absolute",
              left: "50%",
              top: 86,
              width: STAGE_W,
              height: STAGE_H,
              transform: "translateX(-50%)",
            }}>
              {/* 连接曲线层 */}
              <svg
                width={STAGE_W}
                height={STAGE_H}
                viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
                style={{ position: "absolute", inset: 0, overflow: "visible" }}
              >
                {/* 结构边 */}
                {EDGES.map((e, i) => {
                  const a = nodeById(e.from);
                  const b = nodeById(e.to);
                  const p = interpolate(nodeProgress, [0.25 + i * 0.08, 0.55 + i * 0.08], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  return (
                    <path
                      key={i}
                      d={edgePath(a.x, a.y + 22, b.x, b.y - 22)}
                      fill="none"
                      stroke={`${COLORS.accent}66`}
                      strokeWidth={2}
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - p}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* 变量 → 路径 分叉 */}
                {PATHS.map((path, i) => {
                  const p = interpolate(pathProgress, [i * 0.18, i * 0.18 + 0.4], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  const isSel = selectedPath === path.id;
                  const dim = selectedPath && !isSel ? interpolate(pathHighlight, [0, 1], [1, 0.28]) : 1;
                  return (
                    <path
                      key={path.id}
                      d={edgePath(470, 352, path.x, path.y - 30)}
                      fill="none"
                      stroke={path.color}
                      strokeWidth={isSel ? 3.5 : 2}
                      pathLength={1}
                      strokeDasharray={1}
                      strokeDashoffset={1 - p}
                      strokeLinecap="round"
                      opacity={p * dim}
                      style={{ filter: isSel ? `drop-shadow(0 0 6px ${path.color}aa)` : "none" }}
                    />
                  );
                })}
              </svg>

              {/* 节点卡片层 */}
              {NODES.map((node, i) => {
                const enter = interpolate(nodeProgress, [i * 0.09, i * 0.09 + 0.2], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const c = NODE_STYLE[node.type].color;
                const isTopic = node.type === "topic";
                return (
                  <div
                    key={node.id}
                    style={{
                      position: "absolute",
                      left: node.x,
                      top: node.y,
                      transform: `translate(-50%, -50%) scale(${0.9 + enter * 0.1})`,
                      opacity: enter,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: isTopic ? "12px 20px" : "10px 16px",
                      borderRadius: 12,
                      backgroundColor: COLORS.surfaceElevated,
                      border: `1.5px solid ${c}`,
                      boxShadow: `0 6px 18px ${c}22, 0 0 0 4px ${c}0d`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div style={{
                      width: isTopic ? 30 : 26,
                      height: isTopic ? 30 : 26,
                      borderRadius: 8,
                      backgroundColor: `${c}1a`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Icon icon={node.icon} size={isTopic ? 17 : 15} color={c} strokeWidth={2} />
                    </div>
                    <span style={{
                      fontFamily: FONT.ui,
                      fontSize: isTopic ? 15 : 13,
                      color: COLORS.fg,
                      fontWeight: isTopic ? 700 : 500,
                    }}>
                      {node.label}
                    </span>
                  </div>
                );
              })}

              {/* 路径分叉卡片 */}
              {PATHS.map((path, i) => {
                const p = interpolate(pathProgress, [i * 0.18 + 0.2, i * 0.18 + 0.55], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const isSel = selectedPath === path.id;
                const dim = selectedPath && !isSel ? interpolate(pathHighlight, [0, 1], [1, 0.4]) : 1;
                const prob = isSel && i === 0 ? Math.round(probR1) : path.prob;
                return (
                  <div
                    key={path.id}
                    style={{
                      position: "absolute",
                      left: path.x,
                      top: path.y,
                      transform: `translate(-50%, -50%) scale(${isSel ? 1.06 : 1})`,
                      opacity: p * dim,
                      width: 168,
                      padding: 14,
                      borderRadius: 14,
                      backgroundColor: COLORS.surfaceElevated,
                      border: `${isSel ? 2 : 1.5}px solid ${path.color}`,
                      boxShadow: isSel
                        ? `0 10px 28px ${path.color}40, 0 0 0 5px ${path.color}14`
                        : `0 6px 16px ${path.color}1f`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                      <Icon icon={path.icon} size={16} color={path.color} />
                      <span style={{ fontFamily: FONT.ui, fontSize: 13, color: path.color, fontWeight: 600 }}>
                        {path.label}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, backgroundColor: `${path.color}1f`, overflow: "hidden" }}>
                      <div style={{ width: `${prob}%`, height: "100%", backgroundColor: path.color, borderRadius: 3 }} />
                    </div>
                    <div style={{ marginTop: 6, fontFamily: FONT.mono, fontSize: 18, color: path.color, fontWeight: 700 }}>
                      {prob}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 变量调整面板 */}
            {frame >= 340 && (
              <div style={{
                position: "absolute",
                right: 24,
                top: 86,
                width: 196,
                backgroundColor: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                padding: 16,
                fontFamily: FONT.ui,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.fgSecondary, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon={SlidersHorizontal} size={15} color={COLORS.accent} />
                  变量调整
                </div>
                <div style={{ fontSize: 12, color: COLORS.fg, marginBottom: 6 }}>减产幅度（万桶/日）</div>
                <div style={{ height: 6, backgroundColor: COLORS.border, borderRadius: 3, position: "relative", marginBottom: 8 }}>
                  <div style={{ width: `${(sliderValue - 50) / 250 * 100}%`, height: "100%", backgroundColor: COLORS.accent, borderRadius: 3 }} />
                  <div style={{
                    position: "absolute",
                    left: `${(sliderValue - 50) / 250 * 100}%`,
                    top: "50%",
                    width: 14, height: 14, borderRadius: 7,
                    backgroundColor: COLORS.accent,
                    border: "2px solid #fff",
                    transform: "translate(-7px,-7px)",
                    boxShadow: `0 2px 6px ${COLORS.accent}55`,
                  }} />
                </div>
                <div style={{ fontSize: 20, color: COLORS.accent, fontWeight: 700, fontFamily: FONT.mono }}>
                  {Math.round(sliderValue)}
                </div>
              </div>
            )}

            {/* 小地图 */}
            <div style={{
              position: "absolute",
              left: 24,
              bottom: 24,
              width: 150,
              height: 96,
              borderRadius: 10,
              border: `1px solid ${COLORS.borderStrong}`,
              backgroundColor: "rgba(255,255,255,0.9)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} preserveAspectRatio="xMidYMid meet">
                {NODES.map((n) => (
                  <rect key={n.id} x={n.x - 40} y={n.y - 14} width={80} height={28} rx={6}
                    fill={`${NODE_STYLE[n.type].color}33`} stroke={NODE_STYLE[n.type].color} strokeWidth={2} opacity={nodeProgress} />
                ))}
                {PATHS.map((p) => (
                  <rect key={p.id} x={p.x - 60} y={p.y - 24} width={120} height={48} rx={8}
                    fill={`${p.color}22`} stroke={p.color} strokeWidth={2} opacity={pathProgress} />
                ))}
                {/* 视口框 */}
                <rect x={40} y={20} width={STAGE_W - 80} height={STAGE_H - 40} rx={10} fill="none" stroke={COLORS.accent} strokeWidth={4} strokeDasharray="14 10" />
              </svg>
            </div>

            {/* 缩放控件 */}
            <div style={{
              position: "absolute",
              right: 24,
              bottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 4,
              backgroundColor: "rgba(255,255,255,0.9)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: 6,
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            }}>
              {[ZoomOut, ZoomIn, Maximize2].map((Z, i) => (
                <React.Fragment key={i}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon icon={Z} size={16} color={COLORS.fgSecondary} />
                  </div>
                  {i === 0 && (
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.fgSecondary, padding: "0 4px" }}>100%</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* 报告面板 */}
            {frame >= 420 && (
              <div style={{
                position: "absolute",
                bottom: 24,
                left: "50%",
                transform: `translateX(-50%) translateY(${(1 - reportProgress) * 24}px)`,
                width: 720,
                backgroundColor: "rgba(255,255,255,0.94)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderRadius: 16,
                border: `1px solid ${COLORS.accent}44`,
                padding: 20,
                opacity: reportProgress,
                boxShadow: "0 16px 40px rgba(201, 100, 66, 0.16)",
              }}>
                <div style={{ fontFamily: FONT.ui, fontSize: 14, color: COLORS.accent, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon icon={ClipboardList} size={17} color={COLORS.accent} />
                  综合分析报告
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {REPORT_SECTIONS.map((section, i) => {
                    const so = interpolate(reportProgress, [i * 0.12, i * 0.12 + 0.15], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    });
                    return (
                      <div key={i} style={{
                        fontFamily: FONT.ui,
                        fontSize: 12,
                        padding: "6px 12px",
                        borderRadius: 8,
                        backgroundColor: COLORS.accentMuted,
                        color: COLORS.fg,
                        opacity: so,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}>
                        <span style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.accent, color: "white", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontFamily: FONT.mono }}>
                          {i + 1}
                        </span>
                        {section}
                      </div>
                    );
                  })}
                </div>
                <button style={{
                  fontFamily: FONT.ui,
                  fontSize: 13,
                  background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  cursor: "pointer",
                  boxShadow: `0 4px 12px ${COLORS.accent}33`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <Icon icon={Download} size={15} color="#ffffff" />
                  导出报告
                </button>
              </div>
            )}
          </div>
        </div>
      </ProductScreenFrame>

      {/* 字幕 */}
      <SubtitleBar text="把复杂问题，变成推演图" visibleFrom={10} visibleUntil={80} />
      <SubtitleBar text="结构化拆解，沙盘可视化" visibleFrom={90} visibleUntil={180} />
      <SubtitleBar text="多条路径，并排展开" visibleFrom={200} visibleUntil={310} />
      <SubtitleBar text="你选路径，AI 继续推" visibleFrom={330} visibleUntil={400} />
      <SubtitleBar text="推演收束，报告落盘" visibleFrom={420} visibleUntil={470} />
    </AbsoluteFill>
  );
};
