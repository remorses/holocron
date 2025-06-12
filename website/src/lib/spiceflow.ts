import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { notifyError } from './errors'
import { s3 } from './s3'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
    // Health check endpoint
    .get('/health', () => ({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    }))
    // Create upload URL endpoint
    .post(
        '/createUploadSignedUrl',

        async ({ request }) => {
            const body = await request.json()

            const signedUrl = s3.presign(body.key, {
                method: 'PUT',
            })

            return {
                success: true,
                signedUrl,
            }
        },
        {
            body: z.object({
                key: z.string().min(1, 'Key is required'),
                contentType: z.string().optional(),
            }),
        },
    )
    // Error handling middleware
    .onError(({ error }) => {
        notifyError(error)
    })

export type SpiceflowApp = typeof app
