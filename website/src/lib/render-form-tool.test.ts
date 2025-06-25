import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema
import { describe, expect, test } from 'vitest'
import { getTypeForNameInSchema } from './render-form-tool'

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

    // Navigation tested for all anyOf's
    // Navigation.languages (variant 0)
    test('navigation.languages.0.language', () => {
        expect(getTypeForNameInSchema('navigation.languages.0.language'))
            .toMatchInlineSnapshot(`
              {
                "description": "The language code (ISO 639-1) for this section, e.g., "en", "fr", "es"",
                "minLength": 1,
                "type": "string",
              }
            `)
    })
    test('navigation.languages.0.default', () => {
        expect(getTypeForNameInSchema('navigation.languages.0.default'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether this language is the default selection",
                "type": "boolean",
              }
            `)
    })
    test('navigation.languages.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.languages.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether the language is hidden by default",
                "type": "boolean",
              }
            `)
    })
    test('navigation.languages.0.href', () => {
        expect(getTypeForNameInSchema('navigation.languages.0.href'))
            .toMatchInlineSnapshot(`
              {
                "description": "URL or root path for this language variant",
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Navigation.versions (variant 1)
    test('navigation.versions.0.version', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.version'))
            .toMatchInlineSnapshot(`
              {
                "description": "Version label (e.g., "v1.0", "latest")",
                "minLength": 1,
                "type": "string",
              }
            `)
    })
    test('navigation.versions.0.default', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.default'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether this is the default version",
                "type": "boolean",
              }
            `)
    })
    test('navigation.versions.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether this version selection is hidden by default",
                "type": "boolean",
              }
            `)
    })
    test('navigation.versions.0.href', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.href'))
            .toMatchInlineSnapshot(`
              {
                "description": "URL or root path for this version",
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Navigation.tabs (variant 2)
    test('navigation.tabs.0.tab', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.tab'))
            .toMatchInlineSnapshot(`
              {
                "description": "Tab name or label",
                "minLength": 1,
                "type": "string",
              }
            `)
    })
    test('navigation.tabs.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional icon",
                "type": "string",
              }
            `)
    })
    test('navigation.tabs.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether the tab is hidden by default",
                "type": "boolean",
              }
            `)
    })
    test('navigation.tabs.0.href', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.href'))
            .toMatchInlineSnapshot(`
              {
                "description": "URL or root path for this tab",
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Navigation.dropdowns (variant 3)
    test('navigation.dropdowns.0.dropdown', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.dropdown'))
            .toMatchInlineSnapshot(`
              {
                "description": "Dropdown name or label",
                "minLength": 1,
                "type": "string",
              }
            `)
    })
    test('navigation.dropdowns.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional icon",
                "type": "string",
              }
            `)
    })
    test('navigation.dropdowns.0.color.light', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.color.light'))
            .toMatchInlineSnapshot(`
          {
            "description": "Color used in light mode",
            "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
            "type": "string",
          }
        `)
    })
    test('navigation.dropdowns.0.color.dark', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.color.dark'))
            .toMatchInlineSnapshot(`
          {
            "description": "Color used in dark mode",
            "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
            "type": "string",
          }
        `)
    })
    test('navigation.dropdowns.0.description', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.description'))
            .toMatchInlineSnapshot(`
              {
                "description": "Text description shown for dropdown",
                "type": "string",
              }
            `)
    })
    test('navigation.dropdowns.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether the dropdown is hidden by default",
                "type": "boolean",
              }
            `)
    })
    test('navigation.dropdowns.0.href', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.href'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional URL linked from the dropdown",
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Navigation.anchors (variant 4)
    test('navigation.anchors.0.anchor', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.anchor'))
            .toMatchInlineSnapshot(`
              {
                "description": "Anchor name/section for this navigation entry",
                "minLength": 1,
                "type": "string",
              }
            `)
    })
    test('navigation.anchors.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional icon",
                "type": "string",
              }
            `)
    })
    test('navigation.anchors.0.color.light', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.color.light'))
            .toMatchInlineSnapshot(`
          {
            "description": "Color used in light mode",
            "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
            "type": "string",
          }
        `)
    })
    test('navigation.anchors.0.color.dark', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.color.dark'))
            .toMatchInlineSnapshot(`
          {
            "description": "Color used in dark mode",
            "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
            "type": "string",
          }
        `)
    })
    test('navigation.anchors.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether the anchor/section is hidden by default",
                "type": "boolean",
              }
            `)
    })
    test('navigation.anchors.0.href', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.href'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional link or path for this anchor",
                "format": "uri",
                "type": "string",
              }
            `)
    })

    // Navigation.groups (variant 5)
    test('navigation.groups.0.group', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.group'))
            .toMatchInlineSnapshot(`
              {
                "description": "Name of the navigation group",
                "minLength": 1,
                "type": "string",
              }
            `)
    })
    test('navigation.groups.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional icon",
                "type": "string",
              }
            `)
    })
    test('navigation.groups.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "description": "Whether this group is hidden by default",
                "type": "boolean",
              }
            `)
    })
    test('navigation.groups.0.root', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.root'))
            .toMatchInlineSnapshot(`
              {
                "description": "Path to the root page of this group",
                "type": "string",
              }
            `)
    })
    test('navigation.groups.0.tag', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.tag'))
            .toMatchInlineSnapshot(`
              {
                "description": "Optional tag for this group",
                "type": "string",
              }
            `)
    })
    test('navigation.groups.0.pages.0', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.pages.0'))
            .toMatchInlineSnapshot(`
              {
                "anyOf": [
                  {
                    "minLength": 1,
                    "type": "string",
                  },
                  {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/5/properties/groups/items",
                  },
                ],
              }
            `)
    })

    // Navigation.pages (variant 6)
    test('navigation.pages.0', () => {
        expect(getTypeForNameInSchema('navigation.pages.0'))
            .toMatchInlineSnapshot(`
              {
                "description": "Path to a documentation page",
                "minLength": 1,
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
