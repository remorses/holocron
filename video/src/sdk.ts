/**
 * Client-side SDK singleton for agent-driven rendering.
 *
 * Exposes screenshot() and export() methods on window.egakiSDK so agents
 * can call them via Playwriter's page.evaluate(). PlayerPage registers
 * the live composition on mount; the SDK forwards calls to
 * @remotion/web-renderer's renderStillOnWeb / renderMediaOnWeb.
 *
 * Returns data URLs (not Blobs) because page.evaluate() cannot serialize
 * binary types across the CDP boundary. Agents decode the data URL in
 * the Playwriter sandbox with fetch().then(r => r.arrayBuffer()).
 */

import { renderStillOnWeb, renderMediaOnWeb } from '@remotion/web-renderer'
import type {
  FrameRange,
  RenderStillOnWebImageFormat,
  WebRendererContainer,
  WebRendererVideoCodec,
  WebRendererAudioCodec,
  WebRendererQuality,
  WebRendererHardwareAcceleration,
  RenderMediaOnWebProgressCallback,
} from '@remotion/web-renderer'

// Re-export Remotion types so consumers can reference them
export type {
  FrameRange,
  RenderStillOnWebImageFormat,
  WebRendererContainer,
  WebRendererVideoCodec,
  WebRendererAudioCodec,
  WebRendererQuality,
  WebRendererHardwareAcceleration,
  RenderMediaOnWebProgressCallback,
}

// ---------------------------------------------------------------------------
// Composition registration — PlayerPage calls this on mount
// ---------------------------------------------------------------------------

interface PlayerHandle {
  seekTo: (frame: number) => void
  getCurrentFrame: () => number
  play: () => void
  pause: () => void
  toggle: () => void
  isPlaying: () => boolean
}

interface CompositionConfig {
  component: React.FC
  totalDuration: number
  fps: number
  width: number
  height: number
  sectionCount: number
  playerRef: { current: PlayerHandle | null }
  /** The DOM element wrapping the Remotion Player (used for coordinate mapping) */
  playerContainerRef: { current: HTMLElement | null }
}

// ---------------------------------------------------------------------------
// SDK option types
// ---------------------------------------------------------------------------

export interface ScreenshotOptions {
  /** Frame number to capture (0-indexed). Default 0. */
  frame?: number
  /** Output format. Default 'png'. */
  format?: RenderStillOnWebImageFormat
  /** Encoder quality for jpeg/webp, 0-1. Ignored for png. */
  quality?: number
  /** Scale multiplier. Default 1. */
  scale?: number
  /** Use Chromium experimental HTML-in-canvas. Default true. */
  allowHtmlInCanvas?: boolean
}

export interface ExportOptions {
  /** Single frame or frame range. null = all frames. */
  frameRange?: FrameRange | null
  /** Container format. Default 'mp4'. */
  container?: WebRendererContainer
  /** Video codec. Default depends on container. */
  videoCodec?: WebRendererVideoCodec
  /** Video bitrate — number (bps) or preset name. Default 'high'. */
  videoBitrate?: number | WebRendererQuality
  /** Audio codec. Default depends on container. */
  audioCodec?: WebRendererAudioCodec
  /** Audio bitrate — number (bps) or preset name. */
  audioBitrate?: number | WebRendererQuality
  /** Audio sample rate in Hz. Default 48000. */
  sampleRate?: number
  /** Strip audio. Default false. */
  muted?: boolean
  /** Encode with alpha channel (webm/mkv only). Default false. */
  transparent?: boolean
  /** Scale multiplier. Default 1. */
  scale?: number
  /** Seconds between keyframes. Default 5. */
  keyframeIntervalInSeconds?: number
  /** Hardware acceleration preference. */
  hardwareAcceleration?: WebRendererHardwareAcceleration
  /** Use Chromium experimental HTML-in-canvas. Default true. */
  allowHtmlInCanvas?: boolean
  /** If set, triggers a browser download with this filename. */
  path?: string
  /** Progress callback. */
  onProgress?: RenderMediaOnWebProgressCallback
}

