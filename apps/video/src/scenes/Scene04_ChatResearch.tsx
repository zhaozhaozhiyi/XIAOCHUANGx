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
  TrendingUp,
  TrendingDown,
  Sparkles,
  Globe,
  Check,
  FileText,
  FileSpreadsheet,
  Link2,
  Gauge,
} from "lucide-react";
import { ProductScreenFrame } from "../components/ProductScreenFrame";
import { TypewriterText } from "../components/TypewriterText";
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

/* ─── 品牌标记小图标 ─── */
const BrandMark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" style={{ flexShrink: 0 }}>
    <rect x="3" y="3" width="16" height="16" rx="5" fill={COLORS.accent} />
    <path d="M8 8L14 14M14 8L8 14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ─── 折线图（价格走势） ─── */
const LineChart: React.FC = () => {
  const data = [60, 80, 45, 90, 70, 55, 85, 65];
  const labels = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月"];
  const chartW = 360;
  const chartH = 150;
  const padLeft = 34;
  const padBottom = 24;
  const padTop = 10;
  const padRight = 10;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;
  const maxVal = 100;
  const xStep = plotW / (data.length - 1);
  const points = data.map((v, i) => ({
    x: padLeft + i * xStep,
    y: padTop + plotH - (v / maxVal) * plotH,
  }));
  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaStr =
    polylineStr + ` ${points[points.length - 1].x},${padTop + plotH} ${points[0].x},${padTop + plotH}`;
  const yGridValues = [0, 25, 50, 75, 100];
  return (
    <svg width="100%" height={132} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {yGridValues.map((v) => {
        const y = padTop + plotH - (v / maxVal) * plotH;
        return (
          <line key={v} x1={padLeft} y1={y} x2={chartW - padRight} y2={y}
            stroke={COLORS.borderStrong} strokeWidth={1} strokeDasharray={v === 0 ? "0" : "3 3"} />
        );
      })}
      <polygon points={areaStr} fill="url(#areaGrad)" />
      <polyline points={polylineStr} fill="none" stroke={COLORS.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <React.Fragment key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill={COLORS.accent} />
          <circle cx={p.x} cy={p.y} r={2} fill="#fff" />
        </React.Fragment>
      ))}
      {points.map((p, i) => (
        <text key={`xl-${i}`} x={p.x} y={chartH - 4} textAnchor="middle"
          style={{ fontFamily: FONT.ui, fontSize: 9, fill: COLORS.fgMuted }}>
          {labels[i]}
        </text>
      ))}
    </svg>
  );
};

/* ─── 柱状图（供需对比） ─── */
const BarChart: React.FC = () => {
  const supply = [70, 64, 78, 60];
  const demand = [62, 68, 72, 66];
  const cats = ["汽油", "柴油", "航煤", "燃料油"];
  const W = 360, H = 150, padL = 28, padB = 26, padT = 10;
  const plotW = W - padL - 8;
  const plotH = H - padB - padT;
  const group = plotW / cats.length;
  const bw = 14;
  return (
    <svg width="100%" height={132} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {[0, 25, 50, 75, 100].map((v) => {
        const y = padT + plotH - (v / 100) * plotH;
        return <line key={v} x1={padL} y1={y} x2={W - 8} y2={y} stroke={COLORS.borderStrong} strokeWidth={1} strokeDasharray={v === 0 ? "0" : "3 3"} />;
      })}
      {cats.map((c, i) => {
        const gx = padL + i * group + group / 2;
        const sH = (supply[i] / 100) * plotH;
        const dH = (demand[i] / 100) * plotH;
        return (
          <React.Fragment key={c}>
            <rect x={gx - bw - 3} y={padT + plotH - sH} width={bw} height={sH} rx={3} fill={COLORS.accent} opacity={0.9} />
            <rect x={gx + 3} y={padT + plotH - dH} width={bw} height={dH} rx={3} fill="#6b8ba4" opacity={0.85} />
            <text x={gx} y={H - 8} textAnchor="middle" style={{ fontFamily: FONT.ui, fontSize: 9, fill: COLORS.fgMuted }}>{c}</text>
          </React.Fragment>
        );
      })}
    </svg>
  );
};

/* ─── KPI 卡片 ─── */
const KpiCard: React.FC<{
  label: string;
  value: string;
  delta: string;
  up: boolean;
  icon: typeof MessageSquare;
}> = ({ label, value, delta, up, icon }) => (
  <div style={{
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: "14px 16px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.accentMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon icon={icon} size={16} color={COLORS.accent} />
      </div>
      <span style={{ fontFamily: FONT.ui, fontSize: 12, color: COLORS.fgTertiary }}>{label}</span>
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontFamily: FONT.display, fontSize: 26, fontWeight: 700, color: COLORS.fg }}>{value}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: FONT.mono, fontSize: 12, color: up ? COLORS.success : COLORS.danger }}>
        <Icon icon={up ? TrendingUp : TrendingDown} size={13} color={up ? COLORS.success : COLORS.danger} />
        {delta}
      </span>
    </div>
  </div>
);

