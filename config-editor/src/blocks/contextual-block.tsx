import { useId } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Label } from '../components/ui/label'
import { BlockWrapper } from '../components/block-wrapper'
import { contextualOptions, type ContextualOption, type ContextualFormValues, type DocsJsonType, type BlockTransform } from '../types'

const contextualLabels: Record<ContextualOption, { label: string; description: string }> = {
  copy: { label: 'Copy', description: 'Copy code to clipboard' },
  view: { label: 'View', description: 'View source code' },
  chatgpt: { label: 'ChatGPT', description: 'Open in ChatGPT' },
  claude: { label: 'Claude', description: 'Open in Claude' },
}

export function ContextualBlock() {
  const id = useId()
  const { formState, control } = useFormContext<ContextualFormValues>()

  return (
    <BlockWrapper
      title="Contextual Actions"
      description="Action buttons shown on code blocks and page headers"
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {contextualOptions.map((option) => (
            <div key={option} className="flex items-start gap-3">
              <Controller
                name={`options.${option}`}
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id={`${id}-${option}`}
                    checked={field.value}
                    onChange={(e) => { field.onChange(e.target.checked) }}
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor={`${id}-${option}`} className="text-sm font-medium">
                  {contextualLabels[option].label}
                </Label>
                <p className="text-xs text-muted-foreground">{contextualLabels[option].description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
            Save
          </Button>
        </div>
      </div>
    </BlockWrapper>
  )
}

ContextualBlock.transform = {
  toForm(config) {
    const enabledOptions = config.contextual?.options ?? []
    return {
      options: contextualOptions.reduce(
        (acc, opt) => {
          acc[opt] = enabledOptions.includes(opt)
          return acc
        },
        {} as Record<ContextualOption, boolean>,
      ),
    }
  },
  toConfig(form) {
    const selectedOptions = Object.entries(form.options || {})
      .filter(([_, enabled]) => enabled)
      .map(([option]) => option as ContextualOption)
    return {
      contextual: {
        options: selectedOptions,
      },
    }
  },
} satisfies BlockTransform<ContextualFormValues>
