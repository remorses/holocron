import { useState } from 'react'
import { useFormContext, useFieldArray } from 'react-hook-form'
import { PlusIcon, TrashIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BlockWrapper } from '../components/block-wrapper'
import { FieldWrapper } from '../components/field-wrapper'
import type { PasswordsFormValues } from '../types'

type PasswordsBlockProps = {
  disabled?: boolean
}

export function PasswordsBlock({ disabled }: PasswordsBlockProps) {
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({})

  const { register, formState, control } = useFormContext<PasswordsFormValues>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'passwords',
  })

  const toggleShowPassword = (index: number) => {
    setShowPasswords((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <BlockWrapper
      title="Password Protection"
      description="Require a password to access your documentation"
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-md border p-3 space-y-3">
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <FieldWrapper label="Password" required error={formState.errors.passwords?.[index]?.password?.message}>
                    <div className="relative">
                      <Input
                        {...register(`passwords.${index}.password`, {
                          required: 'Password is required',
                          minLength: { value: 1, message: 'Password cannot be empty' },
                        })}
                        type={showPasswords[index] ? 'text' : 'password'}
                        placeholder="Enter password"
                        disabled={disabled}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => { toggleShowPassword(index) }}
                      >
                        {showPasswords[index] ? (
                          <EyeOffIcon className="size-4" />
                        ) : (
                          <EyeIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                  </FieldWrapper>
                  <FieldWrapper label="Name (optional)" description="Label for this password, e.g., 'Team Access'">
                    <Input
                      {...register(`passwords.${index}.name`)}
                      placeholder="Team Access"
                      disabled={disabled}
                    />
                  </FieldWrapper>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => { remove(index) }}
                  disabled={disabled}
                  className="shrink-0 mt-6"
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { append({ password: '', name: '' }) }}
          disabled={disabled}
          className="w-full"
        >
          <PlusIcon className="size-4 mr-1" />
          Add Password
        </Button>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={disabled || formState.isSubmitting || !formState.isDirty} isLoading={formState.isSubmitting}>
            Save
          </Button>
        </div>
      </div>
    </BlockWrapper>
  )
}
