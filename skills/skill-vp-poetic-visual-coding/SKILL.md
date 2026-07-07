---
slug: skill-vp-poetic-visual-coding
module: video
task: poetic-visual-coding
version: "0.1"
status: imported
name: poetic-visual-coding
description: Turn a concept — a word, phrase, mood, rough idea, or optionally a reference image/video — into short poetic animations in this project's quiet style, with optional timeline-synced sound design. The default mode is to reason from the concept to an original visual direction; replicating or remixing local sources is a variant. Use when asked to design, storyboard, implement, analyze, replicate, or remix p5.js/Processing-style visual pieces, or for requests mentioning p5.js 动画, 灵感拆解, 视觉复刻, 诗意动效, 视觉方向, 音画同步, 声音设计, or 可复用创作流程.
---

# Poetic Visual Coding

Use this skill to move from a concept — a word, phrase, mood, image, or rough idea — to a reusable short-form animation system:

```text
concept -> visual direction -> static poster -> motion rules -> technical plan -> plan review -> plan optimization -> p5.js implementation -> audiovisual review -> reusable notes
```

Reasoning from the concept to an original visual direction is the default. Tearing down an existing piece is a variant used only when the user asks to replicate or remix.

The target style is not a generic particle demo. It is a quiet visual poem — most often vertical, but the aspect ratio is configurable (see Style Grammar): paper/film texture, muted color, sparse symbolic objects, small captions, and a clear 10-25 second transformation. Sound is optional, but when used it must be composed against the same timeline as the image, with sparse cues that hit key animation moments rather than generic background music.

## Start From The Concept

The default working mode is **imaginative, not imitative**. Given a word, phrase, mood, or rough idea, reason your way to an original visual direction first — do not begin by copying an existing piece. The concept is the seed; the Style Grammar below is the soil.

Derive a direction by interrogating the concept along these axes. Pick concrete, surprising answers rather than literal ones:

```text
concept        the given word or phrase (e.g. 花洒 / 飞鸟 / 春天有点狡猾)
literal core   what it physically is
felt sense     the emotion or sensation it carries
metaphor       what else moves or behaves the same way — reach for the non-obvious
main object    the single poetic form that will carry the piece
medium/surface the texture and world it lives in
palette        3-6 restrained tokens that match the mood
motion + turn  how it begins, and the one visible transformation
```

A good direction is one you could not have guessed from the word alone — the leap from concept to image is where the poetry lives. When several readings of a concept are viable, briefly hold two or three and choose the one with the strongest visual turn.

Worked example — concept: **把一个人慢慢忘记 (slowly forgetting someone)**

```text
concept        把一个人慢慢忘记 (slowly forgetting someone)
literal core   a memory of a person that fades over time
felt sense     quiet grief, softness, the ache of not being able to hold on
metaphor       (obvious) a photo fading   ->   (chosen) frost on a window melting
               at dawn: the face was drawn in the frost, and warmth erases it
main object    a face/figure traced in window frost, made of tiny ice crystals
medium/surface cold fogged glass at daybreak, warm light rising from one edge
palette        pale blue-gray glass, frost white, a thin dawn-amber, faint ink-gray
motion + turn  begins: sharp frost portrait, still, breath-fog around it
               turn:  amber light seeps in, crystals melt from the edges inward,
                      the face loses its outline and runs down as water beads
               end:   bare wet glass, one last droplet, the shape only implied
caption        近黄昏时，我已认不出你的眉眼   (small, lower edge)
```

Why this works: it refuses the literal "fading photo," finds a physical process (frost melting) whose *motion is the emotion*, and lands one clear turn (solid → melt → absence) inside 15s. Do this reasoning first; only then move to the poster and timeline steps below.

Worked example — concept: **迟疑 (hesitation)** — an abstract feeling with no built-in object

```text
concept        迟疑 (hesitation)
literal core   holding still on the edge of an action; not-yet
felt sense     tension between go and stay; a held breath; almost, then not
metaphor       (obvious) a person at a door   ->   (chosen) a water droplet
               hanging at the lip of a faucet, swelling, refusing to fall
main object    one heavy droplet at the tip of a thin dark line (the faucet edge),
               with faint concentric ripples waiting on the surface far below
medium/surface dim wet ceramic, soft top light, deep shadow in the lower half
palette        near-black ground, cold porcelain gray, one silver highlight,
               a single warm reflection caught in the drop
motion + turn  begins: the drop grows, trembles, stretches — almost releases,
                       pulls back, grows again (repeat the near-fall 2-3 times)
               turn:  on the last swell it finally lets go, falls slow
               end:   a single ring spreads on the water below, then stillness
caption        要不要，就这样落下去呢   (small, lower edge)
```

