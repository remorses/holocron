import { useFormContext, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import { themeNames, type DocsJsonType } from '../types'

export type ThemeBlockValues = Pick<DocsJsonType, 'theme'>

export function ThemeBlock() {
  const { control, formState } = useFormContext<ThemeBlockValues>()

  return (
    <BlockWrapper title="Theme" description="Color theme for your documentation site">
      <FieldWrapper label="Color theme">
        <Controller
          name="theme"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || 'neutral'}
              onValueChange={field.onChange}
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
      <div className="flex justify-end pt-4">
        <Button type="submit" size="sm" disabled={formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
          Save
        </Button>
      </div>
    </BlockWrapper>
  )
}
