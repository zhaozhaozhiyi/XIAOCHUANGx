# 对话过程旁白可见性历史方案

> 状态：**已归档并合并到 `0.1.6-rc.2`。**

本专项原用于纠正“旁白被压入技术详情、运行中只显示过程摘要”的问题。最终实现已扩展为跨 Runtime、Companion 和 Web 的完整方案，不再作为独立版本或纯前端工作包维护。

已合并能力：

- 有效 narration 进入一级业务过程；
- running / waiting / error / cancelled 下过程保持可见；
- reasoning 与技术详情独立折叠；
- `assistant.segment` 区分 pending、process 和 final；
- final 首次出现时过程自动收起一次；
- 完成后按 narration、actions、checkpoint 的真实顺序复盘。

现行实施方案：[`chat-process-collapse-implementation-plan.md`](./chat-process-collapse-implementation-plan.md)。

本文件仅保留历史索引，不再包含可独立执行的任务、版本号或发布门槛。
