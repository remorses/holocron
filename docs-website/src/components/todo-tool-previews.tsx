import type { TodoInfo } from 'contesto/src/lib/todo-tool'
import { ToolPreviewContainer, Dot } from './chat-tool-previews'

interface TodoPreviewProps {
  todos: TodoInfo[]
  action: string
  toolCallId?: string
}

export function TodoPreview({ todos, action, toolCallId }: TodoPreviewProps) {
  const getStatusSymbol = (status: TodoInfo['status']) => {
    switch (status) {
      case 'completed': return '☒'
      case 'in_progress': return '☒'
      case 'cancelled': return '☒'
      default: return '☐'
    }
  }

  return (
    <ToolPreviewContainer>
      <div>
        <Dot toolCallId={toolCallId} /> {action}
      </div>
      {todos.map((todo, index) => (
        <div key={todo.id} className='flex flex-row gap-2 whitespace-pre-wrap'>
          <div className='shrink-0'>{index === 0 ? '⎿' : '  '}</div>
          <span>{getStatusSymbol(todo.status)} {todo.content}</span>
        </div>
      ))}
    </ToolPreviewContainer>
  )
}
