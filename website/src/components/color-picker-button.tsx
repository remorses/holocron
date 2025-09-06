import { useState } from 'react'
import { Sketch } from '@uiw/react-color'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

type ColorPickerButtonProps = {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  buttonText?: string
}

export function ColorPickerButton({ value, onChange, disabled, buttonText: label }: ColorPickerButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='outline' disabled={disabled} className='flex items-center gap-2 px-3 py-2 h-auto'>
          <div className='w-4 h-4 rounded border border-gray-300' style={{ backgroundColor: value }} />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-64 p-3'>
        <Sketch
          color={value || ''}
          onChange={(color) => {
            onChange(color.hex)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
