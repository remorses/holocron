import { describe, expect, it, test } from 'vitest'
import { z, toJSONSchema } from 'zod'
import { removeNullsForOptionals, optionalToNullable } from './zod.js'

describe('removeNullsForOptionals', () => {
  it('should remove null values for optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
      nullable: z.string().nullable(),
      optionalNullable: z.string().optional().nullable(),
    })

    const input = {
      required: 'value',
      optional: null,
      nullable: null,
      optionalNullable: null,
    }

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`
      {
        "nullable": null,
        "optionalNullable": null,
        "required": "value",
      }
    `)
  })

  it('should handle nested objects', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        email: z.string().optional(),
        settings: z.object({
          theme: z.string().optional(),
          notifications: z.boolean().optional(),
        }).optional(),
      }),
    })

    const input = {
      user: {
        name: 'John',
        email: null,
        settings: {
          theme: null,
          notifications: false,
        },
      },
    }

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`
      {
        "user": {
          "name": "John",
          "settings": {
            "notifications": false,
          },
        },
      }
    `)
  })

  it('should handle arrays', () => {
    const schema = z.array(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().nullable(),
      })
    )

    const input = [
      { id: 1, name: 'Item 1', description: null },
      { id: 2, name: null, description: 'Desc 2' },
      { id: 3, name: null, description: null },
    ]

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "description": null,
          "id": 1,
          "name": "Item 1",
        },
        {
          "description": "Desc 2",
          "id": 2,
        },
        {
          "description": null,
          "id": 3,
        },
      ]
    `)
  })

  it('should handle records', () => {
    const schema = z.record(z.string(), z.number().optional())

    const input = {
      a: 1,
      b: null,
      c: 3,
      d: null,
    }

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`
      {
        "a": 1,
        "c": 3,
      }
    `)
  })

  it('should handle tuples', () => {
    const schema = z.tuple([
      z.string(),
      z.number().optional(),
      z.boolean().nullable(),
    ])

    const input = ['hello', null, null]

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`
      [
        "hello",
        undefined,
        null,
      ]
    `)
  })

  it('should keep undefined values for optional fields', () => {
    const schema = z.object({
      optional: z.string().optional(),
    })

    const input = {
      optional: undefined,
    }

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`{}`)
  })

  it('should handle null input', () => {
    const schema = z.object({
      field: z.string(),
    })

    const result = removeNullsForOptionals(schema, null)
    
    expect(result).toMatchInlineSnapshot(`null`)
  })

  it('should handle undefined input', () => {
    const schema = z.object({
      field: z.string(),
    })

    const result = removeNullsForOptionals(schema, undefined)
    
    expect(result).toMatchInlineSnapshot(`undefined`)
  })

  it('should preserve non-null values', () => {
    const schema = z.object({
      string: z.string().optional(),
      number: z.number().optional(),
      boolean: z.boolean().optional(),
      object: z.object({ nested: z.string() }).optional(),
      array: z.array(z.string()).optional(),
    })

    const input = {
      string: 'value',
      number: 42,
      boolean: true,
      object: { nested: 'nested value' },
      array: ['a', 'b', 'c'],
    }

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`
      {
        "array": [
          "a",
          "b",
          "c",
        ],
        "boolean": true,
        "number": 42,
        "object": {
          "nested": "nested value",
        },
        "string": "value",
      }
    `)
  })

  it('should handle passthrough objects', () => {
    const schema = z.object({
      known: z.string().optional(),
    }).passthrough()

    const input = {
      known: null,
      unknown: 'value',
      anotherUnknown: null,
    }

    const result = removeNullsForOptionals(schema, input)
    
    expect(result).toMatchInlineSnapshot(`
      {
        "anotherUnknown": null,
        "unknown": "value",
      }
    `)
  })
})

describe('optionalToNullable', () => {
  test('converts optional primitive to nullable', () => {
    const originalSchema = z.object({
      name: z.string().optional(),
      age: z.number().optional(),
      active: z.boolean().optional(),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    // Compare original vs transformed JSON schemas
    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "active": {
              "type": "boolean",
            },
            "age": {
              "type": "number",
            },
            "name": {
              "type": "string",
            },
          },
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "active": {
              "anyOf": [
                {
                  "type": "boolean",
                },
                {
                  "type": "null",
                },
              ],
            },
            "age": {
              "anyOf": [
                {
                  "type": "number",
                },
                {
                  "type": "null",
                },
              ],
            },
            "name": {
              "anyOf": [
                {
                  "type": "string",
                },
                {
                  "type": "null",
                },
              ],
            },
          },
          "required": [
            "name",
            "age",
            "active",
          ],
          "type": "object",
        },
      }
    `)
  })

  test('handles nested objects with optionals', () => {
    const originalSchema = z.object({
      user: z.object({
        name: z.string().optional(),
        email: z.string(),
        profile: z
          .object({
            bio: z.string().optional(),
            avatar: z.string().optional(),
          })
          .optional(),
      }),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    // Compare JSON schemas
    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "user": {
              "additionalProperties": false,
              "properties": {
                "email": {
                  "type": "string",
                },
                "name": {
                  "type": "string",
                },
                "profile": {
                  "additionalProperties": false,
                  "properties": {
                    "avatar": {
                      "type": "string",
                    },
                    "bio": {
                      "type": "string",
                    },
                  },
                  "type": "object",
                },
              },
              "required": [
                "email",
              ],
              "type": "object",
            },
          },
          "required": [
            "user",
          ],
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "user": {
              "additionalProperties": false,
              "properties": {
                "email": {
                  "type": "string",
                },
                "name": {
                  "anyOf": [
                    {
                      "type": "string",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
                "profile": {
                  "anyOf": [
                    {
                      "additionalProperties": false,
                      "properties": {
                        "avatar": {
                          "anyOf": [
                            {
                              "type": "string",
                            },
                            {
                              "type": "null",
                            },
                          ],
                        },
                        "bio": {
                          "anyOf": [
                            {
                              "type": "string",
                            },
                            {
                              "type": "null",
                            },
                          ],
                        },
                      },
                      "required": [
                        "bio",
                        "avatar",
                      ],
                      "type": "object",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
              },
              "required": [
                "name",
                "email",
                "profile",
              ],
              "type": "object",
            },
          },
          "required": [
            "user",
          ],
          "type": "object",
        },
      }
    `)
  })

  test('handles arrays with optional elements', () => {
    const originalSchema = z.object({
      tags: z.array(z.string().optional()),
      numbers: z.array(z.number()),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "numbers": {
              "items": {
                "type": "number",
              },
              "type": "array",
            },
            "tags": {
              "items": {
                "type": "string",
              },
              "type": "array",
            },
          },
          "required": [
            "tags",
            "numbers",
          ],
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "numbers": {
              "items": {
                "type": "number",
              },
              "type": "array",
            },
            "tags": {
              "items": {
                "anyOf": [
                  {
                    "type": "string",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "type": "array",
            },
          },
          "required": [
            "tags",
            "numbers",
          ],
          "type": "object",
        },
      }
    `)
  })

  test('handles records with optional values', () => {
    const originalSchema = z.object({
      metadata: z.record(z.string(), z.string().optional()),
      config: z.record(z.string(), z.number()),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "config": {
              "additionalProperties": {
                "type": "number",
              },
              "propertyNames": {
                "type": "string",
              },
              "type": "object",
            },
            "metadata": {
              "additionalProperties": {
                "type": "string",
              },
              "propertyNames": {
                "type": "string",
              },
              "type": "object",
            },
          },
          "required": [
            "metadata",
            "config",
          ],
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "config": {
              "additionalProperties": {
                "type": "number",
              },
              "propertyNames": {
                "type": "string",
              },
              "type": "object",
            },
            "metadata": {
              "additionalProperties": {
                "anyOf": [
                  {
                    "type": "string",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "propertyNames": {
                "type": "string",
              },
              "type": "object",
            },
          },
          "required": [
            "metadata",
            "config",
          ],
          "type": "object",
        },
      }
    `)
  })

  test('handles tuples with optional elements', () => {
    const originalSchema = z.object({
      coordinates: z.tuple([z.number(), z.number().optional(), z.string().optional()]),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "coordinates": {
              "prefixItems": [
                {
                  "type": "number",
                },
                {
                  "type": "number",
                },
                {
                  "type": "string",
                },
              ],
              "type": "array",
            },
          },
          "required": [
            "coordinates",
          ],
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "coordinates": {
              "prefixItems": [
                {
                  "type": "number",
                },
                {
                  "anyOf": [
                    {
                      "type": "number",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
                {
                  "anyOf": [
                    {
                      "type": "string",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
              ],
              "type": "array",
            },
          },
          "required": [
            "coordinates",
          ],
          "type": "object",
        },
      }
    `)
  })

  test('handles unions with optional schemas', () => {
    const originalSchema = z.object({
      value: z.union([z.string().optional(), z.number(), z.boolean().optional()]),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "value": {
              "anyOf": [
                {
                  "type": "string",
                },
                {
                  "type": "number",
                },
                {
                  "type": "boolean",
                },
              ],
            },
          },
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "value": {
              "anyOf": [
                {
                  "anyOf": [
                    {
                      "type": "string",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
                {
                  "type": "number",
                },
                {
                  "anyOf": [
                    {
                      "type": "boolean",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
              ],
            },
          },
          "required": [
            "value",
          ],
          "type": "object",
        },
      }
    `)
  })

  test('handles intersections with optional fields', () => {
    const baseSchema = z.object({
      id: z.string(),
      name: z.string().optional(),
    })

    const extendedSchema = z.object({
      email: z.string().optional(),
      age: z.number(),
    })

    const originalSchema = z.intersection(baseSchema, extendedSchema)
    const transformedSchema = optionalToNullable(originalSchema)

    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "allOf": [
            {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "type": "string",
                },
                "name": {
                  "type": "string",
                },
              },
              "required": [
                "id",
              ],
              "type": "object",
            },
            {
              "additionalProperties": false,
              "properties": {
                "age": {
                  "type": "number",
                },
                "email": {
                  "type": "string",
                },
              },
              "required": [
                "age",
              ],
              "type": "object",
            },
          ],
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "allOf": [
            {
              "additionalProperties": false,
              "properties": {
                "id": {
                  "type": "string",
                },
                "name": {
                  "anyOf": [
                    {
                      "type": "string",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
              },
              "required": [
                "id",
                "name",
              ],
              "type": "object",
            },
            {
              "additionalProperties": false,
              "properties": {
                "age": {
                  "type": "number",
                },
                "email": {
                  "anyOf": [
                    {
                      "type": "string",
                    },
                    {
                      "type": "null",
                    },
                  ],
                },
              },
              "required": [
                "email",
                "age",
              ],
              "type": "object",
            },
          ],
        },
      }
    `)
  })

  test('leaves non-optional fields unchanged', () => {
    const originalSchema = z.object({
      required: z.string(),
      alsoRequired: z.number(),
      nested: z.object({
        stillRequired: z.boolean(),
      }),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "alsoRequired": {
              "type": "number",
            },
            "nested": {
              "additionalProperties": false,
              "properties": {
                "stillRequired": {
                  "type": "boolean",
                },
              },
              "required": [
                "stillRequired",
              ],
              "type": "object",
            },
            "required": {
              "type": "string",
            },
          },
          "required": [
            "required",
            "alsoRequired",
            "nested",
          ],
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "alsoRequired": {
              "type": "number",
            },
            "nested": {
              "additionalProperties": false,
              "properties": {
                "stillRequired": {
                  "type": "boolean",
                },
              },
              "required": [
                "stillRequired",
              ],
              "type": "object",
            },
            "required": {
              "type": "string",
            },
          },
          "required": [
            "required",
            "alsoRequired",
            "nested",
          ],
          "type": "object",
        },
      }
    `)
  })

  test('handles additional types - literals and enums', () => {
    const originalSchema = z.object({
      literalField: z.literal('specific-value').optional(),
      enumField: z.enum(['option1', 'option2']).optional(),
      booleanField: z.boolean().optional(),
      numberField: z.number().optional(),
    })

    const transformedSchema = optionalToNullable(originalSchema)

    const originalJson = toJSONSchema(originalSchema)
    const transformedJson = toJSONSchema(transformedSchema)

    expect({
      original: originalJson,
      transformed: transformedJson,
    }).toMatchInlineSnapshot(`
      {
        "original": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "booleanField": {
              "type": "boolean",
            },
            "enumField": {
              "enum": [
                "option1",
                "option2",
              ],
              "type": "string",
            },
            "literalField": {
              "const": "specific-value",
              "type": "string",
            },
            "numberField": {
              "type": "number",
            },
          },
          "type": "object",
        },
        "transformed": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "additionalProperties": false,
          "properties": {
            "booleanField": {
              "anyOf": [
                {
                  "type": "boolean",
                },
                {
                  "type": "null",
                },
              ],
            },
            "enumField": {
              "anyOf": [
                {
                  "enum": [
                    "option1",
                    "option2",
                  ],
                  "type": "string",
                },
                {
                  "type": "null",
                },
              ],
            },
            "literalField": {
              "anyOf": [
                {
                  "const": "specific-value",
                  "type": "string",
                },
                {
                  "type": "null",
                },
              ],
            },
            "numberField": {
              "anyOf": [
                {
                  "type": "number",
                },
                {
                  "type": "null",
                },
              ],
            },
          },
          "required": [
            "literalField",
            "enumField",
            "booleanField",
            "numberField",
          ],
          "type": "object",
        },
      }
    `)
  })
})