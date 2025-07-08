import { InferUITool, ToolSet, UIMessage, UIMessageStreamPart } from 'ai'
import { parsePartialJson } from 'ai'

type UiMessagePart = UIMessage['parts'][number]

type TextUIPart = Extract<UiMessagePart, { type: 'text' }>
type ReasoningUIPart = Extract<UiMessagePart, { type: 'reasoning' }>

export async function* fullStreamToUIMessages<TOOLS extends ToolSet>({
    uiStream,
    messages,
    onToolCall,
    generateId,
}: {
    uiStream: AsyncIterable<UIMessageStreamPart>
    messages: UIMessage<
        any,
        any,
        { [K in keyof TOOLS]: InferUITool<TOOLS[K]> }
    >[]
    onToolCall?: (params: { toolCall: any }) => Promise<any> | any
    generateId: () => string
}): AsyncIterable<
    UIMessage<any, any, { [K in keyof TOOLS]: InferUITool<TOOLS[K]> }>[]
> {
    const lastMessage = messages[messages.length - 1]
    const replaceLastMessage = lastMessage?.role === 'assistant'

    let step = 0
    if (replaceLastMessage) {
        const toolParts =
            lastMessage.parts?.filter((part) =>
                part.type.startsWith('tool-'),
            ) || []

        if (toolParts.length > 0) {
            step = Math.floor(toolParts.length / 2)
        }
    }

    const message: UIMessage<
        any,
        any,
        { [K in keyof TOOLS]: InferUITool<TOOLS[K]> }
    > = replaceLastMessage
        ? structuredClone(lastMessage)
        : {
              id: generateId(),
              role: 'assistant',
              parts: [],
          }

    const currentMessages = [...messages]
    if (!replaceLastMessage) {
        currentMessages.push(message)
    } else {
        currentMessages[currentMessages.length - 1] = message
    }

    const activeTextParts: Record<string, TextUIPart> = {}
    const activeReasoningParts: Record<string, ReasoningUIPart> = {}

    function updateOrAddToolPart(
        toolCallId: string,
        toolName: string,
        updates: Record<string, any>,
    ) {
        const partIdx = message.parts.findIndex(
            (part) =>
                part.type === `tool-${toolName}` &&
                'toolCallId' in part &&
                part.toolCallId === toolCallId,
        )

        if (partIdx !== -1) {
            message.parts = [
                ...message.parts.slice(0, partIdx),
                { ...message.parts[partIdx], ...updates } as any,
                ...message.parts.slice(partIdx + 1),
            ]
        } else {
            message.parts = message.parts.concat([
                {
                    type: `tool-${toolName}` as `tool-${string}`,
                    toolCallId,
                    ...updates,
                },
            ] as any)
        }
    }

    const partialToolCalls: Record<
        string,
        { text: string; index: number; toolName: string }
    > = {}

    for await (const values of throttleGenerator(uiStream, 50)) {
        for (const value of values) {
            const type = value.type
            if (type === 'text-start') {
                const textPart: TextUIPart = {
                    type: 'text',
                    text: '',
                }
                activeTextParts[value.id] = textPart
                message.parts = message.parts.concat([textPart])
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'text-delta') {
                activeTextParts[value.id].text += value.delta
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'text-end') {
                delete activeTextParts[value.id]
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'reasoning-start') {
                const reasoningPart: ReasoningUIPart = {
                    type: 'reasoning',
                    text: '',
                }
                activeReasoningParts[value.id] = reasoningPart
                message.parts = message.parts.concat([reasoningPart])
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'reasoning-delta') {
                const reasoningPart = activeReasoningParts[value.id]

                if (reasoningPart) {
                    reasoningPart.text += value.delta
                }
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'reasoning-end') {
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'file') {
                message.parts = message.parts.concat([
                    {
                        type: 'file',
                        mediaType: value.mediaType,
                        url: value.url,
                    },
                ])

                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'source-url') {
                message.parts = message.parts.concat([
                    {
                        type: 'source-url',
                        sourceId: value.sourceId,
                        url: value.url,
                        title: value.title,
                    },
                ])

                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'source-document') {
                message.parts = message.parts.concat([
                    {
                        type: 'source-document',
                        sourceId: value.sourceId,
                        mediaType: value.mediaType,
                        title: value.title,
                        ...(value.filename && { filename: value.filename }),
                    },
                ])

                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'error') {
                throw new Error(value.errorText)
            } else if (type === 'tool-input-start') {
                partialToolCalls[value.toolCallId] = {
                    text: '',
                    toolName: value.toolName,
                    index: message.parts.filter((part) =>
                        part.type.startsWith('tool-'),
                    ).length,
                }

                updateOrAddToolPart(value.toolCallId, value.toolName, {
                    state: 'input-streaming',
                    input: undefined,
                })

                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'tool-input-delta') {
                const partialToolCall = partialToolCalls[value.toolCallId]
                if (!partialToolCall) {
                    throw new Error(
                        `missing partialToolCall for ${value.toolCallId}`,
                    )
                }

                partialToolCall.text += value.inputTextDelta

                const partialInputResult = await parsePartialJson(
                    partialToolCall.text,
                )
                const partialInput = partialInputResult.value

                updateOrAddToolPart(
                    value.toolCallId,
                    partialToolCall.toolName,
                    {
                        state: 'input-streaming',
                        input: partialInput,
                    },
                )

                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'tool-input-available') {
                updateOrAddToolPart(value.toolCallId, value.toolName, {
                    state: 'input-available',
                    input: value.input,
                })

                yield currentMessages.slice(0, -1).concat({ ...message })

                if (onToolCall && !value.providerExecuted) {
                    const result = await onToolCall({ toolCall: value })
                    if (result != null) {
                        updateOrAddToolPart(value.toolCallId, value.toolName, {
                            state: 'output-available',
                            input: value.input,
                            output: result,
                        })

                        yield currentMessages
                            .slice(0, -1)
                            .concat({ ...message })
                    }
                }
            } else if (type === 'tool-output-available') {
                updateOrAddToolPart(value.toolCallId, '', {
                    state: 'output-available',
                    output: value.output,
                })

                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'tool-output-error') {
                updateOrAddToolPart(value.toolCallId, '', {
                    state: 'output-error',
                    errorText: value.errorText,
                })

                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'start') {
                if (value.messageId != null) {
                    message.id = value.messageId
                }
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'finish') {
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'start-step') {
                message.parts = message.parts.concat([{ type: 'step-start' }])
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'finish-step') {
                Object.keys(activeTextParts).forEach(
                    (key) => delete activeTextParts[key],
                )
                Object.keys(activeReasoningParts).forEach(
                    (key) => delete activeReasoningParts[key],
                )
                yield currentMessages.slice(0, -1).concat({ ...message })
            } else if (type === 'message-metadata') {

            } else {
                console.warn(`Unhandled stream part type: ${type}`)
            }
        }
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
