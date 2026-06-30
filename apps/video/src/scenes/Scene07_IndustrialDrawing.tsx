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
  FileCog,
  Axis3d,
  ChevronDown,
  Download,
  CheckCircle2,
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
};

/**
 * 第七幕 · 工业制图（62–76s，帧 0–420）— v2 高级版
 *
 * 深色3D预览区 + 金属质感储罐 + 精致参数面板 + DXF导出
 */
export const Scene07_IndustrialDrawing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 方案卡
  const outlineOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D 预览：线框 → 实体渲染进度
  const renderProgress = interpolate(frame, [120, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 旋转角度
  const rotation = frame * 0.6;

  // 参数面板
  const paramPanelX = interpolate(frame, [240, 270], [300, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const paramPanelOpacity = interpolate(frame, [240, 270], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 滑杆拖动动画
  const sliderValue = interpolate(frame, [280, 310], [800, 1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D 变形动画
  const tankWidth = interpolate(sliderValue, [800, 1200], [140, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 导出按钮
  const exportButtonSpring = spring({
    frame: frame - 340,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const exportButtonScale = interpolate(exportButtonSpring, [0, 1], [0.8, 1]);
  const exportButtonOpacity = interpolate(exportButtonSpring, [0, 1], [0, 1]);

  // DXF 落入工作区
  const dxfFileOpacity = interpolate(frame, [380, 400], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 参数数据
  const params = [
    { group: "筒体", items: [
      { label: "直径", value: Math.round(sliderValue), unit: "mm", min: 400, max: 2000, step: 50 },
      { label: "高度", value: 1600, unit: "mm", min: 400, max: 3000, step: 100 },
      { label: "壁厚", value: 8, unit: "mm", min: 3, max: 30, step: 1 },
    ]},
    { group: "法兰", items: [
      { label: "孔径", value: 18, unit: "mm", min: 10, max: 40, step: 2 },
      { label: "螺栓数", value: 16, unit: "", min: 4, max: 32, step: 4 },
    ]},
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#e8e6dc" }}>
      <ProductScreenFrame x={160} y={60} width={1600} height={960} enterFrom="scale" enterDelay={5} title="Xiaochuang — 制图">
        <div style={{ display: "flex", height: "100%" }}>
          {/* 左侧对话区 */}
          <div style={{ flex: 1, padding: 24, borderRight: `1px solid ${COLORS.border}` }}>
            {/* 导航 */}
            <div style={{ display: "flex", gap: 20, marginBottom: 24, fontFamily: FONT.ui }}>
              {["对话", "写作", "PPT", "制图"].map((tab, i) => (
                <span key={tab} style={{
                  fontSize: 14,
                  color: tab === "制图" ? COLORS.accent : COLORS.fgTertiary,
                  fontWeight: tab === "制图" ? 600 : 400,
                  borderBottom: tab === "制图" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                  paddingBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <Icon icon={TAB_ICONS[tab]} size={15} color={tab === "制图" ? COLORS.accent : COLORS.fgTertiary} />
                  {tab}
                </span>
              ))}
            </div>

            {/* 用户输入 */}
            {frame >= 15 && (
              <div style={{
                backgroundColor: COLORS.accentMuted,
                borderRadius: 16,
                padding: "14px 20px",
                fontFamily: FONT.ui,
                fontSize: 15,
                color: COLORS.fg,
                marginBottom: 20,
                borderLeft: `3px solid ${COLORS.accent}`,
                boxShadow: `0 2px 8px rgba(201, 100, 66, 0.1)`,
              }}>
                画一个带法兰接口的立式储罐
              </div>
            )}

            {/* 方案卡 — 加缩略图预览 */}
            {frame >= 60 && (
              <div
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  padding: 0,
                  opacity: outlineOpacity,
                  border: `1px solid ${COLORS.accent}44`,
                  overflow: "hidden",
                  boxShadow: `0 4px 16px rgba(201, 100, 66, 0.08)`,
                }}
              >
                {/* 缩略图预览 */}
                <div style={{
                  height: 80,
                  background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}>
                  <svg viewBox="0 0 200 80" width="80" height="40">
                    <rect x="70" y="10" width="60" height="50" rx="2" fill="none" stroke={COLORS.accent} strokeWidth="1.5" />
                    <ellipse cx="100" cy="10" rx="30" ry="8" fill="none" stroke={COLORS.accent} strokeWidth="1" />
                    <ellipse cx="100" cy="60" rx="30" ry="8" fill="none" stroke={COLORS.accent} strokeWidth="1" />
                    <rect x="60" y="18" width="80" height="6" rx="1" fill="none" stroke="#f5f4ed55" strokeWidth="0.8" />
                  </svg>
                  <div style={{ position: "absolute", bottom: 6, right: 10, fontFamily: FONT.mono, fontSize: 10, color: COLORS.fgMuted }}>
                    .scad 预览
                  </div>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontFamily: FONT.ui, fontSize: 13, color: COLORS.accent, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon icon={FileCog} size={15} color={COLORS.accent} />
                    方案卡
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontFamily: FONT.ui, fontSize: 12, color: COLORS.fgSecondary }}>
                    <span>类型 立式储罐</span>
                    <span>特征 法兰接口</span>
                    <span>参数 5 项可编辑</span>
                    <span>格式 SCAD / DXF</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：3D 预览 + 参数面板 */}
          <div style={{ width: 800, display: "flex", flexDirection: "column" }}>
            {/* 3D 预览区 — 深色场景 */}
            <div style={{
              flex: 1,
              background: "linear-gradient(180deg, #1a1a1a, #0d0d0d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* 网格地面线 */}
              <svg viewBox="0 0 400 200" width="100%" height="100%" style={{ position: "absolute", bottom: 0, opacity: 0.15 }}>
                {[0, 40, 80, 120, 160, 200].map((y, i) => (
                  <line key={`h${i}`} x1="0" y1={y + 100} x2="400" y2={y + 100} stroke="#ffffff" strokeWidth="0.5" />
                ))}
                {[0, 50, 100, 150, 200, 250, 300, 350, 400].map((x, i) => (
                  <line key={`v${i}`} x1={x} y1="100" x2={x} y2="200" stroke="#ffffff" strokeWidth="0.3" />
                ))}
              </svg>

              {/* 坐标轴 */}
              <div style={{ position: "absolute", bottom: 12, left: 12, fontFamily: FONT.mono, fontSize: 11, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon icon={Axis3d} size={16} color="rgba(255,255,255,0.4)" />
                X / Y / Z
              </div>

              {/* 预览标签 */}
              <div style={{
                position: "absolute", top: 12, right: 12,
                fontFamily: FONT.ui, fontSize: 11, color: "rgba(255,255,255,0.4)",
                backgroundColor: "rgba(255,255,255,0.06)",
                padding: "3px 10px", borderRadius: 4,
              }}>
                3D 预览
              </div>

              {/* 储罐 SVG — 金属质感 */}
              {frame >= 90 && (
                <div
                  style={{
                    width: 320,
                    height: 400,
                    position: "relative",
                    transform: `rotateY(${rotation}deg)`,
                  }}
                >
                  <svg viewBox="0 0 200 300" width="100%" height="100%">
                    <defs>
                      {/* 金属质感渐变 */}
                      <linearGradient id="tankBody" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8b5e3c" />
                        <stop offset="30%" stopColor="#c96442" />
                        <stop offset="60%" stopColor="#d97757" />
                        <stop offset="100%" stopColor="#8b5e3c" />
                      </linearGradient>
                      <linearGradient id="tankCap" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7a5232" />
                        <stop offset="40%" stopColor="#b85c3d" />
                        <stop offset="100%" stopColor="#7a5232" />
                      </linearGradient>
                      <linearGradient id="tankFlange" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6b6b6b" />
                        <stop offset="40%" stopColor="#9a9a9a" />
                        <stop offset="100%" stopColor="#6b6b6b" />
                      </linearGradient>
                    </defs>

                    {/* 底部阴影 */}
                    <ellipse cx="100" cy={230 + tankWidth / 4} rx={tankWidth / 2 + 10} ry="10" fill="rgba(0,0,0,0.3)" />

                    {/* 筒体 */}
                    <rect
                      x={100 - tankWidth / 2} y={60} width={tankWidth} height={160} rx={3}
                      fill={renderProgress > 0.5 ? "url(#tankBody)" : "none"}
                      stroke={COLORS.accent} strokeWidth={renderProgress > 0.5 ? 0.5 : 2}
                      style={{ transition: "x 0.3s, width 0.3s" }}
                    />
                    {/* 顶部封头 */}
                    <ellipse cx={100} cy={60} rx={tankWidth / 2} ry={20}
                      fill={renderProgress > 0.7 ? "url(#tankCap)" : "none"}
                      stroke={COLORS.accent} strokeWidth={renderProgress > 0.7 ? 0.5 : 2}
                      style={{ transition: "rx 0.3s" }}
                    />
                    {/* 底部封头 */}
                    <ellipse cx={100} cy={220} rx={tankWidth / 2} ry={20}
                      fill={renderProgress > 0.8 ? "url(#tankCap)" : "none"}
                      stroke={COLORS.accent} strokeWidth={renderProgress > 0.8 ? 0.5 : 2}
                      style={{ transition: "rx 0.3s" }}
                    />
                    {/* 法兰 */}
                    {renderProgress > 0.6 && (
                      <>
                        <rect x={100 - tankWidth / 2 - 10} y={80} width={tankWidth + 20} height={10} rx={2}
                          fill={renderProgress > 0.9 ? "url(#tankFlange)" : "none"}
                          stroke="#9a9a9a" strokeWidth={0.8}
                          style={{ transition: "x 0.3s, width 0.3s" }}
                        />
                        <rect x={100 - tankWidth / 2 - 10} y={180} width={tankWidth + 20} height={10} rx={2}
                          fill={renderProgress > 0.9 ? "url(#tankFlange)" : "none"}
                          stroke="#9a9a9a" strokeWidth={0.8}
                          style={{ transition: "x 0.3s, width 0.3s" }}
                        />
                        {/* 螺栓点 */}
                        {[-6, -2, 2, 6].map((bx, i) => (
                          <React.Fragment key={`b1${i}`}>
                            <circle cx={100 + bx * (tankWidth / 14)} cy={85} r="1.5" fill="#aaa" />
                            <circle cx={100 + bx * (tankWidth / 14)} cy={185} r="1.5" fill="#aaa" />
                          </React.Fragment>
                        ))}
                      </>
                    )}
                    {/* 尺寸标注线 */}
                    <line x1={100 - tankWidth / 2 - 20} y1={60} x2={100 - tankWidth / 2 - 20} y2={220} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="3 3" />
                    <text x={100 - tankWidth / 2 - 24} y={145} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="end" transform={`rotate(-90, ${100 - tankWidth / 2 - 24}, 145)`}>
                      {sliderValue}mm
                    </text>
                  </svg>
                </div>
              )}
            </div>

            {/* 参数面板 — 精致滑杆 */}
            {frame >= 240 && (
              <div
                style={{
                  height: 240,
                  borderTop: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.surface,
                  padding: 16,
                  opacity: paramPanelOpacity,
                  transform: `translateX(${paramPanelX}px)`,
                  overflowY: "auto",
                }}
              >
                <div style={{ fontFamily: FONT.ui, fontSize: 13, color: COLORS.fgSecondary, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon={ChevronDown} size={15} color={COLORS.accent} />
                  参数面板
                </div>
                {params.map((group, gi) => (
                  <div key={gi} style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: FONT.ui, fontSize: 11, color: COLORS.fgTertiary, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {group.group}
                    </div>
                    {group.items.map((item, ii) => {
                      const isSlider = item.label === "直径";
                      const progress = isSlider
                        ? (item.value - (item.min || 0)) / ((item.max || 1) - (item.min || 0))
                        : 0.5;

                      return (
                        <div key={ii} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                          <span style={{ fontFamily: FONT.ui, fontSize: 12, color: COLORS.fg, width: 44 }}>{item.label}</span>
                          <div style={{ flex: 1, position: "relative", height: 20, display: "flex", alignItems: "center" }}>
                            {/* 刻度线 */}
                            <div style={{ position: "absolute", width: "100%", height: 1, backgroundColor: COLORS.border, top: "50%" }} />
                            {/* 进度条 */}
                            <div style={{
                              position: "absolute",
                              left: 0,
                              width: `${isSlider ? progress * 100 : 50}%`,
                              height: 4,
                              backgroundColor: isSlider ? COLORS.accent : COLORS.fgTertiary,
                              borderRadius: 2,
                              top: "calc(50% - 2px)",
                              opacity: isSlider ? 1 : 0.3,
                            }} />
                            {/* 滑杆手柄 */}
                            {isSlider && (
                              <div style={{
                                position: "absolute",
                                left: `${progress * 100}%`,
                                top: "50%",
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                backgroundColor: COLORS.accent,
                                border: "2px solid white",
                                transform: "translate(-8px, -8px)",
                                boxShadow: "0 2px 6px rgba(201, 100, 66, 0.3)",
                              }} />
                            )}
                          </div>
                          <span style={{
                            fontFamily: FONT.mono,
                            fontSize: isSlider ? 14 : 12,
                            color: isSlider ? COLORS.accent : COLORS.fgSecondary,
                            width: 64,
                            textAlign: "right",
                            fontWeight: isSlider ? 700 : 400,
                          }}>
                            {item.value}{item.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ProductScreenFrame>

      {/* 导出 DXF 按钮 */}
      {frame >= 340 && (
        <div
          style={{
            position: "absolute",
            top: 80,
            right: 100,
            opacity: exportButtonOpacity,
            transform: `scale(${exportButtonScale})`,
          }}
        >
          <button
            style={{
              fontFamily: FONT.ui,
              fontSize: 14,
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              cursor: "pointer",
              boxShadow: `0 4px 16px ${COLORS.accent}44`,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon icon={Download} size={16} color="#ffffff" />
            导出 DXF
          </button>
        </div>
      )}

      {/* DXF 文件落入工作区 */}
      {frame >= 380 && (
        <div
          style={{
            position: "absolute",
            bottom: 120,
            right: 200,
            backgroundColor: COLORS.success,
            color: "white",
            fontFamily: FONT.ui,
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 8,
            opacity: dxfFileOpacity,
            boxShadow: "0 4px 12px rgba(45, 106, 79, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon icon={CheckCircle2} size={16} color="#ffffff" />
          drawing.dxf 已保存到工作区
        </div>
      )}

      {/* 字幕 */}
      <SubtitleBar text="一句话，生成工业图" visibleFrom={10} visibleUntil={80} />
      <SubtitleBar text="参数化 3D 模型" visibleFrom={90} visibleUntil={200} />
      <SubtitleBar text="参数可调，实时刷新" visibleFrom={240} visibleUntil={320} />
      <SubtitleBar text="导出 DXF，直接用" visibleFrom={340} visibleUntil={400} />
    </AbsoluteFill>
  );
};
