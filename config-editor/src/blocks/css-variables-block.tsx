import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BlockWrapper } from '../components/block-wrapper'
import { ColorPickerButton } from '../components/color-picker-button'
import { cssVariableDefinitions, type CssVariablesFormValues, type DocsJsonType, type BlockTransform } from '../types'

export function CssVariablesBlock() {
  const { formState, control, watch, setValue } = useFormContext<CssVariablesFormValues>()

  const { fields: lightFields, append: appendLight, remove: removeLight } = useFieldArray({
    control,
    name: 'light',
  })

  const { fields: darkFields, append: appendDark, remove: removeDark } = useFieldArray({
    control,
    name: 'dark',
  })

  return (
    <BlockWrapper
      title="CSS Variables"
      description="Custom CSS variables for light and dark modes"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Light Mode</p>
          {lightFields.map((field, index) => {
            const colorValue = watch(`light.${index}.value`)
            return (
              <div key={field.id} className="flex gap-2 items-start">
                <Controller
                  control={control}
                  name={`light.${index}.name`}
                  render={({ field: nameField }) => (
                    <Select
                      value={nameField.value}
                      onValueChange={(newName) => {
                        nameField.onChange(newName)
                        const def = cssVariableDefinitions.find((d) => d.name === newName)
                        if (def) {
                          setValue(`light.${index}.value`, def.light, { shouldDirty: true })
                        }
                      }}
                    >
                      <SelectTrigger className="w-[120px] shrink-0">
                        <SelectValue placeholder="Variable" />
                      </SelectTrigger>
                      <SelectContent className="min-w-[180px]">
                        {cssVariableDefinitions.map((def) => (
                          <SelectItem key={def.name} value={def.name}>
                            {def.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <ColorPickerButton
                  value={colorValue}
                  onChange={(newColor) => { setValue(`light.${index}.value`, newColor, { shouldDirty: true }) }}
                />
                <Input
                  value={colorValue}
                  onChange={(e) => { setValue(`light.${index}.value`, e.target.value, { shouldDirty: true }) }}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { removeLight(index) }}
                  className="size-9 shrink-0"
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { appendLight({ name: '', value: '' }) }}
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Light Variable
          </Button>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Dark Mode</p>
          {darkFields.map((field, index) => {
            const colorValue = watch(`dark.${index}.value`)
            return (
              <div key={field.id} className="flex gap-2 items-start">
                <Controller
                  control={control}
                  name={`dark.${index}.name`}
                  render={({ field: nameField }) => (
                    <Select
                      value={nameField.value}
                      onValueChange={(newName) => {
                        nameField.onChange(newName)
                        const def = cssVariableDefinitions.find((d) => d.name === newName)
                        if (def) {
                          setValue(`dark.${index}.value`, def.dark, { shouldDirty: true })
                        }
                      }}
                    >
                      <SelectTrigger className="w-[120px] shrink-0">
                        <SelectValue placeholder="Variable" />
                      </SelectTrigger>
                      <SelectContent className="min-w-[180px]">
                        {cssVariableDefinitions.map((def) => (
                          <SelectItem key={def.name} value={def.name}>
                            {def.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <ColorPickerButton
                  value={colorValue}
                  onChange={(newColor) => { setValue(`dark.${index}.value`, newColor, { shouldDirty: true }) }}
                />
                <Input
                  value={colorValue}
                  onChange={(e) => { setValue(`dark.${index}.value`, e.target.value, { shouldDirty: true }) }}
                  placeholder="#60a5fa"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { removeDark(index) }}
                  className="size-9 shrink-0"
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { appendDark({ name: '', value: '' }) }}
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Dark Variable
          </Button>
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

CssVariablesBlock.transform = {
  toForm(config) {
    return {
      light: Object.entries(config.cssVariables?.light || {}).map(([name, value]) => ({
        name,
        value: String(value ?? ''),
      })),
      dark: Object.entries(config.cssVariables?.dark || {}).map(([name, value]) => ({
        name,
        value: String(value ?? ''),
      })),
    }
  },
  toConfig(form) {
    const light = form.light?.reduce(
      (acc, entry) => {
        if (entry.name && entry.value) {
          acc[entry.name] = entry.value
        }
        return acc
      },
      {} as Record<string, string>,
    )
    const dark = form.dark?.reduce(
      (acc, entry) => {
        if (entry.name && entry.value) {
          acc[entry.name] = entry.value
        }
        return acc
      },
      {} as Record<string, string>,
    )
    return {
      cssVariables: { light, dark },
    }
  },
} satisfies BlockTransform<CssVariablesFormValues>
