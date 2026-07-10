/**
 * Browser automation tools for the Holocron AI chat widget.
 *
 * Generates ChatToolDefinition[] from page declarations. All tool names
 * are prefixed with `browser_` to prevent collisions with user-defined tools.
 *
 * Tools: browser_navigate, browser_type, browser_select,
 *        browser_read_page, browser_highlight
 *
 * Highlight overlay: browser_highlight shows an onboarding-style spotlight
 * over a DOM element with an optional description card. The overlay is
 * persistent — it stays visible until the user dismisses it via the ×
 * button or by clicking the highlighted element (or the element leaves
 * the DOM, e.g. on navigation). The tool returns immediately; it never
 * blocks the AI loop waiting for dismissal. browser_type flashes a very
 * brief ring (no page dim) before acting so the user can see what the AI
 * is interacting with. The overlay renders on `document.body` (outside
 * any shadow DOM) with inline styles so it works on any host page.
 *
 * Design decision: there is no browser_click tool. Instead of clicking
 * elements for the user, the AI highlights them with browser_highlight and
 * tells the user what to click. This keeps the user in control and avoids
 * unexpected side effects from programmatic clicks.
 */

'use client'

import { toolDescriptionProperty } from './define-tool.ts'
import type { ChatToolDefinition, ToolApprovalCheck } from './define-tool.ts'
import { chatWidgetStore } from './chat-widget-store.ts'

export type PageAction = {
  name: string
  description: string
  selector: string
}

export type PageDefinition = {
  path: string
  description: string
  actions?: PageAction[]
}

export type PageToolsOptions = {
  /**
   * Override the navigation function for this tool set.
   * If not provided, reads from chatWidgetStore.navigate (set via
   * ChatWidget's `navigate` prop or HolocronChatBridge).
   */
  navigate?: (path: string) => void | Promise<void>
}

// ── DOM helpers ─────────────────────────────────────────────────────

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'HEAD', 'NOSCRIPT', 'SVG'])

const cssEscape: (value: string) => string =
  globalThis.CSS?.escape ?? ((v) => v.replaceAll('"', '\\"'))

/** Check if an element is visible and actionable (not hidden, not disabled, not inert). */
function isActionable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  // Skip hidden inputs
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false
  // Skip disabled elements
  if ('disabled' in el && (el as any).disabled) return false
  // Skip hidden/inert ancestors
  if (el.hidden || el.ariaHidden === 'true') return false
  if (el.closest('[hidden], [aria-hidden="true"], [inert]')) return false
  // Use checkVisibility if available (modern browsers), fallback to getClientRects
  if (typeof el.checkVisibility === 'function') return el.checkVisibility()
  return el.getClientRects().length > 0
}

/** Build a stable CSS selector for an element, preferring data-*, name, id. */
function stableSelector(el: Element): string {
  // Prefer data-action or data-testid
  for (const attr of ['data-action', 'data-testid', 'data-id']) {
    const val = el.getAttribute(attr)
    if (val) return `[${attr}="${cssEscape(val)}"]`
  }
  // Prefer name attribute (for inputs)
  const name = el.getAttribute('name')
  if (name) return `${el.tagName.toLowerCase()}[name="${cssEscape(name)}"]`
  // Prefer id
  if (el.id) return `#${cssEscape(el.id)}`
  // Fallback: tag.class:nth-of-type
  const tag = el.tagName.toLowerCase()
  const parent = el.parentElement
  if (!parent) return tag
  const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName)
  const index = siblings.indexOf(el) + 1
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : ''
  return siblings.length > 1
    ? `${tag}${cls}:nth-of-type(${index})`
    : `${tag}${cls}`
}

/** Get accessible label for an element: aria-label > associated label > placeholder > name > text. */
function getAccessibleLabel(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel.slice(0, 80)
  // Check for associated <label>
  if (el.id) {
    const label = document.querySelector(`label[for="${cssEscape(el.id)}"]`)
    if (label?.textContent) return label.textContent.trim().slice(0, 80)
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.placeholder || el.name || ''
  }
  return ''
}

