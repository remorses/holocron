import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type LogoMode = 'none' | 'url' | 'upload'

type LogoBlockValues = Pick<DocsJsonType, 'logo'>

type LogoBlockProps = {
  defaultValues: LogoBlockValues
  onSave: (data: LogoBlockValues) => Promise<void>
  onPreview?: (data: LogoBlockValues) => void
  disabled?: boolean
  uploadFunction?: (file: File) => Promise<string>
}

export function LogoBlock({ defaultValues, onSave, onPreview, disabled, uploadFunction }: LogoBlockProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<LogoMode>(() => {
    if (!defaultValues.logo?.light && !defaultValues.logo?.dark) {
      return 'none'
    }
    return 'url'
  })

  const { register, handleSubmit, formState, watch, setValue, reset } = useForm<LogoBlockValues>({
    defaultValues,
  })

  const onSubmit = async (data: LogoBlockValues) => {
    setIsSaving(true)
    try {
      if (mode === 'none') {
        await onSave({ logo: undefined })
      } else {
        await onSave(data)
      }
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpload = async (file: File, field: 'light' | 'dark') => {
    if (!uploadFunction) {
      return
    }
    const url = await uploadFunction(file)
    setValue(`logo.${field}`, url, { shouldDirty: true })
  }

  return (
    <BlockWrapper title="Logo" description="Logo shown in the top left of the navbar">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => { setMode(v as LogoMode) }}>
          <TabsList className="w-full">
            <TabsTrigger value="none" className="flex-1 text-xs">None</TabsTrigger>
            <TabsTrigger value="url" className="flex-1 text-xs">URL</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 text-xs">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="none">
            <p className="text-xs text-muted-foreground py-2">No logo will be displayed</p>
          </TabsContent>

          <TabsContent value="url" className="space-y-3">
            <FieldWrapper label="Light mode" error={formState.errors.logo?.light?.message}>
              <Input
                {...register('logo.light')}
                placeholder="https://example.com/logo-light.svg"
                disabled={disabled}
              />
            </FieldWrapper>
            <FieldWrapper label="Dark mode" error={formState.errors.logo?.dark?.message}>
              <Input
                {...register('logo.dark')}
                placeholder="https://example.com/logo-dark.svg"
                disabled={disabled}
              />
            </FieldWrapper>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <FieldWrapper label="Light mode">
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={disabled || !uploadFunction}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleUpload(file, 'light')
                    }
                  }}
                  className="text-xs"
                />
              </div>
              {watch('logo.light') && (
                <p className="text-xs text-muted-foreground truncate">{watch('logo.light')}</p>
              )}
            </FieldWrapper>
            <FieldWrapper label="Dark mode">
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={disabled || !uploadFunction}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleUpload(file, 'dark')
                    }
                  }}
                  className="text-xs"
                />
              </div>
              {watch('logo.dark') && (
                <p className="text-xs text-muted-foreground truncate">{watch('logo.dark')}</p>
              )}
            </FieldWrapper>
          </TabsContent>
        </Tabs>

        {mode !== 'none' && (
          <>
            <FieldWrapper label="Logo link (optional)" description="URL to navigate to when clicking the logo">
              <Input
                {...register('logo.href')}
                placeholder="/"
                disabled={disabled}
              />
            </FieldWrapper>
            <FieldWrapper label="Logo text (optional)" description="Text shown next to an icon-only logo">
              <Input
                {...register('logo.text')}
                placeholder="My Docs"
                disabled={disabled}
              />
            </FieldWrapper>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={disabled || isSaving || !formState.isDirty} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </BlockWrapper>
  )
}
