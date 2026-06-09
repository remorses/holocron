/**
 * Client-side rendering entry point.
 * Renders the Holocron video entirely in the browser using WebCodecs.
 *
 * When allowHtmlInCanvas is true, the scaffold's layoutsubtree canvas sets
 * visibility:visible (required by Chrome's paint pipeline), which makes the
 * rendering composition visible on the page. We inject a <style> that pushes
 * the scaffold wrapper offscreen so the user never sees it.
 *
 * Usage: import { renderInBrowser } from './render-client'
 *        const blob = await renderInBrowser()
 *        // download blob as .mp4
 */

import { renderMediaOnWeb } from '@remotion/web-renderer'
import { HolocronVideo } from './holocron-video'

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

export async function renderInBrowser(options?: {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}) {
  const removeHider = injectScaffoldHider()

  try {
    const { getBlob } = await renderMediaOnWeb({
      composition: {
        component: HolocronVideo,
        durationInFrames: 1230,
        fps: 30,
        width: 1920,
        height: 1080,
        id: 'HolocronVideo',
        calculateMetadata: null,
      },
      inputProps: {},
      container: 'mp4',
      videoCodec: 'h264',
      videoBitrate: 'high',
      allowHtmlInCanvas: true,
      signal: options?.signal,
      onProgress: ({ progress }) => {
        options?.onProgress?.(progress)
      },
    })

    return getBlob()
  } finally {
    removeHider()
  }
}

/** Download the rendered video as a file */
export async function renderAndDownload(filename = 'holocron.mp4') {
  const blob = await renderInBrowser({
    onProgress: (p) => console.log(`Rendering: ${Math.round(p * 100)}%`),
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
