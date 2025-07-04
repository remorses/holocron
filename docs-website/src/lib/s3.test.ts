import { describe, it, expect, beforeAll } from 'vitest'
import { getPresignedUrl, s3 } from './s3'

describe.skip('s3', async () => {
    it('lists files in the bucket', async () => {
        const { contents } = await s3.list()
        expect(Array.isArray(contents)).toBe(true)
    })
    it('creates a presigned URL and uploads a file', async () => {
        // Generate a unique key for testing
        const key = `test-upload.txt`
        const file = {
            contentType: 'text/plain',
            content: 'hello world!',
        }

        // Get a presigned URL for uploading
        const signedUrl = await getPresignedUrl({
            method: 'PUT',
            key,
            headers: {
                'content-type': file.contentType,
                // 'content-length': file.contentLength,
            },
        })

        console.log(signedUrl)

        // Upload using fetch
        const uploadResp = await fetch(signedUrl, {
            method: 'PUT',
            headers: {
                'content-type': file.contentType,
            },
            body: new File([file.content], key, { type: file.contentType }),
        })
        const resText = await uploadResp.text()
        console.log(resText)
        expect(uploadResp.ok).toBe(true)
    })
})
