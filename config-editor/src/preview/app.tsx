import { useState, useEffect, ReactNode } from 'react'
import { useForm, FormProvider, FieldValues, DefaultValues } from 'react-hook-form'
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
import { Button } from '../components/ui/button'
import type { DocsJsonType } from '../types'

const INITIAL_CONFIG: DocsJsonType = {
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
}

type FormBlockProps<T extends FieldValues> = {
  defaultValues: DefaultValues<T>
  onSave: (data: T) => Promise<void>
  onPreview?: (data: T) => void
  children: ReactNode
}

function FormBlock<T extends FieldValues>({ defaultValues, onSave, onPreview, children }: FormBlockProps<T>) {
  const form = useForm<T>({ defaultValues })
  const { handleSubmit, watch, reset } = form

  useEffect(() => {
    const subscription = watch((data) => {
      console.log('Preview:', data)
      onPreview?.(data as T)
    })
    return () => { subscription.unsubscribe() }
  }, [watch, onPreview])

  const onSubmit = async (data: T) => {
    await onSave(data)
    reset(data)
    console.log('Saved:', data)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {children}
      </form>
    </FormProvider>
  )
}

export function App() {
  const [config, setConfig] = useState<DocsJsonType>(INITIAL_CONFIG)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const handleSave = async <T,>(partial: T) => {
    await new Promise((resolve) => { setTimeout(resolve, 500) })
    setConfig((prev) => ({ ...prev, ...partial }))
    setLastSaved(JSON.stringify(partial, null, 2))
  }

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

        <FormBlock defaultValues={{ logo: config.logo }} onSave={handleSave}>
          <LogoBlock uploadFunction={uploadFunction} />
        </FormBlock>

        <FormBlock defaultValues={{ favicon: config.favicon }} onSave={handleSave}>
          <FaviconBlock uploadFunction={uploadFunction} />
        </FormBlock>

        <FormBlock defaultValues={{ theme: config.theme }} onSave={handleSave}>
          <ThemeBlock />
        </FormBlock>

        <FormBlock defaultValues={{ banner: config.banner }} onSave={handleSave}>
          <BannerBlock />
        </FormBlock>

        <FormBlock defaultValues={{ navbar: { links: config.navbar?.links || [], primary: config.navbar?.primary } }} onSave={handleSave}>
          <NavbarBlock />
        </FormBlock>

        {/* TODO: Refactor remaining blocks that have data transformations */}
        <FooterBlock
          defaultValues={{ footer: config.footer }}
          onSave={(data) => { return handleSave(data) }}
        />

        <DomainsBlock
          defaultValues={{ domains: config.domains }}
          onSave={(data) => { return handleSave(data) }}
          cnameTarget="cname.holocronsites.com"
          internalDomain="example-docs.holocronsites.com"
        />

        <RedirectsBlock
          defaultValues={{ redirects: config.redirects }}
          onSave={(data) => { return handleSave(data) }}
        />

        <SeoBlock
          defaultValues={{ description: config.description, seo: config.seo }}
          onSave={(data) => { return handleSave(data) }}
        />

        <PasswordsBlock
          defaultValues={{ passwords: config.passwords }}
          onSave={(data) => { return handleSave(data) }}
        />

        <ContextualBlock
          defaultValues={{ contextual: config.contextual }}
          onSave={(data) => { return handleSave(data) }}
        />

        <CssVariablesBlock
          defaultValues={{ cssVariables: config.cssVariables }}
          onSave={(data) => { return handleSave(data) }}
        />

        <IntegrationsBlock
          defaultValues={{ integrations: config.integrations }}
          onSave={(data) => { return handleSave(data) }}
        />

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
