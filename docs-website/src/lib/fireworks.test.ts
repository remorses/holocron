import { test, expect } from 'vitest'
import { consumeStream, readUIMessageStream, streamText } from 'ai'
import { fireworks } from '@ai-sdk/fireworks'
import z from 'zod'

test.skip('streamText logs tool call ids', async () => {
  const model = fireworks('accounts/fireworks/models/kimi-k2-instruct')
  const iterator = streamText({
    model, prompt: 'call beforeHello then hello 3 times, alternative beforehello then hello', tools: {
      beforeHello: {
        inputSchema: z.object({}),
        description: 'say hello',
        execute: async () => {
          return 'hello'
        }
      },
      hello: {
        inputSchema: z.object({}),
        description: 'say hello',
        execute: async () => {
          return 'hello'
        }
      }
    }
  })


  const stream = iterator.toUIMessageStream()
  for await (let generatedMessage of readUIMessageStream({ stream, })) {
    console.log(generatedMessage.parts.filter(x => x.type.startsWith('tool')))
  }



  //   for await (const chunk of iterator.fullStream) {
  //   if (chunk.type === 'tool-call')
  //     console.log(chunk)
  // }

})


test('streamText logs tool call ids', async () => {
  const model = fireworks('accounts/fireworks/models/kimi-k2-instruct')


  const result = await model.doStream({

    prompt: [{ role: 'system', content: 'call beforeHello then hello 3 times, alternative beforehello then hello' }],

    tools: [
      {
        name: 'beforeHello',
        inputSchema: {},
        description: 'say hello',
        type: 'function'
      },
      {
        name: 'hello',
        inputSchema: {},
        description: 'say hello',
        type: 'function'
      }
    ]
  })

  const loggingStream = result.stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      console.log(chunk)
      controller.enqueue(chunk)
    }
  }))
  const res = await consumeStream({ stream: loggingStream })
  console.log(res)
})
