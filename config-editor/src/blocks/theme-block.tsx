import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

const THEMES = [
  { value: 'neutral', label: 'Neutral', description: 'Clean and minimal' },
  { value: 'black', label: 'Black', description: 'High contrast dark theme' },
  { value: 'catppuccin', label: 'Catppuccin', description: 'Warm pastel colors' },
  { value: 'dusk', label: 'Dusk', description: 'Soft twilight tones' },
  { value: 'ocean', label: 'Ocean', description: 'Cool blue tones' },
  { value: 'purple', label: 'Purple', description: 'Rich purple accents' },
  { value: 'vitepress', label: 'VitePress', description: 'VitePress-inspired theme' },
] as const

type ThemeBlockValues = Pick<DocsJsonType, 'theme'>

type ThemeBlockProps = {
  defaultValues: ThemeBlockValues
  onSave: (data: ThemeBlockValues) => Promise<void>
  onPreview?: (data: ThemeBlockValues) => void
  disabled?: boolean
}

export function ThemeBlock({ defaultValues, onSave, onPreview, disabled }: ThemeBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const { handleSubmit, formState, control, reset } = useForm<ThemeBlockValues>({
    defaultValues,
  })

  const onSubmit = async (data: ThemeBlockValues) => {
    setIsSaving(true)
    try {
      await onSave(data)
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper title="Theme" description="Color theme for your documentation site">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FieldWrapper label="Color theme">
          <Controller
            name="theme"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'neutral'}
                onValueChange={field.onChange}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      <div className="flex flex-col">
                        <span>{theme.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldWrapper>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={disabled || isSaving || !formState.isDirty} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </BlockWrapper>
  )
}
