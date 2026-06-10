# holocron-video

MDX-to-video framework built on Remotion and Spiceflow. Write MDX with headings as section boundaries; each heading becomes a timed Remotion `Series.Sequence`. Section duration is controlled via heading suffixes (`duration=3s`, `duration=90fps`, `duration=8beats`). Frontmatter sets global `fps` and `bpm`.

## How it works

```
MDX file
  │
  ▼
mdx-parse.ts ──► split into MdxSection[] by headings, parse durations
  │
  ▼
app.tsx (server, Spiceflow RSC)
  ├── safe-mdx parses AST, resolves user imports via virtual:egaki-modules
  ├── renders each section to JSX with Remotion animation components as client refs
  └── passes pre-rendered sections to PlayerPage via RSC flight
        │
        ▼
player-page.tsx (client)
  ├── wraps sections in Remotion <Series> / <Series.Sequence>
  ├── renders interactive <Player> with controls
  └── "Export MP4" button ──► render-client.ts
                                 └── @remotion/web-renderer renderMediaOnWeb()
                                     (WebCodecs + HTML-in-canvas, fully in-browser)
```

**Vite plugin** (`vite-plugin.ts`): accepts `{ entry: './video.mdx' }`, generates virtual modules for the MDX source, user imports (eager glob of all `.tsx/.ts` in project root), and the Spiceflow app entry. Auto-injects `spiceflowPlugin` and `@vitejs/plugin-react`. HMR invalidates virtual modules and sends `rsc:update`.

