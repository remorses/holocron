import { useState } from 'react'
import { Sketch } from '@uiw/react-color'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

type ColorPickerButtonProps = {
    value: string
    onChange: (color: string) => void
    disabled?: boolean
}

export function ColorPickerButton({ value, onChange, disabled }: ColorPickerButtonProps) {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    disabled={disabled}
                    className="w-10 h-10 p-0 rounded-md"
                    style={{ backgroundColor: value }}
                />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3">
                <Sketch
                    color={value}
                    onChange={(color) => {
                        onChange(color.hex)
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}