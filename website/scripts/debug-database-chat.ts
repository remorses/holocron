import { prisma } from 'db'
import yaml from 'js-yaml'

async function main() {
  const chatId = process.argv[2]
  const chat = await prisma.chat.findUnique({
    where: {
      chatId: chatId,
    },
    include: {
      messages: {
        orderBy: { index: 'asc' },
        include: {
          textParts: { orderBy: { index: 'asc' } },
          reasoningParts: { orderBy: { index: 'asc' } },
          toolParts: { orderBy: { index: 'asc' } },
          sourceUrlParts: { orderBy: { index: 'asc' } },
          fileParts: { orderBy: { index: 'asc' } },
        },
      },
    },
  })
  if (!chat) {
    console.log('Chat not found')
    return
  }
  const messages = chat.messages.map((msg) => {
    const {
      textParts = [],
      reasoningParts = [],
      toolParts = [],
      sourceUrlParts = [],
      fileParts = [],
      ...rest
    } = msg

    const message = {
      ...rest,
      parts: [
        ...textParts,
        ...reasoningParts,
        ...toolParts,
        ...sourceUrlParts,
        ...fileParts,
      ]
        .flat()
        .sort((a, b) => a.index - b.index),
    }
    return message
  })
  console.log(
    yaml.dump(messages, { noRefs: true, sortKeys: false, lineWidth: 120 }),
  )
}

main()
