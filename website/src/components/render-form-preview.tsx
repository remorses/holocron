import {
    useForm,
    Controller,
    SubmitHandler,
    FieldValues,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { z } from 'zod'

import type { UIField } from '../lib/ui-field'
import { ButtonHrefEnum } from '../lib/ui-field'

import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'
import { Slider } from './ui/slider'
import { useChatState } from '../lib/state'

const buildSchemaAndDefaults = (fields: UIField[]) => {
    const entries: Record<string, z.ZodTypeAny> = {}
    const defaults: Record<string, unknown> = {}

    fields.forEach((f) => {
        if (
            (f as any).defaultValue !== undefined &&
            (f as any).defaultValue !== null
        ) {
            defaults[f.name] = (f as any).defaultValue
        }

        const required = !!(f as any).required
        let schema: z.ZodTypeAny
        switch (f.type) {
            case 'slider':
            case 'number':
                schema = z.number()
                break
            case 'switch':
                schema = z.boolean()
                break
            default:
                schema = z.string()
        }
        entries[f.name] = required ? schema : schema.optional()
    })

    return { schema: z.object(entries), defaults }
}

type RenderFormPreviewProps = {
    args: { fields: UIField[] }
    state: 'partial-call' | 'call' | 'result'
    result?: any
    toolCallId: any
}

export function RenderFormPreview({
    args,
    state,
    result,
    toolCallId,
}: RenderFormPreviewProps) {
    const isChatGenerating = useChatState((x) => x.isChatGenerating)

    if (!args?.fields || args.fields.length === 0) {
        return (
            <div className='text-muted-foreground text-sm'>
                No form fields to display
            </div>
        )
    }

    const { schema: formSchema, defaults } = buildSchemaAndDefaults(
        args.fields ?? [],
    )

    const { control, handleSubmit, register, reset, watch } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: defaults,
    })

    const watched = watch()

    const onSubmit: SubmitHandler<FieldValues> = (data) => {
        const event = new CustomEvent('formSubmit', {
            detail: { data, toolCallId },
        })
        window.dispatchEvent(event)
        reset()
    }

    const renderField = (field: UIField) => {
        const key = field.name

        switch (field.type) {
            case 'input':
                return (
                    <div key={key} className='flex items-center space-x-2'>
                        {field.prefix && (
                            <span className='text-sm text-muted-foreground'>
                                {field.prefix}
                            </span>
                        )}
                        <Input
                            placeholder={field.placeholder || ''}
                            defaultValue={field.defaultValue || ''}
                            {...register(field.name)}
                        />
                    </div>
                )
            case 'password':
                return (
                    <Input
                        key={key}
                        type='password'
                        placeholder={field.placeholder || ''}
                        defaultValue={field.defaultValue || ''}
                        {...register(field.name)}
                    />
                )
            case 'number':
                return (
                    <Input
                        key={key}
                        type='number'
                        placeholder={field.placeholder || ''}
                        defaultValue={field.defaultValue || undefined}
                        {...register(field.name, { valueAsNumber: true })}
                    />
                )
            case 'textarea':
                return (
                    <Textarea
                        key={key}
                        placeholder={field.placeholder || ''}
                        defaultValue={field.defaultValue || ''}
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
                            defaultValue={field.defaultValue}
                            render={({ field: ctl }) => {
                                return (
                                    <Select
                                        {...ctl}
                                        onValueChange={ctl.onChange}
                                        defaultValue={
                                            ctl.value as string | undefined
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    field.placeholder ||
                                                    'Select…'
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field.options.map((opt) => {
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
                            defaultValue={field.defaultValue || field.min || 0}
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
                        defaultValue={field.defaultValue || false}
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
                    <Input
                        key={key}
                        type='color'
                        defaultValue={field.defaultValue || '#ffffff'}
                        {...register(field.name)}
                    />
                )
            case 'date_picker':
                return (
                    <Input
                        key={key}
                        type='date'
                        defaultValue={field.defaultValue || undefined}
                        {...register(field.name)}
                    />
                )
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
                            href={field.href}
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

    return (
        <Card className='flex flex-col gap-3 animate-in border fade-in'>
            <CardContent className='flex flex-col gap-3 pt-6'>
                {args.fields.map((f) => {
                    return (
                        <div key={f.name} className='flex flex-col gap-2'>
                            {f.type !== 'button' && (
                                <label className='font-medium text-sm'>
                                    {f.label}
                                    {f.required && (
                                        <span className='text-red-500'>*</span>
                                    )}
                                </label>
                            )}
                            {renderField(f)}
                            {f.description && f.type !== 'button' && (
                                <p className='text-xs text-muted-foreground'>
                                    {f.description}
                                </p>
                            )}
                        </div>
                    )
                })}
                <pre className='bg-muted p-2 rounded text-xs overflow-x-auto'>
                    {JSON.stringify(args, null, 2)}
                </pre>
                {/* {args.fields.some((f) => f.type !== 'button') && (
                    <Button
                        className='w-full'
                        onClick={handleSubmit(onSubmit)}
                        disabled={isChatGenerating}
                    >
                        Submit
                    </Button>
                )} */}
            </CardContent>
        </Card>
    )
}
