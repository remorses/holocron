import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { UploadButton } from '../components/upload-button'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type LogoMode = 'none' | 'url' | 'upload'

export type LogoBlockValues = Pick<DocsJsonType, 'logo'>

type LogoBlockProps = {
  disabled?: boolean
  uploadFunction?: (file: File) => Promise<string>
}

export function LogoBlock({ disabled, uploadFunction }: LogoBlockProps) {
  const { register, formState, watch, setValue } = useFormContext<LogoBlockValues>()

  const [mode, setMode] = useState<LogoMode>(() => {
    const logo = watch('logo')
    if (!logo?.light && !logo?.dark) {
      return 'none'
    }
    return 'url'
  })

  return (
    <BlockWrapper title="Logo" description="Logo shown in the top left of the navbar">
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
          <div className="flex gap-4">
            <FieldWrapper label="Light mode" className="flex-1">
              <UploadButton
                accept="image/*"
                disabled={disabled || !uploadFunction}
                uploadFunction={uploadFunction!}
                onUploadFinished={({ src }) => {
                  setValue('logo.light', src, { shouldDirty: true })
                }}
                variant="outline"
                size="sm"
              >
                Upload Light Logo
              </UploadButton>
              {watch('logo.light') && (
                <p className="text-xs text-muted-foreground truncate mt-1">{watch('logo.light')}</p>
              )}
            </FieldWrapper>
            <FieldWrapper label="Dark mode" className="flex-1">
              <UploadButton
                accept="image/*"
                disabled={disabled || !uploadFunction}
                uploadFunction={uploadFunction!}
                onUploadFinished={({ src }) => {
                  setValue('logo.dark', src, { shouldDirty: true })
                }}
                variant="outline"
                size="sm"
              >
                Upload Dark Logo
              </UploadButton>
              {watch('logo.dark') && (
                <p className="text-xs text-muted-foreground truncate mt-1">{watch('logo.dark')}</p>
              )}
            </FieldWrapper>
          </div>
        </TabsContent>
      </Tabs>

      {mode !== 'none' && (
        <div className="space-y-3 mt-4">
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
        </div>
      )}
      <div className="flex justify-end pt-4">
        <Button type="submit" size="sm" disabled={disabled || formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
          Save
        </Button>
      </div>
    </BlockWrapper>
  )
}
