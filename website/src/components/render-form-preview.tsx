import {
    FieldValues,
    SubmitHandler,
    useFormContext,
} from 'react-hook-form'

import type { UIField } from '../lib/render-form-tool'

import { useWebsiteState } from '../lib/state'
import { RenderField } from './render-field'
import { Card, CardContent } from './ui/card'

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
    const { handleSubmit } = useFormContext()

    if (!args?.fields || args.fields.length === 0) {
        return (
            <div className='text-muted-foreground text-sm'>
                No form fields to display
            </div>
        )
    }

    return (
        <Card className='flex flex-col gap-3 animate-in border fade-in'>
            <CardContent className='flex flex-col gap-3 pt-6'>
                {args.fields.map((f) => {
                    return (
                        <div key={f.name} className='flex flex-col gap-2'>
                            {f.type !== 'button' &&
                                f.type !== 'color_picker' && (
                                    <label className='font-medium text-sm'>
                                        {f.label}
                                        {f.required && (
                                            <span className='text-red-500'>
                                                *
                                            </span>
                                        )}
                                    </label>
                                )}
                            <RenderField hasFinished={result} field={f} />
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
