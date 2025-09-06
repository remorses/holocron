import { useEffect } from 'react'
import { useChatContext } from '../index.js'
import { Controller, DeepPartial, useFormContext } from 'react-hook-form'
import { UIMessage } from 'ai'

import type { RenderFormParameters, UIField } from '../lib/render-form-tool.js'
import { cn } from '../lib/cn.js'

import { ColorPickerButton } from './color-picker-button.js'
import { Button } from './ui/button.js'
import { Input } from './ui/input.js'
import { SelectNative } from './ui/select-native.js'
import { Slider } from './ui/slider.js'
import { Switch } from './ui/switch.js'
import { Textarea } from './ui/textarea.js'
import { UploadButton } from './upload-button.js'
import { RadioGroup, RadioGroupItem } from './ui/radio-group.js'
import { Label } from './ui/label.js'

type RenderFieldProps = {
  field: UIField
  disabled?: boolean
  messageId?: string
  uploadFunction?: (file: File) => Promise<string>
}

function RenderField({ field, disabled, messageId, uploadFunction }: RenderFieldProps) {
  const form = useFormContext()
  const { control, getValues, register, setValue } = form

  const name = field.name
  const fieldKey = name ? `form-field-${messageId}-${name}` : null

  useEffect(() => {
    if (disabled || !name || !fieldKey) return

    const persistedValue = localStorage.getItem(fieldKey)
    if (persistedValue) {
      try {
        const parsed = JSON.parse(persistedValue)
        setValue(name, parsed)
        return
      } catch {}
    }

    if ('initialValue' in field && field.initialValue !== undefined) {
      setValue(name, field.initialValue)
    }
  }, [name, fieldKey, field, setValue, disabled])

  useEffect(() => {
    if (disabled || !name || !fieldKey) return

    const subscription = form.watch((value, { name: changedName }) => {
      if (changedName === name) {
        const fieldValue = form.getValues(name)
        if (fieldValue !== undefined && fieldValue !== null) {
          localStorage.setItem(fieldKey, JSON.stringify(fieldValue))
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [name, fieldKey, disabled, form])

  useEffect(() => {
    if (disabled) return

    const handler = () => {
      const value = getValues(field.name)
      if (!value && field.name && 'initialValue' in field) {
        setValue(field.name, field.initialValue)
      }
    }
    window.addEventListener('chatGenerationFinished', handler)
    return () => {
      window.removeEventListener('chatGenerationFinished', handler)
    }
  }, [field, setValue, getValues, disabled])

  const key = `${messageId}-${field.name}`
  if (!field.name) {
    return null
  }
  if (!field.type) {
    return null
  }

  switch (field.type) {
    case 'input':
      return (
        <div key={key} className='flex items-center space-x-2'>
          <Input
            placeholder={field.placeholder || ''}
            {...(name && register(name, {}))}
            disabled={disabled}
            className='bg-muted'
          />
        </div>
      )
    case 'password':
      return (
        <Input
          key={key}
          type='password'
          placeholder={field.placeholder || ''}
          {...(name && register(name))}
          disabled={disabled}
          className='bg-muted'
        />
      )
    case 'number':
      return (
        <Input
          key={key}
          type='number'
          placeholder={field.placeholder || ''}
          {...(!disabled && register(field.name, { valueAsNumber: true }))}
          disabled={disabled}
          className='bg-muted'
        />
      )
    case 'textarea':
      return (
        <Textarea
          key={key}
          placeholder={field.placeholder || ''}
          {...(name && register(name))}
          disabled={disabled}
          className='bg-muted'
        />
      )
    case 'select':
      return (
        <SelectNative
          key={key}
          {...(name && register(name))}
          defaultValue={field.placeholder ? '' : undefined}
          disabled={disabled}
          className='bg-muted'
        >
          {field.placeholder && (
            <option value='' disabled>
              {field.placeholder}
            </option>
          )}
          {field.options?.map((opt) => {
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            )
          })}
        </SelectNative>
      )
    case 'radio':
      return (
        <Controller
          key={key}
          control={control}
          name={name}
          disabled={disabled}
          render={({ field: ctl }) => {
            return (
              <RadioGroup
                className='gap-6'
                value={ctl.value as string | undefined}
                onValueChange={disabled ? undefined : ctl.onChange}
                disabled={disabled}
              >
                {field.options?.map((opt) => {
                  const radioId = `${messageId}-${field.name}-${opt.value}`
                  return (
                    <div key={radioId} className='flex items-start gap-2'>
                      <RadioGroupItem value={opt.value} id={radioId} disabled={disabled} />
                      <div className='grow'>
                        <div className='grid grow gap-2'>
                          <Label htmlFor={radioId}>{opt.label}</Label>
                          {opt.description && (
                            <p id={`${radioId}-description`} className='text-muted-foreground text-xs'>
                              {opt.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </RadioGroup>
            )
          }}
        />
      )
    case 'slider':
      return (
        <Controller
          key={key}
          control={control}
          name={name}
          disabled={disabled}
          render={({ field: ctl }) => {
            return (
              <div className='space-y-2'>
                <Slider
                  min={field.min || undefined}
                  max={field.max || undefined}
                  step={field.step || 1}
                  value={[Number(ctl.value) || 0]}
                  onValueChange={
                    disabled
                      ? undefined
                      : (v) => {
                          ctl.onChange(v[0])
                        }
                  }
                  disabled={disabled}
                />
                <div className='text-xs text-muted-foreground text-center'>{ctl.value}</div>
              </div>
            )
          }}
        />
      )
    case 'switch':
      return (
        <Controller
          key={key}
          control={control}
          name={name}
          disabled={disabled}
          render={({ field: ctl }) => {
            return (
              <Switch
                checked={ctl.value as boolean}
                onCheckedChange={disabled ? undefined : ctl.onChange}
                disabled={disabled}
              />
            )
          }}
        />
      )
    case 'color_picker':
      return (
        <Controller
          key={key}
          control={control}
          name={name}
          disabled={disabled}
          render={({ field: ctl }) => {
            return (
              <ColorPickerButton
                value={ctl.value as string}
                onChange={disabled ? () => {} : ctl.onChange}
                buttonText={field.label}
                disabled={disabled}
              />
            )
          }}
        />
      )
    case 'date_picker':
      return <Input key={key} type='date' {...(name && register(name))} disabled={disabled} className='bg-muted' />
    case 'image_upload':
      return (
        <Controller
          name={name}
          control={control}
          defaultValue=''
          disabled={disabled}
          render={({ field: { value, onChange } }) => (
            <>
              <UploadButton
                onUploadFinished={disabled ? () => {} : ({ src }) => onChange(src)}
                disabled={disabled}
                uploadFunction={uploadFunction || (async (file) => URL.createObjectURL(file))}
              />
            </>
          )}
        />
      )
    case 'button':
      return (
        <Button key={key} asChild className='justify-start' disabled={disabled}>
          <a
            href={field.href || '#'}
            target='_blank'
            rel='noopener noreferrer'
            onClick={
              disabled
                ? (e) => {
                    e.preventDefault()
                  }
                : undefined
            }
          >
            {field.label}
          </a>
        </Button>
      )
    default:
      return null
  }
}

export function RenderFormPreview({
  input: args,
  output: result,
  message,
  showSubmitButton = false,
  className,
  uploadFunction,
}: {
  input?: DeepPartial<RenderFormParameters>
  output?: any
  className?: string
  message: UIMessage
  showSubmitButton?: boolean
  uploadFunction?: (file: File) => Promise<string>
}) {
  const { messages, isGenerating } = useChatContext()

  const disabled = messages[messages.length - 1]?.id !== message.id

  if (!args?.fields || args.fields.length === 0) {
    return <div className='text-muted-foreground text-sm'>No form fields to display</div>
  }

  // Group fields by consecutive groupTitle
  const fieldGroups: { title: string | null; fields: UIField[] }[] = []

  args.fields.forEach((field, index) => {
    const lastGroup = fieldGroups[fieldGroups.length - 1]

    if (lastGroup && lastGroup.title === field?.groupTitle && field?.groupTitle !== null) {
      // Add to existing group if same title
      lastGroup.fields.push(field as any)
    } else {
      // Create new group
      fieldGroups.push({
        title: field?.groupTitle || null,
        fields: [field as any],
      })
    }
  })

  return (
    <div
      className={cn(
        'flex not-prose my-4 font-sans rounded-lg flex-col gap-4 animate-in fade-in',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      {fieldGroups.map((group, groupIndex) => {
        if (group.title) {
          return (
            <div key={`group-${groupIndex}`} className='flex flex-col gap-6'>
              <h3 className='font-medium text-sm text-muted-foreground'>{group.title}</h3>
              <div className='flex flex-col gap-6 rounded border-border'>
                {group.fields.map((f) => (
                  <div key={f.name} className='flex flex-col gap-6'>
                    {f.type !== 'button' && f.type !== 'color_picker' && (
                      <label className='font-medium text-sm'>
                        {f.label}
                        {f.required && <span className='text-red-500 ml-1'>*</span>}
                      </label>
                    )}
                    <RenderField field={f} disabled={disabled} messageId={message.id} uploadFunction={uploadFunction} />
                    {f.description && f.type !== 'button' && (
                      <p className='text-xs text-muted-foreground'>{f.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        } else {
          return group.fields.map((f) => (
            <div key={f.name} className='flex flex-col gap-6'>
              {f.type !== 'button' && f.type !== 'color_picker' && (
                <label className='font-medium text-sm'>
                  {f.label}
                  {f.required && <span className='text-red-500 ml-1'>*</span>}
                </label>
              )}
              <RenderField disabled={disabled} messageId={message.id} field={f} uploadFunction={uploadFunction} />
              {f.description && f.type !== 'button' && <p className='text-xs text-muted-foreground'>{f.description}</p>}
            </div>
          ))
        }
      })}
      {showSubmitButton && args.fields.some((f) => f && f.type !== 'button') && (
        <div>
          <Button type='submit' className='w-full' disabled={disabled || isGenerating}>
            {isGenerating ? 'Loading...' : 'Submit'}
          </Button>
        </div>
      )}
    </div>
  )
}