export interface CompositionInfo {
  totalDuration: number
  fps: number
  width: number
  height: number
  sectionCount: number
  /** Duration in seconds */
  durationSeconds: number
  /** Current frame the player is on */
  currentFrame: number
  /** Whether the player is currently playing */
  isPlaying: boolean
}

export interface ElementPosition {
  /** X offset from the left edge of the composition, in composition pixels */
  x: number
  /** Y offset from the top edge of the composition, in composition pixels */
  y: number
  /** Element width in composition pixels */
  width: number
  /** Element height in composition pixels */
  height: number
  /** X offset as a percentage of composition width (0-100) */
  xPercent: number
  /** Y offset as a percentage of composition height (0-100) */
  yPercent: number
  /** Element width as a percentage of composition width (0-100) */
  widthPercent: number
  /** Element height as a percentage of composition height (0-100) */
  heightPercent: number
  /** Center X in composition pixels */
  centerX: number
  /** Center Y in composition pixels */
  centerY: number
  /** Center X as a percentage of composition width (0-100) */
  centerXPercent: number
  /** Center Y as a percentage of composition height (0-100) */
  centerYPercent: number
}

// ---------------------------------------------------------------------------
// Helper: blob → data URL
// ---------------------------------------------------------------------------

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// EgakiSDK class
// ---------------------------------------------------------------------------

class EgakiSDK {
  private config: CompositionConfig | null = null

  /** Called by PlayerPage to wire the SDK to the live composition. */
  register(config: CompositionConfig) {
    this.config = config
  }

  private getConfig(): CompositionConfig {
    if (!this.config) {
      throw new Error(
        'egakiSDK: no composition registered. ' +
        'Make sure the video page is loaded and PlayerPage has mounted.',
      )
    }
    return this.config
  }

  private getPlayer(): PlayerHandle {
    const player = this.getConfig().playerRef.current
    if (!player) {
      throw new Error(
        'egakiSDK: player ref is null. The <Player> component has not mounted yet.',
      )
    }
    return player
  }

  // -------------------------------------------------------------------------
  // Player controls
  // -------------------------------------------------------------------------

  /** Seek the player to a specific frame (0-indexed). */
  seekTo(frame: number) {
    this.getPlayer().seekTo(frame)
  }

  /** Returns the frame number the player is currently displaying. */
  getCurrentFrame(): number {
    return this.getPlayer().getCurrentFrame()
  }

  /** Start playback. */
  play() {
    this.getPlayer().play()
  }

  /** Pause playback. */
  pause() {
    this.getPlayer().pause()
  }

  /** Toggle play/pause. */
  toggle() {
    this.getPlayer().toggle()
  }

  /** Whether the player is currently playing. */
  isPlaying(): boolean {
    return this.getPlayer().isPlaying()
  }

  // -------------------------------------------------------------------------
  // Info
  // -------------------------------------------------------------------------

  /** Returns metadata about the current composition and player state. */
  getInfo(): CompositionInfo {
    const c = this.getConfig()
    const player = c.playerRef.current
    return {
      totalDuration: c.totalDuration,
      fps: c.fps,
      width: c.width,
      height: c.height,
      sectionCount: c.sectionCount,
      durationSeconds: c.totalDuration / c.fps,
      currentFrame: player?.getCurrentFrame() ?? 0,
      isPlaying: player?.isPlaying() ?? false,
    }
  }

  // -------------------------------------------------------------------------
  // Element position
  // -------------------------------------------------------------------------

