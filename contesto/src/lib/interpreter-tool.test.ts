import { describe, test, expect } from 'vitest'
import { createInterpreterTool } from './interpreter-tool.js'

describe('createInterpreterTool', () => {
    test('executes simple code and captures console.log', async () => {
        const tool = createInterpreterTool()
        
        const result = await tool.execute!({
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
            `
        }, {} as any) as string
        
        expect(result).toMatchInlineSnapshot(`
          "Starting calculation
          a = 5
          b = 3
          sum = 8"
        `)
    })
    
    test('handles errors gracefully', async () => {
        const tool = createInterpreterTool()
        
        const result = await tool.execute!({
            title: 'Error test',
            code: `
                console.log('Before error')
                throw new Error('Test error')
                console.log('After error')
            `
        }, {} as any) as string
        
        expect(result).toContain('Test error')
        expect(result).toContain('Before error')
        expect(result).toContain('Stack trace')
    })
    
    test('handles JSON objects in console.log', async () => {
        const tool = createInterpreterTool()
        
        const result = await tool.execute!({
            title: 'JSON logging',
            code: `
                const obj = { name: 'test', value: 42, nested: { key: 'value' } }
                console.log('Object:', obj)
                console.log('Array:', [1, 2, 3])
            `
        }, {} as any) as string
        
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
        const tool = createInterpreterTool()
        
        const result = await tool.execute!({
            title: 'Timeout test',
            code: `
                while(true) {
                    // Infinite loop
                }
            `,
            timeout: 100
        }, {} as any) as string
        
        expect(result).toContain('Script execution timed out')
    })
    
    test('handles async code', async () => {
        const tool = createInterpreterTool()
        
        const result = await tool.execute!({
            title: 'Async test',
            code: `
                console.log('Start')
                const promise = new Promise(resolve => {
                    resolve('resolved')
                })
                const value = await promise
                console.log('Promise value:', value)
                return 'done'
            `
        }, {} as any) as string
        
        expect(result).toMatchInlineSnapshot(`
          "Start
          Promise value: resolved"
        `)
    })
    
    test('respects custom timeout', async () => {
        const tool = createInterpreterTool()
        
        const startTime = Date.now()
        const result = await tool.execute!({
            title: 'Custom timeout test',
            code: `
                let i = 0
                while(true) {
                    i++
                }
            `,
            timeout: 100
        }, {} as any) as string
        const elapsed = Date.now() - startTime
        
        expect(result).toContain('Script execution timed out')
        expect(elapsed).toBeGreaterThanOrEqual(90)
        expect(elapsed).toBeLessThan(200)
    })
    
    test('returns "no console logs" when no output', async () => {
        const tool = createInterpreterTool()
        
        const result = await tool.execute!({
            title: 'No output test',
            code: `
                const a = 5
                const b = 10
                const sum = a + b
                return sum
            `
        }, {} as any) as string
        
        expect(result).toBe('no console logs')
    })
    
    test('shows stack trace for errors thrown in functions', async () => {
        const tool = createInterpreterTool()
        
        const result = await tool.execute!({
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
            `
        }, {} as any) as string
        
        expect(result).toMatchInlineSnapshot(`
          "Logs before error:
          Starting main
          About to throw

          Error: Something went wrong in doSomething
          Stack trace:
          Error: Something went wrong in doSomething
              at doSomething (<isolated-vm>:12:27)
              at main (<isolated-vm>:17:21)
              at <isolated-vm>:21:17
              at <isolated-vm>:23:23"
        `)
    })
})