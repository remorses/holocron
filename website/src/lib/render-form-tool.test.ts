import schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema
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
    test('container.items', () => {
        expect(getTypeForNameInSchema('container.items', compiled))
            .toMatchInlineSnapshot(`
              {
                "anyOf": [
                  {
                    "type": "string",
                  },
                  {
                    "properties": {
                      "nested": {
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
                      },
                      "type": {
                        "const": "complex",
                      },
                    },
                    "required": [
                      "nested",
                      "type",
                    ],
                    "type": "object",
                  },
                ],
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
                "additionalProperties": false,
                "description": "Navbar link entry",
                "properties": {
                  "href": {
                    "description": "Link URL",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "description": "Optional icon",
                    "type": "string",
                  },
                  "label": {
                    "description": "Link text",
                    "type": "string",
                  },
                },
                "required": [
                  "label",
                  "href",
                ],
                "type": "object",
              }
            `)
    })
    test('navbar.links.0.href', () => {
        expect(getTypeForNameInSchema('navbar.links.0.href'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navbar link entry",
                "properties": {
                  "href": {
                    "description": "Link URL",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "description": "Optional icon",
                    "type": "string",
                  },
                  "label": {
                    "description": "Link text",
                    "type": "string",
                  },
                },
                "required": [
                  "label",
                  "href",
                ],
                "type": "object",
              }
            `)
    })
    test('navbar.links.0.icon', () => {
        expect(getTypeForNameInSchema('navbar.links.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navbar link entry",
                "properties": {
                  "href": {
                    "description": "Link URL",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "description": "Optional icon",
                    "type": "string",
                  },
                  "label": {
                    "description": "Link text",
                    "type": "string",
                  },
                },
                "required": [
                  "label",
                  "href",
                ],
                "type": "object",
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
                "additionalProperties": false,
                "description": "Language item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this language is the default selection",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether the language is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this language variant",
                    "format": "uri",
                    "type": "string",
                  },
                  "language": {
                    "description": "The language code (ISO 639-1) for this section, e.g., "en", "fr", "es"",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "language",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.languages.0.default', () => {
        expect(getTypeForNameInSchema('navigation.languages.0.default'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Language item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this language is the default selection",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether the language is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this language variant",
                    "format": "uri",
                    "type": "string",
                  },
                  "language": {
                    "description": "The language code (ISO 639-1) for this section, e.g., "en", "fr", "es"",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "language",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.languages.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.languages.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Language item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this language is the default selection",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether the language is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this language variant",
                    "format": "uri",
                    "type": "string",
                  },
                  "language": {
                    "description": "The language code (ISO 639-1) for this section, e.g., "en", "fr", "es"",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "language",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.languages.0.href', () => {
        expect(getTypeForNameInSchema('navigation.languages.0.href'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Language item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this language is the default selection",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether the language is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this language variant",
                    "format": "uri",
                    "type": "string",
                  },
                  "language": {
                    "description": "The language code (ISO 639-1) for this section, e.g., "en", "fr", "es"",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "language",
                ],
                "type": "object",
              }
            `)
    })

    // Navigation.versions (variant 1)
    test('navigation.versions.0.version', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.version'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Version item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this is the default version",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether this version selection is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this version",
                    "format": "uri",
                    "type": "string",
                  },
                  "version": {
                    "description": "Version label (e.g., "v1.0", "latest")",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "version",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.versions.0.default', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.default'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Version item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this is the default version",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether this version selection is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this version",
                    "format": "uri",
                    "type": "string",
                  },
                  "version": {
                    "description": "Version label (e.g., "v1.0", "latest")",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "version",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.versions.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Version item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this is the default version",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether this version selection is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this version",
                    "format": "uri",
                    "type": "string",
                  },
                  "version": {
                    "description": "Version label (e.g., "v1.0", "latest")",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "version",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.versions.0.href', () => {
        expect(getTypeForNameInSchema('navigation.versions.0.href'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Version item within navigation",
                "properties": {
                  "default": {
                    "description": "Whether this is the default version",
                    "type": "boolean",
                  },
                  "hidden": {
                    "description": "Whether this version selection is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this version",
                    "format": "uri",
                    "type": "string",
                  },
                  "version": {
                    "description": "Version label (e.g., "v1.0", "latest")",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "version",
                ],
                "type": "object",
              }
            `)
    })

    // Navigation.tabs (variant 2)
    test('navigation.tabs.0.tab', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.tab'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Tab item for organizing navigation",
                "properties": {
                  "hidden": {
                    "description": "Whether the tab is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this tab",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the tab",
                  },
                  "tab": {
                    "description": "Tab name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "tab",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.tabs.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Tab item for organizing navigation",
                "properties": {
                  "hidden": {
                    "description": "Whether the tab is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this tab",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the tab",
                  },
                  "tab": {
                    "description": "Tab name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "tab",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.tabs.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Tab item for organizing navigation",
                "properties": {
                  "hidden": {
                    "description": "Whether the tab is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this tab",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the tab",
                  },
                  "tab": {
                    "description": "Tab name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "tab",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.tabs.0.href', () => {
        expect(getTypeForNameInSchema('navigation.tabs.0.href'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Tab item for organizing navigation",
                "properties": {
                  "hidden": {
                    "description": "Whether the tab is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "URL or root path for this tab",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the tab",
                  },
                  "tab": {
                    "description": "Tab name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "required": [
                  "tab",
                ],
                "type": "object",
              }
            `)
    })

    // Navigation.dropdowns (variant 3)
    test('navigation.dropdowns.0.dropdown', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.dropdown'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Dropdown item for navigation groups",
                "properties": {
                  "color": {
                    "additionalProperties": false,
                    "description": "Optional custom color",
                    "properties": {
                      "dark": {
                        "description": "Color used in dark mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                      "light": {
                        "description": "Color used in light mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                    },
                    "required": [
                      "light",
                      "dark",
                    ],
                    "type": "object",
                  },
                  "description": {
                    "description": "Text description shown for dropdown",
                    "type": "string",
                  },
                  "dropdown": {
                    "description": "Dropdown name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether the dropdown is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional URL linked from the dropdown",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the dropdown",
                  },
                },
                "required": [
                  "dropdown",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.dropdowns.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Dropdown item for navigation groups",
                "properties": {
                  "color": {
                    "additionalProperties": false,
                    "description": "Optional custom color",
                    "properties": {
                      "dark": {
                        "description": "Color used in dark mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                      "light": {
                        "description": "Color used in light mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                    },
                    "required": [
                      "light",
                      "dark",
                    ],
                    "type": "object",
                  },
                  "description": {
                    "description": "Text description shown for dropdown",
                    "type": "string",
                  },
                  "dropdown": {
                    "description": "Dropdown name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether the dropdown is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional URL linked from the dropdown",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the dropdown",
                  },
                },
                "required": [
                  "dropdown",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.dropdowns.0.color.light', () => {
        expect(
            getTypeForNameInSchema('navigation.dropdowns.0.color.light'),
        ).toMatchInlineSnapshot(`undefined`)
    })
    test('navigation.dropdowns.0.color.dark', () => {
        expect(
            getTypeForNameInSchema('navigation.dropdowns.0.color.dark'),
        ).toMatchInlineSnapshot(`undefined`)
    })
    test('navigation.dropdowns.0.description', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.description'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Dropdown item for navigation groups",
                "properties": {
                  "color": {
                    "additionalProperties": false,
                    "description": "Optional custom color",
                    "properties": {
                      "dark": {
                        "description": "Color used in dark mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                      "light": {
                        "description": "Color used in light mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                    },
                    "required": [
                      "light",
                      "dark",
                    ],
                    "type": "object",
                  },
                  "description": {
                    "description": "Text description shown for dropdown",
                    "type": "string",
                  },
                  "dropdown": {
                    "description": "Dropdown name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether the dropdown is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional URL linked from the dropdown",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the dropdown",
                  },
                },
                "required": [
                  "dropdown",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.dropdowns.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Dropdown item for navigation groups",
                "properties": {
                  "color": {
                    "additionalProperties": false,
                    "description": "Optional custom color",
                    "properties": {
                      "dark": {
                        "description": "Color used in dark mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                      "light": {
                        "description": "Color used in light mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                    },
                    "required": [
                      "light",
                      "dark",
                    ],
                    "type": "object",
                  },
                  "description": {
                    "description": "Text description shown for dropdown",
                    "type": "string",
                  },
                  "dropdown": {
                    "description": "Dropdown name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether the dropdown is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional URL linked from the dropdown",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the dropdown",
                  },
                },
                "required": [
                  "dropdown",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.dropdowns.0.href', () => {
        expect(getTypeForNameInSchema('navigation.dropdowns.0.href'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Dropdown item for navigation groups",
                "properties": {
                  "color": {
                    "additionalProperties": false,
                    "description": "Optional custom color",
                    "properties": {
                      "dark": {
                        "description": "Color used in dark mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                      "light": {
                        "description": "Color used in light mode",
                        "pattern": "^(#|rgb|rgba|hsl|hsla)\\b",
                        "type": "string",
                      },
                    },
                    "required": [
                      "light",
                      "dark",
                    ],
                    "type": "object",
                  },
                  "description": {
                    "description": "Text description shown for dropdown",
                    "type": "string",
                  },
                  "dropdown": {
                    "description": "Dropdown name or label",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether the dropdown is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional URL linked from the dropdown",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for the dropdown",
                  },
                },
                "required": [
                  "dropdown",
                ],
                "type": "object",
              }
            `)
    })

    // Navigation.anchors (variant 4)
    test('navigation.anchors.0.anchor', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.anchor'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Anchor item for navigation",
                "properties": {
                  "anchor": {
                    "description": "Anchor name/section for this navigation entry",
                    "minLength": 1,
                    "type": "string",
                  },
                  "color": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/3/properties/dropdowns/items/properties/color",
                    "description": "Optional custom color",
                  },
                  "hidden": {
                    "description": "Whether the anchor/section is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional link or path for this anchor",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for this section",
                  },
                },
                "required": [
                  "anchor",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.anchors.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Anchor item for navigation",
                "properties": {
                  "anchor": {
                    "description": "Anchor name/section for this navigation entry",
                    "minLength": 1,
                    "type": "string",
                  },
                  "color": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/3/properties/dropdowns/items/properties/color",
                    "description": "Optional custom color",
                  },
                  "hidden": {
                    "description": "Whether the anchor/section is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional link or path for this anchor",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for this section",
                  },
                },
                "required": [
                  "anchor",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.anchors.0.color.light', () => {
        expect(
            getTypeForNameInSchema('navigation.anchors.0.color.light'),
        ).toMatchInlineSnapshot(`undefined`)
    })
    test('navigation.anchors.0.color.dark', () => {
        expect(
            getTypeForNameInSchema('navigation.anchors.0.color.dark'),
        ).toMatchInlineSnapshot(`undefined`)
    })
    test('navigation.anchors.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Anchor item for navigation",
                "properties": {
                  "anchor": {
                    "description": "Anchor name/section for this navigation entry",
                    "minLength": 1,
                    "type": "string",
                  },
                  "color": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/3/properties/dropdowns/items/properties/color",
                    "description": "Optional custom color",
                  },
                  "hidden": {
                    "description": "Whether the anchor/section is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional link or path for this anchor",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for this section",
                  },
                },
                "required": [
                  "anchor",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.anchors.0.href', () => {
        expect(getTypeForNameInSchema('navigation.anchors.0.href'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Anchor item for navigation",
                "properties": {
                  "anchor": {
                    "description": "Anchor name/section for this navigation entry",
                    "minLength": 1,
                    "type": "string",
                  },
                  "color": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/3/properties/dropdowns/items/properties/color",
                    "description": "Optional custom color",
                  },
                  "hidden": {
                    "description": "Whether the anchor/section is hidden by default",
                    "type": "boolean",
                  },
                  "href": {
                    "description": "Optional link or path for this anchor",
                    "format": "uri",
                    "type": "string",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Optional icon for this section",
                  },
                },
                "required": [
                  "anchor",
                ],
                "type": "object",
              }
            `)
    })

    // Navigation.groups (variant 5)
    test('navigation.groups.0.group', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.group'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navigation group, can contain nested pages or groups",
                "properties": {
                  "group": {
                    "description": "Name of the navigation group",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether this group is hidden by default",
                    "type": "boolean",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Group section icon",
                  },
                  "pages": {
                    "description": "Nested list of page paths or group objects",
                    "items": {
                      "anyOf": [
                        {
                          "minLength": 1,
                          "type": "string",
                        },
                        {
                          "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/5/properties/groups/items",
                        },
                      ],
                    },
                    "type": "array",
                  },
                  "root": {
                    "description": "Path to the root page of this group",
                    "type": "string",
                  },
                  "tag": {
                    "description": "Optional tag for this group",
                    "type": "string",
                  },
                },
                "required": [
                  "group",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.groups.0.icon', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.icon'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navigation group, can contain nested pages or groups",
                "properties": {
                  "group": {
                    "description": "Name of the navigation group",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether this group is hidden by default",
                    "type": "boolean",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Group section icon",
                  },
                  "pages": {
                    "description": "Nested list of page paths or group objects",
                    "items": {
                      "anyOf": [
                        {
                          "minLength": 1,
                          "type": "string",
                        },
                        {
                          "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/5/properties/groups/items",
                        },
                      ],
                    },
                    "type": "array",
                  },
                  "root": {
                    "description": "Path to the root page of this group",
                    "type": "string",
                  },
                  "tag": {
                    "description": "Optional tag for this group",
                    "type": "string",
                  },
                },
                "required": [
                  "group",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.groups.0.hidden', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.hidden'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navigation group, can contain nested pages or groups",
                "properties": {
                  "group": {
                    "description": "Name of the navigation group",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether this group is hidden by default",
                    "type": "boolean",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Group section icon",
                  },
                  "pages": {
                    "description": "Nested list of page paths or group objects",
                    "items": {
                      "anyOf": [
                        {
                          "minLength": 1,
                          "type": "string",
                        },
                        {
                          "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/5/properties/groups/items",
                        },
                      ],
                    },
                    "type": "array",
                  },
                  "root": {
                    "description": "Path to the root page of this group",
                    "type": "string",
                  },
                  "tag": {
                    "description": "Optional tag for this group",
                    "type": "string",
                  },
                },
                "required": [
                  "group",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.groups.0.root', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.root'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navigation group, can contain nested pages or groups",
                "properties": {
                  "group": {
                    "description": "Name of the navigation group",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether this group is hidden by default",
                    "type": "boolean",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Group section icon",
                  },
                  "pages": {
                    "description": "Nested list of page paths or group objects",
                    "items": {
                      "anyOf": [
                        {
                          "minLength": 1,
                          "type": "string",
                        },
                        {
                          "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/5/properties/groups/items",
                        },
                      ],
                    },
                    "type": "array",
                  },
                  "root": {
                    "description": "Path to the root page of this group",
                    "type": "string",
                  },
                  "tag": {
                    "description": "Optional tag for this group",
                    "type": "string",
                  },
                },
                "required": [
                  "group",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.groups.0.tag', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.tag'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navigation group, can contain nested pages or groups",
                "properties": {
                  "group": {
                    "description": "Name of the navigation group",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether this group is hidden by default",
                    "type": "boolean",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Group section icon",
                  },
                  "pages": {
                    "description": "Nested list of page paths or group objects",
                    "items": {
                      "anyOf": [
                        {
                          "minLength": 1,
                          "type": "string",
                        },
                        {
                          "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/5/properties/groups/items",
                        },
                      ],
                    },
                    "type": "array",
                  },
                  "root": {
                    "description": "Path to the root page of this group",
                    "type": "string",
                  },
                  "tag": {
                    "description": "Optional tag for this group",
                    "type": "string",
                  },
                },
                "required": [
                  "group",
                ],
                "type": "object",
              }
            `)
    })
    test('navigation.groups.0.pages.0', () => {
        expect(getTypeForNameInSchema('navigation.groups.0.pages.0'))
            .toMatchInlineSnapshot(`
              {
                "additionalProperties": false,
                "description": "Navigation group, can contain nested pages or groups",
                "properties": {
                  "group": {
                    "description": "Name of the navigation group",
                    "minLength": 1,
                    "type": "string",
                  },
                  "hidden": {
                    "description": "Whether this group is hidden by default",
                    "type": "boolean",
                  },
                  "icon": {
                    "$ref": "#/definitions/DocsConfigSchema/properties/navbar/properties/links/items/properties/icon",
                    "description": "Group section icon",
                  },
                  "pages": {
                    "description": "Nested list of page paths or group objects",
                    "items": {
                      "anyOf": [
                        {
                          "minLength": 1,
                          "type": "string",
                        },
                        {
                          "$ref": "#/definitions/DocsConfigSchema/properties/navigation/anyOf/5/properties/groups/items",
                        },
                      ],
                    },
                    "type": "array",
                  },
                  "root": {
                    "description": "Path to the root page of this group",
                    "type": "string",
                  },
                  "tag": {
                    "description": "Optional tag for this group",
                    "type": "string",
                  },
                },
                "required": [
                  "group",
                ],
                "type": "object",
              }
            `)
    })

    // Navigation.pages (variant 6)
    test('navigation.pages.0', () => {
        expect(getTypeForNameInSchema('navigation.pages.0'))
            .toMatchInlineSnapshot(`
              {
                "description": "Simple linear list of doc page paths",
                "items": {
                  "description": "Path to a documentation page",
                  "minLength": 1,
                  "type": "string",
                },
                "minItems": 1,
                "type": "array",
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
                "additionalProperties": false,
                "description": "Footer link column",
                "properties": {
                  "header": {
                    "description": "Column header",
                    "type": "string",
                  },
                  "items": {
                    "description": "Column link items",
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "href": {
                          "description": "Item link URL",
                          "format": "uri",
                          "type": "string",
                        },
                        "label": {
                          "description": "Item text",
                          "type": "string",
                        },
                      },
                      "required": [
                        "label",
                        "href",
                      ],
                      "type": "object",
                    },
                    "minItems": 1,
                    "type": "array",
                  },
                },
                "required": [
                  "items",
                ],
                "type": "object",
              }
            `)
    })
    test('footer.links.0.items.0.label', () => {
        expect(
            getTypeForNameInSchema('footer.links.0.items.0.label'),
        ).toMatchInlineSnapshot(`undefined`)
    })
    test('footer.links.0.items.0.href', () => {
        expect(
            getTypeForNameInSchema('footer.links.0.items.0.href'),
        ).toMatchInlineSnapshot(`undefined`)
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
                "items": {
                  "enum": [
                    "copy",
                    "view",
                    "chatgpt",
                    "claude",
                  ],
                  "type": "string",
                },
                "type": "array",
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
