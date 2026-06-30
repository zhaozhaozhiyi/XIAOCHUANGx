# OpenSCAD 工具链规范

## 工具链定位

OpenSCAD 是工业制图模块的主执行引擎。它负责把 `.scad` 主资产编译成可预览和可交付的派生文件。

工具链分层：

| 层级 | 作用 |
|------|------|
| `.scad` 主资产 | 用户可编辑的参数化源码 |
| OpenSCAD CLI | 服务端 / 本地导出 STL、DXF |
| OpenSCAD WASM | 浏览器侧即时预览、未来离线预览 |
| fallback | 工具链不可用时的预览或参数轮廓兜底 |

## 能力检测

运行时应提供工具链状态：

```json
{
  "openscad": {
    "binary": "openscad",
    "available": true,
    "version": "OpenSCAD ..."
  },
  "capabilities": {
    "scadToStl": true,
    "scadToDxfProjection": true,
    "previewStlFallback": true,
    "parameterOutlineDxfFallback": true
  }
}
```

用户界面应能说明当前预览 / 导出来源：

- OpenSCAD 实时编译。
- 工作区 `exports/preview.stl` 兜底。
- OpenSCAD 投影 DXF。
- 参数轮廓 DXF 兜底。

## STL 导出

STL 导出规则：

- 输入必须是当前 `.scad`。
- 输出路径默认 `exports/drawing.stl`。
- 预览兜底可使用 `exports/preview.stl`，但不能命名为正式导出。
- 失败时必须保留错误原因。

## DXF 导出

DXF 导出优先级：

1. 使用 OpenSCAD `projection(cut = false)` 对当前模型导出 DXF。
2. 若 OpenSCAD 不可用或导出失败，使用参数轮廓兜底生成二维 DXF。

兜底 DXF 必须标注：

```json
{
  "dxfStatus": "generated",
  "dxfMethod": "parameter_outline",
  "dxfWarning": "OpenSCAD unavailable or failed"
}
```

不能把参数轮廓兜底说成工程级 DXF。

## WASM 接入目标

浏览器侧 OpenSCAD WASM 接入后，应具备：

- Web Worker 隔离编译。
- 每个预览实例独立 worker，避免多组件串扰。
- 支持 `FS_WRITE` 写入 `import()` 依赖文件。
- 预览时可同时输出 STL 和 OFF，OFF 用于颜色传播。
- 导出 DXF 时在点击下载或导出动作中即时编译。

## 错误处理

常见错误说明：

| 错误 | 用户可见解释 |
|------|--------------|
| `openscad_unavailable` | 本机尚未检测到 OpenSCAD，可继续编辑 SCAD，暂不能真实导出 |
| `openscad_timeout` | 模型复杂或工具链响应慢，编译超时 |
| `openscad_compile_failed` | SCAD 源码存在语法或几何编译问题 |
| `openscad_dxf_failed` | DXF 投影失败，可能是模型为空或非二维可投影结构 |

## 真实性要求

- 只有文件真实写入后才能说“已导出”。
- 只有 OpenSCAD 成功返回文件后才能说“OpenSCAD 导出”。
- fallback 文件必须在 README 和参数 JSON 中标注来源。
- 预览和导出必须基于同一份当前源码。

## 验收命令

本模块相关验收至少包括：

```bash
pnpm smoke:3d:toolchain
pnpm smoke:3d:parameters
pnpm smoke:3d:dxf
pnpm smoke:3d:claude
```

其中真实流程以 Claude Code / Companion 写入工作区文件为主，mock 只用于开发联调。
