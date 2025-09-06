import { describe, test, expect } from 'vitest'
import { createInterpreterTool } from './interpreter-tool.js'
import { tool } from 'ai'
import { z } from 'zod'

describe('createInterpreterTool', () => {
  test('executes simple code and captures console.log', async () => {
    const tool = await createInterpreterTool()

    const startTime = Date.now()
    const result = (await tool.execute!(
      {
        title: 'Simple calculation',
        code: `
                console.log('Starting calculation')
                const a = 5
                const b = 3
                console.log('a =', a)
                console.log('b =', b)
                const sum = a + b
                console.log('sum =', sum)
                return sum
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string
    const executionTime = Date.now() - startTime

    console.log(`Tool execution time: ${executionTime}ms`)

    expect(result).toMatchInlineSnapshot(`
          "Starting calculation
          a = 5
          b = 3
          sum = 8"
        `)
  })

  test('handles errors gracefully', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'Error test',
        code: `
                console.log('Before error')
                throw new Error('Test error')
                console.log('After error')
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toContain('Test error')
    expect(result).toContain('Before error')
    expect(result).toContain('Stack trace')
  })

  test('handles JSON objects in console.log', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'JSON logging',
        code: `
                const obj = { name: 'test', value: 42, nested: { key: 'value' } }
                console.log('Object:', obj)
                console.log('Array:', [1, 2, 3])
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatchInlineSnapshot(`
          "Object: {
            "name": "test",
            "value": 42,
            "nested": {
              "key": "value"
            }
          }
          Array: [
            1,
            2,
            3
          ]"
        `)
  })

  test('enforces timeout', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'Timeout test',
        code: `
                while(true) {
                    // Infinite loop
                }
            `,
        timeout: 100,
      },
      {} as any,
    )) as string

    expect(result).toContain('Script execution timed out')
  })

  test('handles async code', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'Async test',
        code: `
                console.log('Start')
                const promise = new Promise(resolve => {
                    resolve('resolved')
                })
                const value = await promise
                console.log('Promise value:', value)
                return 'done'
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatchInlineSnapshot(`
          "Start
          Promise value: resolved"
        `)
  })

  test('respects custom timeout', async () => {
    const tool = await createInterpreterTool()

    const startTime = Date.now()
    const result = (await tool.execute!(
      {
        title: 'Custom timeout test',
        code: `
                let i = 0
                while(true) {
                    i++
                }
            `,
        timeout: 100,
      },
      {} as any,
    )) as string
    const elapsed = Date.now() - startTime

    expect(result).toContain('Script execution timed out')
    expect(elapsed).toBeGreaterThanOrEqual(90)
    expect(elapsed).toBeLessThan(200)
  })

  test('returns "no console logs" when no output', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'No output test',
        code: `
                const a = 5
                const b = 10
                const sum = a + b
                return sum
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toBe('no console logs')
  })

  test('shows stack trace for errors thrown in functions', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'Error with stack trace',
        code: `
                function doSomething() {
                    console.log('About to throw')
                    throw new Error('Something went wrong in doSomething')
                }

                function main() {
                    console.log('Starting main')
                    doSomething()
                    console.log('This should not run')
                }

                main()
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatchInlineSnapshot(`
          "Logs before error:
          Starting main
          About to throw

          Error: Something went wrong in doSomething
          Stack trace:
          Error: Something went wrong in doSomething
              at doSomething (<isolated-vm>:57:27)
              at main (<isolated-vm>:62:21)
              at <isolated-vm>:66:17
              at <isolated-vm>:68:23"
        `)
  })

  test('can execute tools passed to the interpreter', async () => {
    const addTool = tool({
      description: 'Add two numbers',
      inputSchema: z.object({
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ a, b }) => {
        return { result: a + b }
      },
    })

    const greetTool = tool({
      description: 'Greet someone',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: async ({ name }) => {
        return `Hello, ${name}!`
      },
    })

    const interpreterTool = await createInterpreterTool({
      tools: {
        add: addTool,
        greet: greetTool,
      },
    })

    const result = (await interpreterTool.execute!(
      {
        title: 'Tool execution test',
        code: `
                console.log('Testing tools')

                const sum = await tools.add({ a: 5, b: 3 })
                console.log('Sum result:', sum)

                const greeting = await tools.greet({ name: 'Alice' })
                console.log('Greeting:', greeting)

                console.log('Done')
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatchInlineSnapshot(`
          "Testing tools
          Sum result: {
            "result": 8
          }
          Greeting: Hello, Alice!
          Done"
        `)
  })

  test('validates tool input schemas', async () => {
    const mathTool = tool({
      description: 'Multiply numbers',
      inputSchema: z.object({
        x: z.number(),
        y: z.number(),
      }),
      execute: async ({ x, y }) => x * y,
    })

    const interpreterTool = await createInterpreterTool({
      tools: {
        multiply: mathTool,
      },
    })

    const result = (await interpreterTool.execute!(
      {
        title: 'Invalid tool input test',
        code: `
                try {
                    await tools.multiply({ x: 'not a number', y: 5 })
                } catch (error) {
                    console.log('Error caught:', error.message)
                }
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toContain('Invalid input for tool multiply')
  })

  test('supports various console methods', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'Console methods test',
        code: `
                console.log('This is log')
                console.error('This is error')
                console.warn('This is warn')
                console.info('This is info')
                console.debug('This is debug')

                console.time('myTimer')
                // Simulate some work
                let sum = 0
                for (let i = 0; i < 1000; i++) {
                    sum += i
                }
                console.timeEnd('myTimer')

                console.log('Sum calculated:', sum)
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatch(/This is log/)
    expect(result).toMatch(/This is error/)
    expect(result).toMatch(/This is warn/)
    expect(result).toMatch(/This is info/)
    expect(result).toMatch(/This is debug/)
    expect(result).toMatch(/myTimer: \d+ms/)
    expect(result).toMatch(/Sum calculated: 499500/)
  })

  test('handles tools without execute function', async () => {
    const schemaTool = tool({
      description: 'Schema-only tool',
      inputSchema: z.object({
        value: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
    })

    const interpreterTool = await createInterpreterTool({
      tools: {
        schemaOnly: schemaTool,
      },
    })

    const result = (await interpreterTool.execute!(
      {
        title: 'Non-executable tool test',
        code: `
                console.log('Tools available:', Object.keys(tools))
                console.log('No tools should be available')
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatchInlineSnapshot(`
          "Tools available: []
          No tools should be available"
        `)
  })

  test('includes available tools in description with TypeScript types', async () => {
    const mockFetch = tool({
      description: 'Fetch data',
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => `Data from ${url}`,
    })

    const mockEditor = tool({
      description: 'Edit files',
      inputSchema: z.object({
        command: z.enum([
          'view',
          'create',
          'str_replace',
          'insert',
          'undo_edit',
        ]),
        path: z.string(),
        file_text: z.string().optional(),
        insert_line: z.number().int().optional().describe('description here'),
        new_str: z.string().optional(),
        old_str: z.string().optional(),
        view_range: z.array(z.number()).length(2).optional(),
      }),
      execute: async ({ path }) => ``,
    })

    const schemaOnly = tool({
      description: 'Schema only',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
    })

    const interpreterTool = await createInterpreterTool({
      tools: {
        'fetch-data': mockFetch,
        edit_file: mockEditor,
        'schema-only': schemaOnly,
      },
    })

    expect(interpreterTool.description).toMatchInlineSnapshot(`
          "Execute JavaScript code in an isolated sandbox environment with console.log capture

          You have access to a global tools object to call the chat available tools, here is the typescript definition of the tools object:

          // exhaustive list of tools available. These are all the available methods on tools object
          interface Tools {
            fetchData: (args: {
              url: string
            }) => Promise<any>;
            editFile: (args: {
              command: ("view" | "create" | "str_replace" | "insert" | "undo_edit")
              path: string
              file_text?: string
              /**
               * description here
               */
              insert_line?: number
              new_str?: string
              old_str?: string
              /**
               * @minItems 2
               * @maxItems 2
               */
              view_range?: [number, number]
            }) => Promise<any>;
          }

          declare global {
            var tools: Tools
          }

          You can use \`await tools.toolName({ param: 1 })\` to compose tools together (feeding the result of one tool to another) and call tools concurrently with Promise.all

          Use this interpreter tool when you want to chain together multiple tool calls and do so without repeating the whole output to the next tool.

          For example you can fetch a page and then write it to a file if you have a fetch and an editor tool.

          Before running this tool you should have a good idea of the outputs of the tools you will call. For example when using fetch you should try first calling fetch normally to see what is the format of the url response

          DO NOT wrap your code in a main function, just put your code in the top level scope and use top level await.

          DO NOT use import or require.

          NEVER suppress errors with empty catch statements. Always log the errors.
          "
        `)
  })

  test('supports URL constructor', async () => {
    const tool = await createInterpreterTool()

    const result = (await tool.execute!(
      {
        title: 'URL test',
        code: `
                const url = new URL('https://example.com/path?query=value#hash')
                console.log('URL object:', JSON.stringify(url))
                console.log('Protocol:', url.protocol)
                console.log('Hostname:', url.hostname)
                console.log('Pathname:', url.pathname)
                console.log('Search:', url.search)
                console.log('Hash:', url.hash)

                const relative = new URL('/api/users', 'https://api.example.com')
                console.log('Full URL:', relative.href)
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatchInlineSnapshot(`
          "URL object: {"href":"https://example.com/path?query=value#hash","protocol":"https:","hostname":"example.com","host":"example.com","port":"","pathname":"/path","search":"?query=value","searchParams":{"query":"value"},"hash":"#hash","origin":"https://example.com","username":"","password":""}
          Protocol: https:
          Hostname: example.com
          Pathname: /path
          Search: ?query=value
          Hash: #hash
          Full URL: https://api.example.com/api/users"
        `)
  })

  test('real-world example with fetch and editor tools', async () => {
    const files: Record<string, string> = {}

    const fetchTool = tool({
      description: 'Fetch data from a URL',
      inputSchema: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        if (url.includes('/users/')) {
          const id = url.split('/').pop()?.replace('.md', '')
          return `# User ${id}\n\n- ID: ${id}\n- Name: User${id}\n- Status: Active\n- Joined: 2024-01-15`
        }
        if (url.includes('/posts/')) {
          const id = url.split('/').pop()?.replace('.md', '')
          return `# Post ${id}\n\n**Views:** ${parseInt(id!) * 100}\n\n## Content\n\nThis is the content of post ${id}.`
        }
        throw new Error(`Unknown URL: ${url}`)
      },
    })

    const editToolSchema = z.object({
      command: z.enum(['view', 'create', 'str_replace', 'insert', 'undo_edit']),
      path: z.string(),
      file_text: z.string().optional(),
      insert_line: z.number().int().optional(),
      new_str: z.string().optional(),
      old_str: z.string().optional(),
      view_range: z.array(z.number()).length(2).optional(),
    })

    const strReplaceEditor = tool({
      description: 'Edit files with various commands',
      inputSchema: editToolSchema,
      execute: async (params) => {
        const { command, path, file_text, old_str, new_str } = params

        switch (command) {
          case 'view':
            return files[path] || `File not found: ${path}`

          case 'create':
            if (!file_text) return 'Error: file_text is required'
            files[path] = file_text
            return `Created: ${path}`

          case 'str_replace':
            if (!files[path]) return `File not found: ${path}`
            if (!old_str) return 'Error: old_str is required'
            files[path] = files[path].replace(old_str, new_str || '')
            return `Updated: ${path}`

          default:
            return `Unknown command: ${command}`
        }
      },
    })

    const interpreterTool = await createInterpreterTool({
      tools: {
        'fetch-tool': fetchTool,
        editor_tool: strReplaceEditor,
      },
    })

    const result = (await interpreterTool.execute!(
      {
        title: 'Parallel fetch and write',
        code: `
                const urls = [
                    'https://api.example.com/users/1.md',
                    'https://api.example.com/users/2.md',
                    'https://api.example.com/posts/5.md',
                    'https://api.example.com/posts/10.md'
                ]

                console.log('Fetching', urls.length, 'URLs...')

                const results = await Promise.all(
                    urls.map(async url => {
                        const content = await tools.fetchTool({ url })
                        const path = url.split('//')[1].split('/').slice(1).join('/')
                        return { path, content }
                    })
                )

                console.log('Fetched all data')

                const writeResults = await Promise.all(
                    results.map(({ path, content }) =>
                        tools.editorTool({
                            command: 'create',
                            path: path,
                            file_text: content
                        })
                    )
                )

                console.log('Created', writeResults.length, 'files')

                const userFile = await tools.editorTool({
                    command: 'view',
                    path: 'users/1.md'
                })

                console.log('User 1 file:', userFile.substring(0, 20) + '...')
            `,
        timeout: 5000,
      },
      {} as any,
    )) as string

    expect(result).toMatchInlineSnapshot(`
          "Fetching 4 URLs...
          Fetched all data
          Created 4 files
          User 1 file: # User 1

          - ID: 1
          - ..."
        `)

    expect(files['users/1.md']).toContain('# User 1')
    expect(files['users/2.md']).toContain('# User 2')
    expect(files['posts/5.md']).toContain('Views:** 500')
    expect(files['posts/10.md']).toContain('Views:** 1000')
  })
})
