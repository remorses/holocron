import { useId } from 'react'
import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { RedirectsFormValues } from '../types'

export function RedirectsBlock() {
  const id = useId()
  const { register, formState, control, watch } = useFormContext<RedirectsFormValues>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'redirects',
  })

  return (
    <BlockWrapper title="Redirects" description="Redirect rules for your documentation">
      <div className="space-y-4">
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
                />
              </FieldWrapper>
              <div className="flex items-center gap-2 pt-1">
                <Controller
                  name={`redirects.${index}.permanent`}
                  control={control}
                  render={({ field }) => (
                  <Switch
                    id={`${id}-permanent-${index}`}
                    checked={field.value || false}
                    onCheckedChange={field.onChange}
                  />
                  )}
                />
                <Label htmlFor={`${id}-permanent-${index}`} className="text-xs">
                  Permanent (301)
                </Label>
                <span className="text-xs text-muted-foreground ml-auto">
                  {watch(`redirects.${index}.permanent`) ? '301' : '302'}
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
          className="w-full"
        >
          <PlusIcon className="size-4 mr-1" />
          Add Redirect
        </Button>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
            Save
          </Button>
        </div>
      </div>
    </BlockWrapper>
  )
}