  /**
   * Get a DOM element's position mapped to composition coordinates.
   *
   * The Remotion Player scales the 1920×1080 composition to fit the browser
   * viewport. This method reads the element's bounding rect, computes the
   * scale factor from the player container, and returns position/size in
   * both composition pixels and percentages.
   *
   * Use case: match an element's position across scenes (e.g. a logo in
   * scene 1 should animate to the same spot in scene 2).
   */
  getElementPosition(element: Element): ElementPosition {
    const c = this.getConfig()
    const container = c.playerContainerRef.current
    if (!container) {
      throw new Error(
        'egakiSDK: player container ref is null. The player has not mounted yet.',
      )
    }

    // The Remotion Player renders inside the container. Find the actual
    // player viewport element — it's the first child with the composition's
    // aspect ratio, or just use the container itself as the reference frame.
    // The container wraps the <Player> which renders at 100% width and scales
    // the composition to fit.
    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()

    // Scale factor: how many display pixels per composition pixel.
    // The Player scales uniformly (preserves aspect ratio), so we derive
    // the scale from width. The composition fills the container width and
    // the height is determined by aspect ratio.
    const scale = containerRect.width / c.width

    const x = (elementRect.left - containerRect.left) / scale
    const y = (elementRect.top - containerRect.top) / scale
    const width = elementRect.width / scale
    const height = elementRect.height / scale
    const centerX = x + width / 2
    const centerY = y + height / 2

    return {
      x,
      y,
      width,
      height,
      xPercent: (x / c.width) * 100,
      yPercent: (y / c.height) * 100,
      widthPercent: (width / c.width) * 100,
      heightPercent: (height / c.height) * 100,
      centerX,
      centerY,
      centerXPercent: (centerX / c.width) * 100,
      centerYPercent: (centerY / c.height) * 100,
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /** Screenshot whatever frame the player is currently showing. */
  async screenshotCurrentFrame(
    options: Omit<ScreenshotOptions, 'frame'> = {},
  ): Promise<string> {
    return this.screenshot({ ...options, frame: this.getCurrentFrame() })
  }

  /** Render a single frame and return a data URL string. */
  async screenshot(options: ScreenshotOptions = {}): Promise<string> {
    const c = this.getConfig()
    const format = options.format ?? 'png'

    const still = await renderStillOnWeb({
      composition: {
        component: c.component,
        durationInFrames: c.totalDuration,
        fps: c.fps,
        width: c.width,
        height: c.height,
        id: 'EgakiSDK',
        calculateMetadata: null,
      },
      frame: options.frame ?? 0,
      scale: options.scale,
      allowHtmlInCanvas: options.allowHtmlInCanvas ?? true,
    })

    const blob = await still.blob({
      format,
      quality: options.quality,
    })
    return blobToDataUrl(blob)
  }

  /** Render a video (or segment) and return a data URL string.
   *  If `path` is set, also triggers a browser download. */
  async export(options: ExportOptions = {}): Promise<string> {
    const c = this.getConfig()

    const { getBlob } = await renderMediaOnWeb({
      composition: {
        component: c.component,
        durationInFrames: c.totalDuration,
        fps: c.fps,
        width: c.width,
        height: c.height,
        id: 'EgakiSDK',
        calculateMetadata: null,
      },
      inputProps: {},
      container: options.container ?? 'mp4',
      videoCodec: options.videoCodec,
      videoBitrate: options.videoBitrate ?? 'high',
      audioCodec: options.audioCodec,
      audioBitrate: options.audioBitrate,
      sampleRate: options.sampleRate,
      muted: options.muted,
      transparent: options.transparent,
      scale: options.scale,
      keyframeIntervalInSeconds: options.keyframeIntervalInSeconds,
      hardwareAcceleration: options.hardwareAcceleration,
      frameRange: options.frameRange ?? undefined,
      allowHtmlInCanvas: options.allowHtmlInCanvas ?? true,
      onProgress: options.onProgress,
    })

    const blob = await getBlob()

    if (options.path) {
      triggerDownload(blob, options.path)
    }

    return blobToDataUrl(blob)
  }
}

// ---------------------------------------------------------------------------
// Singleton — mounted on window for Playwriter access
// ---------------------------------------------------------------------------

export const egakiSDK = new EgakiSDK()

if (typeof window !== 'undefined') {
  ;(window as any).egakiSDK = egakiSDK
}
