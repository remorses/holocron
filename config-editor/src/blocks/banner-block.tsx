import { useId } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

export type BannerBlockValues = Pick<DocsJsonType, 'banner'>

export function BannerBlock() {
  const id = useId()
  const { register, formState, control } = useFormContext<BannerBlockValues>()

  return (
    <BlockWrapper title="Banner" description="Announcement banner shown at the top of all pages">
      <FieldWrapper
        label="Banner content"
        description="HTML or MDX content for the banner"
        error={formState.errors.banner?.content?.message}
      >
        <Textarea
          {...register('banner.content')}
          placeholder="<a href='/changelog'>Check out our new features!</a>"
          rows={3}
        />
      </FieldWrapper>

      <div className="flex items-center gap-2 mt-4">
        <Controller
          name="banner.dismissible"
          control={control}
          render={({ field }) => (
            <Switch
              id={`${id}-dismissible`}
              checked={field.value || false}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor={`${id}-dismissible`} className="text-xs">Allow users to dismiss the banner</Label>
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit" size="sm" disabled={formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
          Save
        </Button>
      </div>
    </BlockWrapper>
  )
}
