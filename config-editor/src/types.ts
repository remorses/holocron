import {
  type DocsJsonType,
  themeNames,
  type ThemeName,
  contextualOptions,
  type ContextualOption,
  socialPlatforms,
  type SocialPlatform,
  integrationDefinitions,
  type IntegrationDefinition,
  type IntegrationField,
  cssVariableDefinitions,
  type CssVariableDefinition,
} from '@holocron.so/cli/src/docs-json.js'

export {
  type DocsJsonType,
  themeNames,
  type ThemeName,
  contextualOptions,
  type ContextualOption,
  socialPlatforms,
  type SocialPlatform,
  integrationDefinitions,
  type IntegrationDefinition,
  type IntegrationField,
  cssVariableDefinitions,
  type CssVariableDefinition,
}

export type BlockProps<T extends Partial<DocsJsonType>> = {
  defaultValues: T
  onSave: (data: T) => Promise<void>
  onPreview?: (data: T) => void
  disabled?: boolean
}

// Form helper types for transforming schema types to editable form structures

export type CssVariableEntry = { name: string; value: string }

export type CssVariablesFormValues = {
  light: CssVariableEntry[]
  dark: CssVariableEntry[]
}

export type DomainsFormValues = {
  domains: { value: string }[]
}

export type MetatagEntry = { name: string; content: string }

export type SeoFormValues = {
  description: string
  indexing: 'navigable' | 'all' | 'default'
  metatags: MetatagEntry[]
}

export type ContextualFormValues = {
  options: Record<ContextualOption, boolean>
}

export type SocialEntry = { platform: string; url: string }

export type FooterLinkItem = { label: string; href: string }

export type FooterLinkColumn = { header: string; items: FooterLinkItem[] }

export type FooterFormValues = {
  socials: SocialEntry[]
  links: FooterLinkColumn[]
}

export type IntegrationsFormValues = {
  integrations: Record<string, Record<string, string>>
}

export type RedirectsFormValues = {
  redirects: { source: string; destination: string; permanent?: boolean }[]
}

export type PasswordsFormValues = {
  passwords: { password: string; name?: string }[]
}
