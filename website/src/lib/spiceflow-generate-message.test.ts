import { describe, test, expect } from 'vitest'
import fs from 'fs'
import {
    testGenerateMessage,
    type TestGenerateMessageResult,
    type TestGenerateMessageInput,
} from './generate-message-utils'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import path from 'path'
import { isValidLucideIconName } from './icons'
import dedent from 'dedent'
import fm from 'front-matter'
import yaml from 'js-yaml'

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
            expect(
                createdPaths.some(
                    (p) => p.includes('index.md') || p.includes('index.mdx'),
                ),
            ).toBe(true)
        },
    },
    {
        name: 'nonsense user query',
        messages: [
            {
                role: 'user',
                content: 'adsf',
            },
        ],
        onFinish: (result) => {
            // Check that files were created
            expect(Object.keys(result.filesInDraft).length).toBeGreaterThan(0)
        },
    },
    {
        name: 'form/change theme',
        messages: [
            {
                role: 'user',
                content: 'change the theme of the website',
            },
        ],
        onFinish: (result) => {
            // Check that files were created
            expect(result.markdown).toContain('tool-renderForm')
        },
    },
    {
        name: 'create a simple index page',
        messages: [
            {
                role: 'user',
                content:
                    'create a simple index.mdx page with a title "Welcome"',
            },
        ],
        onFinish: (result) => {
            // Check that index file was created
            const createdPaths = Object.keys(result.filesInDraft)
            expect(createdPaths.some((p) => p.includes('index.mdx'))).toBe(true)

            // Check that the content includes the title
            const indexFile = Object.entries(result.filesInDraft).find(
                ([path]) => path.includes('index.mdx'),
            )
            if (indexFile) {
                expect(indexFile[1].content).toContain('Welcome')
            }
        },
    },
    {
        name: 'create API documentation',
        messages: [
            {
                role: 'user',
                content:
                    'create API documentation with endpoints for users and products',
            },
        ],
        onFinish: (result) => {
            // Check that API docs were created
            const createdPaths = Object.keys(result.filesInDraft)
            expect(
                createdPaths.some((p) => p.toLowerCase().includes('api')),
            ).toBe(true)

            // Check content mentions users and products
            // const apiFiles = Object.entries(result.filesInDraft).filter(
            //     ([path]) => path.toLowerCase().includes('api'),
            // )
            // const hasUsersAndProducts = apiFiles.some(([, file]) =>
            //     file.content?.toLowerCase().includes('users') &&
            //     file.content?.toLowerCase().includes('products')
            // )
            // expect(hasUsersAndProducts).toBe(true)
        },
    },
    {
        name: 'add icons to pages',
        filesInDraft: {
            'index.mdx': {
                githubPath: 'index.mdx',
                content: dedent`
                    ---
                    title: Home
                    ---
                    
                    # Welcome to our docs
                    
                    This is the home page.
                `,
            },
            'getting-started.mdx': {
                githubPath: 'getting-started.mdx',
                content: dedent`
                    ---
                    title: Getting Started
                    ---
                    
                    # Getting Started
                    
                    Learn how to get started with our product.
                `,
            },
            'api/overview.mdx': {
                githubPath: 'api/overview.mdx',
                content: dedent`
                    ---
                    title: API Overview
                    ---
                    
                    # API Overview
                    
                    Overview of our API endpoints.
                `,
            },
            'guides/configuration.mdx': {
                githubPath: 'guides/configuration.mdx',
                content: dedent`
                    ---
                    title: Configuration
                    ---
                    
                    # Configuration Guide
                    
                    How to configure the application.
                `,
            },
        },
        messages: [
            {
                role: 'user',
                content: 'add icons to all pages',
            },
        ],
        onFinish: (result) => {
            // Check that no file paths start with /
            const filesWithSlash = Object.keys(result.filesInDraft).filter(
                (path) => path.startsWith('/'),
            )
            expect(
                filesWithSlash,
                `Files should not start with slash: ${filesWithSlash.join(', ')}`,
            ).toHaveLength(0)

            // Check that files were updated
            const updatedFiles = Object.entries(result.filesInDraft)
            expect(updatedFiles.length).toBeGreaterThan(0)

            // Track which original files have icons
            const originalFiles = [
                'index.mdx',
                'getting-started.mdx',
                'api/overview.mdx',
                'guides/configuration.mdx',
            ]
            const filesWithIcons: string[] = []
            const filesWithoutIcons: string[] = []
            const invalidIcons: Record<string, string> = {}

            // Check each file has an icon in the frontmatter
            for (const [path, file] of updatedFiles) {
                // Only check our original files
                if (originalFiles.includes(path) && file.content) {
                    try {
                        // Parse frontmatter using front-matter library
                        const parsed = fm(file.content)
                        const frontmatter = parsed.attributes as any

                        if (frontmatter && frontmatter.icon) {
                            const iconName = String(frontmatter.icon)
                            const isValid = isValidLucideIconName(iconName)
                            if (isValid) {
                                filesWithIcons.push(path)
                            } else {
                                invalidIcons[path] = iconName
                            }
                        } else {
                            filesWithoutIcons.push(path)
                        }
                    } catch (error) {
                        console.error(
                            `Failed to parse frontmatter for ${path}:`,
                            error,
                        )
                        filesWithoutIcons.push(path)
                    }
                }
            }

            // Log for debugging
            console.log('Files with valid icons:', filesWithIcons)
            console.log('Files without icons:', filesWithoutIcons)
            console.log('Invalid icons:', invalidIcons)

            // All original files should have valid icons
            expect(
                filesWithoutIcons,
                `These files are missing icons: ${filesWithoutIcons.join(', ')}`,
            ).toHaveLength(0)
            expect(
                Object.keys(invalidIcons),
                `These files have invalid icons: ${JSON.stringify(invalidIcons)}`,
            ).toHaveLength(0)
            expect(
                filesWithIcons.length,
                `Only ${filesWithIcons.length}/${originalFiles.length} files have valid icons`,
            ).toBe(originalFiles.length)
        },
    },
]
describe.concurrent('generateMessageStream', ({}) => {
    for (const testCase of testCases) {
        test.concurrent(
            testCase.name,
            async ({ expect }) => {
                const { name, onFinish, ...inputParams } = testCase
                const generator = testGenerateMessage(inputParams)

                let finalResult: TestGenerateMessageResult | null = null
                const sanitizedName = name.replace(/\s+/g, '-')

                // Paths for partial files
                const messagePartialPath = path.join(
                    __dirname,
                    'snapshots',
                    `${sanitizedName}-message-partial.md`,
                )
                const filesPartialPath = path.join(
                    __dirname,
                    'snapshots',
                    `${sanitizedName}-files-partial.md`,
                )
                // Ensure the parent directory exists
                fs.mkdirSync(path.dirname(filesPartialPath), {
                    recursive: true,
                })

                // Use while loop to iterate through generator
                while (true) {
                    const { done, value } = await generator.next()

                    if (done) break

                    if (value) {
                        finalResult = value

                        // Write partial snapshots on every value
                        writeFileSync(
                            messagePartialPath,
                            value.markdown,
                            'utf-8',
                        )
                        if (value.filesMarkdown)
                            writeFileSync(
                                filesPartialPath,
                                value.filesMarkdown,
                                'utf-8',
                            )
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
                await expect(finalResult.markdown).toMatchFileSnapshot(
                    `./snapshots/${sanitizedName}-message.md`,
                )
                if (finalResult.filesMarkdown) {
                    await expect(finalResult.filesMarkdown).toMatchFileSnapshot(
                        `./snapshots/${sanitizedName}-files.md`,
                    )
                }
            },
            120000,
        ) // 120 second timeout for AI generation
    }
})

test('system message input', async () => {
    const { generateSystemMessage } = await import(
        './spiceflow-generate-message'
    )

    // Test both onboarding and non-onboarding modes
    const onboardingSystemMessage = await generateSystemMessage(true)
    const regularSystemMessage = await generateSystemMessage(false)

    // Save system messages as snapshots
    await expect(onboardingSystemMessage).toMatchFileSnapshot(
        './snapshots/system-message-onboarding.md',
    )
    await expect(regularSystemMessage).toMatchFileSnapshot(
        './snapshots/system-message-regular.md',
    )
})
