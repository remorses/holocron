import { useFormContext, useFieldArray } from 'react-hook-form'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import type { DomainsFormValues, DocsJsonType, BlockTransform } from '../types'

type DomainsBlockProps = {
  cnameTarget?: string
  internalDomain?: string
}

export function DomainsBlock({
  cnameTarget = 'cname.holocronsites.com',
  internalDomain,
}: DomainsBlockProps) {
  const { register, formState, control, watch } =
    useFormContext<DomainsFormValues>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'domains',
  })

  return (
    <BlockWrapper
      title='Custom Domains'
      description='Connect custom domains to your documentation site'
    >
      <div className='space-y-4'>
        <div className='rounded-md bg-muted/50 p-3 space-y-1'>
          <p className='text-xs font-medium'>DNS Configuration</p>
          <p className='text-xs text-muted-foreground'>
            Point your domain to{' '}
            <code className='bg-muted px-1 rounded'>{cnameTarget}</code> via
            CNAME record
            <div className='mt-3'>
              <table className='w-full text-xs text-left border border-muted rounded bg-background'>
                <thead>
                  <tr className='bg-muted/60'>
                    <th className='py-1 px-2 border-b border-muted font-medium'>
                      Type
                    </th>
                    <th className='py-1 px-2 border-b border-muted font-medium'>
                      Name / Host
                    </th>
                    <th className='py-1 px-2 border-b border-muted font-medium'>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className='py-1 px-2 border-b border-muted'>CNAME</td>
                    <td className='py-1 px-2 border-b border-muted italic'>
                      your custom domain
                    </td>
                    <td className='py-1 px-2 border-b border-muted font-mono'>
                      {cnameTarget}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </p>
        </div>

        <div className='space-y-2'>
          {fields.map((field, index) => {
            const domainValue = watch(`domains.${index}.value`)
            const isInternal = Boolean(
              internalDomain &&
                typeof domainValue === 'string' &&
                domainValue.endsWith(internalDomain),
            )
            return (
              <div key={field.id} className='flex gap-2 items-start'>
                <div className='flex-1'>
                  <Input
                    {...register(`domains.${index}.value`, {
                      required: 'Domain is required',
                      pattern: {
                        value:
                          /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/,
                        message: 'Invalid domain format',
                      },
                    })}
                    placeholder='docs.example.com'
                    disabled={isInternal}
                  />
                  {formState.errors.domains?.[index]?.value && (
                    <p className='text-xs text-destructive mt-1'>
                      {formState.errors.domains[index]?.value?.message}
                    </p>
                  )}
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => {
                    remove(index)
                  }}
                  disabled={isInternal}
                  className='shrink-0'
                >
                  <TrashIcon className='size-4' />
                </Button>
              </div>
            )
          })}
        </div>

        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => {
            append({ value: '' })
          }}
          className='w-full'
        >
          <PlusIcon className='size-4 mr-1' />
          Add Domain
        </Button>

        <div className='flex justify-end pt-2'>
          <Button
            type='submit'
            size='sm'
            disabled={formState.isSubmitting || !formState.isDirty}
            isLoading={formState.isSubmitting}
          >
            Save
          </Button>
        </div>
      </div>
    </BlockWrapper>
  )
}

DomainsBlock.transform = {
  toForm(config) {
    return {
      domains: (config.domains ?? []).map((d) => ({ value: d })),
    }
  },
  toConfig(form) {
    return {
      domains: form.domains?.map((d) => d.value).filter(Boolean),
    }
  },
} satisfies BlockTransform<DomainsFormValues>
