import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type IntegrationsBlockValues = Pick<DocsJsonType, 'integrations'>

type IntegrationsBlockProps = {
  defaultValues: IntegrationsBlockValues
  onSave: (data: IntegrationsBlockValues) => Promise<void>
  onPreview?: (data: IntegrationsBlockValues) => void
  disabled?: boolean
}

const INTEGRATIONS = [
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    fields: [{ key: 'measurementId', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX' }],
    docsUrl: 'https://support.google.com/analytics/answer/9539598',
  },
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    fields: [{ key: 'tagId', label: 'Tag ID', placeholder: 'GTM-XXXXXXX' }],
    docsUrl: 'https://support.google.com/tagmanager/answer/6102821',
  },
  {
    id: 'posthog',
    name: 'PostHog',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'phc_...' },
      { key: 'apiHost', label: 'API Host (optional)', placeholder: 'https://app.posthog.com' },
    ],
    docsUrl: 'https://posthog.com/docs',
  },
  {
    id: 'plausible',
    name: 'Plausible',
    fields: [
      { key: 'domain', label: 'Domain', placeholder: 'example.com' },
      { key: 'server', label: 'Server (optional)', placeholder: 'https://plausible.io' },
    ],
    docsUrl: 'https://plausible.io/docs',
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'your-api-key' }],
    docsUrl: 'https://www.docs.developers.amplitude.com/',
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    fields: [{ key: 'projectToken', label: 'Project Token', placeholder: 'your-project-token' }],
    docsUrl: 'https://docs.mixpanel.com/',
  },
  {
    id: 'intercom',
    name: 'Intercom',
    fields: [{ key: 'appId', label: 'App ID', placeholder: 'your-app-id' }],
    docsUrl: 'https://developers.intercom.com/',
  },
  {
    id: 'segment',
    name: 'Segment',
    fields: [{ key: 'key', label: 'Write Key', placeholder: 'your-write-key' }],
    docsUrl: 'https://segment.com/docs/',
  },
  {
    id: 'fathom',
    name: 'Fathom',
    fields: [{ key: 'siteId', label: 'Site ID', placeholder: 'XXXXX' }],
    docsUrl: 'https://usefathom.com/docs',
  },
  {
    id: 'pirsch',
    name: 'Pirsch',
    fields: [{ key: 'id', label: 'Site ID', placeholder: 'your-site-id' }],
    docsUrl: 'https://docs.pirsch.io/',
  },
] as const

export function IntegrationsBlock({ defaultValues, onSave, onPreview, disabled }: IntegrationsBlockProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { register, handleSubmit, formState, reset } = useForm<{
    integrations: Record<string, Record<string, string>>
  }>({
    defaultValues: {
      integrations: defaultValues.integrations as Record<string, Record<string, string>> || {},
    },
  })

  const onSubmit = async (data: { integrations: Record<string, Record<string, string>> }) => {
    setIsSaving(true)
    try {
      const integrations: Record<string, Record<string, string>> = {}

      Object.entries(data.integrations).forEach(([key, value]) => {
        const hasValue = Object.values(value).some((v) => v)
        if (hasValue) {
          const cleanedValue: Record<string, string> = {}
          Object.entries(value).forEach(([k, v]) => {
            if (v) {
              cleanedValue[k] = v
            }
          })
          integrations[key] = cleanedValue
        }
      })

      await onSave({
        integrations: Object.keys(integrations).length > 0 ? integrations as any : undefined,
      })
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <BlockWrapper
      title="Integrations"
      description="Third-party analytics and support integrations"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        {INTEGRATIONS.map((integration) => {
          const isExpanded = expanded[integration.id]
          const hasValue = integration.fields.some(
            (f) => (defaultValues.integrations as any)?.[integration.id]?.[f.key]
          )

          return (
            <div key={integration.id} className="border rounded-md">
              <button
                type="button"
                onClick={() => { toggleExpanded(integration.id) }}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium flex-1">{integration.name}</span>
                {hasValue && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Active</span>
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t pt-3">
                  {integration.fields.map((field) => (
                    <FieldWrapper key={field.key} label={field.label}>
                      <Input
                        {...register(`integrations.${integration.id}.${field.key}`)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                      />
                    </FieldWrapper>
                  ))}
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Documentation
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
              )}
            </div>
          )
        })}

        <div className="flex justify-end pt-4">
          <Button type="submit" size="sm" disabled={disabled || isSaving || !formState.isDirty} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </BlockWrapper>
  )
}
