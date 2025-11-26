import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { UploadButton } from '../components/upload-button'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type FaviconMode = 'url' | 'upload'

export type FaviconBlockValues = Pick<DocsJsonType, 'favicon'>

type FaviconBlockProps = {
  uploadFunction?: (file: File) => Promise<string>
}

export function FaviconBlock({ uploadFunction }: FaviconBlockProps) {
  const [mode, setMode] = useState<FaviconMode>('url')
  const { register, formState, watch, setValue } = useFormContext<FaviconBlockValues>()

  return (
    <BlockWrapper title="Favicon" description="Browser tab icon for your site">
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
            />
          </FieldWrapper>
          <FieldWrapper label="Dark mode" error={formState.errors.favicon?.dark?.message}>
            <Input
              {...register('favicon.dark')}
              placeholder="https://example.com/favicon-dark.svg"
            />
          </FieldWrapper>
        </TabsContent>

        <TabsContent value="upload" className="space-y-3">
          <FieldWrapper label="Light mode">
            <UploadButton
              className="mx-1"
              accept="image/*,.ico"
              disabled={!uploadFunction}
              uploadFunction={uploadFunction!}
              onUploadFinished={({ src }) => {
                setValue('favicon.light', src, { shouldDirty: true })
              }}
              variant="outline"
              size="sm"
            >
              Upload Light Favicon
            </UploadButton>
            {watch('favicon.light') && (
              <p className="text-xs text-muted-foreground truncate mt-1">{watch('favicon.light')}</p>
            )}
          </FieldWrapper>
          <FieldWrapper label="Dark mode">
            <UploadButton
              className="mx-1"
              accept="image/*,.ico"
              disabled={!uploadFunction}
              uploadFunction={uploadFunction!}
              onUploadFinished={({ src }) => {
                setValue('favicon.dark', src, { shouldDirty: true })
              }}
              variant="outline"
              size="sm"
            >
              Upload Dark Favicon
            </UploadButton>
            {watch('favicon.dark') && (
              <p className="text-xs text-muted-foreground truncate mt-1">{watch('favicon.dark')}</p>
            )}
          </FieldWrapper>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end pt-4">
        <Button type="submit" size="sm" disabled={formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
          Save
        </Button>
      </div>
    </BlockWrapper>
  )
}