Why this works: an abstract word has no object, so the leap is to find a *physical gesture that embodies the feeling* — a droplet's swell-and-hold is hesitation made visible. The near-fall repeats (the essence of 迟疑) before the single release; the whole meaning lives in timing, not in any drawn symbol. For abstract concepts, let the motion curve carry the idea and keep the object almost nothing.

## Optional Local References

Only consult local sources when the user asks to **replicate, remix, or stay consistent with** an existing piece — not as a routine first step. When that is the goal, useful sources in this project include:

- `xhs_videos/*.mp4` for original timing, resolution, and motion cadence.
- `xhs_videos/analyze/*.jpg` for representative covers.
- `xhs_videos/frames/*.jpg` and `xhs_videos/spring/*.jpg` for progression frames.
- `huasa_p5js.html`, `spring_p5js.html`, `window_p5js.html`, and `generative_art.html` for existing p5.js implementation patterns.

Useful inspection commands:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of default=nw=1 input.mp4
ffmpeg -i input.mp4 -vf "fps=1,scale=360:-1" frames/frame_%03d.jpg
```

Prefer `rg --files` to discover project files. When you do inspect visuals, look at actual frames or screenshots, not filenames alone.

## Style Grammar

Default to these project traits unless the user asks for a different direction:

- **Format**: aspect ratio is user-configurable; always ask or honor the user's choice, and **default to 3:4 vertical** when unspecified. 30 or 60 fps; 10-25 seconds. Supported ratios and reference canvas sizes:
  - `3:4` vertical (default) — `720 x 960`
  - `9:16` tall vertical — `720 x 1280`
  - `1:1` square — `900 x 900`
  - `4:3` horizontal — `960 x 720`
  - `16:9` horizontal — `1280 x 720`

  Keep width at a round base (e.g. 720/900/1280) and derive height from the ratio. When replicating a specific source video, match the ratio detected via `ffprobe` instead of forcing a preset.
- **Surface**: old paper, wall, fogged glass, night sky, or soft digital paper; visible grain/noise/vignette.
- **Palette**: low saturation. Common bases include warm off-white, gray-green, pale mint, muted gray-blue, deep navy, charcoal, dusty yellow, dark red, and cream white.
- **Composition**: one main poetic object or system, plenty of negative space, small text near edges, bottom watermark/title area.
- **Motion**: slow reveal, drifting, falling, growing, clustering, dissolving, swinging, blooming, or breathing. A piece should have a visible turn, not only ambient looping.
- **Sound**: optional, never decorative by default. When requested, design sparse high-quality cues, silence, room tone, or procedural texture that lands on animation constants such as `T_FIRST_MOTION`, `T_TURN`, `T_REVEAL`, and `T_SETTLE`.
- **Code feel**: deterministic generative art. Randomness should be seeded or precomputed in `setup()` so the animation feels intentional.
- **Text**: short Chinese poetic titles or tiny labels. Avoid explanatory UI copy inside the artwork.

Avoid glossy app UI, loud gradients, dense cyber particles, stock illustrations, giant typography, and generic demo controls dominating the image.

## Workflow

### 1. Fix The Direction

Turn the concept into a compact brief before coding. When starting from a word or idea, derive these using the axes in "Start From The Concept". When replicating a source, extract them from the reference instead.

```text
subject:
emotion:
main visual elements:
color system:
motion elements:
turning point:
final image:
reusable materials/code:
```

If a source video is involved (replication/remix), also identify 4-6 key moments: opening state, first movement, accumulation, turning point, reveal, ending state.

### 2. Design The Static Poster

Make the still frame work before animation. Specify:

- background texture and base color
- main object placement
- secondary shapes or particles
- text/watermark placement
- grain, vignette, shadow, and paper aging
- 3-6 color tokens

The still should read as a finished poster even if time is paused.

### 3. Write The Motion Logic

Turn the poster into rules rather than frame-by-frame decoration. Name the key timeline moments because the same constants should drive drawing, review screenshots, and optional sound cues:

```text
0-2s      quiet establishing state
2-6s      first movement or material arrival
6-10s     accumulation, drift, or path following
10-13s    turning point / reveal / bloom / break
13-15s    settle into final image or loop handoff
```

Use easing, delays, noise, and precomputed particles. Keep one dominant motion idea and two supporting motions.

If sound is requested, define the visual sync points before designing any audio:

```text
T_START:
T_FIRST_MOTION:
T_TURN:
T_REVEAL:
T_SETTLE:
```

### 4. Draft The p5.js Technical Plan

Before coding, translate the poster and motion rules into a technical plan:

```text
canvas:
timeline constants:
draw layers:
data structures:
precomputed materials:
motion formulas:
texture/grain strategy:
audio timeline:       only when sound is requested
audio implementation: p5.sound / Web Audio API / Tone.js / external assets
preview/export controls:
performance risks:
fallback simplifications:
```

The technical plan should make the code obvious before it exists. Every important visual element should map to a drawing function, a data structure, and a timeline rule.

### 5. Review And Optimize The Plan

Review the technical plan before writing code:

- Does every visual element map to a clear p5.js drawing function?
- Is the main transformation controlled by explicit timeline constants?
- Are random values seeded or precomputed?
- Are expensive operations avoided inside `draw()`?
- Can the first frame, turning point, and final frame be captured easily?
- If sound is requested, do sound cues hit the animation's key moments precisely?
- Is there a simpler version that preserves the poetic effect?

Optimize once before implementation. Prefer fewer objects with stronger timing over dense systems, and prefer precomputed material over fragile frame-by-frame improvisation.

### 6. Implement In p5.js

For new code, prefer a single HTML file when the user wants a shareable sketch. Use this structure:

```javascript
// Aspect ratio is configurable. Default 3:4 vertical; change ASPECT to
// [9,16], [1,1], [4,3], [16,9], or match a source video via ffprobe.
const BASE = 720;
const ASPECT = [3, 4];
const W = ASPECT[0] >= ASPECT[1] ? Math.round(BASE * ASPECT[0] / ASPECT[1]) : BASE;
const H = ASPECT[0] >= ASPECT[1] ? BASE : Math.round(BASE * ASPECT[1] / ASPECT[0]);
const DURATION = 15;
const PALETTE = {
  bg: [228, 225, 215],
  ink: [55, 50, 50],
  accent: [190, 80, 70]
};

