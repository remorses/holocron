/**
 * Browser automation tools for the Holocron AI chat widget.
 *
 * Generates ChatToolDefinition[] from page declarations. All tool names
 * are prefixed with `browser_` to prevent collisions with user-defined tools.
 *
 * Tools: browser_navigate, browser_click, browser_type, browser_select, browser_read_page
 */

'use client'

import { toolDescriptionProperty } from './define-tool.ts'
import type { ChatToolDefinition, ToolApprovalCheck } from './define-tool.ts'

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
   * Custom navigation function for client-side routing.
   * Called instead of the default `history.pushState` + `popstate` fallback.
   *
   * Examples:
   *   - Next.js: `(path) => router.push(path)`
   *   - React Router: `(path) => navigate(path)`
   *   - SPA with custom router: `(path) => myRouter.go(path)`
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

  return [
    {
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
        if (options?.navigate) {
          await options.navigate(path)
        } else {
          // Fallback: pushState + popstate. Works for most SPAs but won't
          // trigger framework-specific route transitions.
          history.pushState(null, '', path)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }
        await new Promise((r) => setTimeout(r, 200))
        return { navigated: path, currentPath: window.location.pathname }
      },
    },
    {
      name: 'browser_click',
      description: 'Click an element on the page by CSS selector. Use browser_read_page first to discover selectors.',
      inputJsonSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to click' },
          ...descriptionProperty,
        },
        required: ['selector', 'description'],
      },
      needsApproval: domNeedsApproval,
      async run({ input }) {
        const selector = input.selector as string
        const el = document.querySelector(selector)
        if (!el || !(el instanceof HTMLElement)) {
          return { error: `Element not found: ${selector}` }
        }
        el.click()
        await new Promise((r) => setTimeout(r, 500))
        return { clicked: selector }
      },
    },
    {
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