function getVisibleText(el: Element): string {
  return (el.textContent || '').trim().slice(0, 80)
}

/**
 * Approval check for DOM-mutating tools: an element inside a container with
 * `data-holocron-requires-approval` needs user approval before the tool runs.
 * The attribute value (if any) becomes the confirmation message.
 */
function domNeedsApproval({ input }: { input: Record<string, unknown> }): ToolApprovalCheck {
  const selector = input.selector as string
  const holder = document.querySelector(selector)?.closest('[data-holocron-requires-approval]')
  if (!holder) return false
  return { message: holder.getAttribute('data-holocron-requires-approval') || undefined }
}

/** Shared `description` input property: shown as the tool call label in the
 *  chat UI and in approval prompts. Re-exported from define-tool.ts. */
const descriptionProperty = toolDescriptionProperty

/** Walk DOM and collect interactive elements as structured text. */
function readInteractiveElements(): string {
  const lines: string[] = [`Current path: ${location.pathname}`]
  lines.push('')
  lines.push('Interactive elements:')

  const elements = document.querySelectorAll(
    'a[href], button, input, select, textarea, [role="button"], [role="link"]',
  )
  let totalChars = 0
  const MAX_CHARS = 4000

  for (const el of elements) {
    if (totalChars > MAX_CHARS) break
    if (SKIP_TAGS.has(el.tagName)) continue
    if (!isActionable(el)) continue
    // Skip elements inside skipped containers
    if (el.closest('script, style, noscript, svg')) continue

    const tag = el.tagName.toLowerCase()
    const selector = stableSelector(el)
    let line: string

    if (tag === 'input' || tag === 'textarea') {
      const input = el as HTMLInputElement | HTMLTextAreaElement
      const type = input.type || 'text'
      const label = getAccessibleLabel(el) || input.placeholder || input.name || ''
      const val = input.value ? ` value="${input.value.slice(0, 60)}"` : ''
      line = `- ${tag}[type="${type}"] "${label}" [${selector}]${val}`
    } else if (tag === 'select') {
      const select = el as HTMLSelectElement
      const label = getAccessibleLabel(el) || select.name || getVisibleText(select)
      const val = select.value ? ` value="${select.value}"` : ''
      line = `- select "${label}" [${selector}]${val}`
    } else if (tag === 'a') {
      const text = getVisibleText(el)
      const href = el.getAttribute('href') || ''
      line = `- a "${text}" [href="${href}"] [${selector}]`
    } else {
      const text = getVisibleText(el)
      const role = el.getAttribute('role') || tag
      line = `- ${role} "${text}" [${selector}]`
    }

    if (el.closest('[data-holocron-requires-approval]')) {
      line += ' (requires user approval)'
    }

    totalChars += line.length + 1
    lines.push(line)
  }

  return lines.join('\n')
}

// ── Highlight overlay ───────────────────────────────────────────────

const HIGHLIGHT_ATTR = 'data-holocron-highlight-overlay'
const HIGHLIGHT_PADDING = 8
const HIGHLIGHT_RADIUS = 8
const HIGHLIGHT_Z = 2147483647
const HIGHLIGHT_FADE_MS = 180
/** Glow ring around the highlighted element (indigo, subtle). */
const HIGHLIGHT_RING =
  '0 0 0 2px rgba(99, 102, 241, 0.65), 0 0 18px 2px rgba(99, 102, 241, 0.25)'

/**
 * Teardown for the currently visible highlight. Removes the overlay DOM
 * and all listeners/rAF loops. Only one highlight can be visible at a time.
 */
let activeHighlightTeardown: (() => void) | null = null

/** Remove any existing highlight overlay from the DOM. */
function clearHighlight(): void {
  activeHighlightTeardown?.()
  activeHighlightTeardown = null
}