/* ─── 数据表 ─── */
const DataTable: React.FC = () => {
  const rows = [
    { name: "92# 汽油", price: "8,420", yoy: "+3.2%", stock: "偏低", up: true },
    { name: "0# 柴油", price: "7,180", yoy: "-1.8%", stock: "中性", up: false },
    { name: "航空煤油", price: "6,540", yoy: "+5.1%", stock: "偏低", up: true },
    { name: "燃料油", price: "4,260", yoy: "-0.6%", stock: "偏高", up: false },
  ];
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", backgroundColor: COLORS.surface, padding: "8px 14px", fontFamily: FONT.ui, fontSize: 11, color: COLORS.fgTertiary, fontWeight: 600 }}>
        <span style={{ flex: 2 }}>品种</span>
        <span style={{ flex: 1.4, textAlign: "right" }}>均价(元/吨)</span>
        <span style={{ flex: 1, textAlign: "right" }}>同比</span>
        <span style={{ flex: 1, textAlign: "right" }}>库存</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", padding: "9px 14px", fontFamily: FONT.ui, fontSize: 12.5, color: COLORS.fg, borderTop: `1px solid ${COLORS.border}` }}>
          <span style={{ flex: 2, fontWeight: 500 }}>{r.name}</span>
          <span style={{ flex: 1.4, textAlign: "right", fontFamily: FONT.mono }}>{r.price}</span>
          <span style={{ flex: 1, textAlign: "right", fontFamily: FONT.mono, color: r.up ? COLORS.success : COLORS.danger }}>{r.yoy}</span>
          <span style={{ flex: 1, textAlign: "right", color: COLORS.fgSecondary }}>{r.stock}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── 已生成文件 chip ─── */
const FileChip: React.FC<{ name: string; icon: typeof MessageSquare; color: string }> = ({ name, icon, color }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8, backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, fontFamily: FONT.ui, fontSize: 12, color: COLORS.fg }}>
    <Icon icon={icon} size={14} color={color} />
    {name}
    <Icon icon={Check} size={13} color={COLORS.success} />
  </div>
);

/**
 * 第四幕 · 对话研究（20–32s，帧 0–360）
 *
 * 一句话提问 → AI 流式输出一份"丰富"的研究回答：
 * 摘要 + KPI + 核心发现 + 价格走势 + 供需对比 + 数据表 + 来源 + 落盘文件。
 */
