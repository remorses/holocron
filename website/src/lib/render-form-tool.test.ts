import { z } from 'zod'
import { toJSONSchema } from 'zod'
import * as schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema || schemaLib?.['default']?.compileSchema
import { describe, expect, test } from 'vitest'
import { getTypeForNameInSchema, RenderFormParameters, getValidFieldTypesForSchema } from 'contesto'
import { docsJsonSchema } from 'docs-website/src/lib/docs-json'

test('compileSchema can be called on {}', () => {
  expect(() => compileSchema({})).not.toThrow()
})

describe('compileSchema with union in array', () => {
  const zodSchema = z.object({
    container: z.array(
      z.union([
        z.null(),
        z.object({
          email: z.string(),
          type: z.literal('email'),
        }),
        z.object({
          sms: z.string(),
          type: z.literal('sms'),
        }),
        z.object({
          push: z.boolean(),
          type: z.literal('push'),
        }),
      ]),
    ),
  })

  const schema = toJSONSchema(zodSchema)
  const compiled = compileSchema(schema)

  test('should resolve pointer to field existing in only some unions: sms', () => {
    expect(getTypeForNameInSchema('container.0.sms', compiled)).toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
  })
  test('should resolve pointer to field existing in only some unions: type', () => {
    expect(getTypeForNameInSchema('container.0.type', compiled)).toMatchInlineSnapshot(`
              {
                "const": "push",
                "type": "string",
              }
            `)
  })
  test('should resolve pointer to field existing in only some unions: email', () => {
    expect(getTypeForNameInSchema('container.0.email', compiled)).toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
  })

  test('should resolve pointer to field existing in only some unions: push', () => {
    expect(getTypeForNameInSchema('container.0.push', compiled)).toMatchInlineSnapshot(`
              {
                "type": "boolean",
              }
            `)
  })

  // This showcases when a field does not exist, or only in some unions
  test('should resolve pointer to a non-existent field', () => {
    expect(getTypeForNameInSchema('container.0.notarealfield', compiled)).toBeUndefined()
  })
})

