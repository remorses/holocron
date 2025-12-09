import { useEffect, ReactNode } from 'react'
import { useForm, FormProvider, FieldValues, DefaultValues } from 'react-hook-form'
import { create } from 'zustand'
import {
  LogoBlock,
  FaviconBlock,
  NavbarBlock,
  FooterBlock,
  DomainsBlock,
  BannerBlock,
  ThemeBlock,
  RedirectsBlock,
  SeoBlock,
  PasswordsBlock,
  ContextualBlock,
  CssVariablesBlock,
  IntegrationsBlock,
} from '../index'

import { socialPlatforms, contextualOptions, type DocsJsonType, type ContextualOption } from '../types'

function socialsToEntries(socials: Record<string, string> | undefined) {
  return socialPlatforms.map((platform) => ({
    platform,
    url: socials?.[platform] || '',
  }))
}

function metatagsToEntries(metatags: Record<string, string> | undefined) {
  return Object.entries(metatags || {}).map(([name, content]) => ({ name, content }))
}

function recordToEntries(record: Record<string, string> | undefined) {
  return Object.entries(record || {}).map(([name, value]) => ({ name, value }))
}

function contextualToOptions(contextual: { options?: ContextualOption[] } | undefined) {
  return contextualOptions.reduce(
    (acc, opt) => {
      acc[opt] = contextual?.options?.includes(opt) ?? false
      return acc
    },
    {} as Record<ContextualOption, boolean>,
  )
}

type ConfigStore = {
  config: DocsJsonType
  lastSaved: string | null
}

const useConfigStore = create<ConfigStore>()(() => ({
  config: {
    siteId: 'preview-site',
    name: 'My Documentation',
    description: 'Documentation for my awesome project',
    logo: {
      light: 'https://example.com/logo-light.svg',
      dark: 'https://example.com/logo-dark.svg',
      href: '/',
    },
    favicon: {
      light: 'https://example.com/favicon.svg',
      dark: 'https://example.com/favicon-dark.svg',
    },
    theme: 'neutral',
    navbar: {
      links: [
        { label: 'Docs', href: '/docs' },
        { label: 'API', href: '/api' },
      ],
      primary: { type: 'github', href: 'https://github.com/example/repo' },
    },
    banner: {
      content: '<a href="/changelog">New release v2.0!</a>',
      dismissible: true,
    },
    footer: {
      socials: {
        twitter: 'https://twitter.com/example',
        github: 'https://github.com/example',
      },
      links: [
        {
          header: 'Resources',
          items: [
            { label: 'Documentation', href: '/docs' },
            { label: 'API Reference', href: '/api' },
          ],
        },
      ],
    },
    domains: ['docs.example.com', 'example-docs.holocronsites.com'],
    redirects: [
      { source: '/old', destination: '/new', permanent: true },
    ],
    seo: {
      indexing: 'all',
      metatags: {
        'og:type': 'website',
      },
    },
    passwords: [],
    contextual: {
      options: ['copy', 'view'],
    },
    cssVariables: {
      light: { '--accent': '#3b82f6' },
      dark: { '--accent': '#60a5fa' },
    },
    integrations: {
      ga4: { measurementId: 'G-XXXXXXXXXX' },
    },
  },
  lastSaved: null,
}))

type FormBlockProps = {
  defaultValues: DefaultValues<FieldValues>
  children: ReactNode
}

function FormBlock({ defaultValues, children }: FormBlockProps) {
  const form = useForm({ defaultValues })
  const { handleSubmit, watch, reset } = form

  useEffect(() => {
    const subscription = watch((data) => {
      console.log('Preview:', data)
    })
    return () => { subscription.unsubscribe() }
  }, [watch])

  const handleSave = async (data: FieldValues) => {
    await new Promise((resolve) => { setTimeout(resolve, 500) })
    const { config } = useConfigStore.getState()
    useConfigStore.setState({
      config: { ...config, ...data },
      lastSaved: JSON.stringify(data, null, 2),
    })
    reset(data)
    console.log('Saved:', data)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(handleSave)}>
        {children}
      </form>
    </FormProvider>
  )
}

export function App() {
  const config = useConfigStore((s: ConfigStore) => s.config)
  const lastSaved = useConfigStore((s: ConfigStore) => s.lastSaved)

  const uploadFunction = async (file: File) => {
    await new Promise((resolve) => { setTimeout(resolve, 300) })
    return URL.createObjectURL(file)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-sm mx-auto py-8 px-4 space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold">Config Editor Preview</h1>
          <p className="text-sm text-muted-foreground">Narrow width layout preview</p>
        </div>

        <FormBlock defaultValues={{ logo: config.logo }}>
          <LogoBlock uploadFunction={uploadFunction} />
        </FormBlock>

        <FormBlock defaultValues={{ favicon: config.favicon }}>
          <FaviconBlock uploadFunction={uploadFunction} />
        </FormBlock>

        <FormBlock defaultValues={{ theme: config.theme }}>
          <ThemeBlock />
        </FormBlock>

        <FormBlock defaultValues={{ banner: config.banner }}>
          <BannerBlock />
        </FormBlock>

        <FormBlock defaultValues={{ navbar: { links: config.navbar?.links || [], primary: config.navbar?.primary } }}>
          <NavbarBlock />
        </FormBlock>

        <FormBlock defaultValues={{ socials: socialsToEntries(config.footer?.socials), links: config.footer?.links || [] }}>
          <FooterBlock />
        </FormBlock>

        <FormBlock defaultValues={{ domains: (config.domains || []).map((d: string) => ({ value: d })) }}>
          <DomainsBlock cnameTarget="cname.holocronsites.com" internalDomain="example-docs.holocronsites.com" />
        </FormBlock>

        <FormBlock defaultValues={{ redirects: config.redirects || [] }}>
          <RedirectsBlock />
        </FormBlock>

        <FormBlock defaultValues={{ description: config.description || '', indexing: config.seo?.indexing || 'default', metatags: metatagsToEntries(config.seo?.metatags) }}>
          <SeoBlock />
        </FormBlock>

        <FormBlock defaultValues={{ passwords: config.passwords || [] }}>
          <PasswordsBlock />
        </FormBlock>

        <FormBlock defaultValues={{ options: contextualToOptions(config.contextual as { options?: ContextualOption[] } | undefined) }}>
          <ContextualBlock />
        </FormBlock>

        <FormBlock defaultValues={{ light: recordToEntries(config.cssVariables?.light), dark: recordToEntries(config.cssVariables?.dark) }}>
          <CssVariablesBlock />
        </FormBlock>

        <FormBlock defaultValues={{ integrations: config.integrations || {} }}>
          <IntegrationsBlock />
        </FormBlock>

        {lastSaved && (
          <div className="fixed bottom-4 right-4 max-w-xs bg-card border rounded-lg p-3 shadow-lg">
            <p className="text-xs font-medium mb-1">Last saved:</p>
            <pre className="text-xs text-muted-foreground overflow-auto max-h-32">{lastSaved}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
