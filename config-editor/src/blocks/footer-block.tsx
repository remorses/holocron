import { useState } from 'react'
import { useForm, useFieldArray, UseFormRegister, Control } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import { DragGroup } from '../components/drag-group'
import type { DocsJsonType, FooterFormValues, SocialEntry, FooterLinkColumn } from '../types'

type FooterBlockValues = Pick<DocsJsonType, 'footer'>

type FooterBlockProps = {
  defaultValues: FooterBlockValues
  onSave: (data: FooterBlockValues) => Promise<void>
  onPreview?: (data: FooterBlockValues) => void
  disabled?: boolean
}

const SOCIAL_PLATFORMS = ['twitter', 'github', 'discord', 'linkedin', 'youtube', 'facebook', 'instagram'] as const

function socialsToEntries(socials: Record<string, string> | undefined): SocialEntry[] {
  return SOCIAL_PLATFORMS.map((platform) => ({
    platform,
    url: socials?.[platform] || '',
  }))
}

function entriesToSocials(entries: SocialEntry[]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, { platform, url }) => {
    if (url) {
      acc[platform] = url
    }
    return acc
  }, {})
}

export function FooterBlock({ defaultValues, onSave, onPreview, disabled }: FooterBlockProps) {
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, formState, control, reset } = useForm<FooterFormValues>({
    defaultValues: {
      socials: socialsToEntries(defaultValues.footer?.socials),
      links: (defaultValues.footer?.links || []) as FooterLinkColumn[],
    },
  })

  const columnsFieldArray = useFieldArray({
    control,
    name: 'links',
  })

  const { fields: linkColumns, append: appendColumn, remove: removeColumn } = columnsFieldArray

  const onSubmit = async (data: FooterFormValues) => {
    setIsSaving(true)
    try {
      const socials = entriesToSocials(data.socials)
      const links = data.links
        .map((col) => ({
          header: col.header,
          items: col.items.filter((item) => item.label && item.href),
        }))
        .filter((col) => col.items.length > 0)

      await onSave({
        footer: {
          socials: Object.keys(socials).length > 0 ? socials : undefined,
          links: links.length > 0 ? links : undefined,
        },
      })
      reset(data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BlockWrapper title="Footer" description="Footer content shown at the bottom of all pages">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Social Links</p>
          <div className="space-y-2">
            {SOCIAL_PLATFORMS.map((platform, index) => (
              <div key={platform} className="flex gap-2 items-center">
                <span className="text-xs w-16 capitalize">{platform}</span>
                <Input
                  {...register(`socials.${index}.url`)}
                  placeholder={`https://${platform}.com/...`}
                  disabled={disabled}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Link Columns</p>
          <DragGroup fieldArray={columnsFieldArray} className="space-y-2">
            {linkColumns.map((column, colIndex) => (
              <DragGroup.Item key={column.id} id={column.id} className="flex gap-2 items-start">
                <DragGroup.Handle className="mt-3" />
                <div className="flex-1">
                  <FooterColumn
                    colIndex={colIndex}
                    register={register}
                    control={control}
                    disabled={disabled}
                    onRemove={() => { removeColumn(colIndex) }}
                  />
                </div>
              </DragGroup.Item>
            ))}
          </DragGroup>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { appendColumn({ header: '', items: [{ label: '', href: '' }] }) }}
            disabled={disabled}
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Column
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

function FooterColumn({
  colIndex,
  register,
  control,
  disabled,
  onRemove,
}: {
  colIndex: number
  register: UseFormRegister<FooterFormValues>
  control: Control<FooterFormValues>
  disabled?: boolean
  onRemove: () => void
}) {
  const { fields: items, append: appendItem, remove: removeItem } = useFieldArray({
    control,
    name: `links.${colIndex}.items`,
  })

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Column #{colIndex + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          className="size-7"
        >
          <TrashIcon className="size-3" />
        </Button>
      </div>

      <FieldWrapper label="Header (optional)">
        <Input
          {...register(`links.${colIndex}.header`)}
          placeholder="Resources"
          disabled={disabled}
        />
      </FieldWrapper>

      <div className="space-y-2 pl-2 border-l-2">
        {items.map((item, itemIndex) => (
          <div key={item.id} className="space-y-1">
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input
                  {...register(`links.${colIndex}.items.${itemIndex}.label`)}
                  placeholder="Label"
                  disabled={disabled}
                />
                <Input
                  {...register(`links.${colIndex}.items.${itemIndex}.href`)}
                  placeholder="https://..."
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { removeItem(itemIndex) }}
                disabled={disabled}
                className="size-7 shrink-0"
              >
                <TrashIcon className="size-3" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { appendItem({ label: '', href: '' }) }}
          disabled={disabled}
          className="w-full text-xs h-7"
        >
          <PlusIcon className="size-3 mr-1" />
          Add Link
        </Button>
      </div>
    </div>
  )
}
