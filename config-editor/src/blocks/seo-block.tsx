import { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { DocsJsonType } from '../types'

type SeoBlockValues = Pick<DocsJsonType, 'description' | 'seo'>

type SeoBlockProps = {
  defaultValues: SeoBlockValues
  onSave: (data: SeoBlockValues) => Promise<void>
  onPreview?: (data: SeoBlockValues) => void
  disabled?: boolean
}

export function SeoBlock({ defaultValues, onSave, onPreview, disabled }: SeoBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const defaultMetatags = Object.entries(defaultValues.seo?.metatags || {}).map(([name, content]) => ({
    name,
    content,
  }))

  const { register, handleSubmit, formState, control, reset } = useForm<{
    description: string
    indexing: 'navigable' | 'all' | 'default'
    metatags: { name: string; content: string }[]
  }>({
    defaultValues: {
      description: defaultValues.description || '',
      indexing: defaultValues.seo?.indexing || 'default',
      metatags: defaultMetatags,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metatags',
  })

  const onSubmit = async (data: { description: string; indexing: 'navigable' | 'all' | 'default'; metatags: { name: string; content: string }[] }) => {
    setIsSaving(true)
    try {
      const metatags: Record<string, string> = {}
      data.metatags.forEach((m) => {
        if (m.name && m.content) {
          metatags[m.name] = m.content
        }
      })

      await onSave({
        description: data.description || undefined,
        seo: {
          metatags: Object.keys(metatags).length > 0 ? metatags : undefined,
          indexing: data.indexing === 'default' ? undefined : data.indexing,
        },
      })
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper title="SEO" description="Search engine optimization settings">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <Button type="submit" size="sm" disabled={disabled || isSaving || !formState.isDirty} isLoading={isSaving}>
            Save
          </Button>
        </div>
      </form>
    </BlockWrapper>
  )
}
