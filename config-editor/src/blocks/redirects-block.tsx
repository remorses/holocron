import { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type RedirectsBlockValues = Pick<DocsJsonType, 'redirects'>

type RedirectsBlockProps = {
  defaultValues: RedirectsBlockValues
  onSave: (data: RedirectsBlockValues) => Promise<void>
  onPreview?: (data: RedirectsBlockValues) => void
  disabled?: boolean
}

export function RedirectsBlock({ defaultValues, onSave, onPreview, disabled }: RedirectsBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, formState, control, reset } = useForm<RedirectsBlockValues>({
    defaultValues: {
      redirects: defaultValues.redirects || [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'redirects',
  })

  const onSubmit = async (data: RedirectsBlockValues) => {
    setIsSaving(true)
    try {
      const redirects = (data.redirects || []).filter((r) => r.source && r.destination)
      await onSave({ redirects: redirects.length > 0 ? redirects : undefined })
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper title="Redirects" description="Redirect rules for your documentation">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Redirect #{index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { remove(index) }}
                  disabled={disabled}
                  className="size-7"
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
              <FieldWrapper
                label="Source path"
                required
                error={formState.errors.redirects?.[index]?.source?.message}
              >
                <Input
                  {...register(`redirects.${index}.source`, {
                    required: 'Source is required',
                    validate: (v) => !v || v.startsWith('/') || 'Must start with /',
                  })}
                  placeholder="/old-page"
                  disabled={disabled}
                />
              </FieldWrapper>
              <FieldWrapper
                label="Destination"
                required
                error={formState.errors.redirects?.[index]?.destination?.message}
              >
                <Input
                  {...register(`redirects.${index}.destination`, {
                    required: 'Destination is required',
                  })}
                  placeholder="/new-page or https://example.com"
                  disabled={disabled}
                />
              </FieldWrapper>
              <div className="flex items-center gap-2 pt-1">
                <Controller
                  name={`redirects.${index}.permanent`}
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id={`redirect-permanent-${index}`}
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                    />
                  )}
                />
                <Label htmlFor={`redirect-permanent-${index}`} className="text-xs">
                  Permanent (301)
                </Label>
                <span className="text-xs text-muted-foreground ml-auto">
                  {fields[index]?.permanent ? '301' : '302'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { append({ source: '', destination: '', permanent: false }) }}
          disabled={disabled}
          className="w-full"
        >
          <PlusIcon className="size-4 mr-1" />
          Add Redirect
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
