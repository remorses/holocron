import { GripVerticalIcon } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import { createContext, useContext, useCallback, useRef, ComponentPropsWithoutRef } from 'react'
import { UseFieldArrayReturn } from 'react-hook-form'
import { cn } from '../lib/cn'

type DragGroupContextValue = {
  getDragControls: (id: string) => ReturnType<typeof useDragControls>
}

const DragGroupContext = createContext<DragGroupContextValue | null>(null)

type DragGroupProps = {
  fieldArray: UseFieldArrayReturn<any, any, any>
  children: React.ReactNode
  className?: string
}

export function DragGroup({ fieldArray, children, className }: DragGroupProps) {
  const dragControlsRef = useRef<Record<string, ReturnType<typeof useDragControls>>>({})

  const getDragControls = useCallback((id: string) => {
    if (!dragControlsRef.current[id]) {
      dragControlsRef.current[id] = {
        start: () => {},
        stop: () => {},
        componentControls: new Set(),
        updateConstraints: () => {},
      } as any
    }
    return dragControlsRef.current[id]
  }, [])

  return (
    <DragGroupContext.Provider value={{ getDragControls }}>
      <Reorder.Group
        axis="y"
        values={fieldArray.fields.map((x) => x.id)}
        onReorder={(newOrder) => {
          const currentOrder = fieldArray.fields.map((x) => x.id)
          for (let i = 0; i < newOrder.length; i++) {
            const currentIndex = currentOrder.indexOf(newOrder[i])
            if (currentIndex !== i && currentIndex !== -1) {
              fieldArray.move(currentIndex, i)
              currentOrder.splice(currentIndex, 1)
              currentOrder.splice(i, 0, newOrder[i])
            }
          }
        }}
        className={cn('space-y-2', className)}
      >
        {children}
      </Reorder.Group>
    </DragGroupContext.Provider>
  )
}

type DragItemProps = {
  id: string
  children: React.ReactNode
  className?: string
}

function DragItem({ id, children, className }: DragItemProps) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className={className}
      layout="position"
      transition={{ duration: 0.15 }}
    >
      <DragItemContext.Provider value={{ controls }}>
        {children}
      </DragItemContext.Provider>
    </Reorder.Item>
  )
}

type DragItemContextValue = {
  controls: ReturnType<typeof useDragControls>
}

const DragItemContext = createContext<DragItemContextValue | null>(null)

type DragHandleProps = {
  className?: string
}

function DragHandle({ className }: DragHandleProps) {
  const context = useContext(DragItemContext)
  if (!context) {
    return <GripVerticalIcon className={cn('size-4 text-muted-foreground', className)} />
  }

  return (
    <button
      type="button"
      className={cn(
        'cursor-grab active:cursor-grabbing rounded p-1',
        'hover:bg-accent active:bg-accent',
        className
      )}
      onPointerDown={(e) => {
        context.controls.start(e)
      }}
    >
      <GripVerticalIcon className="size-4 text-muted-foreground" />
    </button>
  )
}

DragGroup.Item = DragItem
DragGroup.Handle = DragHandle
