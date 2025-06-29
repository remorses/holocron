import { createHonoServer } from 'react-router-hono-server/node'

import { prisma } from 'db'
import { imageLoader } from './lib/image-loader'

export default await createHonoServer({
    port: Number(process.env.PORT) || 7777,
    configure: (server) => {
        server.use(async (c, next) => {
            const url = c.req.path
            const hasMediaExtension = mediaExtensions.some((ext) =>
                url.endsWith('.' + ext),
            )
            if (hasMediaExtension) {
                return await imageLoader({ request: c.req.raw })
            }
            return next()
        })
    },
})

const mediaExtensions = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'svg',
    'ico',
    'mp4',
    'webm',
    'mov',
    'avi',
    'mp3',
    'wav',
    'ogg',
    'pdf',
    'doc',
    'docx',
    'zip',
]
