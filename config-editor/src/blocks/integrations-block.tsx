import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import { integrationDefinitions, type IntegrationsFormValues } from '../types'

export function IntegrationsBlock() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { register, formState, watch } = useFormContext<IntegrationsFormValues>()

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const integrations = watch('integrations')

  return (
    <BlockWrapper
      title="Integrations"
      description="Third-party analytics and support integrations"
    >
      <div className="space-y-2">
        {integrationDefinitions.map((integration) => {
          const isExpanded = expanded[integration.id]
          const hasValue = integration.fields.some(
            (f) => integrations?.[integration.id]?.[f.key]
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
          <Button type="submit" size="sm" disabled={formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
            Save
          </Button>
        </div>
      </div>
    </BlockWrapper>
  )
}
