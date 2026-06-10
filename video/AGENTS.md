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

**Media components**: `<Video>` and `<Audio>` from `@remotion/media` are available in MDX. `soundtrack` frontmatter field plays audio for the entire composition.

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

### SDK methods

**Player controls** (synchronous, no await needed inside evaluate):
- **`seekTo(frame)`** — seek the player to a specific frame
- **`getCurrentFrame()`** — returns the frame the player is currently displaying
- **`play()`** / **`pause()`** / **`toggle()`** — playback control
- **`isPlaying()`** — returns boolean

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
