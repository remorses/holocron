import {
    Controller,
    FieldValues,
    SubmitHandler,
    useFormContext,
} from 'react-hook-form'

import type { UIField } from '../lib/render-form-tool'

import { useChatState } from '../lib/state'
import { ColorPickerButton } from './color-picker-button'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
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

    const { control, handleSubmit, register, reset, watch } = useFormContext()

    const onSubmit: SubmitHandler<FieldValues> = (data) => {
        const event = new CustomEvent('formSubmit', {
            detail: { data, toolCallId },
        })
        window.dispatchEvent(event)
        reset()
    }
    if (!args?.fields || args.fields.length === 0) {
        return (
            <div className='text-muted-foreground text-sm'>
                No form fields to display
            </div>
        )
    }

    const renderField = (field: UIField) => {
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
                    <Controller
                        key={key}
                        control={control}
                        name={field.name}
                        defaultValue={field.defaultValue || '#ffffff'}
                        render={({ field: ctl }) => {
                            return (
                                <ColorPickerButton
                                    value={ctl.value as string}
                                    onChange={ctl.onChange}
                                    buttonText={field.buttonText}
                                />
                            )
                        }}
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
                            {f.type !== 'button' && f.type !== 'color_picker' && (
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
