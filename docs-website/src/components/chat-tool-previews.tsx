import { useChatContext } from 'contesto/src/chat/chat-provider'
import { MarkdownRuntime as Markdown } from 'docs-website/src/lib/markdown-runtime'
import { truncateText } from 'docs-website/src/lib/utils'
import { DocsToolPart } from 'docs-website/src/lib/types'
import { capitalize, cn } from 'docs-website/src/lib/utils'
import { ReactNode, useMemo } from 'react'
import { ShowMore } from './show-more'
import { ChatMarkdown } from './docs-chat'
import React from 'react'

function Highlight({ children }: { children: ReactNode }) {
  return <span className=' dark:text-purple-300 text-purple-800'>{children}</span>
}

export function ErrorPreview({ error }) {
  const truncatedError = truncateText(
    String(error),
    process.env.NODE_ENV === 'development' ? Infinity : 600
  )
  return (
    <div className='flex flex-row  gap-2'>
      <div className='shrink-0'>⎿</div>
      <span>
        Error: <span className='dark:text-orange-300 text-orange-500 whitespace-pre-line'>{truncatedError}</span>
      </span>
    </div>
  )
}

export function EditorToolPreview({
  input: args,
  state,
  toolCallId,
  output: result,
}: Extract<DocsToolPart, { type: 'tool-strReplaceEditor' }>) {
  const { isGenerating: isChatGenerating } = useChatContext()
  const command = args?.command
  let error = ''
  if (
    typeof result === 'object' && 'error' in result && result.error
  ) {
    error = result?.error
  }

  if (command === 'view') {
    let linesText = ''
    if (args?.view_range?.length === 2) {
      const [start, end] = args?.view_range
      linesText = `:${start}:${end}`
    }

    return (
      <ToolPreviewContainer>
        <Dot toolCallId={toolCallId} /> Reading <Highlight>{args?.path}</Highlight>
        {linesText}
        {error && <ErrorPreview error={error} />}
      </ToolPreviewContainer>
    )
  }

  if (command === 'undo_edit') {
    return (
      <ToolPreviewContainer>
        <Dot toolCallId={toolCallId} /> Undo last edit in <Highlight>{args?.path}</Highlight>
        {error && <ErrorPreview error={error} />}
      </ToolPreviewContainer>
    )
  }

  if (command === 'create' || command === 'insert' || command === 'str_replace') {
    let language = 'mdx'
    let code = args?.file_text || args?.new_str || ''
    if (args?.new_str || args?.old_str) {
      language = 'diff'
      code =
        (args.old_str || '')
          .split('\n')
          .filter(Boolean)
          .map((line) => `- ${line}`)
          .join('\n') +
        '\n' +
        (args.new_str || '')
          .split('\n')
          .filter(Boolean)
          .map((line) => `+ ${line}`)
          .join('\n')
    }

    if (code && typeof code === 'object') {
      code = code?.['error'] || JSON.stringify(code, null, 2)
    }

    const markdown = `\`\`\`\`${language} lineNumbers=true \n${code}\n\`\`\`\``

    let actionText = capitalize(command)
    if (command === 'str_replace') actionText = 'Replacing content in'

    return (
      <ShowMore>
        <ToolPreviewContainer>
          <Dot toolCallId={toolCallId} /> {actionText} <Highlight>{args?.path}</Highlight>
          {command === 'insert' ? `:${args?.insert_line || 0}` : ''}
          {error ? (
            <ErrorPreview error={error} />
          ) : (
            <ChatMarkdown className='block' isStreaming={isChatGenerating} markdown={markdown} />
          )}
        </ToolPreviewContainer>
      </ShowMore>
    )
  }

  return (
    <ToolPreviewContainer>
      <Dot toolCallId={toolCallId} /> Loading files {args?.command} <Highlight>{args?.path}</Highlight>
      {error && <ErrorPreview error={error} />}
    </ToolPreviewContainer>
  )
}

export function ToolPreviewContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('py-2 rounded-lg font-mono text-sm space-y-2 w-full', className)}>{children}</div>
}


export function Dot({ toolCallId }: { toolCallId?: string }) {
  const { messages } = useChatContext()

  const isLastPendingCall = useMemo(() => {
    if (!toolCallId) return false

    // Find all tool calls across all messages
    //
    const allToolCalls: Array<{ id: string; state?: string }> = []

    messages.forEach((message) => {
      if (message.parts) {
        message.parts.forEach((part) => {
          if (part.type?.startsWith('tool-') && 'toolCallId' in part) {
            allToolCalls.push({
              id: part.toolCallId,
              state: part.state,
            })
          }
        })
      }
    })

    // Check if this is the last tool call
    const lastToolCall = allToolCalls[allToolCalls.length - 1]
    if (!lastToolCall || lastToolCall.id !== toolCallId) return false

    // Check if it's still processing (not output-available or error)
    return lastToolCall.state !== 'output-available' && lastToolCall.state !== 'error'
  }, [toolCallId, messages])

  return (
    <span className={cn('whitespace-pre')}>
      {isLastPendingCall ? <PieLoader /> : '◆ '}
    </span>
  )
}

function PieLoader() {

  const pies = ['◔', '◑', '◕', '●']
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % pies.length)
    }, 160)
    return () => clearInterval(interval)
  }, [])

  return <span className="inline-block text-orange-500 dark:text-orange-300">{pies[index]} </span>
}
