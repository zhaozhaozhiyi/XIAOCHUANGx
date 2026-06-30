# 3D绘图模块 PRD

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.1 |
| 日期 | 2026-06-26 |
| 状态 | 已立项 / 进入开发准备 |
| 模块名称 | 3D绘图 |
| 关联 | [PRD-小窗.md](../PRD-小窗.md)、[功能清单.md](../功能清单.md)、[chat-core-architecture.md](../../technical/chat-core-architecture.md)、[技术方案.md](../../technical/技术方案.md) |
| 参考项目 | `参考项目/CADAM` |

---

## 1. 模块定义

### 1.1 一句话定义

**3D绘图 = 自然语言 / 参考图输入 + 参数化几何生成 + 实时预览 + 工业文件导出。**

### 1.2 模块定位

3D绘图模块是小窗里的一个新业务模块，用来承接零件、结构件、设备草模、工业示意件和二维工程输出。

它不是通用白板，也不是智能体研究流程的一个变种，而是一个**以图纸 / 模型交付为中心**的生产模块。

### 1.3 本期定位

本期默认按“**页面结构与写作 / PPT 模块保持一致，核心制图能力学习 CADAM**”设计。3D绘图不是另起一套独立 CAD 应用外壳，而是在小窗现有对话式模块基座上，通过工业制图 Skill、工作区文件、OpenSCAD 工具链与预览导出能力完成闭环。

本模块采用：

- 与写作 / PPT 一致的聊天型页面结构、会话历史与工作区绑定方式
- `skill-industrial-drawing-*` 固化制图需求收敛、参数化建模、预览导出规范
- 产品托管的 OpenSCAD CLI / 本地 CAD Runtime 执行编译与导出
- 必要时可补充浏览器内 WASM 预览能力，但不作为用户需要安装或配置的前置条件

执行层原则：

- 不要求用户安装 OpenSCAD 或配置 PATH
- 不 1:1 复刻 OpenSCAD 代码并宣称自研
- 不自研新的 agent loop；复用小窗现有 Companion / 会话 / Skill 编排基座
- 不把 GPL 工具链代码揉进闭源业务代码，OpenSCAD 作为独立 CLI / Runtime 组件调用

---

## 2. 参考项目给出的核心启发

### 2.1 CADAM 的实际业务逻辑

参考项目 `CADAM` 的主链路并不复杂，本质上是四段式：

1. 用户输入需求
2. 模型侧产出 OpenSCAD 代码或 Mesh 结果
3. 前端编译 / 预览 / 提取参数
4. 用户继续调参数并导出文件

### 2.2 值得直接借鉴的部分

#### A. 双通道生成思路

`CADAM` 实际上有两条能力线：

- `creative-chat`：偏创意 Mesh 生成
- `parametric-chat`：偏参数化 CAD 生成

两条路由最终都收敛到同一个 `handleAiChatRequest`，说明它的核心不是页面差异，而是**结果物类型差异**。

对3D绘图模块的启发是：

- 主路径应以**参数化工业几何**为核心
- 创意型三维生成只能作为补充入口
- 模块的主心智应是“可编辑、可标注、可导出”，不是“生成一个好看的 3D 东西”

#### B. 参数提取是模块核心，不是附属功能

`CADAM` 的 `parseParameter.ts` 会从 OpenSCAD 代码顶部变量与注释中提取：

- 参数名
- 分组
- 滑杆范围
- 枚举选项
- 文本长度
- 描述文案

这意味着它把“代码”当成中间表达，把“参数面板”当成用户真正操作的界面。

对3D绘图模块的启发是：

- 第一版不要做复杂自由绘图
- 先把“生成后可调参数”做扎实
- 参数面板应成为右侧标准区，而不是弹窗工具

#### C. 预览链路必须独立

`CADAM` 的 `useOpenSCAD.ts`、`OpenSCADViewer.tsx`、`ThreeScene.tsx` 说明它把预览当成独立链路处理：

- 编译与预览分离
- 预览与导出分离
- 失败时可回退
- 预览结果可持续替换

对3D绘图模块的启发是：

- “画图成功”不等于“可交付”
- 模块内部必须有编译态、预览态、导出态
- 二维导出与三维预览应是两个独立动作

#### D. 导出是产品闭环的一部分

`CADAM` 默认把 `.STL`、`.SCAD`、`.DXF` 作为正式交付物，而不是“开发者工具”。

对3D绘图模块的启发是：

- 导出能力必须进入主界面
- 导出格式要围绕工业链路设计
- 文件交付不能依赖聊天记录或 agent 文本

---

## 3. 设计原则

### 3.1 总原则

