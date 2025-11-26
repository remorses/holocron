import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { SeoFormValues } from '../types'

type SeoBlockProps = {
  disabled?: boolean
}

export function SeoBlock({ disabled }: SeoBlockProps) {
  const { register, formState, control } = useFormContext<SeoFormValues>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metatags',
  })

  return (
    <BlockWrapper title="SEO" description="Search engine optimization settings">
      <div className="space-y-4">
        <FieldWrapper
          label="Default description"
          description="Used for pages without a description in frontmatter"
        >
          <Textarea
            {...register('description')}
            placeholder="Documentation for..."
            disabled={disabled}
            rows={2}
          />
        </FieldWrapper>

        <FieldWrapper label="Indexing mode">
          <Controller
            name="indexing"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'default'}
                onValueChange={field.onChange}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="navigable">Navigable only</SelectItem>
                  <SelectItem value="all">All pages</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FieldWrapper>

        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Custom Meta Tags</p>
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input
                  {...register(`metatags.${index}.name`)}
                  placeholder="name"
                  disabled={disabled}
                />
                <Input
                  {...register(`metatags.${index}.content`)}
                  placeholder="content"
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { remove(index) }}
                disabled={disabled}
                className="size-7 shrink-0"
              >
                <TrashIcon className="size-3" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { append({ name: '', content: '' }) }}
            disabled={disabled}
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Meta Tag
          </Button>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={disabled || formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
            Save
          </Button>
        </div>
      </div>
    </BlockWrapper>
  )
}
