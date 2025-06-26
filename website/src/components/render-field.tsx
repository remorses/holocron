import { useEffect } from 'react'
import { Controller, useFormContext } from 'react-hook-form'

import type { UIField } from '../lib/render-form-tool'

import { ColorPickerButton } from './color-picker-button'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Textarea } from './ui/textarea'

type RenderFieldProps = {
    field: UIField
}

export function RenderField({ field }: RenderFieldProps) {
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
                    <Controller
                        key={key}
                        control={control}
                        name={field.name}
                        render={({ field: ctl }) => {
                            return (
                                <Select
                                    {...ctl}
                                    onValueChange={ctl.onChange}
                                    value={ctl.value as string | undefined}
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            placeholder={
                                                field.placeholder || 'Select…'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {field.options?.map((opt) => {
                                            return (
                                                <SelectItem
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {opt.label}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
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
                <Input
                    key={key}
                    type='file'
                    accept='image/*'
                    {...register(field.name)}
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