- **页面结构复用写作 / PPT**：3D绘图模块使用同一套聊天型页面、左侧共享历史、会话线程和工作区绑定体验。
- **Skill 负责逻辑链路**：3D绘图的意图收敛、参数化表达、预览导出规范沉淀为专用 Skill。
- **执行面受控**：制图编译、预览和导出由产品托管 Runtime 执行，不暴露本机 PATH、CLI 安装和环境变量问题给用户。
- **工作区优先**：用户已选择目录时直接使用该目录；未选择目录时使用平台默认任务目录。
- **Artifact-first**：模块所有关键结果都要沉淀为可预览、可下载、可再次编辑的文件。
- **参数优先**：第一版优先支持参数化编辑，不优先支持自由手绘。
- **工业输出优先**：优先保证尺寸、结构、导出和打印 / 制图可用性，不追求创意生成的开放性。
- **合规内置**：OpenSCAD 以独立 CLI / Runtime 组件合规内置，产品需提供许可证、版本与源码获取说明。

### 3.2 与现有平台原则的关系

本模块遵循平台“**不自研 agent loop**”的大原则，但不再把“3D绘图”定义为完全脱离对话运行时的独立系统。当前实现边界为：

- 页面层：复用写作 / PPT 的 `ChatHome`、`ChatThread`、共享历史、项目选择与会话记录。
- 逻辑层：以 `skill-industrial-drawing-*` 固化 CADAM 风格的制图链路。
- 执行层：复用 Companion 作为本地工作区执行与文件落盘基座；OpenSCAD 编译 / 导出能力封装为受控 Runtime 或模块 API。
- 产物层：所有可编辑源文件、参数 JSON、预览与导出文件都进入当前 `projectId` 工作区。

因此本模块可以复用：

- `web/src/app/api/chat/route.ts` 的会话入口
- `web/src/lib/companion/run.ts` 的工作区解析、Skill 注入与运行请求
- `companion/src/runs/*` 的受控运行、文件扫描、交付物识别
- `packages/runtime-core` 的工作区 diff 与 deliverables 识别能力

同时，本模块应新增或保留模块专用接口族，用于 CAD Runtime 能力：

- `/api/workspace/cad/toolchain`
- `/api/workspace/cad/compile`
- `/api/workspace/cad/dxf`
- 后续可扩展 `/api/workspace/cad/export`、`/api/workspace/cad/parameters`

---

## 4. 用户与场景

### 4.1 目标用户

- 产业研究员：需要快速生成设备、结构、部件示意图
- 方案顾问：需要在报告或演示中插入工业结构图
- 产品 / 实施人员：需要参数化地生成基础工业件草模
- 分析师：需要把文字需求快速变成结构图或可导出的图纸

### 4.2 核心场景

- 输入“画一个带法兰接口的立式储罐草图”，生成可调参数模型
- 上传参考图，生成可继续改尺寸的工业结构草模
- 基于已有参数件，调整孔径、长度、厚度、孔位后重新导出
- 输出 `.DXF`、`.SVG`、`.PDF`、`.STL` 用于报告、评审或加工前沟通

### 4.3 非目标场景

- 不做通用 CAD 专业工作站替代品
- 不做自由插画或艺术 3D 生成器
- 不做复杂多人协同 CAD 平台
- 不做完整 PLM / PDM 系统

---

## 5. MVP 产品范围

### 5.1 本期必须做

- 文本输入生成工业几何草模
- 上传参考图辅助生成
- 参数面板编辑
- 三维预览
- 二维投影视图导出
- 工作区文件沉淀

### 5.2 本期建议支持的导出格式

- `.scad`
- `.dxf`
- `.svg`
- `.png`
- `.pdf`
- `.stl`

### 5.3 本期不做

- 自由钢笔绘制
- 图层级协作评论
- 复杂装配约束系统
- 完整 BOM 自动生成
- 工业标准件数据库全量接入
- 历史版本 diff 视图

---

## 6. 页面与信息架构

### 6.1 一级模块建议

建议把“3D绘图”作为一级模块进入主导航，与“对话 / 写作 / PPT”平级。

### 6.2 二级结构建议

```text
3D绘图
├── 新建图纸
├── 共享会话历史
└── 模板库（后续）
```

### 6.3 页面布局

页面结构必须与写作 / PPT 模块保持一致，采用“左侧模块导航 + 共享会话历史 + 中间对话工作区 + 右侧/工作区预览”的产品骨架。3D 特有能力通过消息产物、工作区预览、参数面板和导出动作承载，不另起一套完全不同的信息架构。

3D 产物预览态可采用三栏式：

- 左侧：图纸历史 / 图纸信息 / 文件列表
- 中间：主预览区
- 右侧：参数面板 / 导出面板 / 视图设置

### 6.4 主页面分区

#### 顶部工具条

- 图纸标题
- 生成 / 重新生成
- 视角切换
- 单位切换
- 导出按钮

#### 中间预览区

- 三维预览
- 正交 / 透视切换
- 网格与轴向辅助
- 二维投影预览入口

#### 右侧参数区

- 尺寸参数
- 布局参数
- 孔位 / 厚度 / 间距参数
- 材质 / 颜色参数
- 参数分组折叠

