import { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import { ColorPickerButton } from '../components/color-picker-button'
import type { DocsJsonType, CssVariablesFormValues, CssVariableEntry } from '../types'

type CssVariablesBlockValues = Pick<DocsJsonType, 'cssVariables'>

type CssVariablesBlockProps = {
  defaultValues: CssVariablesBlockValues
  onSave: (data: CssVariablesBlockValues) => Promise<void>
  onPreview?: (data: CssVariablesBlockValues) => void
  disabled?: boolean
}

function recordToEntries(record: Record<string, string> | undefined): CssVariableEntry[] {
  return Object.entries(record || {}).map(([name, value]) => ({ name, value }))
}

function entriesToRecord(entries: CssVariableEntry[]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, { name, value }) => {
    if (name && value) {
      acc[name] = value
    }
    return acc
  }, {})
}

export function CssVariablesBlock({ defaultValues, onSave, onPreview, disabled }: CssVariablesBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, formState, control, reset } = useForm<CssVariablesFormValues>({
    defaultValues: {
      light: recordToEntries(defaultValues.cssVariables?.light),
      dark: recordToEntries(defaultValues.cssVariables?.dark),
    },
  })

  const { fields: lightFields, append: appendLight, remove: removeLight } = useFieldArray({
    control,
    name: 'light',
  })

  const { fields: darkFields, append: appendDark, remove: removeDark } = useFieldArray({
    control,
    name: 'dark',
  })

  const onSubmit = async (data: CssVariablesFormValues) => {
    setIsSaving(true)
    try {
      const light = entriesToRecord(data.light)
      const dark = entriesToRecord(data.dark)
      const hasVars = Object.keys(light).length > 0 || Object.keys(dark).length > 0
      await onSave({
        cssVariables: hasVars ? { light, dark } : undefined,
      })
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper
      title="CSS Variables"
      description="Custom CSS variables for light and dark modes"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            Variable names should start with <code className="bg-muted px-1 rounded">--</code>
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Light Mode</p>
          {lightFields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              <Input
                {...register(`light.${index}.name`)}
                placeholder="--primary"
                disabled={disabled}
                className="flex-1"
              />
              <Controller
                control={control}
                name={`light.${index}.value`}
                render={({ field: colorField }) => (
                  <ColorPickerButton
                    value={colorField.value}
                    onChange={colorField.onChange}
                    disabled={disabled}
                  />
                )}
              />
              <Input
                {...register(`light.${index}.value`)}
                placeholder="#3b82f6"
                disabled={disabled}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { removeLight(index) }}
                disabled={disabled}
                className="size-9 shrink-0"
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { appendLight({ name: '', value: '' }) }}
            disabled={disabled}
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Light Variable
          </Button>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Dark Mode</p>
          {darkFields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              <Input
                {...register(`dark.${index}.name`)}
                placeholder="--primary"
                disabled={disabled}
                className="flex-1"
              />
              <Controller
                control={control}
                name={`dark.${index}.value`}
                render={({ field: colorField }) => (
                  <ColorPickerButton
                    value={colorField.value}
                    onChange={colorField.onChange}
                    disabled={disabled}
                  />
                )}
              />
              <Input
                {...register(`dark.${index}.value`)}
                placeholder="#60a5fa"
                disabled={disabled}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { removeDark(index) }}
                disabled={disabled}
                className="size-9 shrink-0"
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { appendDark({ name: '', value: '' }) }}
            disabled={disabled}
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Dark Variable
          </Button>
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
