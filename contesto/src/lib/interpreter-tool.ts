import z from 'zod'
import { tool } from 'ai'
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

export function createInterpreterTool() {
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
                
                const wrappedCode = `
                    const console = {
                        log: function(...args) {
                            _consoleLog.apply(undefined, [args], { arguments: { copy: true } })
                        }
                    };
                    
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