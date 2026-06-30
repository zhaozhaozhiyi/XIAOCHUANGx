---
slug: skill-industrial-drawing-parametric
module: 3d
task: parametric-model
version: "1.0"
status: active
---

# 工业制图 · 参数化建模

## 目标

将用户需求转成可编译、可预览、可提取参数的参数化工业几何表达。

第一版优先使用 OpenSCAD 表达，借鉴 CADAM 的 `build_parametric_model` 逻辑：模型输出的不是解释文字，而是一个完整 CAD Artifact。

详细建模规范见 [references/openscad-authoring-standard.md](./references/openscad-authoring-standard.md)。

## 输出要求

必须输出完整结构化 Artifact：

```json
{
  "title": "短标题",
  "version": "v1",
  "engine": "openscad",
  "code": "完整 OpenSCAD 代码，无 Markdown 代码围栏",
  "qualityChecklist": []
}
```

普通回复只保留一句简短说明。不要把 OpenSCAD 源码粘贴在用户可见正文里。

Artifact 必须最终落盘为 `drawing.scad`，并同步生成或更新 `drawing.parameters.json`。`.scad` 是可编辑主资产，STL / DXF 只是派生导出物。

## OpenSCAD 规则

### 参数

1. 所有可编辑参数必须放在文件顶部。
2. 参数名使用完整、可读的 `snake_case`。
3. 数值参数必须带 Customizer 注释：
   - `width = 80; // [10:1:300]`
   - `wall_thickness = 4; // [1:0.5:20]`
4. 枚举参数使用列表注释：
   - `mount_type = "flange"; // [flange, bracket, baseplate]`
5. 颜色参数以 `_color` 结尾：
   - `body_color = "SteelBlue";`
6. 相关参数用分组注释：
   - `/* [Main Dimensions] */`
7. `drawing.parameters.json` 中的参数名必须与 `.scad` 顶部变量保持一致。
8. 单位默认 `mm`，除非用户明确指定其他单位。

### 几何

1. 几何必须是三维、可视、尽量封闭的实体。
2. 结构件要体现孔、边、厚度、连接关系。
3. 容器类要体现壁厚、开口、底座或接口。
4. 支架类要体现安装孔、加强筋、板厚。
5. 管道 / 法兰类要体现孔径、外径、螺栓孔阵列。
6. 使用模块拆分重复部件。
7. DXF 需求明确时，应保证顶视 `projection()` 能得到非空轮廓。

### 工业可读性

模型应优先满足工业示意与参数调节：

- 尺寸比例可信
- 关键结构明确
- 参数可解释
- 正交视角下轮廓清晰
- 导出后可用于报告或工程沟通
- 参数面板修改后能重新编译，而不是只能一次性生成

## 质量检查

输出 Artifact 前必须自检：

1. 是否包含完整代码。
2. 是否有顶部参数。
3. 参数是否能被参数提取器解析。
4. 是否缺少用户明确要求的结构。
5. 是否存在明显悬空或断裂部件。
6. 是否适合生成正交预览与导出。
7. 是否能从 Customizer 注释和参数 JSON 中稳定恢复可编辑参数。

## 编译反馈处理

如果执行面返回编译失败：

1. 根据错误修复完整代码。
2. 保留用户意图，不随意换题。
3. 只输出新的完整 Artifact。

如果执行面返回预览质量不足：

1. 补齐缺失结构。
2. 强化不同视角可见性。
3. 优先修几何，不靠颜色或文字说明遮掩。

## 回改处理

用户要求修改已生成图纸时：

1. 优先读取当前 `drawing.scad`。
2. 修改已有参数或新增参数，不要无故重写为不可追踪的新结构。
3. 同步更新 `drawing.parameters.json`。
4. 修改后重新触发预览或说明待导出的格式。
5. 除非用户要求保留版本，不要新建另一个无关目录。

## 示例

用户：画一个带法兰接口的立式储罐草图，高 120mm，直径 60mm，底部有支脚。

Artifact 的 `code` 应包含：

```scad
/* [Main Dimensions] */
tank_height = 120; // [50:5:300]
tank_diameter = 60; // [20:1:150]
wall_thickness = 3; // [1:0.5:10]
flange_diameter = 28; // [10:1:80]
leg_height = 18; // [5:1:50]
body_color = "SteelBlue";

$fn = 96;

module tank_body() {
  color(body_color)
  difference() {
    cylinder(h=tank_height, d=tank_diameter);
    translate([0, 0, wall_thickness])
      cylinder(h=tank_height, d=tank_diameter - wall_thickness * 2);
  }
}

tank_body();
```

实际输出必须是完整可编译代码，示例只说明风格。

## 禁止

- 不要省略代码主体。
- 不要用不可解析表达式作为顶部参数默认值。
- 不要把变量命名成 `a`、`b`、`x1` 这类不可读短名。
- 不要只画一个简单方块或圆柱来敷衍复杂工业件。
- 不要把不可继续参数编辑的 STL / OBJ mesh 当作工业制图主交付。