/**
 * Show a persistent onboarding-style spotlight overlay on a DOM element.
 *
 * Creates a full-viewport backdrop with a cutout around the target element
 * using the CSS outline trick (a positioned div with `outline: 9999px solid`).
 * The backdrop is a light dim so the page stays readable. An optional
 * description card is positioned below or above the element.
 *
 * The overlay has NO auto-dismiss timer. It stays until:
 *   - the user clicks the × close button,
 *   - the user clicks the highlighted element itself (task done), or
 *   - the element leaves the DOM (e.g. client-side navigation), or
 *   - another highlight replaces it.
 *
 * Position is tracked every frame via requestAnimationFrame so the
 * spotlight follows the element through scrolling, resizes, and layout
 * shifts (including the smooth scrollIntoView right before showing).
 */
function showHighlight(el: Element, options: { message?: string } = {}): void {
  const { message } = options

  clearHighlight()

  // Container: fixed, full viewport, pointer-events none so the user can
  // still click the highlighted element through the overlay.
  const container = document.createElement('div')
  container.setAttribute(HIGHLIGHT_ATTR, '')
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    zIndex: String(HIGHLIGHT_Z),
    pointerEvents: 'none',
    opacity: '0',
    transition: `opacity ${HIGHLIGHT_FADE_MS}ms ease`,
  } satisfies Partial<CSSStyleDeclaration>)

  // Spotlight cutout: positioned over the element with a massive outline
  // that covers the rest of the viewport as a light dim backdrop.
  const spotlight = document.createElement('div')
  Object.assign(spotlight.style, {
    position: 'fixed',
    borderRadius: `${HIGHLIGHT_RADIUS}px`,
    outline: '9999px solid rgba(0, 0, 0, 0.15)',
    boxShadow: HIGHLIGHT_RING,
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(spotlight)

  // × close button — dismisses the overlay. Lives inside the description
  // card when a message is shown, otherwise floats at the spotlight corner.
  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.setAttribute('aria-label', 'Dismiss highlight')
  closeButton.textContent = '×'
  Object.assign(closeButton.style, {
    pointerEvents: 'auto',
    cursor: 'pointer',
    border: 'none',
    padding: '0',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    fontSize: '15px',
    lineHeight: '22px',
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } satisfies Partial<CSSStyleDeclaration>)

  // Description card with message (if provided)
  let tooltip: HTMLDivElement | null = null
  if (message) {
    tooltip = document.createElement('div')
    Object.assign(tooltip.style, {
      position: 'fixed',
      maxWidth: '300px',
      padding: '10px 34px 10px 14px',
      borderRadius: '10px',
      backgroundColor: 'rgba(15, 15, 15, 0.92)',
      color: '#f0f0f0',
      fontSize: '13px',
      lineHeight: '1.45',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
      pointerEvents: 'auto',
      backdropFilter: 'blur(8px)',
    } satisfies Partial<CSSStyleDeclaration>)
    tooltip.textContent = message
    Object.assign(closeButton.style, {
      position: 'absolute',
      top: '5px',
      right: '5px',
      backgroundColor: 'transparent',
      color: 'rgba(240, 240, 240, 0.7)',
    } satisfies Partial<CSSStyleDeclaration>)
    tooltip.appendChild(closeButton)
    container.appendChild(tooltip)
  } else {
    Object.assign(closeButton.style, {
      position: 'fixed',
      backgroundColor: 'rgba(15, 15, 15, 0.9)',
      color: '#f0f0f0',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
    } satisfies Partial<CSSStyleDeclaration>)
    container.appendChild(closeButton)
  }

  /** Position spotlight, description card, and close button from the
   *  element's current viewport rect. Called every animation frame. */
  function positionParts(): void {
    const rect = el.getBoundingClientRect()
    Object.assign(spotlight.style, {
      top: `${rect.top - HIGHLIGHT_PADDING}px`,
      left: `${rect.left - HIGHLIGHT_PADDING}px`,
      width: `${rect.width + HIGHLIGHT_PADDING * 2}px`,
      height: `${rect.height + HIGHLIGHT_PADDING * 2}px`,
    })
    if (tooltip) {
      const spaceBelow = window.innerHeight - rect.bottom
      const placeAbove = spaceBelow < 120 && rect.top > 120
      Object.assign(tooltip.style, {
        left: `${Math.max(12, Math.min(rect.left, window.innerWidth - 320))}px`,
        ...(placeAbove
          ? {
              bottom: `${window.innerHeight - rect.top + HIGHLIGHT_PADDING + 12}px`,
              top: 'auto',
            }
          : { top: `${rect.bottom + HIGHLIGHT_PADDING + 12}px`, bottom: 'auto' }),
      })
    } else {
      // Floating close button at the spotlight's top-right corner
      Object.assign(closeButton.style, {
        top: `${rect.top - HIGHLIGHT_PADDING - 11}px`,
        left: `${rect.left + rect.width + HIGHLIGHT_PADDING - 11}px`,
      })
    }
  }

  let rafId = 0
  let dismissed = false

  function teardown(): void {
    cancelAnimationFrame(rafId)
    el.removeEventListener('click', dismiss)
    container.remove()
    if (activeHighlightTeardown === teardown) activeHighlightTeardown = null
  }

  function dismiss(): void {
    if (dismissed) return
    dismissed = true
    container.style.opacity = '0'
    setTimeout(teardown, HIGHLIGHT_FADE_MS)
  }

  function track(): void {
    // Element removed (e.g. client-side navigation) — nothing to point at
    if (!el.isConnected) {
      teardown()
      return
    }
    positionParts()
    rafId = requestAnimationFrame(track)
  }

  closeButton.addEventListener('click', dismiss)
  // Clicking the highlighted element means the user followed the hint —
  // the spotlight has done its job, fade it out.
  el.addEventListener('click', dismiss)

  activeHighlightTeardown = teardown

  positionParts()
  document.body.appendChild(container)
  rafId = requestAnimationFrame(track)

  // Trigger fade-in on next frame
  requestAnimationFrame(() => {
    container.style.opacity = '1'
  })
}

/**
 * Flash a very brief glow ring on an element before an action (type,
 * select). No page dim, no tooltip — just a quick "look here" pulse.
 * Scrolls the element into view first.
 */
async function flashHighlight(el: Element): Promise<void> {
  clearHighlight()
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  await new Promise((r) => setTimeout(r, 100))

  const rect = el.getBoundingClientRect()
  const ring = document.createElement('div')
  ring.setAttribute(HIGHLIGHT_ATTR, '')
  Object.assign(ring.style, {
    position: 'fixed',
    top: `${rect.top - HIGHLIGHT_PADDING}px`,
    left: `${rect.left - HIGHLIGHT_PADDING}px`,
    width: `${rect.width + HIGHLIGHT_PADDING * 2}px`,
    height: `${rect.height + HIGHLIGHT_PADDING * 2}px`,
    borderRadius: `${HIGHLIGHT_RADIUS}px`,
    boxShadow: HIGHLIGHT_RING,
    zIndex: String(HIGHLIGHT_Z),
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 120ms ease',
  } satisfies Partial<CSSStyleDeclaration>)

  function teardown(): void {
    ring.remove()
    if (activeHighlightTeardown === teardown) activeHighlightTeardown = null
  }
  activeHighlightTeardown = teardown

  document.body.appendChild(ring)
  requestAnimationFrame(() => {
    ring.style.opacity = '1'
  })
  await new Promise((r) => setTimeout(r, 300))
  ring.style.opacity = '0'
  setTimeout(teardown, 140)
}

// ── Tool generators ─────────────────────────────────────────────────

/**
 * Generate browser automation tools from page declarations.
 *
 * Returns tools prefixed with `browser_` that navigate, click, type,
 * select, and read the current page's interactive elements.
 */
export function pageTools(pages: PageDefinition[], options?: PageToolsOptions): ChatToolDefinition[] {
  const pageList = pages
    .map((p) => {
      const actions = p.actions?.length
        ? '\n  Actions:\n' + p.actions.map((a) => `    - ${a.name}: ${a.description} (selector: ${a.selector})`).join('\n')
        : ''
      return `  - ${p.path}: ${p.description}${actions}`
    })
    .join('\n')

  // All browser automation tools are internal to the holocron chat widget.
  // They must NOT be exposed on document.modelContext for external agents.
  const internal = { exposeToModelContext: false as const }

  return [
    {
      ...internal,
      name: 'browser_navigate',
      description: `Navigate the browser to a page path using client-side navigation.\n\nAvailable pages:\n${pageList}`,
      inputJsonSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The page path to navigate to (e.g. "/settings")' },
          ...descriptionProperty,
        },
        required: ['path', 'description'],
      },
      async run({ input }) {
        const path = input.path as string
        const navigateFn = options?.navigate ?? chatWidgetStore.getState().navigate
        await navigateFn(path)
        await new Promise((r) => setTimeout(r, 200))
        return { navigated: path, currentPath: window.location.pathname }
      },
    },
    {
      ...internal,
      name: 'browser_type',
      description: 'Type text into an input or textarea element. Clears existing value first.',
      inputJsonSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the input element' },
          text: { type: 'string', description: 'Text to type into the element' },
          ...descriptionProperty,
        },
        required: ['selector', 'text', 'description'],
      },
      needsApproval: domNeedsApproval,
      async run({ input }) {
        const selector = input.selector as string
        const text = input.text as string
        const el = document.querySelector(selector)
        if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
          return { error: `Input element not found: ${selector}` }
        }
        await flashHighlight(el)
        el.focus()
        // Use native setter to trigger React's synthetic event system
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value',
        )?.set
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, text)
        } else {
          el.value = text
        }
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return { typed: text, selector }
      },
    },
    {
      ...internal,
      name: 'browser_select',
      description: 'Select a value in a <select> dropdown element.',
      inputJsonSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the select element' },
          value: { type: 'string', description: 'Value to select' },
          ...descriptionProperty,
        },
        required: ['selector', 'value', 'description'],
      },
      needsApproval: domNeedsApproval,
      async run({ input }) {
        const selector = input.selector as string
        const value = input.value as string
        const el = document.querySelector(selector)
        if (!el || !(el instanceof HTMLSelectElement)) {
          return { error: `Select element not found: ${selector}` }
        }
        el.value = value
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return { selected: value, selector }
      },
    },
    {
      ...internal,
      name: 'browser_highlight',
      description: 'Highlight an element on the page with a persistent spotlight overlay and a description card next to it, like an onboarding tour step. ALWAYS use this tool when the user asks to do something on the page. This is the primary way to guide users to interact with elements — there is no click tool. For example, if the user asks "change my email", type the new value with browser_type, then highlight the Save button with a message like "Click here to save your changes". Use this to point at buttons, links, form controls, or any UI element the user should interact with. The overlay stays visible until the user dismisses it (via the × button or by clicking the element), so always provide a message telling the user what to do. Always pass a `message`.',
      inputJsonSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to highlight' },
          message: { type: 'string', description: 'Short instruction shown in a card next to the element, e.g. "Click here to save your changes"' },
          ...descriptionProperty,
        },
        required: ['selector', 'description'],
      },
      async run({ input }) {
        const selector = input.selector as string
        const message = typeof input.message === 'string' ? input.message : undefined
        const el = document.querySelector(selector)
        if (!el) {
          return { error: `Element not found: ${selector}` }
        }
        // The rAF position tracker follows the smooth scroll, so the
        // overlay can be shown immediately and the tool returns right
        // away — it never blocks the AI loop waiting for dismissal.
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        showHighlight(el, { message })
        return {
          highlighted: selector,
          note: 'Overlay stays visible until the user dismisses it or clicks the element.',
        }
      },
    },
    {
      ...internal,
      name: 'browser_read_page',
      description: 'Read the current page and list all interactive elements (buttons, links, inputs, selects) with their CSS selectors. Use this before clicking or typing to discover what elements are available.',
      inputJsonSchema: {
        type: 'object',
        properties: {},
      },
      async run() {
        return { content: readInteractiveElements() }
      },
    },
  ]
}
