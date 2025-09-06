import { describe, test, expect } from 'vitest'
import { z, toJSONSchema } from 'zod'
import { optionalToNullable, UIFieldSchema } from 'contesto'
import { openai } from '@ai-sdk/openai'
import { generateText, tool } from 'ai'

describe('optionalToNullable', () => {
  test('UIFieldSchema can be made nullable for all optionals', async () => {
    const transformedSchema = optionalToNullable(UIFieldSchema)

    const json = toJSONSchema(transformedSchema)

    expect(json).toMatchInlineSnapshot(`
          {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "additionalProperties": false,
            "properties": {
              "description": {
                "anyOf": [
                  {
                    "type": "string",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "groupTitle": {
                "anyOf": [
                  {
                    "type": "string",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "href": {
                "anyOf": [
                  {
                    "type": "string",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "initialValue": {
                "anyOf": [
                  {
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
                  {
                    "type": "null",
                  },
                ],
              },
              "label": {
                "type": "string",
              },
              "max": {
                "anyOf": [
                  {
                    "type": "number",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "min": {
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
                "type": "string",
              },
              "options": {
                "anyOf": [
                  {
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "label": {
                          "type": "string",
                        },
                        "value": {
                          "type": "string",
                        },
                      },
                      "required": [
                        "label",
                        "value",
                      ],
                      "type": "object",
                    },
                    "type": "array",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "placeholder": {
                "anyOf": [
                  {
                    "type": "string",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "required": {
                "anyOf": [
                  {
                    "type": "boolean",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "step": {
                "anyOf": [
                  {
                    "type": "number",
                  },
                  {
                    "type": "null",
                  },
                ],
              },
              "type": {
                "enum": [
                  "input",
                  "password",
                  "textarea",
                  "number",
                  "select",
                  "slider",
                  "switch",
                  "color_picker",
                  "date_picker",
                  "image_upload",
                  "button",
                ],
                "type": "string",
              },
            },
            "required": [
              "name",
              "type",
              "label",
              "description",
              "required",
              "groupTitle",
              "placeholder",
              "initialValue",
              "min",
              "max",
              "step",
              "options",
              "href",
            ],
            "type": "object",
          }
        `)

    const model = openai.responses('gpt-4.1')
    const provider = model.provider
    const modelId = model.modelId
    expect({ provider, modelId }).toMatchInlineSnapshot(`
          {
            "modelId": "gpt-4.1",
            "provider": "openai.responses",
          }
        `)
    const res = await generateText({
      prompt:
        'Convert this schema to a tool schema, random values for each field',
      tools: {
        test: tool({ inputSchema: UIFieldSchema }),
      },
      model,
    })
  })

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
      coordinates: z.tuple([
        z.number(),
        z.number().optional(),
        z.string().optional(),
      ]),
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
      value: z.union([
        z.string().optional(),
        z.number(),
        z.boolean().optional(),
      ]),
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
