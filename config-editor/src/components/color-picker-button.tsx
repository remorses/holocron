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
          type="button"
          variant="outline"
          disabled={disabled}
          className="size-9 p-0 shrink-0"
        >
          <div
            className="size-5 rounded border border-border"
            style={{ backgroundColor: value || '#000000' }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <Sketch
          color={value || '#000000'}
          onChange={(color) => {
            onChange(color.hex)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
