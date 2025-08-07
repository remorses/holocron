import { describe, test, expect } from 'vitest'
import {
    testGenerateMessage,
    type TestGenerateMessageResult,
    type TestGenerateMessageInput
} from './generate-message-utils'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import path from 'path'

type TestCase = TestGenerateMessageInput & {
    name: string
    onFinish?: (result: TestGenerateMessageResult) => void
}

const testCases: TestCase[] = [
    {
        name: 'create a docs website',
        messages: [
            {
                role: 'user',
                content: 'create a docs website',
            },
        ],
        onFinish: (result) => {
            // Check that files were created
            expect(Object.keys(result.filesInDraft).length).toBeGreaterThan(0)

            // Check that some common files exist
            const createdPaths = Object.keys(result.filesInDraft)
            expect(createdPaths.some(p => p.includes('index.md') || p.includes('index.mdx'))).toBe(true)
        }
    },
    {
        name: 'create a simple index page',
        messages: [
            {
                role: 'user',
                content: 'create a simple index.mdx page with a title "Welcome"',
            },
        ],
        onFinish: (result) => {
            // Check that index file was created
            const createdPaths = Object.keys(result.filesInDraft)
            expect(createdPaths.some(p => p.includes('index.mdx'))).toBe(true)

            // Check that the content includes the title
            const indexFile = Object.entries(result.filesInDraft).find(([path]) =>
                path.includes('index.mdx')
            )
            if (indexFile) {
                expect(indexFile[1].content).toContain('Welcome')
            }
        }
    },
    {
        name: 'create API documentation',
        messages: [
            {
                role: 'user',
                content: 'create API documentation with endpoints for users and products',
            },
        ],
        onFinish: (result) => {
            // Check that API docs were created
            const createdPaths = Object.keys(result.filesInDraft)
            expect(createdPaths.some(p => p.toLowerCase().includes('api'))).toBe(true)

            // Check content mentions users and products
            const apiFiles = Object.entries(result.filesInDraft).filter(([path]) =>
                path.toLowerCase().includes('api')
            )
            // const hasUsersAndProducts = apiFiles.some(([, file]) =>
            //     file.content?.toLowerCase().includes('users') &&
            //     file.content?.toLowerCase().includes('products')
            // )
            // expect(hasUsersAndProducts).toBe(true)
        }
    }
]

describe('generateMessageStream', () => {
    for (const testCase of testCases) {
        test(testCase.name, async () => {
            const { name, onFinish, ...inputParams } = testCase
            const generator = testGenerateMessage(inputParams)

            let finalResult: TestGenerateMessageResult | null = null
            const sanitizedName = name.replace(/\s+/g, '-')

            // Paths for partial files
            const messagePartialPath = path.join(__dirname, 'snapshots', `${sanitizedName}-message-partial.md`)
            const filesPartialPath = path.join(__dirname, 'snapshots', `${sanitizedName}-files-partial.md`)

            // Track last write time for throttling
            let lastWriteTime = 0
            const throttleMs = 50

            // Use while loop to iterate through generator
            while (true) {
                const { done, value } = await generator.next()

                if (done) break

                if (value) {
                    finalResult = value

                    // Throttle partial file writes
                    const now = Date.now()
                    if (now - lastWriteTime >= throttleMs) {
                        lastWriteTime = now

                        // Write partial snapshots
                        writeFileSync(messagePartialPath, value.markdown, 'utf-8')
                        writeFileSync(filesPartialPath, value.filesMarkdown, 'utf-8')
                    }
                }
            }

            // Clean up partial files if they exist
            if (existsSync(messagePartialPath)) {
                unlinkSync(messagePartialPath)
            }
            if (existsSync(filesPartialPath)) {
                unlinkSync(filesPartialPath)
            }

            if (!finalResult) {
                throw new Error('No result generated')
            }

            // Run custom assertions if provided
            if (onFinish) {
                onFinish(finalResult)
            }

            // Save final snapshots
            await expect(finalResult.markdown).toMatchFileSnapshot(`./snapshots/${sanitizedName}-message.md`)
            await expect(finalResult.filesMarkdown).toMatchFileSnapshot(`./snapshots/${sanitizedName}-files.md`)
        }, 60000) // 60 second timeout for AI generation
    }
})
