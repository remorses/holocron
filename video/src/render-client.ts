/**
 * Client-side rendering entry point.
 * Renders any Remotion composition entirely in the browser using WebCodecs.
 *
 * When allowHtmlInCanvas is true, the scaffold's layoutsubtree canvas sets
 * visibility:visible (required by Chrome's paint pipeline), which makes the
 * rendering composition visible on the page. We inject a <style> that pushes
 * the scaffold wrapper offscreen so the user never sees it.
 */

import { renderMediaOnWeb } from '@remotion/web-renderer'

/**
 * Hide the web-renderer scaffold during export. The scaffold wrapper uses
 * position:fixed + visibility:hidden + z-index:-9999, but allowHtmlInCanvas
 * sets visibility:visible on an inner canvas, making it peek through.
 * Moving the wrapper offscreen with translate keeps Chrome's paint pipeline
 * happy (element is still "visible" in the CSS sense) while hiding it from
 * the viewport.
 */
function injectScaffoldHider(): () => void {
  const style = document.createElement('style')
  style.textContent = `
    body > div[style*="z-index: -9999"] {
      translate: -200vw 0 !important;
    }
  `
  document.head.appendChild(style)
  return () => style.remove()
}

export async function renderInBrowser(options: {
  component: React.FC
  durationInFrames: number
  fps?: number
  width?: number
  height?: number
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}) {
  const removeHider = injectScaffoldHider()

  try {
    const { getBlob } = await renderMediaOnWeb({
      composition: {
        component: options.component,
        durationInFrames: options.durationInFrames,
        fps: options.fps ?? 30,
        width: options.width ?? 1920,
        height: options.height ?? 1080,
        id: 'MdxVideo',
        calculateMetadata: null,
      },
      inputProps: {},
      container: 'mp4',
      videoCodec: 'h264',
      videoBitrate: 'high',
      allowHtmlInCanvas: true,
      signal: options.signal,
      onProgress: ({ progress }) => {
        options.onProgress?.(progress)
      },
    })

    return getBlob()
  } finally {
    removeHider()
  }
}
