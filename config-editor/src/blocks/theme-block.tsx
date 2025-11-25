import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import { themeNames, type DocsJsonType } from '../types'

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
                  {themeNames.map((theme) => (
                    <SelectItem key={theme} value={theme} className="capitalize">
                      {theme}
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
