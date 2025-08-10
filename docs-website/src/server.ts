import { createHonoServer } from 'react-router-hono-server/node'

import { prisma } from 'db'
import { imageLoader } from './lib/image-loader'
import { serveRawMarkdown } from './lib/serve-raw-markdown'
import { withoutBasePath } from './lib/utils'

export default await createHonoServer({
    port: Number(process.env.PORT) || 7777,
    configure: (server) => {
        server.use(async (c, next) => {
            const url = withoutBasePath(c.req.path)
            const host = c.req.header('host')?.split(':')[0] || ''

            if (url.endsWith('.md') || url.endsWith('.mdx')) {
                const query = c.req.query()
                const showLineNumbers = query.showLineNumbers != undefined && query.showLineNumbers !== 'false'
                const startLine = query.startLine ? parseInt(query.startLine, 10) : undefined
                const endLine = query.endLine ? parseInt(query.endLine, 10) : undefined

                const result = await serveRawMarkdown({
                    domain: host,
                    path: url,
                    showLineNumbers,
                    startLine,
                    endLine,
                })

                if (result != null) {
                    return c.text(result.markdown, 200, {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'public, max-age=300, s-maxage=300',
                        'Cache-Tag': result.cacheTag,
                    })
                }
                return next()
            }

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
