import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { PlusIcon, TrashIcon, AlertCircleIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type DomainsBlockValues = Pick<DocsJsonType, 'domains'>

type DomainsBlockProps = {
  defaultValues: DomainsBlockValues
  onSave: (data: DomainsBlockValues) => Promise<void>
  onPreview?: (data: DomainsBlockValues) => void
  disabled?: boolean
  cnameTarget?: string
  internalDomain?: string
}

export function DomainsBlock({
  defaultValues,
  onSave,
  onPreview,
  disabled,
  cnameTarget = 'cname.holocronsites.com',
  internalDomain,
}: DomainsBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, formState, control, reset } = useForm<{ domains: { value: string }[] }>({
    defaultValues: {
      domains: (defaultValues.domains || []).map((d) => ({ value: d })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'domains',
  })

  const onSubmit = async (data: { domains: { value: string }[] }) => {
    setIsSaving(true)
    try {
      const domains = data.domains.map((d) => d.value).filter(Boolean)
      await onSave({ domains })
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper title="Custom Domains" description="Connect custom domains to your documentation site">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <p className="text-xs font-medium">DNS Configuration</p>
          <p className="text-xs text-muted-foreground">
            Point your domain to <code className="bg-muted px-1 rounded">{cnameTarget}</code> via CNAME record
          </p>
        </div>

        {internalDomain && (
          <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 p-3 text-xs">
            <AlertCircleIcon className="size-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-yellow-700 dark:text-yellow-400">
              The internal domain <code className="bg-muted px-1 rounded">{internalDomain}</code> should never be removed
            </p>
          </div>
        )}

        <div className="space-y-2">
          {fields.map((field, index) => {
            const isInternal = Boolean(internalDomain && field.value === internalDomain)
            return (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input
                    {...register(`domains.${index}.value`, {
                      required: 'Domain is required',
                      pattern: {
                        value: /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
                        message: 'Invalid domain format',
                      },
                    })}
                    placeholder="docs.example.com"
                    disabled={disabled || isInternal}
                  />
                  {formState.errors.domains?.[index]?.value && (
                    <p className="text-xs text-destructive mt-1">
                      {formState.errors.domains[index]?.value?.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { remove(index) }}
                  disabled={disabled || isInternal}
                  className="shrink-0"
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { append({ value: '' }) }}
          disabled={disabled}
          className="w-full"
        >
          <PlusIcon className="size-4 mr-1" />
          Add Domain
        </Button>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={disabled || isSaving || !formState.isDirty} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </BlockWrapper>
  )
}