#### 底部输入区

- 文本需求输入
- 上传参考图
- 生成说明提示

---

## 7. 核心流程

### 7.1 新建图纸流程

```text
进入 /3d/new
→ 不创建文件夹，不写工作区
→ 输入文字需求 / 上传参考图
→ 点击生成
→ 创建 / 更新会话记录
→ 解析用户选择目录；若未选择目录，则按平台默认任务目录规则确保 projectId
→ Companion 在 projectId 工作区执行工业制图 Skill 链路
→ 生成参数化表达、预览结果与导出文件
→ 文件落入当前工作区
→ 前端展示交付物、三维预览、参数面板
→ 用户调整参数
→ 局部重编译 / 重渲染
→ 用户导出 DXF / SVG / STL / PDF
→ 导出文件继续落入当前工作区
```

约束：

- `/3d/new` 只是草稿入口，不得因页面打开而创建目录。
- 用户已选择本地目录时，该目录天然就是工作区；目录下已有文件必须被识别为上下文，而不是“空工作区”。
- 用户未选择目录时，系统按 `~/Documents/XIAOCHUANG/工业制图/{YYYY-MM-DD}/{任务标题}/` 创建平台默认任务目录。
- 默认任务目录的创建时机应与写作 / PPT 保持一致：第一版可在首次提交运行时创建；如后续要做到“真正产物出现后再创建”，必须做成所有模块通用的 staging / promotion 机制，而不是 3D 单独特例。
- 工作区存在与否不以 `.scad` 文件为唯一判断；任意可交付产物生成或变更都应触发工作区产物识别。

### 7.2 参数修改流程

```text
用户修改右侧参数
→ 前端更新参数状态
→ 触发 preview / compile 接口
→ 刷新预览
→ 成功后可直接导出
```

### 7.3 导出流程

```text
用户点击导出
→ 选择格式
→ 后端执行对应导出器
→ 产出文件落工作区
→ 前端提示“已生成文件”，并支持预览 / 下载
```

### 7.4 工作区与产物生命周期

3D绘图需要区分“会话”“工作区 Project”“3D 产物”三层：

| 层级 | 说明 | 创建 / 存在条件 |
|------|------|----------------|
| 会话 | 左侧共享历史中的一次 3D 对话 | 用户提交需求或进入已有线程后存在 |
| 工作区 Project | 用户选择目录或平台默认任务目录 | 用户选择目录时立即存在；未选择目录时由首次运行确保 |
| 3D 产物 | `.scad`、`.stl`、`.dxf`、`.off`、`.png`、`.json`、`README.md` 等 | Agent / Runtime 真实写入或修改文件后存在 |

规则：

- 不应把“工作区存在”与 `.scad` 单一文件绑定。
- 用户选择的目录可能本身已有文件，3D 模块必须读取并尊重这些上下文。
- Deliverables 应基于运行前后工作区 diff 识别新增 / 修改文件，而不是全量把目录已有文件当成本轮产物。
- 若生成失败但已经写入可编辑源文件或参数 JSON，仍应保留文件并进入可修复状态。
- 若生成完全失败且没有任何文件落盘，只保留会话记录、错误说明和可重试状态。

---

## 8. 功能需求

### 8.1 F-ID-001 文本生成工业图

用户输入一段自然语言，系统生成一个参数化工业图草模。

要求：

- 支持纯文本描述
- 支持“带尺寸要求”的描述
- 支持“基于某类部件”的描述
- 结果必须返回结构化参数，而不只是渲染图

### 8.2 F-ID-002 参考图辅助生成

用户可上传一张或多张参考图作为生成依据。

要求：

- 支持 PNG / JPG / WEBP
- 上传后生成任务能读取图片上下文
- 生成结果仍需落回参数化表达

### 8.3 F-ID-003 参数面板

系统从参数化表达中提取参数，渲染成右侧参数面板。

参数类型至少支持：

- 数值
- 数值范围
- 枚举
- 布尔
- 文本
- 颜色

参数能力至少支持：

- 分组
- 描述
- 默认值恢复
- 修改后即时预览

### 8.4 F-ID-004 三维预览

系统对当前图纸提供三维预览能力。

要求：

- 支持拖拽旋转
- 支持缩放
- 支持透视 / 正交切换
- 支持基础灯光与背景
- 支持加载失败提示

### 8.5 F-ID-005 二维投影与导出

系统可把当前工业模型导出为二维工程结果。

要求：

- 支持 DXF
- 支持 SVG
- 支持 PDF
- 支持最小化二维投影预览

### 8.6 F-ID-006 工作区文件沉淀

3D绘图模块的所有结果文件都应进入当前 `projectId` 工作区。工作区可以是用户手动选择的本地目录，也可以是平台默认任务目录。

至少包括：

- 原始参数表达文件（如 `.scad`，但不限定为 `.scad`）
- 导出文件
- 预览截图
- 元信息文件

要求：

