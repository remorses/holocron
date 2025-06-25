import { compileSchema } from 'json-schema-library'
import { describe, expect, test } from 'vitest'
import { getTypeForNameInSchema } from './render-form-tool'

describe('compileSchema with union in array', () => {
    const schema = {
        type: 'object',
        properties: {
            container: {
                type: 'array',
                items: {
                    anyOf: [
                        {
                            type: 'null',
                        },
                        {
                            type: 'object',
                            properties: {
                                email: { type: 'string' },
                                type: { const: 'email' },
                            },
                            required: ['email', 'type'],
                        },
                        {
                            type: 'object',
                            properties: {
                                sms: { type: 'string' },
                                type: { const: 'sms' },
                            },
                            required: ['sms', 'type'],
                        },
                        {
                            type: 'object',
                            properties: {
                                push: { type: 'boolean' },
                                type: { const: 'push' },
                            },
                            required: ['push', 'type'],
                        },
                    ],
                },
            },
        },
        required: ['container'],
    }

    const compiled = compileSchema(schema)

    test('should resolve pointer to field existing in only some unions: sms', () => {
        expect(getTypeForNameInSchema('container.items.0.sms', compiled))
            .toMatchInlineSnapshot(`
          {
            "type": "string",
          }
        `)
    })
    test('should resolve pointer to field existing in only some unions: type', () => {
        expect(getTypeForNameInSchema('container.items.0.type', compiled))
            .toMatchInlineSnapshot(`
              {
                "const": "push",
              }
            `)
    })
    test('should resolve pointer to field existing in only some unions: email', () => {
        expect(getTypeForNameInSchema('container.items.0.email', compiled))
            .toMatchInlineSnapshot(`
          {
            "type": "string",
          }
        `)
    })

    test('should resolve pointer to field existing in only some unions: push', () => {
        expect(getTypeForNameInSchema('container.items.0.push', compiled))
            .toMatchInlineSnapshot(`
          {
            "type": "boolean",
          }
        `)
    })

    // This showcases when a field does not exist, or only in some unions
    test('should resolve pointer to a non-existent field', () => {
        expect(
            getTypeForNameInSchema('container.items.0.notarealfield', compiled),
        ).toBeUndefined()
    })
})

// UNION TESTS: string or object union
describe('compileSchema with array union of string or object', () => {
    const schema = {
        type: 'object',
        properties: {
            container: {
                type: 'array',
                items: {
                    anyOf: [
                        { type: 'string' },
                        {
                            type: 'object',
                            properties: {
                                nested: {
                                    type: 'object',
                                    properties: {
                                        foo: { type: 'integer' },
                                        bar: { type: 'string' },
                                    },
                                    required: ['foo', 'bar'],
                                },
                                type: { const: 'complex' },
                            },
                            required: ['nested', 'type'],
                        },
                    ],
                },
            },
        },
        required: ['container'],
    }

    const compiled = compileSchema(schema)

    test('should resolve pointer to field in string-or-object union: type', () => {
        expect(getTypeForNameInSchema('container.items.0.type', compiled))
            .toMatchInlineSnapshot(`
              {
                "const": "complex",
              }
            `)
    })

    test('should resolve pointer to nested field in union: nested.foo', () => {
        expect(getTypeForNameInSchema('container.items.0.nested.foo', compiled))
            .toMatchInlineSnapshot(`
              {
                "type": "integer",
              }
            `)
    })

    test('should resolve pointer to nested field in union: nested.bar', () => {
        expect(getTypeForNameInSchema('container.items.0.nested.bar', compiled))
            .toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
    })

    test('should resolve pointer to the nested object itself', () => {
        expect(getTypeForNameInSchema('container.items.0.nested', compiled))
            .toMatchInlineSnapshot(`
              {
                "properties": {
                  "bar": {
                    "type": "string",
                  },
                  "foo": {
                    "type": "integer",
                  },
                },
                "required": [
                  "foo",
                  "bar",
                ],
                "type": "object",
              }
            `)
    })
})
