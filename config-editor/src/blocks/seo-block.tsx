import { useFormContext, useFieldArray, Controller } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { SeoFormValues, DocsJsonType, BlockTransform } from '../types'

export function SeoBlock() {
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
                />
                <Input
                  {...register(`metatags.${index}.content`)}
                  placeholder="content"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { remove(index) }}
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
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Meta Tag
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

SeoBlock.transform = {
  toForm(config) {
    return {
      description: config.description ?? '',
      indexing: config.seo?.indexing ?? 'default',
      metatags: Object.entries(config.seo?.metatags || {}).map(([name, content]) => ({
        name,
        content: String(content ?? ''),
      })),
    }
  },
  toConfig(form) {
    const metatags = form.metatags?.reduce(
      (acc, entry) => {
        if (entry.name && entry.content) {
          acc[entry.name] = entry.content
        }
        return acc
      },
      {} as Record<string, string>,
    )
    return {
      description: form.description,
      seo: {
        indexing: form.indexing === 'default' ? undefined : form.indexing,
        metatags,
      },
    }
  },
} satisfies BlockTransform<SeoFormValues>
