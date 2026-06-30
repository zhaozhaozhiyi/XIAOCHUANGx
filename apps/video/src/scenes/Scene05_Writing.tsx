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
  ClipboardCheck,
  ListTree,
  GripVertical,
  Download,
} from "lucide-react";
import { ProductScreenFrame } from "../components/ProductScreenFrame";
import { SubtitleBar } from "../components/SubtitleBar";
import { Icon } from "../components/Icon";
import { FONT, COLORS } from "../constants";

const TAB_ICONS: Record<string, typeof MessageSquare> = {
  对话: MessageSquare,
  写作: PenLine,
  PPT: Presentation,
};

/* ── 报告内嵌折线图（价格走势 + 渐变填充） ── */
const ReportLineChart: React.FC = () => {
  const data = [58, 72, 50, 84, 66, 90];
  const labels = ["1月", "2月", "3月", "4月", "5月", "6月"];
  const W = 360, H = 120, padL = 8, padR = 8, padT = 10, padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const step = plotW / (data.length - 1);
  const pts = data.map((v, i) => ({ x: padL + i * step, y: padT + plotH - (v / 100) * plotH }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = line + ` ${pts[pts.length - 1].x},${padT + plotH} ${pts[0].x},${padT + plotH}`;
  return (
    <svg width="100%" height={108} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <defs>
        <linearGradient id="repArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.26" />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((g) => {
        const y = padT + plotH - (g / 100) * plotH;
        return <line key={g} x1={padL} y1={y} x2={W - padR} y2={y} stroke={COLORS.borderStrong} strokeWidth={1} strokeDasharray={g === 0 ? "0" : "3 3"} />;
      })}
      <polygon points={area} fill="url(#repArea)" />
      <polyline points={line} fill="none" stroke={COLORS.accent} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <React.Fragment key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={COLORS.accent} />
          <circle cx={p.x} cy={p.y} r={1.6} fill="#fff" />
          <text x={p.x} y={H - 5} textAnchor="middle" style={{ fontFamily: FONT.ui, fontSize: 9, fill: COLORS.fgMuted }}>{labels[i]}</text>
        </React.Fragment>
      ))}
    </svg>
  );
};

/**
 * 第五幕 · 写作能力（32–46s，帧 0–420）— v2 高级版
 *
 * 需求卡片带赤陶竖条 + 大纲卡片带拖拽手柄 + A4纸张预览 + 渐变导出按钮
 */
