import { readUIMessageStream, UIMessage, UIMessageChunk } from 'ai'
import {
    asyncIterableToReadableStream,
    isReadableStream,
    throttleGenerator,
} from './utils.js'

export async function* uiStreamToUIMessages<M extends UIMessage>({
    uiStream,
    messages,
    generateId,
}: {
    uiStream: ReadableStream<UIMessageChunk> | AsyncIterable<UIMessageChunk>
    messages: M[]
    generateId: () => string
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
        yield currentMessages
    }
}

type UiMessagePart = UIMessage['parts'][number]
type TextUIPart = Extract<UiMessagePart, { type: 'text' }>
type ReasoningUIPart = Extract<UiMessagePart, { type: 'reasoning' }>
