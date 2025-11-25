import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type FaviconMode = 'url' | 'upload'

type FaviconBlockValues = Pick<DocsJsonType, 'favicon'>

type FaviconBlockProps = {
  defaultValues: FaviconBlockValues
  onSave: (data: FaviconBlockValues) => Promise<void>
  onPreview?: (data: FaviconBlockValues) => void
  disabled?: boolean
  uploadFunction?: (file: File) => Promise<string>
}

export function FaviconBlock({ defaultValues, onSave, onPreview, disabled, uploadFunction }: FaviconBlockProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<FaviconMode>('url')

  const { register, handleSubmit, formState, watch, setValue, reset } = useForm<FaviconBlockValues>({
    defaultValues,
  })

  const onSubmit = async (data: FaviconBlockValues) => {
    setIsSaving(true)
    try {
      await onSave(data)
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
    setValue(`favicon.${field}`, url, { shouldDirty: true })
  }

  return (
    <BlockWrapper title="Favicon" description="Browser tab icon for your site">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => { setMode(v as FaviconMode) }}>
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1 text-xs">URL</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 text-xs">Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-3">
            <FieldWrapper label="Light mode" error={formState.errors.favicon?.light?.message}>
              <Input
                {...register('favicon.light')}
                placeholder="https://example.com/favicon-light.svg"
                disabled={disabled}
              />
            </FieldWrapper>
            <FieldWrapper label="Dark mode" error={formState.errors.favicon?.dark?.message}>
              <Input
                {...register('favicon.dark')}
                placeholder="https://example.com/favicon-dark.svg"
                disabled={disabled}
              />
            </FieldWrapper>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3">
            <FieldWrapper label="Light mode">
              <Input
                type="file"
                accept="image/*,.ico"
                disabled={disabled || !uploadFunction}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleUpload(file, 'light')
                  }
                }}
                className="text-xs"
              />
              {watch('favicon.light') && (
                <p className="text-xs text-muted-foreground truncate">{watch('favicon.light')}</p>
              )}
            </FieldWrapper>
            <FieldWrapper label="Dark mode">
              <Input
                type="file"
                accept="image/*,.ico"
                disabled={disabled || !uploadFunction}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleUpload(file, 'dark')
                  }
                }}
                className="text-xs"
              />
              {watch('favicon.dark') && (
                <p className="text-xs text-muted-foreground truncate">{watch('favicon.dark')}</p>
              )}
            </FieldWrapper>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={disabled || isSaving || !formState.isDirty} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </BlockWrapper>
  )
}
