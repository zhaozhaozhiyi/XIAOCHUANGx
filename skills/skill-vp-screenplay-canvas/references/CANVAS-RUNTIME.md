# Canvas Runtime

`screenplay-canvas` 的脚手架默认生成 `studio/`，不是 `presentation/`。

运行态：

- `/`：制作态，点击或键盘推进
- `?preview=1`：自动预览，适合确认叙事流
- `?voice=1`：播音频但不自动推进
- `?capture=1`：音频结束后自动推进，适合录屏

概念映射：

- `sequence`：一段完整叙事单元
- `beat`：该单元内的最小叙事拍点
- `cue`：beat 对应的口播文本或静默提示

默认目录：

```text
studio/
  src/sequences/<NN>-<id>/
    <Scene>.tsx
    <Scene>.css
    cues.ts
```

`cues.ts` 的数组长度必须和 scene 里可到达的 beat 数保持一致。