- `/3d/new` 不得创建空目录。
- 用户选择目录优先，不得强行额外创建一套 3D 根目录覆盖用户选择。
- 若未选择目录，平台默认任务目录应使用 `工业制图` 作为 workspace segment。
- 产物识别应支持 `.scad`、`.stl`、`.dxf`、`.off`、`.svg`、`.png`、`.pdf`、`.json`、`.md` 等类型。
- 本轮交付物只展示本轮新增或修改的文件；用户目录下已有文件只作为上下文，不自动进入本轮交付清单。

### 8.7 F-ID-007 共享会话历史与图纸续作

3D绘图的历史记录应复用对话 / 写作 / PPT 的同一套会话历史能力，而不是单独维护一套“历史图纸”。当用户在左侧选择对话菜单时，应能看到包含对话、写作、PPT、3D绘图在内的统一记录；进入 3D 模块时，可按 `moduleId = 3d` 展示相关会话或通过模块标签过滤。

要求：

- 每条记录必须带 `moduleId`、标题、更新时间、工作区 `projectId`、产物状态与导出状态。
- 从共享历史重新打开 3D 会话后，应恢复对话上下文、参数面板、主预览和工作区文件。
- 3D 会话中的 `.scad`、参数 JSON、导出文件等可编辑产物必须继续关联到同一个 `projectId`。
- 历史记录是“会话线程”的历史，不是单纯文件列表；图纸文件列表由工作区 deliverables 与文件浏览器承载。
- 若用户从对话模块打开 3D 记录，应自动切换到对应 3D 会话页面或以 3D artifact 形态展示。

### 8.8 F-ID-008 浏览器 WASM 快速预览增强

增强版应支持在浏览器 Worker 中运行 OpenSCAD WASM，用于参数微调、局部预览和低延迟查看。该能力是“快速预览引擎”，不是 MVP 的唯一编译 / 导出来源；正式导出、工作区落盘和可交付文件仍以产品托管 CLI / CAD Runtime 为权威结果。

要求：

- 在浏览器 Worker 中执行 OpenSCAD WASM，避免阻塞主线程。
- 支持将当前 `.scad` 或参数化表达快速编译为 `STL` / `OFF`，并交给 Three.js 预览。
- 参数面板调整时，应优先走 WASM 快速预览；用户确认保存、导出或生成交付物时，再走产品托管 CLI 进行权威编译与落盘。
- WASM 预览失败时，不影响 CLI 主链路；界面应自动降级为“托管 Runtime 编译预览”。
- WASM 预览产物默认只作为临时预览缓存，不直接写入工作区 deliverables；只有用户保存 / 导出 / 确认生成时才进入工作区。
- WASM 与 CLI 输出存在差异时，以 CLI 结果为准，并在调试日志中记录差异。
- 增强版需支持进度状态、取消编译、超时保护和可读错误提示。
- OpenSCAD WASM、字体、运行资源和许可证声明必须纳入开源组件清单。

---

## 9. 技术方案约束

### 9.1 执行面原则

本模块必须采用“**产品托管 CAD Runtime 执行面**”：

```text
Web UI
→ Chat / Companion 运行请求
→ 当前 projectId 工作区
→ 产品托管 OpenSCAD CLI / CAD Runtime
→ 写入可编辑源文件、参数 JSON、预览与导出文件
→ Deliverables / Workspace Preview 展示
```

说明：

- OpenSCAD CLI 由产品托管，不依赖用户本机安装或 PATH。
- 前端不直接暴露 CLI 路径、环境变量、编译命令等开发者概念。
- Runtime 错误需要归一为用户可理解状态：引擎准备中、生成失败、可修复、导出失败等。

### 9.2 禁止接入项

本模块禁止出现以下产品形态：

- 要求用户自行安装 OpenSCAD
- 要求用户配置 PATH / 环境变量
- 因 PATH 不存在而把开发者错误直接暴露给用户
- 1:1 复刻 OpenSCAD 源码并包装成闭源自研库
- 直接复制 CADAM GPLv3 代码进入正式产品路径且无许可证策略
- 把 `.stl`、`.dxf` 等导出结果当成“已生成”，但实际未写入工作区

### 9.3 推荐实现分层

#### 前端层

- 模块页面
- 参数状态
- 预览状态
- 导出状态

#### BFF / 模块 API 层

- 请求校验
- 任务转发
- 文件保存
- 错误归一

#### CAD 执行层

- 生成表达
- 编译预览
- 导出转换
- 参数提取

### 9.4 推荐的第一版技术路线

#### 路线 A：合规内置 OpenSCAD CLI（推荐 MVP 主路径）

- 参数表达：OpenSCAD
- 执行：产品内置 / 托管 OpenSCAD CLI
- 预览：CLI 导出 STL / OFF 后由 Three.js 展示
- 导出：STL / DXF / SCAD

适合：

