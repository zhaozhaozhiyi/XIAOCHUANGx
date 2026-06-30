# OpenSCAD Runtime Resources

This directory is the product-managed OpenSCAD runtime location for the 3D
industrial drawing module.

Expected source / prepared layout:

```text
resources/engines/openscad/
  README.md

apps/desktop/resources/engines/openscad/
  darwin|win32|linux/
    OpenSCAD.app/ or openscad(.exe)
    VERSION.txt
    RUNTIME_MANIFEST.json
    LICENSES/

web/public/openscad-wasm/
  openscad.js
  openscad.wasm
  VERSION.txt
  WASM_MANIFEST.json
  SOURCE_AVAILABILITY.md
```

Prepare or refresh the desktop resource copy with:

```bash
pnpm engines:prepare:openscad
```

Prepare or verify the browser WASM preview assets with:

```bash
JLC_OPENSCAD_WASM_ARCHIVE=.runtime/openscad-downloads/wasm/OpenSCAD-2026.06.21-WebAssembly-web.zip \
JLC_OPENSCAD_WASM_DIST_SHA256=<sha256> \
pnpm engines:prepare:openscad-wasm

pnpm engines:verify:openscad-wasm
pnpm engines:verify:openscad-wasm:required
```

The WASM bundle is an enhancement for fast in-browser previews. It does not
replace the desktop CLI runtime for authoritative export. `ScadPreview` first
tries the browser Worker when `NEXT_PUBLIC_OPENSCAD_WASM_PREVIEW=1`; if the
Worker is unavailable or compilation fails, the preview falls back to the CAD
Runtime API and then to workspace / parameterized fallbacks.

Prepare a normalized license notices directory first:

```bash
JLC_OPENSCAD_SOURCE_TREE=/path/to/extracted/openscad-source \
JLC_OPENSCAD_SOURCE_CODE_URL=https://github.com/openscad/openscad \
JLC_OPENSCAD_SOURCE_ARCHIVE_URL=https://example.com/openscad-source-matching-runtime.tar.gz \
JLC_OPENSCAD_SOURCE_SHA256=<source-sha256> \
JLC_OPENSCAD_LICENSES_OUT=.runtime/openscad-license-notices \
pnpm engines:licenses:openscad
```

Use source materials that correspond to the selected runtime artifact. Do not
pair a newer snapshot binary with an unrelated older stable source archive for
release approval; that can make the `SOURCE_AVAILABILITY.md` file misleading.
If using upstream snapshots, record the exact upstream URL, SHA256, and source
commit/archive accepted by legal/release review.

The generated directory is intended to be passed as
`JLC_OPENSCAD_LICENSES_DIR`. It must include at least:

```text
LICENSE
THIRD_PARTY_NOTICES.md
SOURCE_AVAILABILITY.md
```

The generator is a packaging aid, not legal approval. Review upstream license,
copyright, dependency, and source-offer obligations before shipping.

For repeatable development or release preparation, prefer the fetch wrapper with
an internal artifact or a verified upstream download:

```bash
# Internal artifact / local cache.
JLC_OPENSCAD_ARCHIVE=/path/to/OpenSCAD-runtime.dmg \
JLC_OPENSCAD_DIST_SHA256=<sha256> \
JLC_OPENSCAD_LICENSES_DIR=.runtime/openscad-license-notices \
JLC_OPENSCAD_SOURCE_CODE_URL=https://github.com/openscad/openscad \
pnpm engines:fetch:openscad

# Direct download URL.
JLC_OPENSCAD_DIST_URL=https://example.com/OpenSCAD-runtime.dmg \
JLC_OPENSCAD_DIST_SHA256=<sha256> \
JLC_OPENSCAD_LICENSES_DIR=.runtime/openscad-license-notices \
JLC_OPENSCAD_SOURCE_CODE_URL=https://github.com/openscad/openscad \
pnpm engines:fetch:openscad
```

