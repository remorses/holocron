import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Label } from '../components/ui/label'
import { BlockWrapper } from '../components/block-wrapper'
import { contextualOptions, type ContextualOption, type DocsJsonType } from '../types'

const contextualLabels: Record<ContextualOption, { label: string; description: string }> = {
  copy: { label: 'Copy', description: 'Copy code to clipboard' },
  view: { label: 'View', description: 'View source code' },
  chatgpt: { label: 'ChatGPT', description: 'Open in ChatGPT' },
  claude: { label: 'Claude', description: 'Open in Claude' },
}

type ContextualBlockValues = Pick<DocsJsonType, 'contextual'>

type ContextualBlockProps = {
  defaultValues: ContextualBlockValues
  onSave: (data: ContextualBlockValues) => Promise<void>
  onPreview?: (data: ContextualBlockValues) => void
  disabled?: boolean
}

export function ContextualBlock({ defaultValues, onSave, onPreview, disabled }: ContextualBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const defaultOptions = contextualOptions.reduce(
    (acc, opt) => {
      acc[opt] = defaultValues.contextual?.options?.includes(opt) ?? false
      return acc
    },
    {} as Record<ContextualOption, boolean>,
  )

  const { handleSubmit, formState, control, reset } = useForm<{
    options: Record<ContextualOption, boolean>
  }>({
    defaultValues: { options: defaultOptions },
  })

  const onSubmit = async (data: { options: Record<ContextualOption, boolean> }) => {
    setIsSaving(true)
    try {
      const options = Object.entries(data.options)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key as ContextualOption)

      await onSave({
        contextual: options.length > 0 ? { options } : undefined,
      })
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper
      title="Contextual Actions"
      description="Action buttons shown on code blocks and page headers"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-3">
          {contextualOptions.map((option) => (
            <div key={option} className="flex items-start gap-3">
              <Controller
                name={`options.${option}`}
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id={`contextual-${option}`}
                    checked={field.value}
                    onChange={(e) => { field.onChange(e.target.checked) }}
                    disabled={disabled}
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor={`contextual-${option}`} className="text-sm font-medium">
                  {contextualLabels[option].label}
                </Label>
                <p className="text-xs text-muted-foreground">{contextualLabels[option].description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={disabled || isSaving || !formState.isDirty} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </BlockWrapper>
  )
}