**Components** (`components.tsx`): ported from [remocn](https://github.com/kapishdima/remocn). Includes `MeshGradientBg`, `BlurReveal`, `MaskedSlideReveal`, `StaggeredFadeUp`, `TerminalSimulator`, `GlassCodeBlock`, `ShimmerSweep`, `SpringPopIn`, `AnimatedChart`, `FeaturePill`. All use Remotion hooks (`useCurrentFrame`, `useVideoConfig`, `spring`, `interpolate`).

**Animation wrappers** (`mdx-video.tsx`): `FadeIn`, `FadeOut`, `ZoomIn`, `ZoomOut`, `SlideIn`, `SlideOut`, `BlurIn`, `BlurOut`, and `<Animate enter="fadeIn" exit="zoomOut">` shorthand.

**Media components**: `<Video>` and `<Audio>` from `@remotion/media` are available in MDX.

## Animation utilities — `springFromDuration`, `dspring`, and `EASE` presets

Always use `springFromDuration()` or `dspring()` instead of raw `spring({ config: { damping, stiffness, mass } })`. The physics parameters are hard to reason about; `(duration, bounce)` is intuitive and matches Framer Motion's API.

```tsx
import { spring } from 'remotion'
import { springFromDuration, dspring, EASE } from 'holocron-video'

// springFromDuration returns a config object for Remotion's spring()
const scale = spring({ frame, fps, config: springFromDuration(0.5, 0.3) })

// dspring is the shorthand that calls spring() internally
const opacity = dspring(frame, fps, 0.6, 0.25)  // 600ms, subtle bounce
const pop = dspring(frame, fps, 0.4)              // 400ms, no bounce

// EASE presets for interpolate()
const x = interpolate(frame, [0, 30], [0, 100], {
  easing: EASE.apple,  // the Apple 75% influence S-curve
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
})
```

**`bounce` parameter**: 0 = no overshoot (critically damped), 0.25 = subtle Apple-like, 0.5 = playful, 1 = maximum bounce.

**`EASE` presets**: `apple` (tight S-curve), `enterFast` (arrive with momentum), `exitSlow` (leave with gravity), `snappy` (social media punch), `cinematic` (luxurious slow).

Never use raw `spring({ config: { damping: 15, stiffness: 150 } })` in new code. Convert to `springFromDuration(duration, bounce)` instead.

## Preamble — composition-level content

Content **before the first `#` heading** in the MDX file is the **preamble**. It is rendered at the Remotion composition level, outside the `<Series>` that sequences sections. This means preamble content persists across all sections for the entire video duration, and renders in the background behind the section content (earlier DOM order = behind).

Use the preamble for:
- **Soundtracks**: `<Audio src="/music.mp3" />` plays for the full video
- **Ambient background video**: `<Video src="/bg.mp4" />` loops behind all sections
- **Global background color or image**: a `<Background>` with `<MeshGradientBg>` or a static color that shows behind every section without repeating it in each one
- **Persistent overlays**: watermarks, logos, or any element that should never disappear between sections

```mdx
---
fps: 30
bpm: 120
---

<Audio src="/soundtrack.mp3" />
<Video src="/ambient-bg.mp4" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

# First Section duration=5s

This content appears on top of the ambient background video.
```

Content inside sections (after a heading) is scoped to that section's `Series.Sequence` and only visible during that section's duration. Preamble content has no such scoping; it renders for the entire composition and sits behind the sections in z-order.

## Client-side rendering constraints

holocron-video always renders in the browser via `@remotion/web-renderer` (WebCodecs, no FFmpeg). This means every component and style must be compatible with the web-renderer's canvas-based emulation. Full list of limitations: https://remotion.dev/docs/client-side-rendering/limitations

### Things you must NOT do

**Media imports:**
- Do NOT import `<Audio>`, `<Video>`, or `<OffthreadVideo>` from `remotion`. Those are `Html5Audio`/`Html5Video` wrappers that throw in the web-renderer.
- Always import `<Audio>` and `<Video>` from `@remotion/media`.
- Do NOT use `<AnimatedEmoji>` from `@remotion/animated-emoji` (use `<Lottie>` instead).

| Component | Import from | Web-renderer support |
|---|---|---|
| `<Audio>` | `@remotion/media` | supported |
| `<Video>` | `@remotion/media` | supported |
| `<Audio>` | `remotion` (Html5Audio) | not supported |
| `<Video>` | `remotion` (Html5Video) | not supported |
| `<OffthreadVideo>` | `remotion` | not supported |

**CSS properties that do NOT work:**
- `backdrop-filter` (no frosted glass in exported video)
- `mix-blend-mode`, `background-blend-mode`
- `z-index` (control layer order via DOM order instead)
- `perspective`, `perspective-origin`, `transform-style`
- `text-decoration`
- `writing-mode`
- `object-position` (content is always centered)
- `inset` box shadows and shadow spread radius
- `background-image` with anything other than `linear-gradient` (no `radial-gradient`, no `url()`)
- `mask-image` with anything other than `linear-gradient`
- `clip-path: url()` referencing SVG `<clipPath>` elements
- `filter: url()` referencing inline SVG filters
- `corner-shape`

**Other constraints:**
- Filters (`blur`, `brightness`, etc.) do NOT work in Safari/WebKit. Use Chrome or Firefox.
- No multithreading; rendering is single-threaded.
- Background browser tabs throttle `requestAnimationFrame`, slowing down export. Keep the tab in the foreground during export.
- The `<HtmlInCanvas>` flag bypasses most CSS limitations (takes a full screenshot per frame) but is Chromium-only and experimental.

## Remotion resources

- **Remotion GitHub**: https://github.com/remotion-dev/remotion
- **Remotion docs**: https://www.remotion.dev/docs
- **Remotion LLM system prompt** (llms.txt): https://www.remotion.dev/llms.txt (no `llms-full.txt`)
- **Remotion AI code generation guide**: https://www.remotion.dev/docs/ai/generate

### Browser rendering (`@remotion/web-renderer`)

This package renders video entirely in the browser using WebCodecs (no server, no FFmpeg). It's what powers the "Export MP4" button.

- **Overview**: https://www.remotion.dev/docs/client-side-rendering
- **`renderMediaOnWeb()` API**: https://www.remotion.dev/docs/web-renderer/render-media-on-web
- **`renderStillOnWeb()` API**: https://www.remotion.dev/docs/web-renderer/render-still-on-web
- **HTML-in-canvas** (Chromium experimental): https://www.remotion.dev/docs/client-side-rendering/html-in-canvas
- **Progress tracker**: https://github.com/remotion-dev/remotion/issues/5913

To read the `@remotion/web-renderer` source code:

```bash
bunx opensrc path remotion-dev/remotion
# then read from: packages/web-renderer/
```

The web renderer implementation is at `packages/web-renderer/` in the Remotion monorepo. Key files:
- `packages/web-renderer/src/render-media-on-web.ts` (main entry)
- `packages/web-renderer/src/render-still-on-web.ts`
- `packages/web-renderer/src/compose.ts` (DOM tree walker that paints to OffscreenCanvas)
- `packages/web-renderer/src/html-in-canvas/` (Chromium `drawElementImage` path)

## Agent SDK (`window.egakiSDK`)

The SDK singleton is mounted on `window.egakiSDK` when the player page loads. Agents call it via Playwriter's `page.evaluate()` to screenshot frames or export video segments.

`page.evaluate()` cannot return binary types (`Blob`, `ArrayBuffer`), so the SDK returns **data URL strings**. Convert to a buffer with `fetch()`:

### Player controls

```js
// Seek to frame 120
playwriter -s 1 -e 'await state.page.evaluate(() => window.egakiSDK.seekTo(120))'

// Get current frame
playwriter -s 1 -e 'console.log(await state.page.evaluate(() => window.egakiSDK.getCurrentFrame()))'

// Play / pause / toggle
playwriter -s 1 -e 'await state.page.evaluate(() => window.egakiSDK.play())'
playwriter -s 1 -e 'await state.page.evaluate(() => window.egakiSDK.pause())'
```

### Screenshot a frame

```js
// Screenshot frame 60
playwriter -s 1 -e "$(cat <<'EOF'
const dataUrl = await state.page.evaluate(() => window.egakiSDK.screenshot({ frame: 60 }))
const buf = Buffer.from(await (await fetch(dataUrl)).arrayBuffer())
require("node:fs").writeFileSync("/tmp/frame-60.png", buf)
console.log("saved", buf.length, "bytes")
EOF
)"

// Screenshot whatever the player is currently showing
playwriter -s 1 -e "$(cat <<'EOF'
const dataUrl = await state.page.evaluate(() => window.egakiSDK.screenshotCurrentFrame())
const buf = Buffer.from(await (await fetch(dataUrl)).arrayBuffer())
require("node:fs").writeFileSync("/tmp/current.png", buf)
console.log("saved", buf.length, "bytes")
EOF
)"
```

### Export a video segment

For large videos, trigger a browser download instead of transferring via data URL:

```js
// Export frames 0-90 as MP4, downloads to ~/Downloads
playwriter -s 1 -e 'await state.page.evaluate(() => window.egakiSDK.export({ frameRange: [0, 90], path: "clip.mp4" }))'
```

To get the full video as a data URL (small compositions only):

```js
playwriter -s 1 -e "$(cat <<'EOF'
const dataUrl = await state.page.evaluate(() => window.egakiSDK.export({ frameRange: [0, 90], videoBitrate: "high" }))
const buf = Buffer.from(await (await fetch(dataUrl)).arrayBuffer())
require("node:fs").writeFileSync("/tmp/clip.mp4", buf)
console.log("saved", buf.length, "bytes")
EOF
)"
```

### Get composition info

```js
playwriter -s 1 -e 'console.log(await state.page.evaluate(() => window.egakiSDK.getInfo()))'
// { totalDuration: 450, fps: 30, width: 1920, height: 1080, sectionCount: 3, durationSeconds: 15, currentFrame: 0, isPlaying: false }
```

### Get element position

Maps a DOM element's position to composition coordinates (1920×1080 space). Returns pixels and percentages. The Player scales the composition to fit the viewport; this method accounts for that scale factor.

```js
// Seek to a specific frame, then get the position of an element
playwriter -s 1 -e "$(cat <<'EOF'
const pos = await state.page.evaluate(() => {
  window.egakiSDK.seekTo(0)
  const el = document.querySelector('.hero-logo')
  return window.egakiSDK.getElementPosition(el)
})
console.log(pos)
// { x: 810, y: 440, width: 300, height: 200,
//   xPercent: 42.19, yPercent: 40.74, widthPercent: 15.63, heightPercent: 18.52,
//   centerX: 960, centerY: 540, centerXPercent: 50, centerYPercent: 50 }
EOF
)"
```

**Layout transition between scenes.** Capture an element's position in scene 1, then use those coordinates to position the same element in scene 2 so it appears to stay in place (or animate from the old position to a new one).

```js
// 1. Seek to the last frame of scene 1, capture the logo position
// 2. Seek to the first frame of scene 2, capture the same element
// 3. The delta tells you how to animate the transition
playwriter -s 1 -e "$(cat <<'EOF'
const info = await state.page.evaluate(() => window.egakiSDK.getInfo())
const fps = info.fps

// Scene 1 ends at frame 149 (5s at 30fps), scene 2 starts at 150
const scene1Pos = await state.page.evaluate(() => {
  window.egakiSDK.seekTo(149)
  return window.egakiSDK.getElementPosition(document.querySelector('.product-card'))
})

const scene2Pos = await state.page.evaluate(() => {
  window.egakiSDK.seekTo(150)
  return window.egakiSDK.getElementPosition(document.querySelector('.product-card'))
})

console.log('Scene 1 position:', scene1Pos.xPercent + '%', scene1Pos.yPercent + '%')
console.log('Scene 2 position:', scene2Pos.xPercent + '%', scene2Pos.yPercent + '%')
console.log('Delta:', {
  dx: scene2Pos.x - scene1Pos.x,
  dy: scene2Pos.y - scene1Pos.y,
})
EOF
)"
```

### SDK methods

**Player controls** (synchronous, no await needed inside evaluate):
- **`seekTo(frame)`** — seek the player to a specific frame
- **`getCurrentFrame()`** — returns the frame the player is currently displaying
- **`play()`** / **`pause()`** / **`toggle()`** — playback control
- **`isPlaying()`** — returns boolean

**Element position** (synchronous):

**`getElementPosition(element)`** — maps a DOM element to composition coordinates. Returns `{ x, y, width, height, centerX, centerY }` in composition pixels, plus `*Percent` variants (0-100) for all six values. Useful for matching element positions across scenes to build layout transition animations.

**Rendering** (async, returns data URL strings):

**`screenshot(options?)`** — renders one frame via `renderStillOnWeb()`.
- `frame` (number, default 0)
- `format` ('png' | 'jpeg' | 'webp', default 'png')
- `quality` (0-1, for jpeg/webp)
- `scale` (number, default 1)
- `allowHtmlInCanvas` (boolean, default true)

**`screenshotCurrentFrame(options?)`** — same as `screenshot()` but captures whatever frame the player is on. Accepts the same options except `frame`.

**`export(options?)`** — renders video via `renderMediaOnWeb()`. If `path` is set, also triggers a browser download.
- `frameRange` (number | [number, number] | null, default null = all)
- `container` ('mp4' | 'webm' | 'mkv', default 'mp4')
- `videoCodec` ('h264' | 'vp8' | 'vp9' | 'av1')
- `videoBitrate` (number | 'very-low' | 'low' | 'medium' | 'high' | 'very-high')
- `audioCodec`, `audioBitrate`, `sampleRate`, `muted`, `transparent`
- `scale`, `keyframeIntervalInSeconds`, `hardwareAcceleration`
- `path` (string — triggers download)
- `onProgress` (callback)

**`getInfo()`** — returns `{ totalDuration, fps, width, height, sectionCount, durationSeconds, currentFrame, isPlaying }`.

All option types are re-exported from `@remotion/web-renderer`. See Remotion docs for full details on each parameter.

## Docs

- **[Lottie to Remotion conversion](docs/lottie-to-remotion.md)**: how to read a Lottie JSON file and reproduce its animations using Remotion's `interpolate()` and `Easing.bezier()`. Covers the full keyframe/easing model, field mapping, overshoot, hold keyframes, per-segment easing, and a conversion algorithm.

## Key files

| File | Role |
|---|---|
| `src/vite-plugin.ts` | Vite plugin entry, virtual modules, HMR |
| `src/app.tsx` | Spiceflow RSC server, MDX parsing + rendering |
| `src/mdx-parse.ts` | Server-safe section splitting and duration parsing |
| `src/mdx-video.tsx` | Client animation components + re-exports |
| `src/components.tsx` | Visual components (remocn ports) |
| `src/player-page.tsx` | Client Player wrapper + export UI |
| `src/render-client.ts` | In-browser MP4 export via `@remotion/web-renderer` |
| `src/sdk.ts` | Agent SDK singleton (`window.egakiSDK`) |