- Desktop Alpha 本地文件夹工作区
- 用户拿来即用，不关心安装和 PATH
- 合规边界清晰：OpenSCAD 作为独立 CLI / Runtime 组件调用

#### 路线 B：浏览器 WASM 预览增强

- 参数表达：OpenSCAD
- 执行：OpenSCAD WASM Worker
- 导出：STL / OFF / DXF / SVG
- 定位：快速预览与参数微调增强，不替代权威 CLI 导出

适合：

- 提升前端交互预览体验
- 后续 Web 在线工作区
- CADAM 技术链路验证

### 9.5 推荐结论

MVP 建议：

- 前端先借 `CADAM` 的参数面板和预览思路
- 执行层优先采用合规内置 OpenSCAD CLI
- 页面与会话结构复用写作 / PPT 模块
- 不复用 `CADAM` 的 AI chat / tool loop 外壳
- 不要求用户安装或配置 OpenSCAD

### 9.6 3D / 2D 查看技术链路

CADAM 的可视化核心不是后端截图，而是**CAD 编译结果 + Three.js 交互查看**。3D绘图模块的 MVP 主路径采用产品托管 OpenSCAD CLI 生成 STL / OFF / DXF 等产物，再由工作区预览组件展示；浏览器内 OpenSCAD WASM 可作为后续增强路线，用于降低预览往返成本。

#### 9.6.1 3D 查看链路

```text
OpenSCAD code
→ 产品托管 OpenSCAD CLI / CAD Runtime compile
→ STL + OFF
→ STLLoader / OFF parser
→ Three.js / React Three Fiber
→ 正交 / 透视 / OrbitControls / 视角 Gizmo
```

对应 CADAM 参考点与小窗落地方式：

| CADAM 参考点 | 可学习能力 | 小窗落地方式 |
|------------|------------|--------------|
| `src/worker/worker.ts` | 预览 / 导出 / 文件写入的任务协议 | 不直接照搬 Worker；抽象为 CAD Runtime job 协议 |
| `src/worker/openSCAD.ts` | OpenSCAD 编译参数、输出格式、错误整理 | 第一版由后端 / 本地 Runtime 调用产品托管 CLI；WASM 作为后续增强 |
| `src/components/viewer/OpenSCADViewer.tsx` | SCAD 到可显示模型的预览编排 | 落地为 `ScadPreview`，读取工作区文件并请求 `/api/workspace/cad/compile` |
| `src/components/viewer/ThreeScene.tsx` | Three.js 场景、灯光、正交 / 透视切换、OrbitControls | 可自研 / 重写为小窗工作区预览组件 |
| `src/utils/coloredOffMesh.ts` | 解析 OFF，保留 OpenSCAD `color()` 的多色面片 | 可按能力重写，不直接复制 GPL 代码 |

3D绘图第一版建议保留两个结果：

- `STL`：作为基础三维几何，用于稳定预览与导出。
- `OFF`：作为彩色预览增强，用于保留 OpenSCAD `color()` 的部件颜色。

如果第一版要压缩范围，可以先只接 `STL` 单色预览；但正式体验建议补上 `OFF` 多色预览，否则复杂设备会更像灰模，工业结构辨识度较低。

#### 9.6.2 2D 查看与导出链路

```text
OpenSCAD code
→ projection(cut = false) 包装
→ OpenSCAD export dxf / svg
→ DXF normalize
→ 2D 预览 / 下载 / 工作区沉淀
```

对应 CADAM 参考点：

| CADAM 文件 | 职责 |
|------------|------|
| `src/utils/dxfUtils.ts` | 生成 `projection()` 包装代码，并规范化 OpenSCAD DXF |
| `src/components/viewer/OpenSCADViewer.tsx` | 注册 DXF exporter，用户点击导出时才编译 |
| `src/worker/openSCAD.ts` | 通过 OpenSCAD WASM 执行 `dxf` / `svg` 导出 |

MVP 的 2D 能力建议分两步：

1. 先做 `DXF / SVG` 导出，保证可交付。
2. 再做内置 2D viewer，支持俯视、正视、侧视与图框。

#### 9.6.3 与小窗现有平台的嫁接点

小窗当前工作区预览统一走 `web/src/components/workspace/FileViewer.tsx`，已经支持 Markdown、HTML、PPTX、图片、PDF、DOCX。3D绘图应在该入口新增 CAD 文件分支。

| 文件类型 | 第一版处理 | 后续增强 |
|----------|------------|----------|
| `.scad` | `ScadPreview`：编译为 3D 预览，可导出 STL / DXF | 参数面板、错误修复、视图保存 |
| `.stl` | `StlPreview`：直接 Three.js 查看 | 材质、测量、剖切 |
| `.dxf` | 下载 / 源码预览 | DXF Canvas / SVG 预览 |
| `.svg` | 复用图片预览 | 图框、标注层 |
| `.pdf` | 复用 PDF 预览 | 工程图归档 |

需要改造的现有文件：

