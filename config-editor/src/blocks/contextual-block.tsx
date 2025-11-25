import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Label } from '../components/ui/label'
import { BlockWrapper } from '../components/block-wrapper'
import type { DocsJsonType } from '../types'

const CONTEXTUAL_OPTIONS = [
  { value: 'copy', label: 'Copy', description: 'Copy code to clipboard' },
  { value: 'view', label: 'View', description: 'View source code' },
  { value: 'chatgpt', label: 'ChatGPT', description: 'Open in ChatGPT' },
  { value: 'claude', label: 'Claude', description: 'Open in Claude' },
] as const

type ContextualOption = typeof CONTEXTUAL_OPTIONS[number]['value']

type ContextualBlockValues = Pick<DocsJsonType, 'contextual'>

type ContextualBlockProps = {
  defaultValues: ContextualBlockValues
  onSave: (data: ContextualBlockValues) => Promise<void>
  onPreview?: (data: ContextualBlockValues) => void
  disabled?: boolean
}

export function ContextualBlock({ defaultValues, onSave, onPreview, disabled }: ContextualBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const { handleSubmit, formState, control, reset, watch, setValue } = useForm<{
    options: Record<ContextualOption, boolean>
  }>({
    defaultValues: {
      options: {
        copy: defaultValues.contextual?.options?.includes('copy') ?? false,
        view: defaultValues.contextual?.options?.includes('view') ?? false,
        chatgpt: defaultValues.contextual?.options?.includes('chatgpt') ?? false,
        claude: defaultValues.contextual?.options?.includes('claude') ?? false,
      },
    },
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
          {CONTEXTUAL_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-start gap-3">
              <Controller
                name={`options.${option.value}`}
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id={`contextual-${option.value}`}
                    checked={field.value}
                    onChange={(e) => { field.onChange(e.target.checked) }}
                    disabled={disabled}
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor={`contextual-${option.value}`} className="text-sm font-medium">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
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
