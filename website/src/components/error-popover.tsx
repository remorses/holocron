import { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Button } from './ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export function useErrorPopover() {
  const [errorMessage, setErrorMessage] = useState('')

  const ErrorTooltipAnchor = ({
    children,
    open,
  }: {
    children: React.ReactNode
    open?: boolean
  }) => {
    const isOpen = open !== undefined ? open : !!errorMessage

    if (!isOpen || !errorMessage) return <>{children}</>

    return (
      <TooltipProvider>
        <Tooltip open={true}>
          <TooltipTrigger>{children}</TooltipTrigger>
          <ErrorOverlay onClick={() => setErrorMessage('')} />
          <TooltipContent className='border-destructive max-w-[400px] p-3 z-[60]'>
            <div className='flex items-start gap-2'>
              <AlertCircle className='size-4 text-destructive mt-0.5 flex-shrink-0' />
              <div className='grow'>
                <p className='text-sm'>{errorMessage}</p>
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='p-0.5 h-auto hover:text-destructive hover:bg-destructive/10'
                onClick={() => setErrorMessage('')}
              >
                <X className='size-3' />
              </Button>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return {
    setErrorMessage,
    errorMessage,
    ErrorTooltipAnchor,
  }
}

function ErrorOverlay({ onClick }: { onClick: () => void }) {
  return (
    <div
      style={{
        pointerEvents: 'auto',
      }}
      className='fixed inset-0 z-50 bg-black/40 transition-all duration-100'
      onClick={onClick}
    />
  )
}
