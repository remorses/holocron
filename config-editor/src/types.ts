export type DocsJsonType = {
  $schema?: string
  siteId?: string
  name?: string
  description?: string
  logo?: {
    light: string
    dark: string
    href?: string
    text?: string
  }
  favicon?: {
    light: string
    dark: string
  }
  navbar?: {
    links?: Array<{
      label: string
      href: string
      icon?: string
    }>
    primary?: 
      | { type: 'button'; label: string; href: string }
      | { type: 'github'; href: string }
  }
  footer?: {
    socials?: Record<string, string>
    links?: Array<{
      header?: string
      items: Array<{ label: string; href: string }>
    }>
  }
  tabs?: Array<
    | { tab: string; folder: string; description?: string; hideSidebar?: boolean }
    | { tab: string; openapi: string; renderer?: 'fumadocs' | 'scalar'; hideSidebar?: boolean }
    | { tab: string; mcp: string; hideSidebar?: boolean }
  >
  seo?: {
    metatags?: Record<string, string>
    indexing?: 'navigable' | 'all'
  }
  redirects?: Array<{
    source: string
    destination: string
    permanent?: boolean
  }>
  banner?: {
    content: string
    dismissible?: boolean
  }
  contextual?: {
    options: Array<'copy' | 'view' | 'chatgpt' | 'claude'>
  }
  cssVariables?: {
    light: Record<string, string>
    dark: Record<string, string>
  }
  domains?: string[]
  hideSidebar?: boolean
  ignore?: string[]
  theme?: 'black' | 'catppuccin' | 'dusk' | 'neutral' | 'ocean' | 'purple' | 'vitepress'
  disableEditButton?: boolean
  poweredBy?: {
    name: string
    url: string
  }
  passwords?: Array<{
    password: string
    name?: string
  }>
  integrations?: {
    amplitude?: { apiKey: string }
    clearbit?: { publicApiKey: string }
    fathom?: { siteId: string }
    frontchat?: { snippetId: string }
    ga4?: { measurementId: string }
    gtm?: { tagId: string }
    heap?: { appId: string }
    hotjar?: { hjid: string; hjsv: string }
    intercom?: { appId: string }
    koala?: { publicApiKey: string }
    logrocket?: { appId: string }
    mixpanel?: { projectToken: string }
    pirsch?: { id: string }
    posthog?: { apiKey: string; apiHost?: string }
    plausible?: { domain: string; server?: string }
    segment?: { key: string }
  }
}

export type BlockProps<T extends Partial<DocsJsonType>> = {
  defaultValues: T
  onSave: (data: T) => Promise<void>
  onPreview?: (data: T) => void
  disabled?: boolean
}