| 文件 | 改造点 |
|------|--------|
| `web/src/components/workspace/FileViewer.tsx` | 增加 `.scad`、`.stl`、`.dxf` 的预览分支 |
| `web/src/lib/workspace-binary.ts` | 将 `.stl`、`.dxf` 纳入二进制 / MIME 推断 |
| `web/src/lib/workspace/adapter.ts` | 增加 `.scad`、`.stl`、`.dxf` 的 language 推断 |
| `web/package.json` | 增加 `three`、`@react-three/fiber`、`@react-three/drei` 等依赖 |
| `web/src/app/api/workspace/cad/*` | 封装 toolchain 检测、compile、DXF / STL 导出等 Runtime API |
| 桌面资源目录 / Runtime 资源目录 | 放置各平台 OpenSCAD CLI 与许可证文件 |
| `web/public` 或 `web/src/vendor` | 仅在后续 WASM 增强阶段放置 OpenSCAD WASM、字体与必要运行资源 |

#### 9.6.4 推荐嫁接顺序

1. 建 `cad/toolchain` 状态接口，返回产品托管 OpenSCAD Runtime 的可用性、版本、许可证提示与修复状态。
2. 建 `ScadPreview`，读取工作区 `.scad`，通过 `/api/workspace/cad/compile` 生成 `STL` 并交给 Three.js 预览。
3. 接工作区输出与 diff 识别：`drawing.scad`、`drawing.parameters.json`、`exports/*` 必须真实落盘。
4. 接 `DXF / SVG` 导出：`projection()` 包装 + OpenSCAD export，导出文件继续写入当前 `projectId`。
5. 接参数面板：从 SCAD 顶部 Customizer 注释或 `parameters.json` 提取参数，修改后触发局部重编译。
6. 接 `OFF` 彩色预览，提升部件辨识度。
7. 后续再接 OpenSCAD WASM Worker，作为浏览器内即时预览增强，而不是 MVP 的主执行面。

#### 9.6.5 双引擎预览策略

增强版采用“双引擎”策略：

```text
参数调整 / 临时查看
→ Browser OpenSCAD WASM Worker
→ 临时 STL / OFF
→ Three.js 快速预览

保存 / 导出 / 交付
→ 产品托管 OpenSCAD CLI / CAD Runtime
→ 权威 STL / OFF / DXF / SVG / SCAD
→ 工作区 deliverables
```

原则：

- 浏览器 WASM 负责“快”，产品托管 CLI 负责“准”和“可交付”。
- 同一份参数 schema 与 `.scad` 源文件必须能被两套引擎使用，避免出现两套模型逻辑。
- 前端预览组件只关心几何结果，不直接绑定某一种编译引擎。
- Runtime API 应返回 `engine = cli | wasm`、耗时、输出格式、错误类型，方便调试与体验优化。
- 若两套引擎输出存在明显差异，界面以 CLI 编译结果为最终展示和导出依据。

### 9.7 CADAM 代码迁移策略

CADAM 使用 GPLv3 许可证。若直接复制代码进入主工程并随产品分发，可能带来开源义务与派生作品边界问题。本文档不替代法律意见，但产品化前应由项目负责人确认许可策略。

建议采用“两阶段迁移”：

#### 阶段 A：隔离抄通链路

目的：快速确认 CADAM 技术链路能在小窗里跑起来。

做法：

- 可在独立实验目录或独立分支直接复制 CADAM 的 Viewer / Worker / DXF 工具代码。
- 目录命名建议：`web/src/features/3d/cadam-spike/` 或独立 `spikes/cadam-viewer/`。
- 保留 CADAM 原始许可证声明与来源说明。
- 不把 spike 作为正式产品代码长期维护。

验收标准：

- `.scad` 能在小窗里编译出 3D 预览。
- `.scad` 能导出 `.stl` / `.dxf`。
- 参数变更后能重新编译。

#### 阶段 B：按接口产品化改写

目的：把验证过的技术链路改造成符合小窗架构、命名、UI 与许可策略的正式实现。

做法：

- 先固定接口：`compileScad()`、`exportScad()`、`parseScadParameters()`、`renderCadPreview()`。
- Worker 协议按小窗命名重写，不沿用 CADAM 的业务状态。
- Three.js 场景按小窗 Workspace 视觉体系重写。
- DXF/SVG 导出工具可以参考 CADAM 的思路，但应重写实现并补测试样例。
- 仅在确认 GPL 兼容时，才保留直接复制的代码进入正式产品路径。

#### 策略选择

不建议一开始“边抄边大改”。这样容易同时混入三类问题：

- CADAM 原始链路是否能跑
- 小窗架构是否接得对
- 改写后的代码是否引入新 bug

推荐节奏是：

```text
隔离抄通
→ 固定小窗接口
→ 分模块替换为小窗实现
→ 删除 spike
→ 进入正式产品路径
```

### 9.8 OpenSCAD 合规内置策略