let startTime = 0;
let elements = [];

function setup() {
  const canvas = createCanvas(W, H);
  canvas.parent("canvas-container");
  startTime = millis();
  randomSeed(42);
  noiseSeed(42);
  // Precompute stable positions here.
}

function draw() {
  const t = min((millis() - startTime) / 1000, DURATION);
  drawBackground(t);
  drawPosterBase(t);
  drawMotionLayer(t);
  drawCaptions(t);
}
```

Implementation rules:

- Precompute particle/dot/shape positions in `setup()`.
- Use timeline constants such as `T_REVEAL`, `T_BLOOM`, `T_SETTLE`.
- Use helpers like `easeInOutCubic()`, `fadeIn(t,start,dur)`, and `grainOverlay()`.
- Keep canvas art separate from browser preview controls.
- Add save/record controls only when useful for the user's requested output.
- When sound is requested, trigger audio from the same timeline constants used for the visuals. Account for browser audio unlock with a clear user gesture, and avoid autoplay assumptions.
- Match existing project files before inventing a new structure.

### 7. Optional Sound Design

Sound is optional, but when used it is part of the animation composition, not a background layer added after the fact. Define:

```text
sound concept:
acoustic materials:
silence strategy:
timeline sync points:
sound events:
dynamic curve:
implementation:
export risks:
```

Rules:

- Use silence and near-silence as active materials.
- Avoid generic background music unless explicitly requested.
- Match each cue to the visual material, scale, and emotional temperature.
- Make sounds sparse, intentional, and precisely aligned with motion turns.
- Let the sound structure mirror the visual structure: gather with gathering, crack with breaking, dissolve with dissolving, settle with settling.
- Prefer a few designed cues over continuous decorative audio.

Review sound against the picture: mute should still work as a visual poem, but unmuted should feel more exact, dimensional, and inevitable.

### 8. Review Against The Project Style

Before finalizing, check:

- The canvas matches the chosen aspect ratio (default 3:4, or the user-specified / source-detected ratio).
- The first frame, turning point, and final frame are visually distinct.
- The palette is restrained and not one loud hue family.
- Text is small, placed near edges, and does not explain the artwork.
- Random motion is stable enough to feel designed.
- The piece has texture: grain, paper, slight blur, faded edges, or analog imperfection.
- If sound is included, cues align with visual keyframes and never feel like generic BGM.
- The final file can be opened locally or served with a simple dev server.

When possible, run the sketch and inspect screenshots or exported frames. If verification cannot be run, say so.

## Output Modes

If the user asks for an analysis, return:

```text
visual structure
motion structure
style tokens
implementation strategy
reusable materials/code
```

If the user asks for a plan, return:

```text
concept direction
static poster design
timeline
p5.js module plan
technical review
optimization pass
sound design plan, if requested
review checklist
```

If the user asks to build, implement the HTML/p5.js sketch, verify it, and finish with the file path and what was tested.

If the user asks for a reusable template, extract the stable parts into named helpers: timeline, palette, texture, particles, path motion, reveal, typography, optional audio cues, and recording/export controls.
