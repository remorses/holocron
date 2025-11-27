import { useFormContext, useFieldArray, UseFormRegister, Control } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import { DragGroup } from '../components/drag-group'
import { socialPlatforms, type FooterFormValues, type FooterLinkColumn, type DocsJsonType, type BlockTransform } from '../types'

export function FooterBlock() {
  const { register, formState, control } = useFormContext<FooterFormValues>()

  const columnsFieldArray = useFieldArray({
    control,
    name: 'links',
  })

  const { fields: linkColumns, append: appendColumn, remove: removeColumn } = columnsFieldArray

  return (
    <BlockWrapper title="Footer" description="Footer content shown at the bottom of all pages">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Social Links</p>
          <div className="space-y-2">
            {socialPlatforms.map((platform, index) => (
              <div key={platform} className="flex gap-2 items-center">
                <span className="text-xs w-16 capitalize">{platform}</span>
                <Input
                  {...register(`socials.${index}.url`)}
                  placeholder={`https://${platform}.com/...`}
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
            className="w-full"
          >
            <PlusIcon className="size-4 mr-1" />
            Add Column
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

FooterBlock.transform = {
  toForm(config) {
    return {
      socials: socialPlatforms.map((platform) => ({
        platform,
        url: config.footer?.socials?.[platform] || '',
      })),
      links: (config.footer?.links ?? []).map((link) => ({
        header: link.header ?? '',
        items: link.items,
      })),
    }
  },
  toConfig(form) {
    const socials = form.socials?.reduce(
      (acc, entry) => {
        if (entry.url) {
          acc[entry.platform] = entry.url
        }
        return acc
      },
      {} as Record<string, string>,
    )
    return {
      footer: {
        socials,
        links: form.links,
      },
    }
  },
} satisfies BlockTransform<FooterFormValues>

function FooterColumn({
  colIndex,
  register,
  control,
  onRemove,
}: {
  colIndex: number
  register: UseFormRegister<FooterFormValues>
  control: Control<FooterFormValues>
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
          className="size-7"
        >
          <TrashIcon className="size-3" />
        </Button>
      </div>

      <FieldWrapper label="Header (optional)">
        <Input
          {...register(`links.${colIndex}.header`)}
          placeholder="Resources"
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
                />
                <Input
                  {...register(`links.${colIndex}.items.${itemIndex}.href`)}
                  placeholder="https://..."
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { removeItem(itemIndex) }}
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
          className="w-full text-xs h-7"
        >
          <PlusIcon className="size-3 mr-1" />
          Add Link
        </Button>
      </div>
    </div>
  )
}
