# Voice Pass

先抽 cue，再合成音频。

推荐命令：

```bash
npm run extract-cues
npm run render-voice
```

产物：

- `audio-cues.json`：扁平 cue 清单
- `public/voice/<sequence>/<N>.mp3`：每一拍对应的音频

provider 约定：

- 脚本入口在 `templates/scripts/voice-providers/`
- 运行器按 `SCREENPLAY_TTS` 选择 provider
- 默认内置 `minimax` 和 `openai`

静默 cue 用空字符串表示，运行器会跳过，不生成音频。
