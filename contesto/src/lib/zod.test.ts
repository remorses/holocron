import { describe, expect, it, test } from 'vitest'
import { z, toJSONSchema } from 'zod'
import { removeNullsForOptionals, optionalToNullable, repairToolCall } from './zod'

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

  it('should handle deeply nested optional fields', () => {
    const schema = z.object({
      level1: z.object({
        level2: z.object({
          level3: z.object({
            required: z.string(),
            optional: z.string().optional(),
            nullable: z.string().nullable(),
          }).optional(),
        }).optional(),
      }),
    })

    const input = {
      level1: {
        level2: {
          level3: {
            required: 'value',
            optional: null,
            nullable: null,
          },
        },
      },
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "level1": {
          "level2": {
            "level3": {
              "nullable": null,
              "required": "value",
            },
          },
        },
      }
    `)
  })

  it('should handle mixed arrays with nullable and optional items', () => {
    const schema = z.object({
      mixedArray: z.array(
        z.union([
          z.object({
            type: z.literal('a'),
            value: z.string().optional(),
          }),
          z.object({
            type: z.literal('b'),
            value: z.number().nullable(),
          }),
        ])
      ),
    })

    const input = {
      mixedArray: [
        { type: 'a', value: null },
        { type: 'b', value: null },
        { type: 'a', value: 'test' },
        { type: 'b', value: 42 },
      ],
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "mixedArray": [
          {
            "type": "a",
            "value": null,
          },
          {
            "type": "b",
            "value": null,
          },
          {
            "type": "a",
            "value": "test",
          },
          {
            "type": "b",
            "value": 42,
          },
        ],
      }
    `)
  })

  it('should handle optional arrays and nullable arrays', () => {
    const schema = z.object({
      optionalArray: z.array(z.string()).optional(),
      nullableArray: z.array(z.string()).nullable(),
      optionalNullableArray: z.array(z.string()).optional().nullable(),
      arrayOfOptionals: z.array(z.string().optional()),
    })

    const input = {
      optionalArray: null,
      nullableArray: null,
      optionalNullableArray: null,
      arrayOfOptionals: ['a', null, 'b', null],
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "arrayOfOptionals": [
          "a",
          "b",
        ],
        "nullableArray": null,
        "optionalNullableArray": null,
      }
    `)
  })

  it('should handle discriminated unions', () => {
    const schema = z.object({
      data: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('text'),
          content: z.string().optional(),
          metadata: z.object({
            author: z.string().optional(),
            timestamp: z.number().nullable(),
          }).optional(),
        }),
        z.object({
          type: z.literal('image'),
          url: z.string(),
          alt: z.string().optional(),
          dimensions: z.object({
            width: z.number().optional(),
            height: z.number().optional(),
          }).nullable(),
        }),
      ]),
    })

    const input = {
      data: {
        type: 'text',
        content: null,
        metadata: {
          author: null,
          timestamp: null,
        },
      },
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "content": null,
          "metadata": {
            "author": null,
            "timestamp": null,
          },
          "type": "text",
        },
      }
    `)
  })

  it('should handle complex record types with nested optionals', () => {
    const schema = z.object({
      settings: z.record(
        z.string(),
        z.object({
          enabled: z.boolean(),
          value: z.union([z.string(), z.number()]).optional(),
          config: z.record(z.string(), z.unknown()).optional(),
        })
      ),
    })

    const input = {
      settings: {
        feature1: {
          enabled: true,
          value: null,
          config: null,
        },
        feature2: {
          enabled: false,
          value: 'test',
          config: { key: 'value', another: null },
        },
      },
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "settings": {
          "feature1": {
            "enabled": true,
          },
          "feature2": {
            "config": {
              "another": null,
              "key": "value",
            },
            "enabled": false,
            "value": "test",
          },
        },
      }
    `)
  })

  it('should handle circular reference patterns', () => {
    type TreeNode = {
      value: string
      left?: TreeNode | null
      right?: TreeNode | null
    }

    const TreeSchema: z.ZodType<TreeNode> = z.object({
      value: z.string(),
      left: z.lazy(() => TreeSchema).optional(),
      right: z.lazy(() => TreeSchema).nullable(),
    })

    const input = {
      value: 'root',
      left: {
        value: 'left',
        left: null,
        right: null,
      },
      right: null,
    }

    const result = removeNullsForOptionals(TreeSchema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "left": {
          "left": null,
          "right": null,
          "value": "left",
        },
        "right": null,
        "value": "root",
      }
    `)
  })

  it('should handle transforms and refinements', () => {
    const schema = z.object({
      email: z.string().email().optional(),
      age: z.number().int().positive().optional(),
      date: z.string().datetime().optional(),
      custom: z.string().transform(val => val.toUpperCase()).optional(),
    })

    const input = {
      email: null,
      age: null,
      date: null,
      custom: null,
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`{}`)
  })

  it('should handle edge case with empty objects and arrays', () => {
    const schema = z.object({
      emptyObj: z.object({}).optional(),
      emptyArr: z.array(z.never()).optional(),
      objWithAllOptionals: z.object({
        a: z.string().optional(),
        b: z.number().optional(),
      }),
    })

    const input = {
      emptyObj: null,
      emptyArr: null,
      objWithAllOptionals: {
        a: null,
        b: null,
      },
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "objWithAllOptionals": {},
      }
    `)
  })

  it('should handle Maps and Sets', () => {
    const schema = z.object({
      map: z.map(z.string(), z.number().optional()),
      set: z.set(z.string().optional()),
      optionalMap: z.map(z.string(), z.number()).optional(),
    })

    const inputMap = new Map([
      ['key1', 1],
      ['key2', null],
      ['key3', 3],
    ])

    const inputSet = new Set(['a', null, 'b'])

    const input = {
      map: inputMap,
      set: inputSet,
      optionalMap: null,
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "map": Map {
          "key1" => 1,
          "key2" => null,
          "key3" => 3,
        },
        "set": Set {
          "a",
          null,
          "b",
        },
      }
    `)
  })

  it('should handle promise schemas', () => {
    const schema = z.object({
      asyncData: z.promise(z.string().optional()),
      optionalPromise: z.promise(z.string()).optional(),
    })

    const input = {
      asyncData: Promise.resolve(null),
      optionalPromise: null,
    }

    const result = removeNullsForOptionals(schema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "asyncData": Promise {},
      }
    `)
  })

  it('should handle complex real-world schema', () => {
    const UserSchema = z.object({
      id: z.string(),
      profile: z.object({
        name: z.string(),
        email: z.string().email().optional(),
        avatar: z.string().url().optional(),
        bio: z.string().max(500).optional(),
        settings: z.object({
          notifications: z.object({
            email: z.boolean(),
            push: z.boolean().optional(),
            sms: z.boolean().optional(),
          }),
          privacy: z.object({
            profileVisibility: z.enum(['public', 'private', 'friends']),
            showEmail: z.boolean().optional(),
            showActivity: z.boolean().optional(),
          }).optional(),
        }).optional(),
      }),
      metadata: z.record(z.string(), z.unknown()).optional(),
      tags: z.array(z.string()).optional(),
      createdAt: z.date(),
      updatedAt: z.date().nullable(),
    })

    const input = {
      id: '123',
      profile: {
        name: 'John Doe',
        email: null,
        avatar: null,
        bio: 'Developer',
        settings: {
          notifications: {
            email: true,
            push: null,
            sms: false,
          },
          privacy: {
            profileVisibility: 'public',
            showEmail: null,
            showActivity: null,
          },
        },
      },
      metadata: null,
      tags: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: null,
    }

    const result = removeNullsForOptionals(UserSchema, input)

    expect(result).toMatchInlineSnapshot(`
      {
        "createdAt": 2024-01-01T00:00:00.000Z,
        "id": "123",
        "profile": {
          "bio": "Developer",
          "name": "John Doe",
          "settings": {
            "notifications": {
              "email": true,
              "sms": false,
            },
            "privacy": {
              "profileVisibility": "public",
            },
          },
        },
        "updatedAt": null,
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

describe('repairToolCall', () => {
  it('should repair tool call with missing optional fields', async () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
      age: z.number().optional(),
      preferences: z.object({
        theme: z.string().optional(),
        notifications: z.boolean().optional()
      }).optional()
    })

    const toolCall = {
      toolName: 'updateUser',
      toolCallId: 'call_123',
      input: {
        name: 'John Doe',
        // Missing required email field
        age: '25', // Wrong type - should be number
        preferences: {
          theme: 'dark',
          // notifications could be missing
        }
      }
    }

    const tool = {
      inputSchema: schema
    }

    const mockGenerateObjectFn = async ({ schema, prompt }: { schema: z.ZodTypeAny; prompt: string }) => {
      // Simulate LLM fixing the input
      return {
        object: {
          name: 'John Doe',
          email: 'john@example.com', // Added missing required field
          age: 25, // Fixed type
          preferences: {
            theme: 'dark',
            notifications: null // Optional field set to null
          }
        }
      }
    }

    const result = await repairToolCall({
      toolCall,
      tool,
      inputSchema: toJSONSchema(schema),
      error: new Error('Validation failed'),
      generateObjectFn: mockGenerateObjectFn
    })

    expect(result).not.toBeNull()
    expect(result?.toolCallId).toBe('call_123')
    expect(result?.toolName).toBe('updateUser')

    // Parse the repaired input
    const repairedInput = JSON.parse(result!.input)
    expect(repairedInput).toMatchInlineSnapshot(`
      {
        "age": 25,
        "email": "john@example.com",
        "name": "John Doe",
        "preferences": {
          "theme": "dark",
        },
      }
    `)
  })

  it('should return null when tool has no input schema', async () => {
    const toolCall = {
      toolName: 'simpleAction',
      toolCallId: 'call_456',
      input: {}
    }

    const tool = {
      // No inputSchema defined
    }

    const mockGenerateObjectFn = async () => {
      throw new Error('Should not be called')
    }

    const result = await repairToolCall({
      toolCall,
      tool,
      inputSchema: {},
      error: new Error('No schema'),
      generateObjectFn: mockGenerateObjectFn
    })

    expect(result).toBeNull()
  })

  it('should return null when repair fails', async () => {
    const schema = z.object({
      requiredField: z.string()
    })

    const toolCall = {
      toolName: 'failingTool',
      toolCallId: 'call_789',
      input: { wrongField: 'value' }
    }

    const tool = {
      inputSchema: schema
    }

    const mockGenerateObjectFn = async () => {
      throw new Error('LLM failed to generate')
    }

    const result = await repairToolCall({
      toolCall,
      tool,
      inputSchema: toJSONSchema(schema),
      error: new Error('Original error'),
      generateObjectFn: mockGenerateObjectFn
    })

    expect(result).toBeNull()
  })

  it('should handle complex nested schemas with arrays', async () => {
    const schema = z.object({
      users: z.array(z.object({
        id: z.number(),
        name: z.string(),
        tags: z.array(z.string()).optional(),
        settings: z.object({
          emailNotifications: z.boolean(),
          theme: z.enum(['light', 'dark']).optional()
        })
      })),
      metadata: z.record(z.string(), z.any()).optional()
    })

    const toolCall = {
      toolName: 'updateUserList',
      toolCallId: 'call_complex',
      input: {
        users: [
          {
            id: '1', // Wrong type
            name: 'Alice',
            tags: null, // Should be array or undefined
            settings: {
              emailNotifications: 'yes', // Wrong type
              theme: 'blue' // Invalid enum value
            }
          }
        ],
        metadata: null
      }
    }

    const tool = {
      inputSchema: schema
    }

    const mockGenerateObjectFn = async ({ schema }: { schema: z.ZodTypeAny }) => {
      return {
        object: {
          users: [
            {
              id: 1,
              name: 'Alice',
              tags: null, // Will be removed by removeNullsForOptionals
              settings: {
                emailNotifications: true,
                theme: null // Will be removed
              }
            }
          ],
          metadata: null // Will be removed
        }
      }
    }

    const result = await repairToolCall({
      toolCall,
      tool,
      inputSchema: toJSONSchema(schema),
      error: new Error('Complex validation error'),
      generateObjectFn: mockGenerateObjectFn
    })

    expect(result).not.toBeNull()
    const repairedInput = JSON.parse(result!.input)
    expect(repairedInput).toMatchInlineSnapshot(`
      {
        "users": [
          {
            "id": 1,
            "name": "Alice",
            "settings": {
              "emailNotifications": true,
            },
          },
        ],
      }
    `)
  })

  it('should preserve tool call ID and name in repaired result', async () => {
    const schema = z.object({
      message: z.string()
    })

    const toolCall = {
      toolName: 'sendMessage',
      toolCallId: 'unique_call_id_12345',
      input: { msg: 'Hello' } // Wrong field name
    }

    const tool = {
      inputSchema: schema
    }

    const mockGenerateObjectFn = async () => ({
      object: {
        message: 'Hello'
      }
    })

    const result = await repairToolCall({
      toolCall,
      tool,
      inputSchema: toJSONSchema(schema),
      error: new Error('Field name error'),
      generateObjectFn: mockGenerateObjectFn
    })

    expect(result).not.toBeNull()
    expect(result?.toolCallId).toBe('unique_call_id_12345')
    expect(result?.toolName).toBe('sendMessage')
  })
})
