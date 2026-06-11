# Lottie to Remotion Conversion

How to read a Lottie JSON file and reproduce its animations in Remotion. The `keyframes()` function in this package wraps Remotion's `interpolate()` + `Easing.bezier()` with a clean, type-safe API that maps directly to Lottie's keyframe model.

```ts
import { keyframes, fromLottieProperty } from 'holocron-video'
```

## Quick example

```ts
import { useCurrentFrame } from 'remotion'
import { keyframes } from 'holocron-video'

const frame = useCurrentFrame()

const opacity = keyframes(frame, [
  { time: 0,  value: 0,   easing: [0.333, 0, 0.667, 1] },
  { time: 30, value: 1 },
])

const scale = keyframes(frame, [
  { time: 0,  value: 0.5, easing: [0.34, 1.56, 0.64, 1] },  // overshoot
  { time: 20, value: 1 },
])
```

## `keyframes()` API

```ts
function keyframes(frame: number, kfs: Keyframe<number>[]): number
function keyframes(frame: number, kfs: Keyframe<number[]>[], options?: KeyframesDimensionOptions): number[]
```

Evaluates a keyframed animation at the given frame. Accepts scalar or vector values.

### `Keyframe<T>` fields

| Field | Type | Description |
|-------|------|-------------|
| `time` | `number` | Frame number where this keyframe occurs |
| `value` | `T` | Value at this keyframe. Scalar (`number`) or vector (`number[]`) |
| `easing` | `BezierCurve` | `[x1, y1, x2, y2]` bezier curve for transition to next keyframe. Omit for linear. |
| `hold` | `boolean` | If true, value holds constant until next keyframe (step function). Overrides `easing`. |

`BezierCurve` is `[x1: number, y1: number, x2: number, y2: number]`, same as CSS `cubic-bezier()`.

### Scalar keyframes

```ts
const opacity = keyframes(frame, [
  { time: 0,  value: 0,   easing: [0.333, 0, 0.667, 1] },
  { time: 30, value: 1 },
])
```

### Vector keyframes

```ts
const [x, y] = keyframes(frame, [
  { time: 0,  value: [0, 0],     easing: [0.333, 0, 0.667, 1] },
  { time: 30, value: [200, 400] },
])
```

### Hold (step function)

```ts
const visible = keyframes(frame, [
  { time: 0,  value: 0, hold: true },
  { time: 30, value: 1 },
])
// Returns 0 for frames 0-29, then 1 at frame 30
```

### Overshoot

Bezier y values outside [0, 1] create overshoot/anticipation:

```ts
const scale = keyframes(frame, [
  { time: 0,  value: 0,   easing: [0.34, 1.56, 0.64, 1] },
  { time: 30, value: 1 },
])
// Value will exceed 1 mid-animation before settling at 1
```

### Per-dimension easing

For vector properties where each dimension needs a different curve:

```ts
const [x, y] = keyframes(frame, [
  { time: 0,  value: [0, 0],     easing: [0.3, 0, 0.7, 1] },
  { time: 30, value: [200, 400] },
], {
  dimensionEasing: [
    [0.3, 0, 0.7, 1],       // x-dimension curve
    [0.5, 0.2, 0.8, 0.9],   // y-dimension curve (overrides keyframe easing)
  ],
})
```

When `dimensionEasing[dim]` is `undefined`, that dimension falls back to the keyframe-level `easing`.

### Multi-keyframe sequences

Each keyframe's `easing` controls the transition to the next keyframe, so each segment can have a different curve:

```ts
const value = keyframes(frame, [
  { time: 0,  value: 0,   easing: [0.333, 0, 0.667, 1] },
  { time: 30, value: 200, easing: [0.25, 0.1, 0.25, 1] },
  { time: 60, value: 50 },
])
```

## Loading from Lottie JSON

`fromLottieProperty()` converts a raw Lottie animated property (`{ a, k }`) into a `Keyframe[]` array:

```ts
import { keyframes, fromLottieProperty } from 'holocron-video'
import lottieJson from './animation.json'

const frame = useCurrentFrame()

// Convert Lottie opacity property to keyframes
const opacityKfs = fromLottieProperty(lottieJson.layers[0].ks.o)
const opacity = keyframes(frame, opacityKfs)

// Convert Lottie position property (vector)
const posKfs = fromLottieProperty(lottieJson.layers[0].ks.p)
const [x, y] = keyframes(frame, posKfs)
```

For vector properties with per-dimension easing, use `extractLottieDimensionEasing()`:

```ts
import { keyframes, fromLottieProperty, extractLottieDimensionEasing } from 'holocron-video'

const posProperty = lottieJson.layers[0].ks.p
const posKfs = fromLottieProperty(posProperty)

// Extract per-dimension easing for each segment
const dimEasing = extractLottieDimensionEasing(posProperty, 0) // segment index 0
const [x, y] = keyframes(frame, posKfs, { dimensionEasing: dimEasing })
```

