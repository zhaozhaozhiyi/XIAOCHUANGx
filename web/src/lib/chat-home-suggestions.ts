import type { ChatSurfaceModuleId } from "@/lib/module-chat-config";

export type ChatHomeSuggestionIcon =
  | "chart"
  | "compare"
  | "document"
  | "box"
  | "ruler"
  | "upload"
  | "video"
  | "simulation";

export type ChatHomeSuggestion = {
  id: string;
  label: string;
  icon: ChatHomeSuggestionIcon;
};

export type ChatHomeSuggestionGroup = {
  ariaLabel: string;
  heading: string;
  tasks: ChatHomeSuggestion[];
};

const CHAT_SUGGESTIONS: ChatHomeSuggestionGroup = {
  ariaLabel: "推荐研究任务",
  heading: "挑一条开始",
  tasks: [
    {
      id: "inventory",
      label: "上周螺纹钢社会库存环比变化",
      icon: "chart",
    },
    {
      id: "compare",
      label: "对比三家机构对原油的多空观点",
      icon: "compare",
    },
    {
      id: "outline",
      label: "生成一份螺纹钢周报大纲",
      icon: "document",
    },
  ],
};

const THREE_D_SUGGESTIONS: ChatHomeSuggestionGroup = {
  ariaLabel: "推荐工业制图任务",
  heading: "从一个工业件开始",
  tasks: [
    {
      id: "mounting-bracket",
      label:
        "生成一个 L 型安装支架：底板 120×80×8mm，立板 90×70×8mm，4 个 M8 安装孔，可调孔距并导出 DXF/STL",
      icon: "ruler",
    },
    {
      id: "flanged-tank",
      label:
        "画一个带法兰接口的立式储罐草模：筒体、椭圆封头、底座和侧向法兰都要参数化",
      icon: "box",
    },
    {
      id: "reference-image",
      label:
        "根据上传的参考图生成可编辑 OpenSCAD 草模，并输出 drawing.scad、参数 JSON 和预览文件",
      icon: "upload",
    },
  ],
};

const VIDEO_SUGGESTIONS: ChatHomeSuggestionGroup = {
  ariaLabel: "推荐视频制作任务",
  heading: "从一个视频 brief 开始",
  tasks: [
    {
      id: "product-intro",
      label: "做一个 60 秒的小窗产品介绍视频，面向客户高层，突出研究、写作、PPT 和本地工作区交付能力",
      icon: "video",
    },
    {
      id: "research-explainer",
      label: "把这份研究报告改成 90 秒讲解视频，16:9，专业商务风，保留关键图表与结论",
      icon: "document",
    },
    {
      id: "vertical-trailer",
      label: "生成一个 30 秒竖屏路演短片，节奏紧凑，适合会议暖场或客户群转发",
      icon: "video",
    },
  ],
};

const SIMULATION_SUGGESTIONS: ChatHomeSuggestionGroup = {
  ariaLabel: "推荐推演任务",
  heading: "从一个复杂问题开始",
  tasks: [
    {
      id: "oil-supply",
      label: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响路径",
      icon: "simulation",
    },
    {
      id: "policy-shock",
      label: "推演一项环保政策收紧后，对钢铁供给、原料价格和下游需求的连锁反应",
      icon: "chart",
    },
    {
      id: "risk-branch",
      label: "把当前项目拆成最可能、风险、反事实三条路径，并给出每条路径的关键触发条件",
      icon: "compare",
    },
  ],
};

export function getChatHomeSuggestions(
  surfaceModuleId: ChatSurfaceModuleId,
): ChatHomeSuggestionGroup | null {
  if (surfaceModuleId === "chat") return CHAT_SUGGESTIONS;
  if (surfaceModuleId === "3d") return THREE_D_SUGGESTIONS;
  if (surfaceModuleId === "video") return VIDEO_SUGGESTIONS;
  if (surfaceModuleId === "simulation") return SIMULATION_SUGGESTIONS;
  return null;
}