Release fetches must provide a SHA256 hash. The script downloads or reads the
archive, verifies the hash, extracts the OpenSCAD app/binary, then delegates to
`prepare-openscad-runtime.mjs`.

Current upstream metadata is exposed by:

- `https://openscad.org/inc/releases.js` for stable release URLs.
- `https://files.openscad.org/snapshots/.snapshots.js` for snapshot URLs.
- `*.sha256` files next to each upstream artifact.

Do not hardcode "latest" in product code. Pick an explicit artifact, record its
URL and SHA256 in CI variables, and decide whether stable or snapshot builds
match the target architecture. At the time this plan was written, the stable
macOS release metadata labels the DMG as 64-bit Intel, while snapshot metadata
publishes newer macOS DMGs and WebAssembly packages. Use
`JLC_OPENSCAD_REQUIRED_ARCHES` to prevent shipping an incompatible macOS bundle.

If a runtime is already installed locally, release builds can also provide
either:

```bash
JLC_OPENSCAD_SOURCE=/path/to/OpenSCAD.app pnpm engines:prepare:openscad
JLC_OPENSCAD_BIN=/path/to/openscad pnpm engines:prepare:openscad
```

Production/release builds must also provide completed license notices:

```bash
JLC_OPENSCAD_SOURCE=/path/to/OpenSCAD.app \
JLC_OPENSCAD_LICENSES_DIR=/path/to/openscad-license-notices \
JLC_OPENSCAD_SOURCE_CODE_URL=https://github.com/openscad/openscad \
JLC_OPENSCAD_REQUIRED_ARCHES=x86_64,arm64 \
JLC_OPENSCAD_REQUIRED=1 \
pnpm engines:prepare:openscad
```

The `LICENSES/` directory must not be the development placeholder. Release
verification requires at least:

```text
LICENSES/
  LICENSE or COPYING
  NOTICE or THIRD_PARTY_NOTICES
  SOURCE or SOURCE_OFFER or SOURCE_AVAILABILITY
```

Run the release verifier directly with:

```bash
pnpm engines:verify:openscad:required
```

On macOS release CI, set `JLC_OPENSCAD_REQUIRED_ARCHES=x86_64,arm64` when the
desktop package must support both Intel and Apple Silicon machines. Stable
upstream OpenSCAD macOS downloads may be Intel-only; use a universal upstream
build, an internally rebuilt universal bundle, or separate architecture-specific
release packages when required.

When verification passes, `RUNTIME_MANIFEST.json` is written next to the
runtime with the detected command, file size, version metadata path, license
files, and source availability checks.

For desktop release packaging, prefer the hard-gated command:

```bash
JLC_OPENSCAD_SOURCE=/path/to/OpenSCAD.app \
JLC_OPENSCAD_LICENSES_DIR=/path/to/openscad-license-notices \
JLC_OPENSCAD_SOURCE_CODE_URL=https://github.com/openscad/openscad \
JLC_OPENSCAD_REQUIRED_ARCHES=x86_64,arm64 \
pnpm desktop:pack:release
```

`desktop:pack` and `desktop:pack:dir` are development / internal-test commands:
they can write `MISSING_RUNTIME.md` so the app remains testable while reporting
`openscad_runtime_missing`. Do not use those soft-gated commands for a release
that should be ready for end users.

Runtime lookup order is implemented in `web/src/lib/cad-toolchain.ts`:

1. `JLC_OPENSCAD_BIN` for explicit development/runtime override.
2. Packaged `process.resourcesPath/engines/openscad/{platform}/...`.
3. Repository-local `resources/engines/openscad/{platform}/...`.
4. `PATH` only when `JLC_OPENSCAD_ALLOW_PATH=1` is set for development.

Do not require end users to install OpenSCAD or configure `PATH`.
When bundling OpenSCAD, include the upstream license notices, version metadata,
source availability notes, and dependency attributions under `LICENSES/`.
Prepared runtime files are ignored by git; only this README and development
missing markers should be committed.
