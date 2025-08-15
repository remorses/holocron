import z from 'zod'
import { tool, Tool } from 'ai'
import ivm from 'isolated-vm'

const interpreterToolParamsSchema = z.object({
    title: z.string().describe('A descriptive title for this code execution'),
    code: z.string().describe('JavaScript code to execute in an isolated environment'),
    timeout: z.number()
        .min(100)
        .max(300000)
        .default(5000)
        .optional()
        .describe('Timeout in milliseconds (default: 5000ms, max: 300000ms/5 minutes)'),
})

export type InterpreterToolParamSchema = z.infer<typeof interpreterToolParamsSchema>

export interface CreateInterpreterToolOptions {
    tools?: Record<string, Tool<any, any>>
}

export function createInterpreterTool(options?: CreateInterpreterToolOptions) {
    const tools = options?.tools || {}

    return tool({
        description: 'Execute JavaScript code in an isolated sandbox environment with console.log capture',
        inputSchema: interpreterToolParamsSchema,
        execute: async ({ title, code, timeout = 5000 }) => {
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

                // Set up tools
                const toolExecutors: Record<string, ivm.Reference<(args: any) => Promise<any>>> = {}
                for (const [name, toolDef] of Object.entries(tools)) {
                    if (toolDef.execute) {
                        toolExecutors[name] = new ivm.Reference(async (args: any) => {
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
                                const result = await toolDef.execute!(args, { abortSignal: undefined } as any)

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

                    const tools = {};
                    ${Object.entries(tools).filter(([_, toolDef]) => toolDef.execute).map(([name]) => `
                    tools.${name} = async function(args) {
                        if (!_toolExecutors.${name}) {
                            throw new Error('Tool ${name} is not executable');
                        }
                        const result = await _toolExecutors.${name}.apply(undefined, [args], {
                            arguments: { copy: true },
                            result: { promise: true, copy: true }
                        });

                        if (result && result.__error) {
                            throw new Error(result.message);
                        }

                        return result && result.__result ? result.value : result;
                    };`).join('')}

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