// UNION TESTS: string or object union
describe('compileSchema with array union of string or object', () => {
  const zodSchema = z.object({
    container: z.array(
      z.union([
        z.string(),
        z.object({
          nested: z.object({
            foo: z.number().int(),
            bar: z.string(),
          }),
          type: z.literal('complex'),
        }),
      ]),
    ),
  })

  const schema = toJSONSchema(zodSchema)
  const compiled = compileSchema(schema)

  test('should resolve pointer to field in string-or-object union: type', () => {
    expect(getTypeForNameInSchema('container.0.type', compiled)).toMatchInlineSnapshot(`
              {
                "const": "complex",
                "type": "string",
              }
            `)
  })

  test('should resolve pointer to nested field in union: nested.foo', () => {
    expect(getTypeForNameInSchema('container.0.nested.foo', compiled)).toMatchInlineSnapshot(`
              {
                "maximum": 9007199254740991,
                "minimum": -9007199254740991,
                "type": "integer",
              }
            `)
  })

  test('should resolve pointer to nested field in union: nested.bar', () => {
    expect(getTypeForNameInSchema('container.0.nested.bar', compiled)).toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
  })

  test('should resolve pointer to the nested object itself', () => {
    expect(getTypeForNameInSchema('container.0.nested', compiled)).toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "properties": {
                  "bar": {
                    "type": "string",
                  },
                  "foo": {
                    "maximum": 9007199254740991,
                    "minimum": -9007199254740991,
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

describe('DocsConfigSchema', () => {
  const compiledDocsJsonSchema = compileSchema(docsJsonSchema)

  test('name', () => {
    expect(getTypeForNameInSchema('name', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "Project or product name. This will be used in holocron dashboard to list the user websites. It has no other use case than that.",
                "minLength": 1,
                "type": "string",
              }
            `)
  })

  test('description', () => {
    expect(getTypeForNameInSchema('description', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "default SEO description for pages that do not have a description frontmatter",
                "type": "string",
              }
            `)
  })

  // logo
  test('logo.light', () => {
    expect(getTypeForNameInSchema('logo.light', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Logo for light mode",
            "type": "string",
          }
        `)
  })
  test('logo.dark', () => {
    expect(getTypeForNameInSchema('logo.dark', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Logo for dark mode",
            "type": "string",
          }
        `)
  })
  test('logo.href', () => {
    expect(getTypeForNameInSchema('logo.href', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Logo click target URL",
            "format": "uri",
            "type": "string",
          }
        `)
  })

  // favicon
  test('favicon.light', () => {
    expect(getTypeForNameInSchema('favicon.light', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Favicon for light mode",
            "type": "string",
          }
        `)
  })
  test('favicon.dark', () => {
    expect(getTypeForNameInSchema('favicon.dark', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Favicon for dark mode",
            "type": "string",
          }
        `)
  })

  // Navbar: links[0] fields
  test('navbar.links.0.label', () => {
    expect(getTypeForNameInSchema('navbar.links.0.label', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "Link text",
                "type": "string",
              }
            `)
  })
  test('navbar.links.0.href', () => {
    expect(getTypeForNameInSchema('navbar.links.0.href', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "Link URL",
                "format": "uri",
                "type": "string",
              }
            `)
  })
  test('navbar.links.0.icon', () => {
    expect(getTypeForNameInSchema('navbar.links.0.icon', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "Optional icon",
                "type": "string",
              }
            `)
  })

  // Navbar: primary CTA union tests
  test('navbar.primary.type', () => {
    expect(getTypeForNameInSchema('navbar.primary.type', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "const": "github",
                "description": "CTA type GitHub",
                "type": "string",
              }
            `)
  })
  test('navbar.primary.label', () => {
    expect(getTypeForNameInSchema('navbar.primary.label', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "Button label",
                "type": "string",
              }
            `)
  })
  test('navbar.primary.href', () => {
    expect(getTypeForNameInSchema('navbar.primary.href', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "GitHub repo URL",
                "format": "uri",
                "type": "string",
              }
            `)
  })
  // Github union
  test('navbar.primary.type_github', () => {
    // For github union: the type property
    expect(getTypeForNameInSchema('navbar.primary.type', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "const": "github",
                "description": "CTA type GitHub",
                "type": "string",
              }
            `)
  })
  test('navbar.primary.href_github', () => {
    expect(getTypeForNameInSchema('navbar.primary.href', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "GitHub repo URL",
                "format": "uri",
                "type": "string",
              }
            `)
  })

  // Footer.socials - a dynamic additional property, test schema for value type
  test('footer.socials.somekey', () => {
    expect(getTypeForNameInSchema('footer.socials.somekey', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "format": "uri",
                "type": "string",
              }
            `)
  })

  // Footer.links[0]
  test('footer.links.0.header', () => {
    expect(getTypeForNameInSchema('footer.links.0.header', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "Column header",
                "type": "string",
              }
            `)
  })
  test('footer.links.0.items.0.label', () => {
    expect(getTypeForNameInSchema('footer.links.0.items.0.label', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Item text",
            "type": "string",
          }
        `)
  })
  test('footer.links.0.items.0.href', () => {
    expect(getTypeForNameInSchema('footer.links.0.items.0.href', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Item link URL",
            "format": "uri",
            "type": "string",
          }
        `)
  })

  // Banner
  test('banner.content', () => {
    expect(getTypeForNameInSchema('banner.content', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "Banner HTML/MDX content",
            "minLength": 1,
            "type": "string",
          }
        `)
  })
  test('banner.dismissible', () => {
    expect(getTypeForNameInSchema('banner.dismissible', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "description": "Whether the banner can be dismissed",
                "type": "boolean",
              }
            `)
  })

  // Contextual.options[0]
  test('contextual.options.0', () => {
    expect(getTypeForNameInSchema('contextual.options.0', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "enum": [
                  "copy",
                  "view",
                  "chatgpt",
                  "claude",
                ],
                "type": "string",
              }
            `)
  })

  // cssVariables: arbitrary properties, each string
  test('cssVariables.light.someVar', () => {
    expect(getTypeForNameInSchema('cssVariables.light.someVar', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
  })
})

describe('getTypeForNameInSchema edge cases', () => {
  test('enum field with string type', () => {
    const zodSchema = z.object({
      status: z.enum(['active', 'inactive', 'pending']),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('status', compiled)).toMatchInlineSnapshot(`
      {
        "enum": [
          "active",
          "inactive",
          "pending",
        ],
        "type": "string",
      }
    `)
  })

  test('enum field with numbers', () => {
    const zodSchema = z.object({
      priority: z.enum(['1', '2', '3']),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('priority', compiled)).toMatchInlineSnapshot(`
      {
        "enum": [
          "1",
          "2",
          "3",
        ],
        "type": "string",
      }
    `)
  })

  test('const field', () => {
    const zodSchema = z.object({
      version: z.literal('v1'),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('version', compiled)).toMatchInlineSnapshot(`
      {
        "const": "v1",
        "type": "string",
      }
    `)
  })

  test('nullable string', () => {
    const zodSchema = z.object({
      optional: z.string().nullable(),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('optional', compiled)).toMatchInlineSnapshot(`
      {
        "anyOf": [
          {
            "type": "string",
          },
          {
            "type": "null",
          },
        ],
      }
    `)
  })

  test('union of string and null', () => {
    const zodSchema = z.object({
      field: z.union([z.string(), z.null()]),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('field', compiled)).toMatchInlineSnapshot(`
      {
        "anyOf": [
          {
            "type": "string",
          },
          {
            "type": "null",
          },
        ],
      }
    `)
  })

  test('array of enums', () => {
    const zodSchema = z.object({
      tags: z.array(z.enum(['red', 'blue', 'green'])),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('tags.0', compiled)).toMatchInlineSnapshot(`
      {
        "enum": [
          "red",
          "blue",
          "green",
        ],
        "type": "string",
      }
    `)
  })

  test('nested object in array with enum', () => {
    const zodSchema = z.object({
      items: z.array(
        z.object({
          status: z.enum(['draft', 'published']),
          title: z.string(),
        }),
      ),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('items.0.status', compiled)).toMatchInlineSnapshot(`
      {
        "enum": [
          "draft",
          "published",
        ],
        "type": "string",
      }
    `)
    expect(getTypeForNameInSchema('items.0.title', compiled)).toMatchInlineSnapshot(`
      {
        "type": "string",
      }
    `)
  })

  test('boolean field', () => {
    const zodSchema = z.object({
      enabled: z.boolean(),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('enabled', compiled)).toMatchInlineSnapshot(`
      {
        "type": "boolean",
      }
    `)
  })

  test('number with constraints', () => {
    const zodSchema = z.object({
      age: z.number().min(0).max(120),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('age', compiled)).toMatchInlineSnapshot(`
      {
        "maximum": 120,
        "minimum": 0,
        "type": "number",
      }
    `)
  })

  test('integer field', () => {
    const zodSchema = z.object({
      count: z.number().int(),
    })
    const schema = toJSONSchema(zodSchema)
    const compiled = compileSchema(schema)
    
    expect(getTypeForNameInSchema('count', compiled)).toMatchInlineSnapshot(`
      {
        "maximum": 9007199254740991,
        "minimum": -9007199254740991,
        "type": "integer",
      }
    `)
  })
})

describe('getValidFieldTypesForSchema', () => {
  test('string type', () => {
    expect(getValidFieldTypesForSchema({ type: 'string' })).toMatchInlineSnapshot(`
      [
        "input",
        "password",
        "textarea",
        "select",
        "radio",
        "color_picker",
        "date_picker",
      ]
    `)
  })

  test('number type', () => {
    expect(getValidFieldTypesForSchema({ type: 'number' })).toMatchInlineSnapshot(`
      [
        "number",
        "slider",
      ]
    `)
  })

  test('integer type', () => {
    expect(getValidFieldTypesForSchema({ type: 'integer' })).toMatchInlineSnapshot(`
      [
        "number",
        "slider",
      ]
    `)
  })

  test('boolean type', () => {
    expect(getValidFieldTypesForSchema({ type: 'boolean' })).toMatchInlineSnapshot(`
      [
        "switch",
      ]
    `)
  })

  test('enum with few options (<=3)', () => {
    expect(getValidFieldTypesForSchema({ enum: ['a', 'b', 'c'] })).toMatchInlineSnapshot(`
      [
        "radio",
        "select",
      ]
    `)
  })

  test('enum with many options (>3)', () => {
    expect(getValidFieldTypesForSchema({ enum: ['a', 'b', 'c', 'd', 'e'] })).toMatchInlineSnapshot(`
      [
        "select",
      ]
    `)
  })

  test('const value', () => {
    expect(getValidFieldTypesForSchema({ const: 'fixed' })).toMatchInlineSnapshot(`
      [
        "input",
        "textarea",
      ]
    `)
  })

  test('anyOf with string and number', () => {
    expect(
      getValidFieldTypesForSchema({
        anyOf: [{ type: 'string' }, { type: 'number' }],
      }),
    ).toMatchInlineSnapshot(`
      [
        "input",
        "password",
        "textarea",
        "select",
        "radio",
        "color_picker",
        "date_picker",
        "number",
        "slider",
      ]
    `)
  })

  test('oneOf with boolean and string', () => {
    expect(
      getValidFieldTypesForSchema({
        oneOf: [{ type: 'boolean' }, { type: 'string' }],
      }),
    ).toMatchInlineSnapshot(`
      [
        "switch",
        "input",
        "password",
        "textarea",
        "select",
        "radio",
        "color_picker",
        "date_picker",
      ]
    `)
  })

  test('array of types', () => {
    expect(getValidFieldTypesForSchema({ type: ['string', 'null'] })).toMatchInlineSnapshot(`
      [
        "input",
        "password",
        "textarea",
        "select",
        "radio",
        "color_picker",
        "date_picker",
      ]
    `)
  })

  test('invalid schema (array type)', () => {
    expect(getValidFieldTypesForSchema({ type: 'array' })).toMatchInlineSnapshot(`[]`)
  })

  test('invalid schema (object type)', () => {
    expect(getValidFieldTypesForSchema({ type: 'object' })).toMatchInlineSnapshot(`[]`)
  })

  test('null schema', () => {
    expect(getValidFieldTypesForSchema(null)).toMatchInlineSnapshot(`[]`)
  })

  test('undefined schema', () => {
    expect(getValidFieldTypesForSchema(undefined)).toMatchInlineSnapshot(`[]`)
  })
})

test('render form tool schema is readable', () => {
  const schema = toJSONSchema(RenderFormParameters, {})
  expect(schema).toMatchInlineSnapshot(`
    {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "additionalProperties": false,
      "properties": {
        "fields": {
          "items": {
            "additionalProperties": false,
            "properties": {
              "description": {
                "type": "string",
              },
              "groupTitle": {
                "description": "Optional group title. When consecutive fields share the same groupTitle, they will be wrapped in a container with this title. ALWAYS and ONLY use this for array of objects to put each object in the array into its own group. ",
                "type": "string",
              },
              "href": {
                "type": "string",
              },
              "initialValue": {
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
                  {
                    "type": "null",
                  },
                ],
              },
              "label": {
                "description": "Label describing what this field does to the user. For array items use First, Second, Third prefixes",
                "type": "string",
              },
              "max": {
                "type": "number",
              },
              "min": {
                "type": "number",
              },
              "name": {
                "description": "Field path with parts delimited by dot, for example object.field.child . for array items you can use parent.{index}.objectField where index is a number. NEVER use [index] syntax, for example instead of domains[0] use domains.0",
                "type": "string",
              },
              "options": {
                "items": {
                  "additionalProperties": false,
                  "properties": {
                    "description": {
                      "type": "string",
                    },
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
              "placeholder": {
                "type": "string",
              },
              "required": {
                "type": "boolean",
              },
              "step": {
                "type": "number",
              },
              "type": {
                "enum": [
                  "input",
                  "password",
                  "textarea",
                  "number",
                  "select",
                  "radio",
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
              "initialValue",
            ],
            "type": "object",
          },
          "type": "array",
        },
      },
      "required": [
        "fields",
      ],
      "type": "object",
    }
  `)
})
