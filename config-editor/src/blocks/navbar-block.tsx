import { useState } from 'react'
import { useFormContext, useFieldArray } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import { DragGroup } from '../components/drag-group'
import type { DocsJsonType } from '../types'

export type NavbarBlockValues = Pick<DocsJsonType, 'navbar'>

type PrimaryType = 'none' | 'button' | 'github'

type NavbarBlockProps = {
  disabled?: boolean
}

export function NavbarBlock({ disabled }: NavbarBlockProps) {
  const { register, formState, control, watch } = useFormContext<NavbarBlockValues>()

  const [primaryType, setPrimaryType] = useState<PrimaryType>(() => {
    const primary = watch('navbar.primary')
    if (!primary) {
      return 'none'
    }
    return primary.type
  })

  const fieldArray = useFieldArray({
    control,
    name: 'navbar.links',
  })
  const { fields, append, remove } = fieldArray

  return (
    <BlockWrapper title="Navbar Links" description="Navigation links shown in the top header">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Links</p>
        <DragGroup fieldArray={fieldArray}>
          {fields.map((field, index) => (
            <DragGroup.Item key={field.id} id={field.id} className="rounded-md border p-3 space-y-2 bg-card">
              <div className="flex items-center gap-2">
                <DragGroup.Handle />
                <span className="text-xs text-muted-foreground">#{index + 1}</span>
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { remove(index) }}
                  disabled={disabled}
                  className="size-7"
                >
                  <TrashIcon className="size-3" />
                </Button>
              </div>
              <FieldWrapper label="Label" required error={formState.errors.navbar?.links?.[index]?.label?.message}>
                <Input
                  {...register(`navbar.links.${index}.label`, { required: 'Label is required' })}
                  placeholder="Documentation"
                  disabled={disabled}
                />
              </FieldWrapper>
              <FieldWrapper label="URL" required error={formState.errors.navbar?.links?.[index]?.href?.message}>
                <Input
                  {...register(`navbar.links.${index}.href`, { required: 'URL is required' })}
                  placeholder="https://docs.example.com"
                  disabled={disabled}
                />
              </FieldWrapper>
              <FieldWrapper label="Icon (optional)" description="Lucide icon name">
                <Input
                  {...register(`navbar.links.${index}.icon`)}
                  placeholder="BookOpen"
                  disabled={disabled}
                />
              </FieldWrapper>
            </DragGroup.Item>
          ))}
        </DragGroup>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { append({ label: '', href: '', icon: '' }) }}
          disabled={disabled}
          className="w-full"
        >
          <PlusIcon className="size-4 mr-1" />
          Add Link
        </Button>
      </div>

      <div className="space-y-2 pt-4 mt-4 border-t">
        <p className="text-xs font-medium text-muted-foreground">Primary CTA</p>
        <Tabs value={primaryType} onValueChange={(v) => { setPrimaryType(v as PrimaryType) }}>
          <TabsList className="w-full">
            <TabsTrigger value="none" className="flex-1 text-xs">None</TabsTrigger>
            <TabsTrigger value="button" className="flex-1 text-xs">Button</TabsTrigger>
            <TabsTrigger value="github" className="flex-1 text-xs">GitHub</TabsTrigger>
          </TabsList>

          <TabsContent value="none">
            <p className="text-xs text-muted-foreground py-2">No primary CTA</p>
          </TabsContent>

          <TabsContent value="button" className="space-y-2">
            <FieldWrapper label="Button label">
              <Input
                {...register('navbar.primary.label' as any)}
                placeholder="Get Started"
                disabled={disabled}
              />
            </FieldWrapper>
            <FieldWrapper label="Button URL">
              <Input
                {...register('navbar.primary.href' as any)}
                placeholder="https://example.com/signup"
                disabled={disabled}
              />
            </FieldWrapper>
          </TabsContent>

          <TabsContent value="github" className="space-y-2">
            <FieldWrapper label="GitHub repo URL">
              <Input
                {...register('navbar.primary.href' as any)}
                placeholder="https://github.com/org/repo"
                disabled={disabled}
              />
            </FieldWrapper>
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit" size="sm" disabled={disabled || formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
          Save
        </Button>
      </div>
    </BlockWrapper>
  )
}
