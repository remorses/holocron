import { isToolUIPart, readUIMessageStream, UIMessage, UIMessageChunk } from 'ai'
import {
    asyncIterableToReadableStream,
    isReadableStream,
    throttleGenerator,
} from './utils.js'

type ToolPart = Extract<UIMessage['parts'][number], { type: `tool-${string}`; toolCallId: string; state: string }>



export async function* uiStreamToUIMessages<M extends UIMessage>({
    uiStream,
    messages,
    generateId,
    throttleMs = 100,
    onToolOutput,
    onToolInput,
    onToolInputStreaming,
}: {
    uiStream: ReadableStream<UIMessageChunk> | AsyncIterable<UIMessageChunk>
    messages: M[]
    generateId: () => string
    throttleMs?: number
    onToolOutput?: (toolPart: ToolPart) => void
    onToolInput?: (toolPart: ToolPart) => void
    onToolInputStreaming?: (toolPart: ToolPart) => void
}): AsyncIterable<M[]> {
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
            : asyncIterableToReadableStream(uiStream),

        message,
    })) {
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
                    onToolOutput(toolPart)
                }
            }

            // Check for tool input available
            if (toolPart.state === 'input-available' && onToolInput) {
                onToolInput(toolPart)
            }

            // Check for tool input streaming
            if (toolPart.state === 'input-streaming' && onToolInputStreaming) {
                onToolInputStreaming(toolPart)
            }
        }

        // Apply throttling
        const now = Date.now()
        if (now - lastYieldTime >= throttleMs) {
            lastYieldTime = now
            yield currentMessages
        }
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
