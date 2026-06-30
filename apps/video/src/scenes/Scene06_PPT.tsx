import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import {
  MessageSquare,
  PenLine,
  Presentation,
  ListOrdered,
  Sparkles,
  FileCode,
  Download,
  Ruler,
  Network,
  Cpu,
  Search,
  PackageCheck,
  ArrowRight,
  Zap,
  Blocks,
  FileStack,
  Clock,
  Laptop,
  Rocket,
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

type SlideType = "cover" | "matrix" | "pipeline" | "stats";

const slidePages: { title: string; type: SlideType }[] = [
  { title: "小窗 · 全能力一览", type: "cover" },
  { title: "六大核心能力", type: "matrix" },
  { title: "全流程闭环交付", type: "pipeline" },
  { title: "硬核实力", type: "stats" },
];

/* ── 内容页头部 ── */
const SlideHeader: React.FC<{ kicker: string; title: string; index: number }> = ({ kicker, title, index }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: FONT.ui, fontSize: 12, color: COLORS.accent, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 6 }}>
        <span style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 16 16" width={10} height={10}><circle cx="8" cy="8" r="4.5" stroke="#fff" strokeWidth="4" fill="none" /></svg>
        </span>
        {kicker}
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 700, color: COLORS.fg }}>{title}</div>
      <div style={{ width: 56, height: 4, borderRadius: 2, marginTop: 8, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentWarm})` }} />
    </div>
    <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLORS.fgMuted }}>{String(index + 1).padStart(2, "0")}</span>
  </div>
);

/**
 * 第六幕 · PPT 能力（46–62s，帧 0–480）— v5 纯能力·夸张版
 *
 * 只讲产品能力：封面 / 六大核心能力 / 全流程闭环 / 硬核实力。
 */
export const Scene06_PPT: React.FC = () => {
  const frame = useCurrentFrame();

  const outlineOpacity = interpolate(frame, [30, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exportOpacity = interpolate(frame, [380, 410], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const flipStart = 150, flipEnd = 360, total = slidePages.length;
  const slideSpan = (flipEnd - flipStart) / total;
  const idxFloat = (frame - flipStart) / slideSpan;
  const currentSlideIndex = Math.min(Math.max(Math.floor(idxFloat), 0), total - 1);
  const localFrame = frame - (flipStart + currentSlideIndex * slideSpan);

  const enterProgress = interpolate(localFrame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const slideRotateY = interpolate(enterProgress, [0, 1], [-20, 0]);
  const slideShiftX = interpolate(enterProgress, [0, 1], [54, 0]);
  const sheenX = interpolate(localFrame, [16, 42], [-40, 140], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const orbT = frame * 0.02;

  const navTabs = ["对话", "写作", "PPT"];
  const slide = slidePages[currentSlideIndex];

  const renderBody = () => {
    switch (slide.type) {
      case "cover":
        return (
          <div style={{ position: "relative", width: "100%", height: "100%", padding: 40, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.accentWarm}aa, transparent 65%)`, filter: "blur(22px)", top: 20 + Math.sin(orbT) * 26, right: -30 + Math.cos(orbT) * 26, opacity: 0.55 }} />
            <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, #6b8ba4aa, transparent 65%)", filter: "blur(26px)", bottom: -40 + Math.cos(orbT * 1.3) * 22, left: -20 + Math.sin(orbT * 1.3) * 22, opacity: 0.4 }} />
            <div style={{ position: "absolute", top: 22, right: 28, opacity: 0.16 }}>
              <svg viewBox="0 0 120 120" width={96} height={96} fill="none">
                <circle cx={60} cy={60} r={34} stroke="#fff" strokeWidth={0.6} />
                <circle cx={60} cy={60} r={20} stroke="#fff" strokeWidth={0.6} />
                <line x1={0} y1={0} x2={120} y2={0} stroke="#fff" strokeWidth={1} />
                <line x1={0} y1={0} x2={0} y2={120} stroke="#fff" strokeWidth={1} />
              </svg>
            </div>
            <div style={{ position: "absolute", top: 28, left: 36, display: "flex", alignItems: "center", gap: 9, zIndex: 2 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 16 16" width={16} height={16} fill="none"><circle cx="8" cy="8" r="4.5" stroke="#faf9f5" strokeWidth="4" /></svg>
              </div>
              <span style={{ fontFamily: FONT.display, fontSize: 17, color: "rgba(255,255,255,0.92)", fontWeight: 700, letterSpacing: "0.05em" }}>小窗</span>
            </div>

            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ fontFamily: FONT.display, fontSize: 58, fontWeight: 700, color: "#fff", lineHeight: 1, textShadow: "0 6px 28px rgba(0,0,0,0.4)" }}>小窗</div>
              <div style={{ width: interpolate(enterProgress, [0, 1], [0, 220]), height: 5, borderRadius: 3, margin: "16px 0", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentWarm})`, boxShadow: `0 0 16px ${COLORS.accent}88` }} />
              <div style={{ fontFamily: FONT.display, fontSize: 26, color: "rgba(255,255,255,0.94)", fontWeight: 600 }}>一站式全能智能工作台</div>
              <div style={{ fontFamily: FONT.ui, fontSize: 15, color: "rgba(255,255,255,0.65)", marginTop: 8, letterSpacing: "0.03em" }}>一个窗口，干完一支团队的活</div>
            </div>

            <div style={{ position: "absolute", bottom: 30, left: 40, right: 40, display: "flex", gap: 8, zIndex: 2 }}>
              {[{ i: MessageSquare, t: "对话研究" }, { i: PenLine, t: "智能写作" }, { i: Presentation, t: "炫彩演示" }, { i: Ruler, t: "工业制图" }, { i: Network, t: "沙盘推演" }].map((f, k) => (
                <div key={k} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 6px", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.85)", fontFamily: FONT.ui, fontSize: 11 }}>
                  <Icon icon={f.i} size={14} color={COLORS.accentWarm} />
                  {f.t}
                </div>
              ))}
            </div>
          </div>
        );

      case "matrix":
        return (
          <div style={{ width: "100%", height: "100%", padding: 36, display: "flex", flexDirection: "column" }}>
            <SlideHeader kicker="CORE CAPABILITIES" title="六大核心能力" index={currentSlideIndex} />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12 }}>
              {[
                { i: MessageSquare, t: "对话研究", d: "联网深挖，一句话直出深度报告" },
                { i: PenLine, t: "智能写作", d: "图文并茂，落笔即终稿" },
                { i: Presentation, t: "炫彩演示", d: "一键生成发布会级 PPT" },
                { i: Ruler, t: "工业制图", d: "自然语言出图，直接产 DXF" },
                { i: Network, t: "沙盘推演", d: "复杂局势，多路径并行推演" },
                { i: Cpu, t: "多引擎适配", d: "18 引擎自由切换，永不掉线" },
              ].map((c, n) => (
                <div key={n} style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: COLORS.accentMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon icon={c.i} size={18} color={COLORS.accent} />
                  </div>
                  <span style={{ fontFamily: FONT.ui, fontSize: 15, fontWeight: 700, color: COLORS.fg }}>{c.t}</span>
                  <span style={{ fontFamily: FONT.ui, fontSize: 11.5, color: COLORS.fgTertiary, lineHeight: 1.4 }}>{c.d}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "pipeline":
        return (
          <div style={{ width: "100%", height: "100%", padding: 36, display: "flex", flexDirection: "column" }}>
            <SlideHeader kicker="END-TO-END" title="全流程闭环交付" index={currentSlideIndex} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              {[{ i: Search, t: "研究" }, { i: PenLine, t: "写作" }, { i: Presentation, t: "演示" }, { i: Ruler, t: "制图" }, { i: Network, t: "推演" }, { i: PackageCheck, t: "交付" }].map((s, n, arr) => (
                <React.Fragment key={n}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 16px ${COLORS.accent}33` }}>
                      <Icon icon={s.i} size={22} color="#fff" strokeWidth={1.8} />
                    </div>
                    <span style={{ fontFamily: FONT.ui, fontSize: 12, color: COLORS.fg, fontWeight: 600 }}>{s.t}</span>
                  </div>
                  {n < arr.length - 1 && <Icon icon={ArrowRight} size={16} color={COLORS.fgMuted} />}
                </React.Fragment>
              ))}
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { t: "你只说一句", items: ["一句话需求", "想做什么直接说", "零学习成本"] },
                { t: "全程 AI 自动跑", items: ["联网检索", "分析建模", "多模型协同"] },
                { t: "拿到即可交付", items: ["报告 / PPT", "工业图纸 DXF", "推演图与决策"] },
              ].map((col, n) => (
                <div key={n} style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontFamily: FONT.ui, fontSize: 13, fontWeight: 700, color: COLORS.accent, marginBottom: 10 }}>{col.t}</div>
                  {col.items.map((it, k) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: FONT.ui, fontSize: 12, color: COLORS.fg, padding: "4px 0" }}>
                      <span style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.accent }} />
                      {it}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );

      case "stats":
        return (
          <div style={{ width: "100%", height: "100%", padding: 36, display: "flex", flexDirection: "column" }}>
            <SlideHeader kicker="RAW POWER" title="硬核实力" index={currentSlideIndex} />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12 }}>
              {[
                { i: Zap, v: "10×", l: "效率提升", d: "一下午干完一周的活" },
                { i: Blocks, v: "40+", l: "技能模板", d: "开箱即用" },
                { i: Cpu, v: "18", l: "CLI 引擎", d: "自由切换永不掉线" },
                { i: FileStack, v: "200+", l: "支持格式", d: "文档·图纸·数据通吃" },
                { i: Clock, v: "7×24", l: "不眠运转", d: "随时待命，从不喊累" },
                { i: Laptop, v: "100%", l: "本地优先", d: "数据不出门更安心" },
              ].map((k, n) => (
                <div key={n} style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: COLORS.accentMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon icon={k.i} size={20} color={COLORS.accent} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 700, color: COLORS.fg }}>{k.v}</span>
                      <span style={{ fontFamily: FONT.ui, fontSize: 12, color: COLORS.fgSecondary, fontWeight: 600 }}>{k.l}</span>
                    </div>
                    <div style={{ fontFamily: FONT.ui, fontSize: 11, color: COLORS.fgTertiary }}>{k.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, borderRadius: 12, padding: "14px 20px", background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`, display: "flex", alignItems: "center", gap: 12, boxShadow: `0 8px 24px ${COLORS.accent}44` }}>
              <Icon icon={Rocket} size={24} color="#fff" strokeWidth={1.8} />
              <span style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 700, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                一个小窗，顶一支专业团队
              </span>
            </div>
          </div>
        );
    }
  };

  const Thumb: React.FC<{ type: SlideType }> = ({ type }) => (
    <div style={{
      width: "100%", height: "100%",
      background: type === "cover" ? "linear-gradient(135deg, #241712, #3a1f17 55%, #1b1310)" : `linear-gradient(160deg, ${COLORS.surfaceElevated}, #f8f6f0)`,
      display: "flex", flexDirection: "column", justifyContent: "center", padding: 6, gap: 3,
    }}>
      <div style={{ width: "65%", height: 4, borderRadius: 2, backgroundColor: type === "cover" ? "rgba(255,255,255,0.85)" : COLORS.accent }} />
      <div style={{ width: "45%", height: 3, borderRadius: 2, backgroundColor: type === "cover" ? "rgba(255,255,255,0.4)" : COLORS.fgMuted }} />
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#e8e6dc" }}>
      <ProductScreenFrame x={120} y={60} width={1680} height={960} enterFrom="scale" enterDelay={5} title="Xiaochuang — PPT">
        <div style={{ display: "flex", height: "100%" }}>
          {/* 左侧 */}
          <div style={{ width: 360, flexShrink: 0, padding: 24, borderRight: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", gap: 20, marginBottom: 24, fontFamily: FONT.ui }}>
              {navTabs.map((tab) => (
                <span key={tab} style={{
                  fontSize: 14, color: tab === "PPT" ? COLORS.accent : COLORS.fgTertiary,
                  fontWeight: tab === "PPT" ? 600 : 400,
                  borderBottom: tab === "PPT" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                  paddingBottom: 4, display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Icon icon={TAB_ICONS[tab]} size={15} color={tab === "PPT" ? COLORS.accent : COLORS.fgTertiary} />
                  {tab}
                </span>
              ))}
            </div>

            {frame >= 30 && (
              <div style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 20, opacity: outlineOpacity, border: `1px solid ${COLORS.accent}`, boxShadow: `0 2px 12px rgba(201, 100, 66, 0.08)` }}>
                <div style={{ fontFamily: FONT.ui, fontSize: 14, color: COLORS.accent, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon={ListOrdered} size={16} color={COLORS.accent} />
                  页纲规划 · 小窗能力介绍
                </div>
                {slidePages.map((page, i) => (
                  <div key={i} style={{ fontFamily: FONT.ui, fontSize: 13, color: currentSlideIndex >= i ? COLORS.fg : COLORS.fgTertiary, padding: "7px 0", borderLeft: `3px solid ${currentSlideIndex >= i ? COLORS.accent : COLORS.borderStrong}`, paddingLeft: 12, fontWeight: currentSlideIndex === i ? 600 : 400, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: FONT.mono, fontSize: 11, color: currentSlideIndex >= i ? COLORS.accent : COLORS.fgMuted }}>{String(i + 1).padStart(2, "0")}</span>
                    {page.title}
                  </div>
                ))}
              </div>
            )}

            {frame >= 100 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontFamily: FONT.ui, fontSize: 12, color: COLORS.fgTertiary, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon icon={Sparkles} size={14} color={COLORS.accent} />
                  炫彩模板 · 17+
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["路演 Pitch", "专业蓝调", "瑞士国际", "归藏墨水"].map((tpl, i) => (
                    <div key={i} style={{ fontFamily: FONT.ui, fontSize: 12, padding: "6px 14px", borderRadius: 999, border: `1px solid ${i === 0 ? COLORS.accent : COLORS.border}`, color: i === 0 ? COLORS.accent : COLORS.fgTertiary, backgroundColor: i === 0 ? COLORS.accentMuted : COLORS.surface, boxShadow: i === 0 ? `0 2px 8px rgba(201, 100, 66, 0.12)` : `0 1px 3px rgba(0,0,0,0.04)`, fontWeight: i === 0 ? 500 : 400 }}>
                      {tpl}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧预览 */}
          <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: FONT.ui, fontSize: 14, color: COLORS.fgSecondary, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon icon={Presentation} size={16} color={COLORS.accent} />
                幻灯片预览
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLORS.fgTertiary }}>
                {String(currentSlideIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </span>
            </div>

            {frame >= 140 && (
              <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", border: `1px solid ${COLORS.border}`, perspective: 1500, boxShadow: "0 18px 50px rgba(0,0,0,0.18)", position: "relative" }}>
                <div style={{
                  width: "100%", height: "100%",
                  background: slide.type === "cover" ? "linear-gradient(135deg, #241712 0%, #3a1f17 55%, #1b1310 100%)" : `linear-gradient(160deg, ${COLORS.surfaceElevated} 0%, #f8f6f0 100%)`,
                  transform: `rotateY(${slideRotateY}deg) translateX(${slideShiftX}px)`,
                  transformStyle: "preserve-3d", opacity: enterProgress, position: "relative", overflow: "hidden",
                }}>
                  {renderBody()}
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${sheenX}%`, width: "20%", background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.2), transparent)", transform: "skewX(-18deg)", pointerEvents: "none", zIndex: 5 }} />
                </div>
              </div>
            )}

            {frame >= 150 && (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                {slidePages.map((p, i) => {
                  const active = i === currentSlideIndex;
                  return (
                    <div key={i} style={{ flex: 1, aspectRatio: "16/9", borderRadius: 6, overflow: "hidden", border: `2px solid ${active ? COLORS.accent : COLORS.border}`, transform: active ? "translateY(-3px)" : "none", boxShadow: active ? `0 6px 16px ${COLORS.accent}33` : "none", opacity: active ? 1 : 0.7 }}>
                      <Thumb type={p.type} />
                    </div>
                  );
                })}
              </div>
            )}

            {frame >= 380 && (
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: exportOpacity }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {slidePages.map((_, i) => (
                    <div key={i} style={{ width: i === currentSlideIndex ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === currentSlideIndex ? COLORS.accent : COLORS.borderStrong }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button style={{ fontFamily: FONT.ui, fontSize: 14, backgroundColor: "transparent", color: COLORS.fgSecondary, border: `1px solid ${COLORS.borderStrong}`, borderRadius: 8, padding: "10px 20px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Icon icon={FileCode} size={16} color={COLORS.fgSecondary} />
                    下载 HTML
                  </button>
                  <button style={{ fontFamily: FONT.ui, fontSize: 14, background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentHover})`, color: "white", border: "none", borderRadius: 8, padding: "10px 22px", cursor: "pointer", boxShadow: `0 4px 16px rgba(201, 100, 66, 0.3)`, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Icon icon={Download} size={16} color="#ffffff" />
                    下载 PPTX
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </ProductScreenFrame>

      {/* 字幕 */}
      <SubtitleBar text="做演示也一样简单" visibleFrom={5} visibleUntil={40} />
      <SubtitleBar text="一份 PPT，讲清小窗能干什么" visibleFrom={45} visibleUntil={140} />
      <SubtitleBar text="六大能力，全流程闭环" visibleFrom={145} visibleUntil={300} />
      <SubtitleBar text="一键导出 PPTX" visibleFrom={380} visibleUntil={460} />
    </AbsoluteFill>
  );
};
