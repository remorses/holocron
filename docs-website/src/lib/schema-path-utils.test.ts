import { describe, test, expect } from 'vitest'
import {toJSONSchema} from 'zod'
import type { JSONSchema7 } from 'json-schema'
import { extractNamePathsFromSchema } from './schema-path-utils'
import { DocsConfigSchema } from 'docs-website/src/lib/docs-json'

type SimpleSchema = {
    type?: string
    properties?: Record<string, SimpleSchema>
    items?: SimpleSchema
    oneOf?: SimpleSchema[]
    anyOf?: SimpleSchema[]
    allOf?: SimpleSchema[]
}

describe('schema-path-utils', () => {
    const docsConfigJsonSchema = toJSONSchema(DocsConfigSchema)

    describe('extractPaths', () => {
        test('extracts paths from DocsConfigSchema', () => {
            const paths = extractNamePathsFromSchema(
                docsConfigJsonSchema as any as JSONSchema7,
            )
            expect(paths).toMatchInlineSnapshot(`
              [
                "siteId",
                "name",
                "description",
                "logo.light",
                "logo.dark",
                "logo.href",
                "logo.text",
                "favicon.light",
                "favicon.dark",
                "navbar.links.{index}.label",
                "navbar.links.{index}.href",
                "navbar.links.{index}.icon",
                "navbar.primary.type",
                "navbar.primary.label",
                "navbar.primary.href",
                "navbar.primary.type",
                "navbar.primary.href",
                "tabs.{index}.tab",
                "tabs.{index}.openapi",
                "tabs.{index}.renderer",
                "tabs.{index}.tab",
                "tabs.{index}.mcp",
                "footer.socials",
                "footer.links.{index}.header",
                "footer.links.{index}.items.{index}.label",
                "footer.links.{index}.items.{index}.href",
                "seo.metatags",
                "seo.indexing",
                "redirects.{index}.source",
                "redirects.{index}.destination",
                "redirects.{index}.permanent",
                "banner.content",
                "banner.dismissible",
                "contextual.options.{index}",
                "cssVariables.light",
                "cssVariables.dark",
                "domains.{index}",
                "hideSidebar",
                "ignore.{index}",
                "theme",
              ]
            `)
        })

        test('extracts paths from simple object schema', () => {
            const simpleSchema: SimpleSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            }
            const paths = extractNamePathsFromSchema(simpleSchema as JSONSchema7)
            expect(paths).toMatchInlineSnapshot(`
              [
                "name",
                "age",
              ]
            `)
        })

        test('extracts paths from nested object schema', () => {
            const nestedSchema: SimpleSchema = {
                type: 'object',
                properties: {
                    user: {
                        type: 'object',
                        properties: {
                            profile: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    email: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            }
            const paths = extractNamePathsFromSchema(nestedSchema as JSONSchema7)
            expect(paths).toMatchInlineSnapshot(`
              [
                "user.profile.name",
                "user.profile.email",
              ]
            `)
        })

        test('extracts paths from array schema', () => {
            const arraySchema: SimpleSchema = {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                value: { type: 'number' },
                            },
                        },
                    },
                },
            }
            const paths = extractNamePathsFromSchema(arraySchema as JSONSchema7)
            expect(paths).toMatchInlineSnapshot(`
              [
                "items.{index}.name",
                "items.{index}.value",
              ]
            `)
        })

        test('extracts paths from union schema', () => {
            const unionSchema: SimpleSchema = {
                oneOf: [
                    {
                        type: 'object',
                        properties: {
                            type: { type: 'string' },
                            value: { type: 'string' },
                        },
                    },
                    {
                        type: 'object',
                        properties: {
                            type: { type: 'string' },
                            count: { type: 'number' },
                        },
                    },
                ],
            }
            const paths = extractNamePathsFromSchema(unionSchema as JSONSchema7)
            expect(paths).toMatchInlineSnapshot(`
              [
                "type",
                "value",
                "type",
                "count",
              ]
            `)
        })
    })
})