export const Scene05_Writing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reqCardOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outlineCardOpacity = interpolate(frame, [150, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const draftOpacity = interpolate(frame, [210, 236], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const reveal = (from: number) =>
    interpolate(frame, [from, from + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const exportGlow = frame >= 340
    ? 0.5 + Math.sin((frame - 340) * 0.2) * 0.5
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#e8e6dc" }}>
      <ProductScreenFrame x={160} y={60} width={1600} height={960} enterFrom="scale" enterDelay={5} title="Xiaochuang — 写作">
        <div style={{ display: "flex", height: "100%" }}>
          {/* 左侧对话区 */}
          <div style={{ flex: 1, padding: 24, borderRight: `1px solid ${COLORS.border}` }}>
            {/* 导航栏 */}
            <div style={{ display: "flex", gap: 20, marginBottom: 24, fontFamily: FONT.ui }}>
              {["对话", "写作", "PPT"].map((tab) => (
                <span key={tab} style={{
                  fontSize: 14,
                  color: tab === "写作" ? COLORS.accent : COLORS.fgTertiary,
                  fontWeight: tab === "写作" ? 600 : 400,
                  borderBottom: tab === "写作" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                  paddingBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <Icon icon={TAB_ICONS[tab]} size={15} color={tab === "写作" ? COLORS.accent : COLORS.fgTertiary} />
                  {tab}
                </span>
              ))}
            </div>

            {/* 用户输入 */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
              <div style={{
                backgroundColor: COLORS.accentMuted,
                borderRadius: 16,
                padding: "12px 20px",
                boxShadow: "0 2px 8px rgba(201, 100, 66, 0.1)",
              }}>
                <span style={{ fontFamily: FONT.ui, fontSize: 15, color: COLORS.fg }}>
                  帮我写一篇成品油市场分析
                </span>
              </div>
            </div>

            {/* 需求卡片 — 带赤陶竖条 + 字段分隔 */}
            {frame >= 30 && (
              <div
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  padding: 0,
                  opacity: reqCardOpacity,
                  border: `1px solid ${COLORS.border}`,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* 赤陶竖条 + 标题 */}
                <div style={{ display: "flex" }}>
                  <div style={{ width: 4, backgroundColor: COLORS.accent }} />
                  <div style={{ padding: "14px 16px", flex: 1 }}>
                    <div style={{ fontFamily: FONT.ui, fontSize: 13, color: COLORS.fgSecondary, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon icon={ClipboardCheck} size={15} color={COLORS.accent} />
                      需求确认
                    </div>
                  </div>
                </div>
                <div style={{ padding: "0 16px 16px 20px" }}>
                  {[
                    { label: "体裁", value: "行业分析报告" },
                    { label: "受众", value: "产业客户" },
                    { label: "篇幅", value: "3000字" },
                    { label: "风格", value: "专业正式" },
                  ].map((item, i) => (
                    <div key={i} style={{
                      fontFamily: FONT.ui,
                      fontSize: 13,
                      color: COLORS.fg,
                      padding: "6px 0",
                      borderBottom: i < 3 ? `1px solid ${COLORS.border}` : "none",
                      display: "flex",
                      gap: 8,
                    }}>
                      <span style={{ color: COLORS.accent, fontSize: 8, lineHeight: "20px" }}>●</span>
                      <span style={{ color: COLORS.fgTertiary, width: 36 }}>{item.label}</span>
                      <span style={{ fontWeight: 500 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 大纲卡片 — 带拖拽手柄 + 高亮当前编辑 */}
            {frame >= 150 && (
              <div
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  opacity: outlineCardOpacity,
                  border: `1px solid ${COLORS.accent}44`,
                  boxShadow: `0 2px 8px rgba(201, 100, 66, 0.06)`,
                }}
              >
                <div style={{ fontFamily: FONT.ui, fontSize: 13, color: COLORS.accent, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon={ListTree} size={15} color={COLORS.accent} />
                  写作大纲
                </div>
                {["一、市场概况与宏观环境", "二、汽油市场分析", "三、柴油市场分析", "四、炼厂库存与供给", "五、展望与风险提示"].map((item, i) => {
                  const isEditing = i === 1;
                  return (
                    <div
                      key={i}
                      style={{
                        fontFamily: FONT.ui,
                        fontSize: 13,
                        color: COLORS.fg,
                        padding: "8px 0",
                        paddingLeft: 12,
                        borderLeft: `3px solid ${isEditing ? COLORS.accent : COLORS.borderStrong}`,
                        backgroundColor: isEditing ? COLORS.accentMuted : "transparent",
                        borderRadius: isEditing ? "0 6px 6px 0" : 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Icon icon={GripVertical} size={13} color={COLORS.fgTertiary} style={{ cursor: "grab" }} />
                      <span style={{ fontWeight: isEditing ? 600 : 400 }}>{item}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 右侧预览区 — 图文并茂报告 */}
          <div style={{ width: 660, padding: 24, backgroundColor: COLORS.border, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontFamily: FONT.ui, fontSize: 13, color: COLORS.fgTertiary, fontWeight: 500 }}>预览</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, color: COLORS.fgMuted, padding: "3px 10px", borderRadius: 999, backgroundColor: COLORS.surface, border: `1px solid ${COLORS.borderStrong}` }}>
                约 3,120 字 · 6 节
              </span>
            </div>

            {frame >= 215 && (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  backgroundColor: COLORS.surfaceElevated,
                  borderRadius: 6,
                  padding: "26px 30px",
                  opacity: draftOpacity,
                  color: COLORS.fg,
                  boxShadow: "0 8px 28px rgba(0,0,0,0.1)",
                  border: `1px solid ${COLORS.border}`,
                  borderTop: `3px solid ${COLORS.accent}`,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* 报告头 */}
                <div style={{ opacity: reveal(220) }}>
                  <div style={{ fontFamily: FONT.ui, fontSize: 10, letterSpacing: "0.14em", color: COLORS.accent, fontWeight: 600, marginBottom: 5 }}>
                    INDUSTRY REPORT · 行业分析报告
                  </div>
                  <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                    2026年上半年成品油市场分析
                  </div>
                  <div style={{ fontFamily: FONT.ui, fontSize: 11, color: COLORS.fgTertiary, marginTop: 6 }}>
                    小窗 AI 撰写 · 2026-06-26 · 数据截至 6 月末
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: COLORS.border }} />

                {/* 正文：两栏（文字 + 图） */}
                <div style={{ display: "flex", gap: 18, opacity: reveal(238) }}>
                  <div style={{ flex: 1.05 }}>
                    <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: COLORS.fg, marginBottom: 6 }}>一、市场概况与宏观环境</div>
                    <p style={{ fontFamily: FONT.ui, fontSize: 11.5, color: COLORS.fgSecondary, lineHeight: 1.75, margin: 0 }}>
                      上半年国内成品油需求整体温和修复。汽油消费受居民出行恢复支撑，二季度环比走强；柴油受基建与物流节奏影响维持区间震荡；航煤随国际航线恢复领涨各品种。
                    </p>
                  </div>
                  {/* 图 1 */}
                  <div style={{ flex: 1, backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px" }}>
                    <ReportLineChart />
                    <div style={{ fontFamily: FONT.ui, fontSize: 9.5, color: COLORS.fgMuted, textAlign: "center", marginTop: 4 }}>
                      图 1 · 主营汽油价格走势（元/吨）
                    </div>
                  </div>
                </div>

                {/* KPI 内联 */}
                <div style={{ display: "flex", gap: 10, opacity: reveal(258) }}>
                  {[
                    { l: "汽油消费", v: "+6.8%", up: true },
                    { l: "柴油需求", v: "-2.1%", up: false },
                    { l: "炼厂库存", v: "-12%", up: true },
                    { l: "主营开工", v: "78.5%", up: true },
                  ].map((k, i) => (
                    <div key={i} style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", backgroundColor: COLORS.surface }}>
                      <div style={{ fontFamily: FONT.ui, fontSize: 10, color: COLORS.fgTertiary }}>{k.l}</div>
                      <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: k.up ? COLORS.success : COLORS.danger }}>{k.v}</div>
                    </div>
                  ))}
                </div>

                {/* 二、汽油市场分析 + 数据表 */}
                <div style={{ display: "flex", gap: 18, opacity: reveal(285) }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: COLORS.fg, marginBottom: 6 }}>二、分品种供需分析</div>
                    <p style={{ fontFamily: FONT.ui, fontSize: 11.5, color: COLORS.fgSecondary, lineHeight: 1.75, margin: 0 }}>
                      各品种走势分化明显：汽油偏强、柴油偏弱、航煤领涨。主营炼厂去库节奏稳健，地炼开工随利润修复小幅回升。
                    </p>
                  </div>
                  <div style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", backgroundColor: COLORS.surface, padding: "6px 10px", fontFamily: FONT.ui, fontSize: 10, color: COLORS.fgTertiary, fontWeight: 600 }}>
                      <span style={{ flex: 1.4 }}>品种</span>
                      <span style={{ flex: 1, textAlign: "right" }}>均价</span>
                      <span style={{ flex: 1, textAlign: "right" }}>同比</span>
                    </div>
                    {[
                      { n: "92# 汽油", p: "8,420", y: "+3.2%", up: true },
                      { n: "0# 柴油", p: "7,180", y: "-1.8%", up: false },
                      { n: "航空煤油", p: "6,540", y: "+5.1%", up: true },
                    ].map((r, i) => (
                      <div key={i} style={{ display: "flex", padding: "6px 10px", fontFamily: FONT.ui, fontSize: 11, color: COLORS.fg, borderTop: `1px solid ${COLORS.border}` }}>
                        <span style={{ flex: 1.4 }}>{r.n}</span>
                        <span style={{ flex: 1, textAlign: "right", fontFamily: FONT.mono }}>{r.p}</span>
                        <span style={{ flex: 1, textAlign: "right", fontFamily: FONT.mono, color: r.up ? COLORS.success : COLORS.danger }}>{r.y}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 关键结论 callout */}
                <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${COLORS.accent}33`, opacity: reveal(312) }}>
                  <div style={{ width: 4, backgroundColor: COLORS.accent }} />
                  <div style={{ padding: "10px 14px", backgroundColor: COLORS.accentMuted, flex: 1 }}>
                    <span style={{ fontFamily: FONT.ui, fontSize: 11.5, color: COLORS.fg, lineHeight: 1.6 }}>
                      <b style={{ color: COLORS.accent }}>核心结论：</b>需求温和修复、结构性分化加剧，下半年关注炼厂检修节奏与出口配额变化对价格的扰动。
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 导出按钮 */}
            {frame >= 340 && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  style={{
                    fontFamily: FONT.ui,
                    fontSize: 13,
                    backgroundColor: "transparent",
                    color: COLORS.fgSecondary,
                    border: `1px solid ${COLORS.borderStrong}`,
                    borderRadius: 8,
                    padding: "9px 18px",
                    cursor: "pointer",
                  }}
                >
                  导出 PDF
                </button>
                <button
                  style={{
                    fontFamily: FONT.ui,
                    fontSize: 13,
                    background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`,
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 20px",
                    cursor: "pointer",
                    boxShadow: `0 4px 16px rgba(201, 100, 66, ${0.3 + exportGlow * 0.2})`,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon icon={Download} size={15} color="#ffffff" />
                  导出 DOCX
                </button>
              </div>
            )}
          </div>
        </div>
      </ProductScreenFrame>

      {/* 字幕 */}
      <SubtitleBar text="需要成稿？进入写作" visibleFrom={5} visibleUntil={40} />
      <SubtitleBar text="AI 会先确认你的需求" visibleFrom={45} visibleUntil={140} />
      <SubtitleBar text="大纲可编辑" visibleFrom={155} visibleUntil={260} />
      <SubtitleBar text="成稿落盘，随时导出" visibleFrom={280} visibleUntil={400} />
    </AbsoluteFill>
  );
};
