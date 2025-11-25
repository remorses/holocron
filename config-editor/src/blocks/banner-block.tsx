import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type BannerBlockValues = Pick<DocsJsonType, 'banner'>

type BannerBlockProps = {
  defaultValues: BannerBlockValues
  onSave: (data: BannerBlockValues) => Promise<void>
  onPreview?: (data: BannerBlockValues) => void
  disabled?: boolean
}

export function BannerBlock({ defaultValues, onSave, onPreview, disabled }: BannerBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, formState, control, reset } = useForm<BannerBlockValues>({
    defaultValues,
  })

  const onSubmit = async (data: BannerBlockValues) => {
    setIsSaving(true)
    try {
      await onSave(data)
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper title="Banner" description="Announcement banner shown at the top of all pages">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FieldWrapper
          label="Banner content"
          description="HTML or MDX content for the banner"
          error={formState.errors.banner?.content?.message}
        >
          <Textarea
            {...register('banner.content')}
            placeholder="<a href='/changelog'>Check out our new features!</a>"
            disabled={disabled}
            rows={3}
          />
        </FieldWrapper>

        <div className="flex items-center gap-2">
          <Controller
            name="banner.dismissible"
            control={control}
            render={({ field }) => (
              <Switch
                id="banner-dismissible"
                checked={field.value || false}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <Label htmlFor="banner-dismissible" className="text-xs">Allow users to dismiss the banner</Label>
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
