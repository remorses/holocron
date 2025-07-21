import { useEffect } from 'react'
import { Controller, DeepPartial, useFormContext } from 'react-hook-form'

import type { RenderFormParameters, UIField } from '../lib/render-form-tool'

import { ColorPickerButton } from './color-picker-button'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { SelectNative } from './ui/select-native'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Textarea } from './ui/textarea'
import { UploadButton } from './upload-button'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Label } from './ui/label'

type RenderFieldProps = {
    field: UIField
}

function RenderField({ field }: RenderFieldProps) {
    const { control, getValues, register, setValue } = useFormContext()

    useEffect(() => {
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
    }, [field, setValue, getValues])

    const key = field.name
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
                        {...register(field.name, {})}
                    />
                </div>
            )
        case 'password':
            return (
                <Input
                    key={key}
                    type='password'
                    placeholder={field.placeholder || ''}
                    {...register(field.name)}
                />
            )
        case 'number':
            return (
                <Input
                    key={key}
                    type='number'
                    placeholder={field.placeholder || ''}
                    {...register(field.name, { valueAsNumber: true })}
                />
            )
        case 'textarea':
            return (
                <Textarea
                    key={key}
                    placeholder={field.placeholder || ''}
                    {...register(field.name)}
                />
            )
        case 'select':
            if (field.type === 'select') {
                return (
                    <SelectNative
                        key={key}
                        {...register(field.name)}
                        defaultValue={field.placeholder ? '' : undefined}
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
            }
            return null
        case 'radio':
            if (field.type === 'radio') {
                return (
                    <Controller
                        key={key}
                        control={control}
                        name={field.name}
                        render={({ field: ctl }) => {
                            return (
                                <RadioGroup
                                    className='gap-6'
                                    value={ctl.value as string | undefined}
                                    onValueChange={ctl.onChange}
                                >
                                    {field.options?.map((opt) => {
                                        const radioId = `${field.name}-${opt.value}`
                                        return (
                                            <div
                                                key={opt.value}
                                                className='flex items-start gap-2'
                                            >
                                                <RadioGroupItem
                                                    value={opt.value}
                                                    id={radioId}
                                                    aria-describedby={
                                                        opt.description
                                                            ? `${radioId}-description`
                                                            : undefined
                                                    }
                                                />
                                                <div className='grow'>
                                                    <div className='grid grow gap-2'>
                                                        <Label
                                                            htmlFor={radioId}
                                                        >
                                                            {opt.label}
                                                        </Label>
                                                        {opt.description && (
                                                            <p
                                                                id={`${radioId}-description`}
                                                                className='text-muted-foreground text-xs'
                                                            >
                                                                {
                                                                    opt.description
                                                                }
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
            }
            return null
        case 'slider':
            if (field.type === 'slider') {
                return (
                    <Controller
                        key={key}
                        control={control}
                        name={field.name}
                        render={({ field: ctl }) => {
                            return (
                                <div className='space-y-2'>
                                    <Slider
                                        min={field.min || undefined}
                                        max={field.max || undefined}
                                        step={field.step || 1}
                                        value={[Number(ctl.value) || 0]}
                                        onValueChange={(v) => {
                                            ctl.onChange(v[0])
                                        }}
                                    />
                                    <div className='text-xs text-muted-foreground text-center'>
                                        {ctl.value}
                                    </div>
                                </div>
                            )
                        }}
                    />
                )
            }
            return null
        case 'switch':
            return (
                <Controller
                    key={key}
                    control={control}
                    name={field.name}
                    render={({ field: ctl }) => {
                        return (
                            <Switch
                                checked={ctl.value as boolean}
                                onCheckedChange={ctl.onChange}
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
                    name={field.name}
                    render={({ field: ctl }) => {
                        return (
                            <ColorPickerButton
                                value={ctl.value as string}
                                onChange={ctl.onChange}
                                buttonText={field.label}
                            />
                        )
                    }}
                />
            )
        case 'date_picker':
            return <Input key={key} type='date' {...register(field.name)} />
        case 'image_upload':
            return (
                <Controller
                    name={field.name}
                    control={control}
                    defaultValue=''
                    render={({ field: { value, onChange } }) => (
                        <>
                            <UploadButton
                                onUploadFinished={({ src }) => onChange(src)}
                            />
                        </>
                    )}
                />
            )
        case 'button':
            return (
                <Button key={key} asChild className='justify-start'>
                    <a
                        href={field.href || '#'}
                        target='_blank'
                        rel='noopener noreferrer'
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
    showSubmitButton = false,
}: {
    input?: DeepPartial<RenderFormParameters>
    output?: any
    showSubmitButton?: boolean
}) {
    const { handleSubmit } = useFormContext()

    if (!args?.fields || args.fields.length === 0) {
        return (
            <div className='text-muted-foreground text-sm'>
                No form fields to display
            </div>
        )
    }
    if (result?.errors?.length) {
        return (
            <div className='bg-red-100 border border-red-300 text-red-600 rounded p-3 mb-3 text-sm'>
                {result.errors.map((err: any, idx: number) => (
                    <div key={idx}>
                        {typeof err === 'string' ? err : JSON.stringify(err)}
                    </div>
                ))}
            </div>
        )
        return null
    }

    // Group fields by consecutive groupTitle
    const fieldGroups: { title: string | null; fields: UIField[] }[] = []

    args.fields.forEach((field, index) => {
        const lastGroup = fieldGroups[fieldGroups.length - 1]

        if (
            lastGroup &&
            lastGroup.title === field?.groupTitle &&
            field?.groupTitle !== null
        ) {
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
        <div className='flex p-3 rounded-lg flex-col gap-3 animate-in border fade-in'>
            {fieldGroups.map((group, groupIndex) => {
                if (group.title) {
                    return (
                        <div
                            key={`group-${groupIndex}`}
                            className='flex flex-col gap-3'
                        >
                            <h3 className='font-medium text-sm text-muted-foreground'>
                                {group.title}
                            </h3>
                            <div className='flex flex-col gap-3 pl-3 border-l-2 border-border'>
                                {group.fields.map((f) => (
                                    <div
                                        key={f.name}
                                        className='flex flex-col gap-3'
                                    >
                                        {f.type !== 'button' &&
                                            f.type !== 'color_picker' && (
                                                <label className='font-medium text-sm'>
                                                    {f.label}
                                                    {f.required && (
                                                        <span className='text-red-500 ml-1'>
                                                            *
                                                        </span>
                                                    )}
                                                </label>
                                            )}
                                        <RenderField field={f} />
                                        {f.description &&
                                            f.type !== 'button' && (
                                                <p className='text-xs text-muted-foreground'>
                                                    {f.description}
                                                </p>
                                            )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                } else {
                    return group.fields.map((f) => (
                        <div key={f.name} className='flex flex-col gap-3'>
                            {f.type !== 'button' &&
                                f.type !== 'color_picker' && (
                                    <label className='font-medium text-sm'>
                                        {f.label}
                                        {f.required && (
                                            <span className='text-red-500 ml-1'>
                                                *
                                            </span>
                                        )}
                                    </label>
                                )}
                            <RenderField field={f} />
                            {f.description && f.type !== 'button' && (
                                <p className='text-xs text-muted-foreground'>
                                    {f.description}
                                </p>
                            )}
                        </div>
                    ))
                }
            })}
            {showSubmitButton &&
                args.fields.some((f) => f && f.type !== 'button') && (
                    <Button type='submit' className='w-full'>
                        Submit
                    </Button>
                )}
        </div>
    )
}
