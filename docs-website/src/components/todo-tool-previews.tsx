import type { TodoInfo } from 'contesto/src/lib/todo-tool'
import { ToolPreviewContainer, Dot } from './chat-tool-previews'
import type { DocsToolPart } from '../lib/types'

type TodoToolPart = Extract<DocsToolPart, { type: 'tool-todowrite' | 'tool-todoread' }>

interface TodoPreviewProps {
  part: TodoToolPart
  message: { parts: any[] }
  index: number
}

export function TodoPreview({ part, message, index }: TodoPreviewProps) {
  // Check if this is the last todo tool in the message
  const remainingParts = message.parts?.slice(index + 1) || []
  const hasLaterTodoTool = remainingParts.some(p =>
    (p.type === 'tool-todowrite' || p.type === 'tool-todoread') &&
    p.state === 'output-available'
  )

  // Only show if this is the last todo tool
  if (hasLaterTodoTool) {
    return null
  }
  const todos = part.type === 'tool-todowrite'
    ? (part.output?.todos || part.input?.todos || [])
    : (part.output?.todos || [])

  const action = part.type === 'tool-todowrite' ? 'Update Todos' : 'Read Todos'
  const getStatusSymbol = (status: TodoInfo['status']) => {
    switch (status) {
      case 'completed': return '✔︎'
      case 'in_progress': return '☐'
      case 'cancelled': return '✘'
      default: return '☐'
    }
  }

  const getStatusColor = (status: TodoInfo['status']) => {
    switch (status) {
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-300 font-bold'
      case 'completed':
        return 'text-purple-600 dark:text-green-300'
      case 'cancelled':
        return 'text-muted-foreground'
      case 'pending':
      default:
        return ''
    }
  }

  return (
    <ToolPreviewContainer>
      <div>
        <Dot toolCallId={part.toolCallId} /> {action}
      </div>
      {todos.map((todo, index) => (
        <div key={todo.id} className='flex tracking-tight leading-tight flex-row gap-2 whitespace-pre-wrap'>
          <div className='shrink-0'>{index === 0 ? '⎿' : '  '}</div>
          <span className={getStatusColor(todo.status)}>
            {getStatusSymbol(todo.status)} {todo.content}
          </span>
        </div>
      ))}
    </ToolPreviewContainer>
  )
}
