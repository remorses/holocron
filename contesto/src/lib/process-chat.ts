import { isToolUIPart, readUIMessageStream, UIMessage, UIMessageChunk } from 'ai'
import { asyncIterableToReadableStream, isReadableStream, throttleGenerator } from './utils'

export type ToolPart<M extends UIMessage = UIMessage> = Extract<
  M['parts'][number],
  { type: `tool-${string}`; toolCallId: string; state: string }
>
export type ToolPartOutputAvailable<M extends UIMessage = UIMessage> = Extract<
  ToolPart<M>,
  { state: 'output-available' }
>
export type ToolPartInputAvailable<M extends UIMessage = UIMessage> = Extract<ToolPart<M>, { state: 'input-available' }>
export type ToolPartInputStreaming<M extends UIMessage = UIMessage> = Extract<ToolPart<M>, { state: 'input-streaming' }>

export async function* uiStreamToUIMessages<M extends UIMessage>({
  uiStream,
  messages,
  generateId,
  throttleMs = 32,
  onToolOutput,
  onToolInput,
  onToolInputStreaming,
}: {
  uiStream: ReadableStream<UIMessageChunk> | AsyncIterable<UIMessageChunk>
  messages: M[]
  generateId: () => string
  throttleMs?: number
  onToolOutput?: (toolPart: ToolPartOutputAvailable<M>) => void | Promise<void>
  onToolInput?: (toolPart: ToolPartInputAvailable<M>) => void | Promise<void>
  onToolInputStreaming?: (toolPart: ToolPartInputStreaming<M>) => void | Promise<void>
}): AsyncIterable<M[]> {
  let capturedError: unknown = null
  const lastMessage = messages[messages.length - 1]
  const replaceLastMessage = lastMessage?.role === 'assistant'

  const message: M = replaceLastMessage
    ? structuredClone(lastMessage)
    : ({
        id: generateId(),
        role: 'assistant',
        parts: [] as M['parts'],
      } as M)

  let lastYieldTime = 0
  const processedToolCallIds = new Set<string>()

  for await (let generatedMessage of readUIMessageStream({
    stream: isReadableStream(uiStream)
      ? uiStream
      : asyncIterableToReadableStream(uiStream, (error) => {
          // TODO this is a work around because of a crazy bug where readUIMessageStream does not detect errors in the readable stream, errors are silently ignored. i debugged it for 2 horus and found nothing. a added a test for readUIMessageStream in ai package and it behaves correctly.
          capturedError = error
        }),
    terminateOnError: true,
    onError: (error) => {
      console.error('Error in UI message stream:', error)
      capturedError = error
    },
    message,
  })) {
    if (capturedError) {
      throw capturedError
    }

    const currentMessages = [...messages]
    if (!replaceLastMessage) {
      currentMessages.push(generatedMessage)
    } else {
      currentMessages[currentMessages.length - 1] = generatedMessage
    }

    // Handle tool callbacks
    const lastPart = generatedMessage.parts[generatedMessage.parts.length - 1]
    if (lastPart && isToolUIPart(lastPart)) {
      const toolPart = lastPart

      // Check for tool output available
      if (toolPart.state === 'output-available' && onToolOutput) {
        if (!processedToolCallIds.has(toolPart.toolCallId)) {
          processedToolCallIds.add(toolPart.toolCallId)
          await onToolOutput(toolPart as ToolPartOutputAvailable<M>)
        }
      }

      // Check for tool input available
      if (toolPart.state === 'input-available' && onToolInput) {
        await onToolInput(toolPart as ToolPartInputAvailable<M>)
      }

      // Check for tool input streaming
      if (toolPart.state === 'input-streaming' && onToolInputStreaming) {
        await onToolInputStreaming(toolPart as ToolPartInputStreaming<M>)
      }
    }

    // Apply throttling
    const now = Date.now()
    if (now - lastYieldTime >= throttleMs) {
      lastYieldTime = now
      yield currentMessages
    }
  }
  if (capturedError) {
    throw capturedError
  }

  // Yield final messages
  const finalMessages = [...messages]
  if (!replaceLastMessage) {
    finalMessages.push(message)
  } else {
    finalMessages[finalMessages.length - 1] = message
  }
  yield finalMessages
}

type UiMessagePart = UIMessage['parts'][number]
type TextUIPart = Extract<UiMessagePart, { type: 'text' }>
type ReasoningUIPart = Extract<UiMessagePart, { type: 'reasoning' }>
