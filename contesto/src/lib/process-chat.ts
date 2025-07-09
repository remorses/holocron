import {
    readUIMessageStream,
    UIMessage,
    UIMessageChunk
} from 'ai'
import { asyncIterableToReadableStream } from './utils.js'

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

    for await (let chunk of throttleGenerator(
        readUIMessageStream({
            stream: isReadableStream(uiStream)
                ? uiStream
                : asyncIterableToReadableStream(uiStream),
            message,
        }),
    )) {
        const generatedMessage = chunk[chunk.length - 1]
        const currentMessages = [...messages]
        if (!replaceLastMessage) {
            currentMessages.push(generatedMessage)
        } else {
            currentMessages[currentMessages.length - 1] = generatedMessage
        }
        yield currentMessages
    }
}

async function* throttleGenerator<T>(
    generator: AsyncIterable<T>,
    delayMs: number = 16,
): AsyncIterable<T[]> {
    let buffer: T[] = []
    let lastYield = 0

    for await (const item of generator) {
        buffer.push(item)

        const now = Date.now()
        if (now - lastYield >= delayMs) {
            yield [...buffer]
            buffer = []
            lastYield = now
        }
    }

    if (buffer.length > 0) {
        yield buffer
    }
}

function isReadableStream(obj: any): obj is ReadableStream<any> {
    return (
        obj != null &&
        typeof obj === 'object' &&
        typeof obj.getReader === 'function' &&
        typeof obj.tee === 'function' &&
        typeof obj.cancel === 'function'
    )
}

type UiMessagePart = UIMessage['parts'][number]
type TextUIPart = Extract<UiMessagePart, { type: 'text' }>
type ReasoningUIPart = Extract<UiMessagePart, { type: 'reasoning' }>
