import z, { toJSONSchema } from 'zod'
import { tool, Tool } from 'ai'
import ivm from 'isolated-vm'
import { compile } from 'json-schema-to-typescript-lite'
import camelCase from 'camelcase'
import dedent from 'string-dedent'

export const interpreterToolParamsSchema = z.object({
    title: z.string().describe('A descriptive very short title for this code execution'),
    code: z.string().describe('JavaScript code to execute in an isolated environment. DO NOT use typescript or jsx. Only plain javascript is supported. No imports or require. Running on the server. Top level await is supported. Do not use an iife.'),
    timeout: z.number()
        .min(100)
        .max(300000)
        .describe('Timeout in milliseconds'),
})

export type InterpreterToolParamSchema = z.infer<typeof interpreterToolParamsSchema>

export interface CreateInterpreterToolOptions {
    tools?: Record<string, Tool<any, any>>
}

function indentString(str: string, indent: string = '  '): string {
    return str.split('\n').map(line => indent + line).join('\n')
}


async function generateToolsTypeDefinition(tools: Record<string, Tool<any, any>>): Promise<string> {
    const toolMethods: string[] = []

    for (const [name, toolDef] of Object.entries(tools)) {
        if (!toolDef.execute) continue

        const camelCaseName = camelCase(name)

        try {
            let inputType = 'any'

            if (toolDef.inputSchema) {
                if ('_def' in toolDef.inputSchema) {
                    const zodSchema = toolDef.inputSchema as any
                    const jsonSchema = toJSONSchema(zodSchema) as any
                    const typeScript = await compile(jsonSchema, `${camelCaseName}Input`, {
                        strictIndexSignatures: false
                    })

                    const match = typeScript.match(/export interface \w+ ({[\s\S]*?})/m)
                    if (match) {
                        inputType = match[1]
                    }
                }
            }

            toolMethods.push(`${camelCaseName}: (args: ${inputType}) => Promise<any>;`)
        } catch {
            toolMethods.push(`${camelCaseName}: (args: any) => Promise<any>;`)
        }
    }

    if (toolMethods.length === 0) return ''

    const indentedMethods = indentString(toolMethods.join('\n'))
    return dedent`
      You have access to a global tools object to call the chat available tools, here is the typescript definition of the tools object:

      // exhaustive list of tools available. These are all the available methods on tools object
      interface Tools {
      ${indentedMethods}
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

    `
}