OpenSCAD 可以作为商业产品中的独立工具链组件使用，但必须按开源许可证履行声明与分发义务。3D绘图模块采用以下策略：

- **独立 CLI 调用**：OpenSCAD 作为独立可执行文件 / Runtime 组件存在，业务代码通过子进程或受控服务调用，不链接进闭源业务代码。
- **产品托管路径**：运行时从产品资源目录解析 OpenSCAD 路径，例如 `resources/engines/openscad/{platform}/...`，不读取用户 PATH 作为正式能力前提。
- **用户无感**：用户不需要安装 OpenSCAD，不需要配置 PATH，不需要理解 CLI。
- **许可证声明**：产品“关于 / 开源组件”页面必须列出 OpenSCAD 版本、许可证、源码获取方式、版权声明与第三方依赖说明。
- **禁止未审修改**：若修改 OpenSCAD 源码或直接复制 CADAM GPLv3 代码进入正式路径，必须先确认开源义务并准备对应源码 / patch 公开方案。
- **自研边界**：小窗自研的是制图 Skill、工作区组织、参数编辑、预览导出编排和多引擎适配层，不宣称 OpenSCAD 几何内核为自研。

验收标准：

- 生产环境无 `openscad not in PATH` 类用户可见错误。
- Runtime 状态页能显示内置 OpenSCAD 是否可用、版本与修复建议。
- 即使 OpenSCAD 不可用，也必须尽可能保留可编辑源文件和参数 JSON，并提示导出尚未完成。

工程闸门：

- **研发态**：允许 Runtime 暂缺，但必须通过 `pnpm engines:verify:openscad`；产品显示 `openscad_runtime_missing`，同时保留 `.scad`、参数 JSON、SVG/PDF/DXF 参数轮廓 fallback 与工作区预览 fallback。
- **准备态**：推荐用 `pnpm engines:fetch:openscad` 从内部制品归档或受控 URL 获取 Runtime，必须提供 `JLC_OPENSCAD_DIST_SHA256`，并把许可证目录传给 `JLC_OPENSCAD_LICENSES_DIR`。
- **WASM 预览态**：推荐用 `pnpm engines:prepare:openscad-wasm` 准备 `web/public/openscad-wasm/openscad.js` 与 `openscad.wasm`，并写入 `WASM_MANIFEST.json`、`VERSION.txt`、`SOURCE_AVAILABILITY.md`；浏览器 Worker 仅用于快速预览增强，失败时必须回落到 CLI Runtime API / 工作区 fallback。
- **发布态**：必须通过 `pnpm engines:verify:openscad:required`、`pnpm engines:verify:openscad-wasm:required` 或 `pnpm desktop:pack:release`，要求内置可执行 Runtime、`VERSION.txt`、`LICENSES/`、`NOTICE` / `THIRD_PARTY`、`SOURCE_AVAILABILITY` 等材料齐全，同时要求浏览器 WASM 预览资源齐全；macOS 等多架构包应设置 `JLC_OPENSCAD_REQUIRED_ARCHES` 防止误发不兼容 Runtime。
- **用户态**：不得要求最终用户安装 OpenSCAD、配置 PATH 或理解 Runtime 路径；所有缺失都应被产品安装包或发布流水线提前发现。

---

## 10. 数据与文件模型

### 10.1 图纸实体建议

```json
{
  "id": "drawing_xxx",
  "moduleId": "3d",
  "projectId": "project_xxx",
  "title": "立式储罐草图",
  "sourcePrompt": "画一个带法兰接口的立式储罐草图",
  "authoritativeEngine": "openscad-cli",
  "previewEngine": "openscad-wasm",
  "expressionFile": "tank.scad",
  "parameterSchemaFile": "tank.parameters.json",
  "previewFile": "tank.preview.png",
  "exports": ["tank.dxf", "tank.svg", "tank.stl"],
  "updatedAt": "2026-06-26T10:00:00+08:00"
}
```

### 10.2 工作区目录建议

若用户已选择本地目录，则直接在该目录内写入产物，目录本身可能已有文件；3D 模块不得把已有文件当成本轮新产物。若用户未选择目录，平台默认任务目录建议如下：

```text
工业制图/
  2026-06-25-立式储罐草图/
    source.prompt.md
    drawing.scad
    drawing.parameters.json
    preview.png
    exports/
      drawing.dxf
      drawing.svg
      drawing.pdf
      drawing.stl
```

### 10.3 工作区创建与识别规则

| 场景 | 工作区行为 | 产物识别 |
|------|------------|----------|
| 打开 `/3d/new` | 不创建目录，不写入文件 | 无产物 |
| 用户选择已有目录 | 使用用户目录作为工作区；目录可非空 | 运行前后 diff 识别新增 / 修改文件 |
| 用户未选择目录并提交生成 | 确保平台默认任务目录，segment 为 `工业制图` | 运行前后 diff 识别新增 / 修改文件 |
| 生成 `.scad` 成功但导出失败 | 保留 `.scad`、参数 JSON、README 等可编辑文件 | 展示为可修复半成品 |
| 生成完全失败且无文件写入 | 不新增产物文件 | 只保留会话错误与重试入口 |

