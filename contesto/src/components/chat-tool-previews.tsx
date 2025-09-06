import { cn } from '../lib/cn.js'
import type { TodoInfo } from '../lib/todo-tool.js'

interface TodoPreviewProps {
  input?: {
    todos?: TodoInfo[]
  }
  output?: {
    title?: string
    output?: string
    metadata?: {
      todos?: TodoInfo[]
    }
  }
  className?: string
}

export function TodoPreview({ input, output, className }: TodoPreviewProps) {
  // Use output todos if available, otherwise use input todos
  const todos = output?.metadata?.todos || input?.todos || []

  if (todos.length === 0) {
    return (
      <div className={cn('font-mono text-sm text-muted-foreground p-3 rounded-lg bg-muted/50', className)}>
        No todos
      </div>
    )
  }

  const getStatusIcon = (status: TodoInfo['status']) => {
    switch (status) {
      case 'completed':
        return '✓' // Unicode check mark
      case 'in_progress':
        return '◐' // Unicode half-filled circle
      case 'cancelled':
        return '✗' // Unicode X mark
      case 'pending':
      default:
        return '○' // Unicode empty circle
    }
  }

  const getStatusColor = (status: TodoInfo['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-400'
      case 'cancelled':
        return 'text-gray-500 dark:text-gray-400'
      case 'pending':
      default:
        return 'text-yellow-600 dark:text-yellow-400'
    }
  }

  const getPriorityColor = (priority: TodoInfo['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400'
      case 'medium':
        return 'text-orange-600 dark:text-orange-400'
      case 'low':
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getPriorityIndicator = (priority: TodoInfo['priority']) => {
    switch (priority) {
      case 'high':
        return '!!!'
      case 'medium':
        return '!!'
      case 'low':
      default:
        return '!'
    }
  }

  // Group todos by status for better organization
  const groupedTodos = {
    in_progress: todos.filter((t) => t.status === 'in_progress'),
    pending: todos.filter((t) => t.status === 'pending'),
    completed: todos.filter((t) => t.status === 'completed'),
    cancelled: todos.filter((t) => t.status === 'cancelled'),
  }

  const incompleteTodos = todos.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length
  const completedTodos = todos.filter((t) => t.status === 'completed').length

  return (
    <div className={cn('font-mono text-sm p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3', className)}>
      {/* Summary */}
      <div className='text-xs text-muted-foreground border-b border-border/30 pb-2'>
        {incompleteTodos} pending • {completedTodos} completed • {todos.length} total
      </div>

      {/* Todo list */}
      <div className='space-y-1.5'>
        {/* In Progress */}
        {groupedTodos.in_progress.length > 0 && (
          <>
            {groupedTodos.in_progress.map((todo) => (
              <div key={todo.id} className='flex items-start gap-2 py-0.5'>
                <span className={cn('mt-0.5', getStatusColor(todo.status))}>{getStatusIcon(todo.status)}</span>
                <span className='flex-1 break-words'>{todo.content}</span>
                <span className={cn('text-xs ml-1', getPriorityColor(todo.priority))}>
                  {getPriorityIndicator(todo.priority)}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Pending */}
        {groupedTodos.pending.length > 0 && (
          <>
            {groupedTodos.pending.map((todo) => (
              <div key={todo.id} className='flex items-start gap-2 py-0.5'>
                <span className={cn('mt-0.5', getStatusColor(todo.status))}>{getStatusIcon(todo.status)}</span>
                <span className='flex-1 break-words'>{todo.content}</span>
                <span className={cn('text-xs ml-1', getPriorityColor(todo.priority))}>
                  {getPriorityIndicator(todo.priority)}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Completed - shown with strikethrough and muted */}
        {groupedTodos.completed.length > 0 && (
          <>
            {groupedTodos.completed.map((todo) => (
              <div key={todo.id} className='flex items-start gap-2 py-0.5 opacity-50'>
                <span className={cn('mt-0.5', getStatusColor(todo.status))}>{getStatusIcon(todo.status)}</span>
                <span className='flex-1 line-through break-words'>{todo.content}</span>
                <span className={cn('text-xs ml-1', getPriorityColor(todo.priority))}>
                  {getPriorityIndicator(todo.priority)}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Cancelled - shown muted */}
        {groupedTodos.cancelled.length > 0 && (
          <>
            {groupedTodos.cancelled.map((todo) => (
              <div key={todo.id} className='flex items-start gap-2 py-0.5 opacity-40'>
                <span className={cn('mt-0.5', getStatusColor(todo.status))}>{getStatusIcon(todo.status)}</span>
                <span className='flex-1 line-through break-words'>{todo.content}</span>
                <span className={cn('text-xs ml-1', getPriorityColor(todo.priority))}>
                  {getPriorityIndicator(todo.priority)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export function TodoReadPreview({ output, className }: { output?: TodoPreviewProps['output']; className?: string }) {
  return <TodoPreview output={output} className={className} />
}

export function TodoWritePreview({ input, output, className }: TodoPreviewProps) {
  return <TodoPreview input={input} output={output} className={className} />
}