export async function createInterpreterTool(options?: CreateInterpreterToolOptions) {
    const tools = options?.tools || {}

    const availableTools = Object.entries(tools)
        .filter(([_, toolDef]) => toolDef.execute)
        .filter(([_, toolDef]) => toolDef.inputSchema !== interpreterToolParamsSchema)
        .map(([name]) => name)

    let toolsDescription = ''

    if (availableTools.length > 0) {
        const typeDefinition = await generateToolsTypeDefinition(tools)
        toolsDescription = typeDefinition || `\n\nAvailable tools in the 'tools' object:\n${availableTools.map(name => `- tools.${name}(...)`).join('\n')}`
    }

    const description =  `Execute JavaScript code in an isolated sandbox environment with console.log capture\n\n${toolsDescription}`
    return tool({
        description,
        inputSchema: interpreterToolParamsSchema,
        execute: async ({ title, code, timeout = 5000 }, secondArg) => {
            const logs: string[] = []
            let result: any

            try {
                const isolate = new ivm.Isolate({ memoryLimit: 64 })
                const context = await isolate.createContext()
                const jail = context.global

                const consoleLog = new ivm.Reference((args: any[]) => {
                    const message = args.map((arg: any) => {
                        if (typeof arg === 'object' && arg !== null) {
                            try {
                                return JSON.stringify(arg, null, 2)
                            } catch {
                                return String(arg)
                            }
                        }
                        return String(arg)
                    }).join(' ')
                    logs.push(message)
                })

                await jail.set('_consoleLog', consoleLog)

                // Set up URL constructor via callback
                const urlConstructor = new ivm.Callback(
                    { sync: true } as any,
                    ((urlString: string, base?: string) => {
                        try {
                            const url = base ? new URL(urlString, base) : new URL(urlString)
                            return {
                                href: url.href,
                                protocol: url.protocol,
                                hostname: url.hostname,
                                host: url.host,
                                port: url.port,
                                pathname: url.pathname,
                                search: url.search,
                                searchParams: Object.fromEntries(url.searchParams.entries()),
                                hash: url.hash,
                                origin: url.origin,
                                username: url.username,
                                password: url.password
                            }
                        } catch (error: any) {
                            throw new Error(`Invalid URL: ${error.message}`)
                        }
                    }) as any
                )

                await jail.set('_urlConstructor', urlConstructor)

                // Set up tools
                const toolExecutors: Record<string, ivm.Reference<(args: any) => Promise<any>>> = {}
                for (const [name, toolDef] of Object.entries(tools)) {
                    if (toolDef.execute) {
                        const camelCaseName = camelCase(name)
                        toolExecutors[camelCaseName] = new ivm.Reference(async (args: any) => {
                            try {
                                // Validate input using the tool's inputSchema if it's a Zod schema
                                if (toolDef.inputSchema && 'parse' in toolDef.inputSchema) {
                                    try {
                                        const validated = (toolDef.inputSchema).parse(args)
                                        args = validated
                                    } catch (error: any) {
                                        return { __error: true, message: `Invalid input for tool ${name}: ${error.message}` }
                                    }
                                }

                                // Execute the tool
                                const result = await toolDef.execute!(args, secondArg)

                                // Handle async iterables
                                if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
                                    const chunks: any[] = []
                                    for await (const chunk of result as AsyncIterable<any>) {
                                        chunks.push(chunk)
                                    }
                                    return { __result: true, value: chunks.length === 1 ? chunks[0] : chunks }
                                }

                                return { __result: true, value: result }
                            } catch (error: any) {
                                return { __error: true, message: error.message || String(error) }
                            }
                        })
                    }
                }

                await jail.set('_toolExecutors', toolExecutors, { copy: true })

                const wrappedCode = `
                    const _log = function(...args) {
                        _consoleLog.apply(undefined, [args], { arguments: { copy: true } })
                    };

                    const _timers = {};

                    const console = {
                        log: _log,
                        error: _log,
                        warn: _log,
                        info: _log,
                        debug: _log,
                        time: function(label = 'default') {
                            _timers[label] = Date.now();
                        },
                        timeEnd: function(label = 'default') {
                            if (_timers[label]) {
                                const duration = Date.now() - _timers[label];
                                delete _timers[label];
                                _log(label + ': ' + duration + 'ms');
                            }
                        }
                    };

                    class URL {
                        constructor(urlString, base) {
                            const result = _urlConstructor(urlString, base);
                            Object.assign(this, result);
                        }

                        toString() {
                            return this.href;
                        }
                    }

                    const tools = {};
                    ${Object.entries(tools).filter(([_, toolDef]) => toolDef.execute).map(([name]) => {
                        const camelCaseName = camelCase(name)
                        return `
                    tools.${camelCaseName} = async function(args) {
                        if (!_toolExecutors.${camelCaseName}) {
                            throw new Error('Tool ${camelCaseName} is not executable');
                        }
                        const result = await _toolExecutors.${camelCaseName}.apply(undefined, [args], {
                            arguments: { copy: true },
                            result: { promise: true, copy: true }
                        });

                        if (result && result.__error) {
                            throw new Error(result.message);
                        }

                        return result && result.__result ? result.value : result;
                    };`
                    }).join('')}

                    (async () => {
                        ${code}
                    })()
                `

                const script = await isolate.compileScript(wrappedCode)
                result = await script.run(context, {
                    timeout,
                    promise: true
                })

                isolate.dispose()

                return logs.length > 0 ? logs.join('\n') : 'no console logs'
            } catch (error: any) {
                const errorMessage = `Error: ${error.message || String(error)}`
                const stackTrace = error.stack ? `\nStack trace:\n${error.stack}` : ''
                const logsOutput = logs.length > 0 ? `Logs before error:\n${logs.join('\n')}\n\n` : ''
                return `${logsOutput}${errorMessage}${stackTrace}`
            }
        },
    })
}