本轮交付物不以 `.scad` 为唯一触发条件。只要 `.stl`、`.dxf`、`.off`、`.svg`、`.png`、`.pdf`、`.json`、`.md` 等可交付文件被真实写入或修改，都应进入本轮 deliverables。

---

## 11. 非功能需求

### 11.1 性能

- 首次预览在可接受样例下应尽量控制在 5 秒内
- 参数微调后的刷新应明显快于首次生成
- 导出失败时应返回可读错误，而不是静默失败

### 11.2 稳定性

- 编译失败、参数非法、导出失败都应有明确状态
- 任何失败都不能丢失当前参数与源码表达

### 11.3 可维护性

- CAD Runtime API 与聊天入口解耦，但页面、会话和工作区基座复用写作 / PPT 模块
- 预览逻辑与导出逻辑分离
- 参数提取器独立封装
- CLI 引擎与 WASM 引擎通过统一 compile / export 接口适配

---

## 12. 版本规划

### 12.1 v1.0 立项版

- 完成模块定位
- 确认执行原则
- 确认与现有 Companion / Skill / 工作区基座的复用边界

### 12.2 v0.2 MVP

- 文本生成
- 参数面板
- 三维预览
- DXF / STL 导出
- 产品托管 OpenSCAD CLI / CAD Runtime 主链路

### 12.3 v0.3 Beta

- 参考图生成
- SVG / PDF 导出
- 共享会话历史与图纸续作
- 更丰富的参数分组

### 12.4 v0.4 增强版

- 浏览器 OpenSCAD WASM Worker 快速预览
- 参数微调低延迟编译
- CLI / WASM 双引擎一致性校验
- 临时预览缓存与权威交付物分离

---

## 13. 模块注册建议

### 13.1 注册原则

3D绘图模块应作为**独立业务模块**注册，但页面结构、会话历史和工作区绑定应与写作 / PPT 模块保持一致。它使用专用 Skill 固化制图逻辑，执行阶段复用小窗现有 Companion / 工作区 / deliverables 基座，并通过 CAD Runtime 完成 OpenSCAD 编译与导出。

它的注册方向应是：

- 有独立 `moduleId`
- 有独立路由
- 有独立工作区分段
- 有托管 CAD Runtime 执行面
- 有固定3D绘图 Skill 链路
- 共享聊天型会话历史

### 13.2 建议注册形态

| 字段 | 建议值 |
|------|--------|
| `moduleId` | `3d` |
| 一级菜单 | 3D绘图 |
| 领域服务 | `cad-runtime`、`openscad-toolchain`、`workspace-deliverables` |
| 绑定方式 | 默认 `skill-industrial-drawing-base`，按阶段调用 `parametric` / `export` |
| 模板资产 | 工业件模板、二维图框模板、参数模板 |
| 页面结构 | 与写作 / PPT 一致的聊天型模块 |
| 会话历史 | 与对话 / 写作 / PPT 共用 |
| 工作区 | `true` |
| `workspaceSegment` | `工业制图` |

### 13.3 Skill 草案

| Skill | 职责 |
|-------|------|
| `skill-industrial-drawing-base` | 3D绘图意图识别、需求收敛、路径选择、Artifact 规范 |
| `skill-industrial-drawing-parametric` | 将需求转为可编译、可提取参数的 OpenSCAD / 参数化表达 |
| `skill-industrial-drawing-export` | 预览检查、二维 / 三维导出、工作区文件组织 |

### 13.4 路由建议

- `/3d`
- `/3d/new`
- `/3d/[id]`

### 13.5 API 建议

- `/api/workspace/cad/toolchain`
- `/api/workspace/cad/compile`
- `/api/workspace/cad/dxf`
- `/api/workspace/cad/export`（后续）
- `/api/workspace/cad/parameters`（后续）

---

## 14. 当前结论

3D绘图模块如果“直接抄 `CADAM`”，真正该抄的是这条产品主链：

**文本生成参数化表达 → 参数提取 → 实时预览 → 导出交付**

而不是抄它的 AI 对话外壳。

对小窗来说，更合适的落地方向是：

- 借鉴 `CADAM` 的参数化 CAD 交互
- 保留平台“不要自研 agent loop”的原则
- 把制图逻辑沉淀为专用 Skill
- 页面结构与写作 / PPT 模块保持一致
- 历史记录、会话线程与工作区绑定共用平台基座
- 执行面收口成“**产品托管 OpenSCAD CLI / CAD Runtime + Companion 工作区文件**”的3D绘图模块
- 工作区采用“用户选择目录优先；未选择目录时使用平台默认任务目录；打开 `/3d/new` 不落盘”的规则

这会让模块边界更清晰，也更适合工业场景的稳定交付。
