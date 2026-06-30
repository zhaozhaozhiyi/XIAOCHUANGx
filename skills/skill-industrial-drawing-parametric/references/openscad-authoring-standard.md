# OpenSCAD 参数化建模标准

## 文件结构

每个 `drawing.scad` 应按以下顺序组织：

```scad
/* [Main Dimensions] */
width = 120; // [20:1:400]
height = 80; // [20:1:300]
plate_thickness = 6; // [1:0.5:30]

/* [Mounting] */
hole_diameter = 8; // [2:0.5:30]
hole_spacing = 80; // [20:1:300]

/* [Appearance] */
body_color = "SteelBlue";

$fn = 96;

module main_body() { ... }
module mounting_holes() { ... }

main_body();
```

要求：

- 所有用户可改参数放在文件顶部。
- 参数名使用可读 `snake_case`。
- 数字参数必须有 Customizer 范围注释。
- 枚举参数必须有选项注释。
- 颜色参数以 `_color` 结尾。
- `module` 命名要反映结构语义，不用 `part1`、`a`、`thing`。

## 参数 JSON 对齐

`drawing.parameters.json` 必须能索引核心参数：

```json
{
  "engine": "openscad",
  "source": "drawing.scad",
  "parameters": [
    {
      "name": "plate_thickness",
      "label": "板厚",
      "value": 6,
      "unit": "mm",
      "min": 1,
      "max": 30,
      "step": 0.5,
      "group": "Main Dimensions"
    }
  ],
  "exports": []
}
```

要求：

- JSON 必须可解析。
- `parameters[].name` 必须与 `.scad` 顶部变量一致。
- 数值单位默认 `mm`。
- 分组应对应 `.scad` 中的 `/* [Group] */`。

## 几何质量

工业制图草模必须优先表达结构关系：

- 支架要有板厚、孔、加强筋或折边。
- 法兰要有内孔、外径、螺栓孔阵列。
- 容器要有主体、壁厚、开口、支脚或接口。
- 外壳要有长宽高、壁厚、安装孔或开槽。
- 管线要有管径、弯头、接口或法兰。

复杂曲面可以近似，但不能把复杂工业件退化成一个无孔无厚度的方块或圆柱。

## 可编译性约束

- 避免依赖未落盘的外部文件。
- 使用 `difference()` 时保证切削体穿透目标体，避免边界共面导致预览异常。
- 关键圆柱设置合理 `$fn`，通常 48-128。
- 需要导出 DXF 的模型，应能通过 `projection(cut = false)` 得到非空顶视轮廓。
- 不输出 Markdown 代码围栏到 `.scad` 文件。

## 颜色与可读性

颜色可以提升预览理解，但不能替代几何结构。

建议：

- 主体结构使用 `body_color`。
- 孔、切削体无需显色。
- 加强筋、支脚、接口可用不同颜色参数。
- 若后续接入 OFF 彩色预览，颜色信息应来自 OpenSCAD `color()`。

## 回改要求

用户要求修改时：

- 优先更新既有参数值。
- 参数不足时再新增参数，并同步写入 JSON。
- 不随意重写成另一种建模风格。
- 保持原目录和文件名，除非用户要求另存版本。

## 自检清单

提交 Artifact 前检查：

- `.scad` 是否完整可编译。
- 顶部是否有核心参数。
- Customizer 注释是否可被解析。
- 是否包含用户明确要求的结构。
- 是否有明显悬空、断裂或空模型风险。
- 是否能支持 STL 预览和 DXF 投影。