export const Scene04_ChatResearch: React.FC = () => {
  const frame = useCurrentFrame();

  const reveal = (from: number) =>
    interpolate(frame, [from, from + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const findings = [
    "汽油消费受出行恢复支撑，二季度环比走强，需求温和修复",
    "柴油受基建与物流节奏影响，呈现区间震荡，弹性偏弱",
    "主营炼厂库存压力较去年同期下降约 12%，去库节奏稳健",
    "航煤随国际航线恢复快速回升，同比增幅领先各品种",
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#e8e6dc" }}>
      <ProductScreenFrame x={60} y={60} width={1800} height={960} enterFrom="scale" enterDelay={5} title="Xiaochuang — 对话">
        <div style={{ padding: "24px 36px", fontFamily: FONT.ui, height: "100%", display: "flex", flexDirection: "column" }}>
          {/* 导航 */}
          <div style={{ display: "flex", gap: 22, marginBottom: 18 }}>
            {["对话", "写作", "PPT", "制图", "推演"].map((tab) => (
              <span key={tab} style={{
                fontSize: 14,
                color: tab === "对话" ? COLORS.accent : COLORS.fgTertiary,
                fontWeight: tab === "对话" ? 600 : 400,
                borderBottom: tab === "对话" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                paddingBottom: 5,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <Icon icon={TAB_ICONS[tab]} size={15} color={tab === "对话" ? COLORS.accent : COLORS.fgTertiary} />
                {tab}
              </span>
            ))}
          </div>

          {/* 用户输入 */}
          {frame >= 10 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, maxWidth: "70%" }}>
                <div style={{ backgroundColor: COLORS.accentMuted, borderRadius: 18, padding: "12px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <TypewriterText text="2026年上半年中国成品油市场复盘" startFrame={15} charsPerFrame={3} fontSize={20} color={COLORS.fg} />
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.accent, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 600 }}>
                  我
                </div>
              </div>
            </div>
          )}

          {/* AI 回复（丰富版） */}
          {frame >= 70 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, minHeight: 0, opacity: reveal(70) }}>
              <BrandMark size={28} />
              <div style={{
                flex: 1,
                background: "linear-gradient(180deg, rgba(201,100,66,0.04), transparent 120px)",
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                minHeight: 0,
              }}>
                {/* 标题行 */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Icon icon={TrendingUp} size={20} color={COLORS.accent} />
                  <span style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 700, color: COLORS.fg }}>
                    2026年上半年中国成品油市场复盘
                  </span>
                  <span style={{ padding: "3px 10px", borderRadius: 999, backgroundColor: COLORS.accentMuted, color: COLORS.accent, fontSize: 11, fontWeight: 600 }}>深度研究</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.fgSecondary, fontSize: 11 }}>
                    <Icon icon={Globe} size={12} color={COLORS.success} /> 已联网 · 12 来源
                  </span>
                </div>

                {/* 摘要段落 */}
                <div style={{ fontSize: 14, color: COLORS.fgSecondary, lineHeight: 1.7 }}>
                  上半年国内成品油需求整体温和修复：汽油受出行恢复支撑环比走强，柴油受基建与物流节奏影响维持区间震荡，航煤随国际航线恢复领涨，主营炼厂库存压力较去年同期明显缓解。
                </div>

                {/* KPI 行 */}
                {frame >= 110 && (
                  <div style={{ display: "flex", gap: 14, opacity: reveal(110) }}>
                    <KpiCard label="汽油消费" value="+6.8%" delta="环比" up icon={Gauge} />
                    <KpiCard label="柴油需求" value="-2.1%" delta="同比" up={false} icon={Gauge} />
                    <KpiCard label="主营开工率" value="78.5%" delta="+3.2pct" up icon={Gauge} />
                    <KpiCard label="炼厂库存" value="-12%" delta="去库" up icon={Gauge} />
                  </div>
                )}

                {/* 两栏：发现+表格  /  图表 */}
                {frame >= 150 && (
                  <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0, opacity: reveal(150) }}>
                    {/* 左 */}
                    <div style={{ flex: 1.15, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: COLORS.accent, marginBottom: 8 }}>
                          <Icon icon={Sparkles} size={15} color={COLORS.accent} /> 核心发现
                        </div>
                        {findings.map((t, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", fontSize: 13, color: COLORS.fg, lineHeight: 1.5 }}>
                            <span style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.accentMuted, color: COLORS.accent, fontSize: 10, fontFamily: FONT.mono, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                            {t}
                          </div>
                        ))}
                      </div>
                      {frame >= 195 && (
                        <div style={{ opacity: reveal(195) }}>
                          <DataTable />
                        </div>
                      )}
                    </div>

                    {/* 右：图表 */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${COLORS.border}` }}>
                        <div style={{ fontSize: 12, color: COLORS.fgTertiary, marginBottom: 4 }}>主营汽油价格走势（元/吨）</div>
                        <LineChart />
                      </div>
                      <div style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${COLORS.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: COLORS.fgTertiary }}>供需对比（指数）</span>
                          <span style={{ display: "flex", gap: 12, fontSize: 10, color: COLORS.fgTertiary }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.accent }} />供给</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: "#6b8ba4" }} />需求</span>
                          </span>
                        </div>
                        <BarChart />
                      </div>
                    </div>
                  </div>
                )}

                {/* 底部：来源 + 落盘文件 */}
                {frame >= 250 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: `1px solid ${COLORS.border}`, opacity: reveal(250) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: COLORS.fgTertiary }}>
                      <Icon icon={Link2} size={13} color={COLORS.fgTertiary} />
                      来源：小窗数据库 · 国家统计局 · 隆众资讯 · 海关总署
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <FileChip name="市场复盘.md" icon={FileText} color={COLORS.success} />
                      <FileChip name="供需摘要.docx" icon={FileText} color="#2563eb" />
                      <FileChip name="价格数据.xlsx" icon={FileSpreadsheet} color="#15803d" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ProductScreenFrame>

      {/* 字幕 */}
      <SubtitleBar text="一句话，开启研究" visibleFrom={10} visibleUntil={70} />
      <SubtitleBar text="自动检索、分析、整理成结论" visibleFrom={80} visibleUntil={180} />
      <SubtitleBar text="数据、图表、表格，一应俱全" visibleFrom={185} visibleUntil={250} />
      <SubtitleBar text="结论自动落盘" visibleFrom={255} visibleUntil={340} />
    </AbsoluteFill>
  );
};
