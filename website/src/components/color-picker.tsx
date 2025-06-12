import pkg, { ColorResult } from 'react-color'
const { SketchPicker } = pkg

import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export function ColorPicker({ onChange, value, children, defaultValue }) {
    function colorString(c: ColorResult) {
        return `rgba(${c.rgb.r},${c.rgb.g},${c.rgb.b},${c.rgb.a || 1})`
    }

    return (
        <Popover>
            <PopoverTrigger>
                <Button className='flex gap-2'>
                    {children}
                    <div
                        style={{ background: value }}
                        className='w-4 h-4 shadow rounded '
                    ></div>
                </Button>
            </PopoverTrigger>

            <PopoverContent className='select-none !bg-transparent !border-0 min-w-0 max-w-max'>
                <SketchPicker
                    className=''
                    onChange={(c) => {
                        onChange(colorString(c))
                    }}
                    onChangeComplete={(c) => {
                        onChange(colorString(c))
                    }}
                    // onBlur={onBlur as any}
                    color={value || defaultValue}
                    // ref={ref}
                />
            </PopoverContent>
        </Popover>
    )
}
