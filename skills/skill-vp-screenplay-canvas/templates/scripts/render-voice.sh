#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CUES="$ROOT/audio-cues.json"
OUT_DIR="$ROOT/public/voice"
PROVIDERS_DIR="$SCRIPT_DIR/voice-providers"

PROVIDER="${SCREENPLAY_TTS:-minimax}"
VOICE="${SCREENPLAY_TTS_VOICE:-}"
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --voice=*) VOICE="${arg#--voice=}" ;;
    --provider=*) PROVIDER="${arg#--provider=}" ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

PROVIDER_FILE="$PROVIDERS_DIR/$PROVIDER.sh"

[[ -f "$CUES" ]] || { echo "Run npm run extract-cues first" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
[[ -f "$PROVIDER_FILE" ]] || { echo "Provider not found: $PROVIDER" >&2; exit 1; }

source "$PROVIDER_FILE"

if declare -F tts_check >/dev/null; then
  tts_check || exit 1
fi

while IFS= read -r row; do
  sequence=$(echo "$row" | jq -r '.sequence')
  beat=$(echo "$row" | jq -r '.beat')
  text=$(echo "$row" | jq -r '.text')
  out="$OUT_DIR/$sequence/$beat.mp3"

  if [[ -f "$out" && "$FORCE" != true ]]; then
    echo "skip $sequence/$beat.mp3"
    continue
  fi

  mkdir -p "$(dirname "$out")"
  tts_synthesize "$text" "$out" "$VOICE"
  echo "done $sequence/$beat.mp3"
done < <(jq -c '.[]' "$CUES")
