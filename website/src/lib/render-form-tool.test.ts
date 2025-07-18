import { z } from 'zod'
import {toJSONSchema} from 'zod'
import * as schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema || schemaLib?.['default']?.compileSchema
import { describe, expect, test } from 'vitest'
import {
    getTypeForNameInSchema,
    RenderFormParameters,
} from './render-form-tool'
import { docsJsonSchema } from 'docs-website/src/lib/docs-json'

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
        expect(getTypeForNameInSchema('container.0.sms', compiled))
            .toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
    })
    test('should resolve pointer to field existing in only some unions: type', () => {
        expect(getTypeForNameInSchema('container.0.type', compiled))
            .toMatchInlineSnapshot(`
              {
                "const": "push",
                "type": "string",
              }
            `)
    })
    test('should resolve pointer to field existing in only some unions: email', () => {
        expect(getTypeForNameInSchema('container.0.email', compiled))
            .toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
    })

    test('should resolve pointer to field existing in only some unions: push', () => {
        expect(getTypeForNameInSchema('container.0.push', compiled))
            .toMatchInlineSnapshot(`
              {
                "type": "boolean",
              }
            `)
    })

    // This showcases when a field does not exist, or only in some unions
    test('should resolve pointer to a non-existent field', () => {
        expect(
            getTypeForNameInSchema('container.0.notarealfield', compiled),
        ).toBeUndefined()
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
        expect(getTypeForNameInSchema('container.0.type', compiled))
            .toMatchInlineSnapshot(`
              {
                "const": "complex",
                "type": "string",
              }
            `)
    })

    test('should resolve pointer to nested field in union: nested.foo', () => {
        expect(getTypeForNameInSchema('container.0.nested.foo', compiled))
            .toMatchInlineSnapshot(`
              {
                "maximum": 9007199254740991,
                "minimum": -9007199254740991,
                "type": "integer",
              }
            `)
    })

    test('should resolve pointer to nested field in union: nested.bar', () => {
        expect(getTypeForNameInSchema('container.0.nested.bar', compiled))
            .toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
    })

    test('should resolve pointer to the nested object itself', () => {
        expect(getTypeForNameInSchema('container.0.nested', compiled))
            .toMatchInlineSnapshot(`
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
            "description": "Project or product name",
            "minLength": 1,
            "type": "string",
          }
        `)
    })

    test('description', () => {
        expect(getTypeForNameInSchema('description', compiledDocsJsonSchema)).toMatchInlineSnapshot(`
          {
            "description": "SEO description",
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
        expect(getTypeForNameInSchema('navbar.links.0.label', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "description": "Link text",
                "type": "string",
              }
            `)
    })
    test('navbar.links.0.href', () => {
        expect(getTypeForNameInSchema('navbar.links.0.href', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "description": "Link URL",
                "format": "uri",
                "type": "string",
              }
            `)
    })
    test('navbar.links.0.icon', () => {
        expect(getTypeForNameInSchema('navbar.links.0.icon', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional icon",
                "type": "string",
              }
            `)
    })

    // Navbar: primary CTA union tests
    test('navbar.primary.type', () => {
        expect(getTypeForNameInSchema('navbar.primary.type', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "const": "github",
                "description": "CTA type GitHub",
                "type": "string",
              }
            `)
    })
    test('navbar.primary.label', () => {
        expect(getTypeForNameInSchema('navbar.primary.label', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "description": "Button label",
                "type": "string",
              }
            `)
    })
    test('navbar.primary.href', () => {
        expect(getTypeForNameInSchema('navbar.primary.href', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
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
        expect(getTypeForNameInSchema('navbar.primary.type', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "const": "github",
                "description": "CTA type GitHub",
                "type": "string",
              }
            `)
    })
    test('navbar.primary.href_github', () => {
        expect(getTypeForNameInSchema('navbar.primary.href', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "description": "GitHub repo URL",
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Footer.socials - a dynamic additional property, test schema for value type
    test('footer.socials.somekey', () => {
        expect(getTypeForNameInSchema('footer.socials.somekey', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Footer.links[0]
    test('footer.links.0.header', () => {
        expect(getTypeForNameInSchema('footer.links.0.header', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "description": "Column header",
                "type": "string",
              }
            `)
    })
    test('footer.links.0.items.0.label', () => {
        expect(getTypeForNameInSchema('footer.links.0.items.0.label', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
          {
            "description": "Item text",
            "type": "string",
          }
        `)
    })
    test('footer.links.0.items.0.href', () => {
        expect(getTypeForNameInSchema('footer.links.0.items.0.href', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
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
        expect(getTypeForNameInSchema('banner.dismissible', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether the banner can be dismissed",
                "type": "boolean",
              }
            `)
    })

    // Contextual.options[0]
    test('contextual.options.0', () => {
        expect(getTypeForNameInSchema('contextual.options.0', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
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
        expect(getTypeForNameInSchema('cssVariables.light.someVar', compiledDocsJsonSchema))
            .toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
    })
})

test('render form tool schema is readable', () => {
    const schema = toJSONSchema(RenderFormParameters, {

    })
    expect(schema).toMatchInlineSnapshot(`
      {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "additionalProperties": false,
        "properties": {
          "fields": {
            "items": {
              "additionalProperties": false,
              "description": "Each field requires a name property that describes the filed updated on that fumabase.jsonc scalar field, it can be siteId, name, description, logo.light, logo.dark, logo.href, logo.text, favicon.light, favicon.dark, navbar.links.{index}.label, navbar.links.{index}.href, navbar.links.{index}.icon, navbar.primary.type, navbar.primary.label, navbar.primary.href, navbar.primary.type, navbar.primary.href, tabs.{index}.tab, tabs.{index}.openapi, tabs.{index}.renderer, tabs.{index}.tab, tabs.{index}.mcp, footer.socials, footer.links.{index}.header, footer.links.{index}.items.{index}.label, footer.links.{index}.items.{index}.href, seo.metatags, seo.indexing, redirects.{index}.source, redirects.{index}.destination, redirects.{index}.permanent, banner.content, banner.dismissible, contextual.options.{index}, cssVariables.light, cssVariables.dark, domains.{index}, hideSidebar, ignore.{index}, theme where {index} is a number. NEVER use [index] syntax, for example instead of domains[0] use domains.0",
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
                  "description": "Optional group title. When consecutive fields share the same groupTitle, they will be wrapped in a container with this title. ONLY use this for array of objects to put each object in the array into its own group. ",
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
                          "type": "null",
                        },
                      ],
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
                          "type": "boolean",
                        },
                        {
                          "type": "null",
                        },
                      ],
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
