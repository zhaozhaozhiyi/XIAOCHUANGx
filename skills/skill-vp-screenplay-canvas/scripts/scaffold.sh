#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$SKILL_DIR/templates"
THEMES_DIR="$SKILL_DIR/themes"
DEFAULT_THEME="night-theater"

list_themes() {
  echo "Available themes:"
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    local meta="$dir/theme.json"
    local id name desc
    id=$(grep -E '"id"' "$meta" | head -n1 | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
    name=$(grep -E '"nameZh"' "$meta" | head -n1 | sed -E 's/.*"nameZh":[[:space:]]*"([^"]+)".*/\1/')
    desc=$(grep -E '"descriptionZh"' "$meta" | head -n1 | sed -E 's/.*"descriptionZh":[[:space:]]*"([^"]+)".*/\1/')
    printf "  • %-16s %s\n      %s\n\n" "$id" "$name" "$desc"
  done
}

TARGET=""
THEME="$DEFAULT_THEME"
for arg in "$@"; do
  case "$arg" in
    --list-themes)
      list_themes
      exit 0
      ;;
    --theme=*)
      THEME="${arg#--theme=}"
      ;;
    --*)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$arg"; fi
      ;;
  esac
done

TARGET="${TARGET:-studio}"
if [[ "$TARGET" = /* ]]; then
  TARGET_ABS="$TARGET"
else
  TARGET_ABS="$(pwd)/$TARGET"
fi
TARGET_PARENT="$(dirname "$TARGET_ABS")"
TARGET_NAME="$(basename "$TARGET_ABS")"
THEME_DIR="$THEMES_DIR/$THEME"
THEME_TOKENS="$THEME_DIR/tokens.css"

if [[ ! -d "$THEME_DIR" || ! -f "$THEME_TOKENS" ]]; then
  echo "Theme not found: $THEME" >&2
  exit 1
fi

if [[ -d "$TARGET_ABS" && -n "$(ls -A "$TARGET_ABS" 2>/dev/null || true)" ]]; then
  echo "Target exists and is not empty: $TARGET" >&2
  exit 1
fi

mkdir -p "$TARGET_PARENT"
(cd "$TARGET_PARENT" && npm create vite@latest -- "$TARGET_NAME" --template react-ts >/dev/null)

cd "$TARGET_ABS"
npm install >/dev/null 2>&1
npm install --save-dev tsx >/dev/null 2>&1

rm -f \
  src/App.tsx src/App.css \
  src/main.tsx src/index.css \
  src/assets/react.svg \
  public/vite.svg \
  README.md
rmdir src/assets 2>/dev/null || true

mkdir -p \
  src/styles src/hooks src/components src/runtime \
  src/sequences/00-pilot \
  public scripts scripts/voice-providers

cp "$TEMPLATES/index.html" .
cp "$TEMPLATES/vite.config.ts" .
cp "$TEMPLATES/src/main.tsx" src/main.tsx
cp "$TEMPLATES/src/App.tsx" src/App.tsx

cp "$THEME_TOKENS" src/styles/tokens.css
cp "$TEMPLATES/src/styles/base.css" src/styles/base.css
cp "$TEMPLATES/src/styles/animations.css" src/styles/animations.css
cp "$TEMPLATES/src/styles/fonts.css" src/styles/fonts.css

cp "$TEMPLATES/src/hooks/useViewportScale.ts" src/hooks/useViewportScale.ts
cp "$TEMPLATES/src/hooks/useCueCursor.ts" src/hooks/useCueCursor.ts
cp "$TEMPLATES/src/hooks/usePlaybackProfile.ts" src/hooks/usePlaybackProfile.ts
cp "$TEMPLATES/src/hooks/useVoiceTrack.ts" src/hooks/useVoiceTrack.ts

cp "$TEMPLATES/src/components/CanvasSurface.tsx" src/components/CanvasSurface.tsx
cp "$TEMPLATES/src/components/CueRail.tsx" src/components/CueRail.tsx
cp "$TEMPLATES/src/components/CueRail.css" src/components/CueRail.css
cp "$TEMPLATES/src/components/LaunchGate.tsx" src/components/LaunchGate.tsx
cp "$TEMPLATES/src/components/LaunchGate.css" src/components/LaunchGate.css
cp "$TEMPLATES/src/components/ModeDial.tsx" src/components/ModeDial.tsx
cp "$TEMPLATES/src/components/ModeDial.css" src/components/ModeDial.css
cp "$TEMPLATES/src/components/PreviewDeck.tsx" src/components/PreviewDeck.tsx
cp "$TEMPLATES/src/components/PreviewDeck.css" src/components/PreviewDeck.css
cp "$TEMPLATES/src/components/WordCut.tsx" src/components/WordCut.tsx

cp "$TEMPLATES/src/runtime/models.ts" src/runtime/models.ts
cp "$TEMPLATES/src/runtime/score.ts" src/runtime/score.ts

cp "$TEMPLATES/src/sequences/00-pilot/PilotScene.tsx" src/sequences/00-pilot/PilotScene.tsx
cp "$TEMPLATES/src/sequences/00-pilot/PilotScene.css" src/sequences/00-pilot/PilotScene.css
cp "$TEMPLATES/src/sequences/00-pilot/cues.ts" src/sequences/00-pilot/cues.ts

cp "$TEMPLATES/scripts/extract-cues.ts" scripts/extract-cues.ts
cp "$TEMPLATES/scripts/render-voice.sh" scripts/render-voice.sh
cp "$TEMPLATES/scripts/voice-providers/README.md" scripts/voice-providers/README.md
cp "$TEMPLATES/scripts/voice-providers/minimax.sh" scripts/voice-providers/minimax.sh
cp "$TEMPLATES/scripts/voice-providers/openai.sh" scripts/voice-providers/openai.sh

python3 - <<'PY'
from pathlib import Path
import json

pkg = Path("package.json")
data = json.loads(pkg.read_text())
data["scripts"] = {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "extract-cues": "tsx scripts/extract-cues.ts",
  "render-voice": "bash scripts/render-voice.sh"
}
pkg.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
PY

chmod +x scripts/render-voice.sh scripts/voice-providers/*.sh

echo "screenplay-canvas studio created at $TARGET_ABS"
echo "Run:"
echo "  cd $TARGET"
echo "  npm run dev"
