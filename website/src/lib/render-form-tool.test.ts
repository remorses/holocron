import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema
import { describe, expect, test } from 'vitest'
import {
    getTypeForNameInSchema,
    RenderFormParameters,
} from './render-form-tool'

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

    const schema = zodToJsonSchema(zodSchema)
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

    const schema = zodToJsonSchema(zodSchema)
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
    test('name', () => {
        expect(getTypeForNameInSchema('name')).toMatchInlineSnapshot(`
          {
            "description": "Project or product name",
            "minLength": 1,
            "type": "string",
          }
        `)
    })

    test('description', () => {
        expect(getTypeForNameInSchema('description')).toMatchInlineSnapshot(`
          {
            "description": "SEO description",
            "type": "string",
          }
        `)
    })

    // logo
    test('logo.light', () => {
        expect(getTypeForNameInSchema('logo.light')).toMatchInlineSnapshot(`
          {
            "description": "Logo for light mode",
            "type": "string",
          }
        `)
    })
    test('logo.dark', () => {
        expect(getTypeForNameInSchema('logo.dark')).toMatchInlineSnapshot(`
          {
            "description": "Logo for dark mode",
            "type": "string",
          }
        `)
    })
    test('logo.href', () => {
        expect(getTypeForNameInSchema('logo.href')).toMatchInlineSnapshot(`
          {
            "description": "Logo click target URL",
            "format": "uri",
            "type": "string",
          }
        `)
    })

    // favicon
    test('favicon.light', () => {
        expect(getTypeForNameInSchema('favicon.light')).toMatchInlineSnapshot(`
          {
            "description": "Favicon for light mode",
            "type": "string",
          }
        `)
    })
    test('favicon.dark', () => {
        expect(getTypeForNameInSchema('favicon.dark')).toMatchInlineSnapshot(`
          {
            "description": "Favicon for dark mode",
            "type": "string",
          }
        `)
    })

    // Navbar: links[0] fields
    test('navbar.links.0.label', () => {
        expect(getTypeForNameInSchema('navbar.links.0.label'))
            .toMatchInlineSnapshot(`
              {
                "description": "Link text",
                "type": "string",
              }
            `)
    })
    test('navbar.links.0.href', () => {
        expect(getTypeForNameInSchema('navbar.links.0.href'))
            .toMatchInlineSnapshot(`
              {
                "description": "Link URL",
                "format": "uri",
                "type": "string",
              }
            `)
    })
    test('navbar.links.0.icon', () => {
        expect(getTypeForNameInSchema('navbar.links.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional icon",
                "type": "string",
              }
            `)
    })

    // Navbar: primary CTA union tests
    test('navbar.primary.type', () => {
        expect(getTypeForNameInSchema('navbar.primary.type'))
            .toMatchInlineSnapshot(`
              {
                "const": "github",
                "description": "CTA type GitHub",
                "type": "string",
              }
            `)
    })
    test('navbar.primary.label', () => {
        expect(getTypeForNameInSchema('navbar.primary.label'))
            .toMatchInlineSnapshot(`
              {
                "description": "Button label",
                "type": "string",
              }
            `)
    })
    test('navbar.primary.href', () => {
        expect(getTypeForNameInSchema('navbar.primary.href'))
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
        expect(getTypeForNameInSchema('navbar.primary.type', undefined))
            .toMatchInlineSnapshot(`
              {
                "const": "github",
                "description": "CTA type GitHub",
                "type": "string",
              }
            `)
    })
    test('navbar.primary.href_github', () => {
        expect(getTypeForNameInSchema('navbar.primary.href', undefined))
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
        expect(getTypeForNameInSchema('footer.socials.somekey'))
            .toMatchInlineSnapshot(`
              {
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Footer.links[0]
    test('footer.links.0.header', () => {
        expect(getTypeForNameInSchema('footer.links.0.header'))
            .toMatchInlineSnapshot(`
              {
                "description": "Column header",
                "type": "string",
              }
            `)
    })
    test('footer.links.0.items.0.label', () => {
        expect(getTypeForNameInSchema('footer.links.0.items.0.label'))
            .toMatchInlineSnapshot(`
          {
            "description": "Item text",
            "type": "string",
          }
        `)
    })
    test('footer.links.0.items.0.href', () => {
        expect(getTypeForNameInSchema('footer.links.0.items.0.href'))
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
        expect(getTypeForNameInSchema('banner.content')).toMatchInlineSnapshot(`
          {
            "description": "Banner HTML/MDX content",
            "minLength": 1,
            "type": "string",
          }
        `)
    })
    test('banner.dismissible', () => {
        expect(getTypeForNameInSchema('banner.dismissible'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether the banner can be dismissed",
                "type": "boolean",
              }
            `)
    })

    // Contextual.options[0]
    test('contextual.options.0', () => {
        expect(getTypeForNameInSchema('contextual.options.0'))
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
    test('cssVariables.someVar', () => {
        expect(getTypeForNameInSchema('cssVariables.someVar'))
            .toMatchInlineSnapshot(`
              {
                "type": "string",
              }
            `)
    })
})

test('render form tool schema is readable', () => {
    const schema = zodToJsonSchema(RenderFormParameters, {
        $refStrategy: 'none',
    })
    expect(schema).toMatchInlineSnapshot(`
      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "additionalProperties": false,
        "properties": {
          "fields": {
            "items": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "placeholder": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "prefix": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "input",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "placeholder",
                    "prefix",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "placeholder": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "password",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "placeholder",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "placeholder": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "textarea",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "placeholder",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "max": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "min": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "name": {
                      "type": "string",
                    },
                    "placeholder": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "step": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "number",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "min",
                    "max",
                    "step",
                    "placeholder",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "options": {
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
                      "minItems": 1,
                      "type": "array",
                    },
                    "placeholder": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "select",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "options",
                    "placeholder",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "max": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "min": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "name": {
                      "type": "string",
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "step": {
                      "type": [
                        "number",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "slider",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "min",
                    "max",
                    "step",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "switch",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "buttonText": {
                      "type": "string",
                    },
                    "defaultValue": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "name": {
                      "type": "string",
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "color_picker",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "buttonText",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "defaultValue": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "date_picker",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "required",
                    "description",
                    "defaultValue",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "required": {
                      "type": [
                        "boolean",
                        "null",
                      ],
                    },
                    "type": {
                      "const": "image_upload",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "required",
                    "description",
                  ],
                  "type": "object",
                },
                {
                  "additionalProperties": false,
                  "properties": {
                    "description": {
                      "type": [
                        "string",
                        "null",
                      ],
                    },
                    "href": {
                      "enum": [
                        "/",
                        "/docs",
                        "/pricing",
                        "https://github.com/your-org",
                      ],
                      "type": "string",
                    },
                    "label": {
                      "type": "string",
                    },
                    "name": {
                      "type": "string",
                    },
                    "type": {
                      "const": "button",
                      "type": "string",
                    },
                  },
                  "required": [
                    "type",
                    "name",
                    "label",
                    "href",
                    "description",
                  ],
                  "type": "object",
                },
              ],
              "description": "Each field requires a name property that describes the filed updated on that fumabase.jsonc scalar field, it can be name, navTopLinks.{index}.anchor, navTopLinks.{index}.icon, navTopLinks.{index}.color.light, navTopLinks.{index}.color.dark, navTopLinks.{index}.hidden, navTopLinks.{index}.href, description, logo.light, logo.dark, logo.href, favicon.light, favicon.dark, navbar.links.{index}.label, navbar.links.{index}.href, navbar.links.{index}.icon, navbar.primary.type, navbar.primary.label, navbar.primary.href, navbar.primary.type, navbar.primary.href, footer.socials, footer.links.{index}.header, footer.links.{index}.items.{index}.label, footer.links.{index}.items.{index}.href, seo.metatags, seo.indexing, redirects.{index}.source, redirects.{index}.destination, redirects.{index}.permanent, banner.content, banner.dismissible, contextual.options.{index}, cssVariables, domains.{index} where {index} is a number",
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
