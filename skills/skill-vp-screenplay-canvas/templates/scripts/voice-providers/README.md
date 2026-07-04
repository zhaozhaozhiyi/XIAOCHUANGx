# Voice Providers

`render-voice.sh` is provider-agnostic. Each provider is one `.sh` file with:

- `tts_synthesize <text> <out_path> [voice]` required
- `tts_check` optional

Built-ins:

- `minimax.sh`
- `openai.sh`

Select provider with:

```bash
SCREENPLAY_TTS=openai npm run render-voice
SCREENPLAY_TTS_VOICE=alloy npm run render-voice
```
