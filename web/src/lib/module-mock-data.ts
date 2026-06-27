/** 各业务模块演示用 Mock 数据（原型，非持久化） */

export type DocItem = {
  id: string;
  name: string;
  format: string;
  size: string;
  tags: string[];
  updatedAt: string;
};

export const MOCK_KB_DOCUMENTS: DocItem[] = [
  {
    id: "1",
    name: "2025Q1 螺纹钢周报.pdf",
    format: "PDF",
    size: "2.4 MB",
    tags: ["黑色", "周报"],
    updatedAt: "2 小时前",
  },
  {
    id: "2",
    name: "原油多空观点对比.docx",
    format: "Word",
    size: "890 KB",
    tags: ["能源", "研报"],
    updatedAt: "昨天",
  },
  {
    id: "3",
    name: "宏观数据解读笔记.md",
    format: "Markdown",
    size: "42 KB",
    tags: ["宏观"],
    updatedAt: "3 天前",
  },
];

export type MeetingRecord = {
  id: string;
  title: string;
  duration: string;
  speakers: number;
  status: "done" | "processing" | "failed";
  updatedAt: string;
};

export const MOCK_MEETING_HISTORY: MeetingRecord[] = [
  {
    id: "m1",
    title: "黑色产业链周会 2025-05-18",
    duration: "1:24:00",
    speakers: 4,
    status: "done",
    updatedAt: "昨天 16:30",
  },
  {
    id: "m2",
    title: "原油策略讨论",
    duration: "0:52:10",
    speakers: 3,
    status: "processing",
    updatedAt: "今天 09:15",
  },
];

// V1.1 收口（2026-06-08）：删除 AssetRecord / MOCK_WRITING_ASSETS / MOCK_PPT_ASSETS
//   及 TranslateRecord / MOCK_TRANSLATE_HISTORY —— 写作/PPT v2 PRD 决策已废止
//   「我的文稿 / 我的 PPT / 翻译历史」二级菜单，相关 mock 数据零引用。
//   见 memory: ppt-prd-v2-supersedes-v1。原来的 AssetListPanel 组件也已一并删除。

export const MOCK_SOURCE_ITEMS = [
  { id: "s1", name: "机构 A 周报", bias: "偏多", updated: "05-18" },
  { id: "s2", name: "机构 B 点评", bias: "中性", updated: "05-17" },
  { id: "s3", name: "终端资讯流", bias: "偏空", updated: "05-19" },
];