## Lottie JSON structure

A Lottie file is a single JSON object (the **Animation**) describing a vector animation. It was designed around After Effects' render model.

```
Animation (root)
  ver ......... spec version (6-digit MMmmpp)
  nm .......... human-readable name
  w / h ....... canvas width and height in pixels
  fr .......... framerate (frames per second)
  ip .......... in-point (start frame, usually 0)
  op .......... out-point (end frame / loop point)
  layers ...... array of Layer objects (the visual stack)
  assets ...... reusable assets (precomps, images, fonts, audio)
  markers ..... named cue points
  slots ....... slot-based property replacement dictionary
```

**Duration** is in frames, not seconds:

```
duration_seconds = (op - ip) / fr
```

`"ip": 0, "op": 60, "fr": 30` is a 2-second animation at 30 fps.

**Layers** are the building blocks. Types: shape, text, image, precomp (nested composition), solid, null (invisible transform anchor). Each layer has transform properties (position, rotation, scale, opacity), blend modes, masks, and matte settings.

**Assets** are reusable resources referenced by layers. A precomposition is itself a full Composition object with its own `layers` array, enabling nested animations.

Spec reference: https://lottie.github.io/lottie-spec/latest/specs/composition/

## Lottie animated properties and keyframes

Every animatable property in Lottie has this shape:

```json
{
  "a": 1,
  "k": [
    { "t": 0,  "s": [0],   "o": {"x": [0.333], "y": [0]},   "i": {"x": [0.667], "y": [1]} },
    { "t": 30, "s": [200] }
  ]
}
```

When `a` is `0`, `k` holds the static value directly. When `a` is `1`, `k` is an array of keyframes sorted by ascending frame number `t`.

### Lottie keyframe fields

| Field | Type | Meaning |
|-------|------|---------|
| `t` | number | Frame number |
| `s` | array | Value at this keyframe (vector, scalar, color, bezier shape) |
| `h` | 0 or 1 | Hold. If 1, value stays constant until the next keyframe (step function) |
| `o` | `{x, y}` | **Out tangent**: easing handle leaving this keyframe |
| `i` | `{x, y}` | **In tangent**: easing handle entering the next keyframe |

The last keyframe in a sequence has no `i`/`o` (there's nothing to interpolate toward).

Spec reference: https://lottie.github.io/lottie-spec/latest/specs/properties/

## Easing: cubic bezier

Lottie's `o` and `i` form a **cubic bezier curve** with fixed endpoints `[0,0]` and `[1,1]`:

- **X axis** = normalized time (0 = current keyframe, 1 = next keyframe)
- **Y axis** = normalized value (0 = current value, 1 = next value)

`o` (out tangent) is the first control point, `i` (in tangent) is the second.

**Y values are not clamped to [0,1].** Supernormal values (y > 1 or y < 0) create overshoot and anticipation effects.

**The mapping rule to `keyframes()`:** Lottie's `o.x, o.y` become bezier points 1-2, and `i.x, i.y` become points 3-4.

```
Lottie: o: {x: 0.333, y: 0}, i: {x: 0.667, y: 1}
   ──►  easing: [0.333, 0, 0.667, 1]
```

This is the same mapping as CSS `cubic-bezier(x1, y1, x2, y2)`.

### Position spatial tangents

Position keyframes in Lottie also have `ti` (value in tangent) and `to` (value out tangent) that define a **bezier motion path** through 2D space. This is separate from the timing curve and controls the spatial trajectory of movement.

Remotion has no built-in spatial path interpolation. For simple cases (straight-line motion), `ti`/`to` can be ignored. For curved motion paths, you'd need to evaluate a cubic bezier path at the eased time value.

## Feature parity table

| Lottie concept | `keyframes()` equivalent |
|---|---|
| Cubic bezier (`i`/`o` handles) | `easing: [x1, y1, x2, y2]` |
| Overshoot (supernormal y) | `easing: [0.34, 1.56, 0.64, 1]` |
| Hold keyframe (`h: 1`) | `hold: true` |
| Multi-keyframe sequence | Multiple entries in the array, each with its own `easing` |
| Per-dimension easing | `dimensionEasing` option |
| Raw Lottie JSON property | `fromLottieProperty()` converter |
| Linear | Omit `easing` (default) |

## What Remotion adds beyond Lottie

Remotion's `spring()` provides physics-based animation that Lottie can't express with bezier curves alone. Springs simulate real mass/damping/stiffness and settle naturally without a fixed duration.

```ts
import { spring, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

const frame = useCurrentFrame()
const { fps } = useVideoConfig()

const driver = spring({ frame, fps, config: { damping: 12, stiffness: 200 } })
const scale = interpolate(driver, [0, 1], [0.5, 1])
```

Use `spring()` when you want organic, physics-based motion. Use `keyframes()` when you need precise, designable timing curves, which is the case when converting from Lottie or working with After Effects-style keyframe animations.
