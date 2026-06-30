import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import {
  MessageSquare,
  PenLine,
  Presentation,
  Ruler,
  Network,
  ClipboardList,
  CheckCircle2,
  ListTree,
  FileText,
  Box,
  Package,
  Blocks,
  Cpu,
  Laptop,
  PackageCheck,
} from "lucide-react";
import { ProductScreenFrame } from "../components/ProductScreenFrame";
import { ArrowConnector } from "../components/ArrowConnector";
import { WarmBackground } from "../components/WarmBackground";
import { SubtitleBar } from "../components/SubtitleBar";
import { Icon } from "../components/Icon";
import { FONT, COLORS } from "../constants";

/**
 * 第十幕 · 全场景串联（104–118s，帧 0–420）
 *
 * Shot33 (0–4s): 五窗口并排 + 箭头
 * Shot34 (4–9s): 五窗合并 + 流程快进
 * Shot35 (9–14s): 窗口缩小 + 标签环绕
 */
export const Scene10_Montage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Shot33 → Shot34: 五窗合并 ──
  const mergeProgress = interpolate(frame, [120, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 五窗口位置
  const windowPositions = [
    { baseX: 20, baseY: 120, label: "对话研究", icon: MessageSquare },
    { baseX: 400, baseY: 120, label: "写作成稿", icon: PenLine },
    { baseX: 780, baseY: 120, label: "PPT 演示", icon: Presentation },
    { baseX: 1160, baseY: 120, label: "工业制图", icon: Ruler },
    { baseX: 1540, baseY: 120, label: "推演沙盘", icon: Network },
  ];

  // 合并后的中心位置
  const centerX = 360;
  const centerY = 80;

  // 各窗口在合并过程中的位置
  const getWindowX = (i: number) => {
    const base = windowPositions[i].baseX;
    return interpolate(mergeProgress, [0, 1], [base, centerX]);
  };
  const getWindowY = (i: number) => {
    const base = windowPositions[i].baseY;
    return interpolate(mergeProgress, [0, 1], [base, centerY]);
  };
  const getWindowWidth = () => interpolate(mergeProgress, [0, 1], [350, 1200]);
  const getWindowHeight = () => interpolate(mergeProgress, [0, 1], [660, 920]);
  const getWindowOpacity = (i: number) => i === 2 ? 1 : interpolate(mergeProgress, [0.6, 1], [1, 0]);

  // 箭头
  const arrowProgress = interpolate(frame, [40, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Shot34: 内部流程快进 ──
  const flowSteps = [
    { label: "需求采集", icon: ClipboardList },
    { label: "摘要确认", icon: CheckCircle2 },
    { label: "大纲规划", icon: ListTree },
    { label: "成稿输出", icon: FileText },
    { label: "3D 预览", icon: Box },
    { label: "沙盘推演", icon: Network },
    { label: "工作区交付", icon: Package },
  ];

  const flowProgress = interpolate(frame, [180, 300], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 流程出现时，淡出合并窗口内的静态图标，避免遮挡
  const flowAppear = interpolate(frame, [168, 194], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Shot35: 窗口缩小 + 标签环绕 ──
  const shrinkProgress = interpolate(frame, [300, 340], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const windowScale = interpolate(shrinkProgress, [0, 1], [1, 0.5]);

  // 能力卡片（环绕中心）
  const capabilities = [
    { t: "40+ 技能模板", d: "开箱即用", icon: Blocks, angle: -Math.PI / 2 },
    { t: "多模型切换", d: "引擎自由选", icon: Cpu, angle: -Math.PI / 6 },
    { t: "参数化制图", d: "一句话出图", icon: Ruler, angle: Math.PI / 6 },
    { t: "沙盘推演", d: "多路径并行", icon: Network, angle: Math.PI / 2 },
    { t: "本地优先", d: "数据不出门", icon: Laptop, angle: (5 * Math.PI) / 6 },
    { t: "结构化交付", d: "即取即用", icon: PackageCheck, angle: (7 * Math.PI) / 6 },
  ];

  return (
    <AbsoluteFill>
      <WarmBackground />

      {/* 五窗口 + 箭头 */}
      {frame < 320 && (
        <>
          {windowPositions.map((wp, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: getWindowX(i),
                top: getWindowY(i),
                transform: `scale(${frame >= 300 ? windowScale : 1})`,
                transformOrigin: "center center",
                opacity: frame >= 180 ? getWindowOpacity(i) : 1,
              }}
            >
              <ProductScreenFrame
                x={0}
                y={0}
                width={getWindowWidth()}
                height={getWindowHeight()}
                enterFrom="scale"
                enterDelay={i * 6}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: 12,
                    opacity: i === 2 ? 1 - flowAppear : 1,
                  }}
                >
                  <div style={{
                    width: 96,
                    height: 96,
                    borderRadius: 24,
                    background: `linear-gradient(135deg, ${COLORS.accentMuted}, ${COLORS.surface})`,
                    border: `1px solid ${COLORS.accent}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 8px 24px ${COLORS.accent}1a`,
                  }}>
                    <Icon icon={wp.icon} size={48} color={COLORS.accent} strokeWidth={1.6} />
                  </div>
                  <span style={{ fontFamily: FONT.ui, fontSize: 18, color: COLORS.fgSecondary, fontWeight: 600 }}>
                    {wp.label}
                  </span>
                </div>
              </ProductScreenFrame>
            </div>
          ))}

          {/* 箭头 */}
          {frame < 130 && (
            <>
              <ArrowConnector fromX={350} fromY={450} toX={420} toY={450} progress={arrowProgress} opacity={arrowProgress > 0 ? 0.8 : 0} />
              <ArrowConnector fromX={730} fromY={450} toX={800} toY={450} progress={arrowProgress} opacity={arrowProgress > 0 ? 0.8 : 0} />
              <ArrowConnector fromX={1110} fromY={450} toX={1180} toY={450} progress={arrowProgress} opacity={arrowProgress > 0 ? 0.8 : 0} />
              <ArrowConnector fromX={1490} fromY={450} toX={1560} toY={450} progress={arrowProgress} opacity={arrowProgress > 0 ? 0.8 : 0} />
            </>
          )}
        </>
      )}

      {/* 合并后的流程快进 — 圆弧型流程 */}
      {frame >= 180 && frame < 320 && (() => {
        // 圆弧布局参数（容器坐标系 900 × 360）
        const W = 900;
        const cx = W / 2;
        const R = 360;
        const cyCircle = 360;
        const thetaMin = -1.18; // ≈ -68°
        const thetaMax = 1.18; //  ≈  68°
        const yOffset = 48;
        const nodePos = flowSteps.map((_, i) => {
          const t = flowSteps.length > 1 ? i / (flowSteps.length - 1) : 0.5;
          const theta = thetaMin + t * (thetaMax - thetaMin);
          return {
            x: cx + R * Math.sin(theta),
            y: cyCircle - R * Math.cos(theta) + yOffset,
          };
        });
        // 用 Catmull-Rom 平滑曲线穿过所有节点，保证连线与节点精确吻合
        const arcPath = (() => {
          if (nodePos.length < 2) return "";
          let d = `M ${nodePos[0].x} ${nodePos[0].y}`;
          for (let i = 0; i < nodePos.length - 1; i++) {
            const p0 = nodePos[i - 1] || nodePos[i];
            const p1 = nodePos[i];
            const p2 = nodePos[i + 1];
            const p3 = nodePos[i + 2] || p2;
            const c1x = p1.x + (p2.x - p0.x) / 6;
            const c1y = p1.y + (p2.y - p0.y) / 6;
            const c2x = p2.x - (p3.x - p1.x) / 6;
            const c2y = p2.y - (p3.y - p1.y) / 6;
            d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
          }
          return d;
        })();

        return (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${frame >= 300 ? windowScale : 1})`,
              width: W,
              height: 400,
              opacity: mergeProgress,
            }}
          >
            {/* 弧线连接 */}
            <svg width={W} height={400} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <path d={arcPath} fill="none" stroke={`${COLORS.accent}33`} strokeWidth={2.5} strokeLinecap="round" />
              <path
                d={arcPath}
                fill="none"
                stroke={COLORS.accent}
                strokeWidth={2.5}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - flowProgress}
              />
            </svg>

            {/* 节点 */}
            {flowSteps.map((step, i) => {
              const stepProgress = interpolate(
                flowProgress,
                [i / flowSteps.length, (i + 0.5) / flowSteps.length],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              const p = nodePos[i];
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    transform: `translate(-50%, -50%) scale(${0.5 + stepProgress * 0.5})`,
                    opacity: stepProgress,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    width: 110,
                  }}
                >
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: COLORS.surfaceElevated,
                    border: `1.5px solid ${COLORS.accent}55`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 6px 16px ${COLORS.accent}1f`,
                  }}>
                    <Icon icon={step.icon} size={26} color={COLORS.accent} strokeWidth={1.7} />
                  </div>
                  <span style={{ fontFamily: FONT.ui, fontSize: 13, fontWeight: 600, color: COLORS.fg, textAlign: "center", whiteSpace: "nowrap" }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 能力环绕看板 */}
      {frame >= 310 && (() => {
        const cx2 = 960, cy2 = 540, rx = 580, ry = 300;
        const centerSp = spring({ frame: frame - 314, fps, config: { damping: 14, stiffness: 120 } });
        return (
          <>
            {/* 连接线 */}
            <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {capabilities.map((c, i) => {
                const x = cx2 + rx * Math.cos(c.angle);
                const y = cy2 + ry * Math.sin(c.angle);
                const lp = interpolate(
                  spring({ frame: frame - 312 - i * 6, fps, config: { damping: 18, stiffness: 120 } }),
                  [0, 1], [0, 1]
                );
                return (
                  <line key={i} x1={cx2} y1={cy2} x2={x} y2={y} stroke={`${COLORS.accent}40`} strokeWidth={1.5} strokeDasharray="3 6" opacity={lp * 0.7} />
                );
              })}
            </svg>

            {/* 中心品牌 */}
            <div style={{
              position: "absolute", left: cx2, top: cy2,
              transform: `translate(-50%, -50%) scale(${interpolate(centerSp, [0, 1], [0.8, 1])})`,
              opacity: interpolate(centerSp, [0, 1], [0, 1]),
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            }}>
              <div style={{ width: 92, height: 92, borderRadius: 24, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 14px 40px ${COLORS.accent}44` }}>
                <svg viewBox="0 0 16 16" width={46} height={46} fill="none"><circle cx="8" cy="8" r="4.5" stroke="#faf9f5" strokeWidth="4" /></svg>
              </div>
              <span style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 700, color: COLORS.fg }}>小窗</span>
              <span style={{ fontFamily: FONT.ui, fontSize: 14, color: COLORS.fgTertiary }}>一个工作台，全部搞定</span>
            </div>

            {/* 能力卡片 */}
            {capabilities.map((c, i) => {
              const x = cx2 + rx * Math.cos(c.angle);
              const y = cy2 + ry * Math.sin(c.angle);
              const sp = spring({ frame: frame - 316 - i * 6, fps, config: { damping: 14, stiffness: 120 } });
              const op = interpolate(sp, [0, 1], [0, 1]);
              const s = interpolate(sp, [0, 1], [0.7, 1]);
              return (
                <div key={i} style={{
                  position: "absolute", left: x, top: y,
                  transform: `translate(-50%, -50%) scale(${s})`,
                  opacity: op,
                  width: 216,
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px",
                  borderRadius: 18,
                  backgroundColor: COLORS.surfaceElevated,
                  border: `1px solid ${COLORS.accent}33`,
                  boxShadow: `0 12px 30px ${COLORS.accent}1f`,
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: COLORS.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon icon={c.icon} size={24} color={COLORS.accent} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT.ui, fontSize: 16, fontWeight: 700, color: COLORS.fg, whiteSpace: "nowrap" }}>{c.t}</div>
                    <div style={{ fontFamily: FONT.ui, fontSize: 12.5, color: COLORS.fgTertiary, marginTop: 2 }}>{c.d}</div>
                  </div>
                </div>
              );
            })}
          </>
        );
      })()}

      {/* 字幕 */}
      <SubtitleBar text="研究 → 写作 → 演示 → 制图 → 推演" visibleFrom={10} visibleUntil={110} />
      <SubtitleBar text="AI 跑完全流程，你只需要确认和交付" visibleFrom={120} visibleUntil={280} />
    </AbsoluteFill>
  );
};
