import { describe, test, expect } from 'vitest'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { JSONSchema7 } from 'json-schema'
import { extractPaths, applyPath } from './schema-path-utils'
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
    const docsConfigJsonSchema = zodToJsonSchema(DocsConfigSchema)

    describe('extractPaths', () => {
        test('extracts paths from DocsConfigSchema', () => {
            const paths = extractPaths(docsConfigJsonSchema as any as JSONSchema7)
            expect(paths).toMatchInlineSnapshot(`
              [
                "name",
                "description",
                "logo",
                "logo.light",
                "logo.dark",
                "logo.href",
                "favicon",
                "favicon.light",
                "favicon.dark",
                "api.openapi",
                "api.openapi[index]",
                "api.asyncapi",
                "api.asyncapi[index]",
                "api.params.expanded",
                "api.playground.display",
                "api.playground.proxy",
                "api.examples.defaults",
                "api.examples.languages[index]",
                "api.mdx.auth.method",
                "api.mdx.auth.name",
                "api.mdx.server",
                "api.mdx.server[index]",
                "navbar.links[index].label",
                "navbar.links[index].href",
                "navbar.links[index].icon",
                "navbar.links[index].icon.name",
                "navbar.links[index].icon.library",
                "navbar.links[index].icon.style",
                "navbar.primary.type",
                "navbar.primary.label",
                "navbar.primary.href",
                "navbar.primary.type",
                "navbar.primary.href",
                "navigation.global.anchors[index].anchor",
                "navigation.global.anchors[index].href",
                "navigation.languages[index].language",
                "navigation.languages[index].default",
                "navigation.languages[index].hidden",
                "navigation.languages[index].href",
                "navigation.global",
                "navigation.versions[index].version",
                "navigation.versions[index].default",
                "navigation.versions[index].hidden",
                "navigation.versions[index].href",
                "navigation.global",
                "navigation.tabs[index].tab",
                "navigation.tabs[index].icon",
                "navigation.tabs[index].hidden",
                "navigation.tabs[index].href",
                "navigation.global",
                "navigation.dropdowns[index].dropdown",
                "navigation.dropdowns[index].icon",
                "navigation.dropdowns[index].color.light",
                "navigation.dropdowns[index].color.dark",
                "navigation.dropdowns[index].description",
                "navigation.dropdowns[index].hidden",
                "navigation.dropdowns[index].href",
                "navigation.global",
                "navigation.anchors[index].anchor",
                "navigation.anchors[index].icon",
                "navigation.anchors[index].color",
                "navigation.anchors[index].hidden",
                "navigation.anchors[index].href",
                "navigation.global",
                "navigation.groups[index].group",
                "navigation.groups[index].icon",
                "navigation.groups[index].hidden",
                "navigation.groups[index].root",
                "navigation.groups[index].tag",
                "navigation.groups[index].pages[index]",
                "navigation.groups[index].pages[index]",
                "navigation.global",
                "navigation.pages[index]",
                "footer.socials",
                "footer.links[index].header",
                "footer.links[index].items[index].label",
                "footer.links[index].items[index].href",
                "search.prompt",
                "seo.metatags",
                "seo.indexing",
                "redirects[index].source",
                "redirects[index].destination",
                "redirects[index].permanent",
                "banner.content",
                "banner.dismissible",
                "errors.404.redirect",
                "contextual.options[index]",
                "integrations.amplitude.apiKey",
                "integrations.clearbit.publicApiKey",
                "integrations.fathom.siteId",
                "integrations.frontchat.snippetId",
                "integrations.ga4.measurementId",
                "integrations.gtm.tagId",
                "integrations.heap.appId",
                "integrations.hotjar.hjid",
                "integrations.hotjar.hjsv",
                "integrations.intercom.appId",
                "integrations.koala.publicApiKey",
                "integrations.logrocket.appId",
                "integrations.mixpanel.projectToken",
                "integrations.osano.scriptSource",
                "integrations.pirsch.id",
                "integrations.posthog.apiKey",
                "integrations.posthog.apiHost",
                "integrations.plausible.domain",
                "integrations.plausible.server",
                "integrations.segment.key",
                "integrations.telemetry.enabled",
                "integrations.cookies.key",
                "integrations.cookies.value",
              ]
            `)
        })

        test('extracts paths from simple object schema', () => {
            const simpleSchema: SimpleSchema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' }
                }
            }
            const paths = extractPaths(simpleSchema as JSONSchema7)
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
                                    email: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
            const paths = extractPaths(nestedSchema as JSONSchema7)
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
                                value: { type: 'number' }
                            }
                        }
                    }
                }
            }
            const paths = extractPaths(arraySchema as JSONSchema7)
            expect(paths).toMatchInlineSnapshot(`
              [
                "items[index].name",
                "items[index].value",
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
                            value: { type: 'string' }
                        }
                    },
                    {
                        type: 'object',
                        properties: {
                            type: { type: 'string' },
                            count: { type: 'number' }
                        }
                    }
                ]
            }
            const paths = extractPaths(unionSchema as JSONSchema7)
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

    describe('applyPath', () => {
        test('gets and sets simple object properties', () => {
            const target = { name: 'John', age: 30 }

            expect(applyPath(target, 'name')).toMatchInlineSnapshot(`"John"`)
            expect(applyPath(target, 'age')).toMatchInlineSnapshot(`30`)

            applyPath(target, 'name', 'Jane')
            expect(target.name).toMatchInlineSnapshot(`"Jane"`)
        })

        test('gets and sets nested object properties', () => {
            const target = {
                user: {
                    profile: {
                        name: 'John',
                        email: 'john@example.com'
                    }
                }
            }

            expect(applyPath(target, 'user.profile.name')).toMatchInlineSnapshot(`"John"`)
            expect(applyPath(target, 'user.profile.email')).toMatchInlineSnapshot(`"john@example.com"`)

            applyPath(target, 'user.profile.name', 'Jane')
            expect(target.user.profile.name).toMatchInlineSnapshot(`"Jane"`)
        })

        test('gets and sets array elements', () => {
            const target = {
                items: [
                    { name: 'item1', value: 10 },
                    { name: 'item2', value: 20 }
                ]
            }

            expect(applyPath(target, 'items[0].name')).toMatchInlineSnapshot(`"item1"`)
            expect(applyPath(target, 'items[1].value')).toMatchInlineSnapshot(`20`)

            applyPath(target, 'items[0].name', 'newItem1')
            expect(target.items[0].name).toMatchInlineSnapshot(`"newItem1"`)
        })

        test('creates missing nested structures', () => {
            const target = {}

            applyPath(target, 'user.profile.name', 'John')
            expect(target).toMatchInlineSnapshot(`
              {
                "user": {
                  "profile": {
                    "name": "John",
                  },
                },
              }
            `)

            applyPath(target, 'items[0].name', 'item1')
            expect(target).toMatchInlineSnapshot(`
              {
                "items": {
                  "0": {
                    "name": "item1",
                  },
                },
                "user": {
                  "profile": {
                    "name": "John",
                  },
                },
              }
            `)
        })

        test('throws error for invalid paths', () => {
            const target = {}

            expect(() => applyPath(target, '')).toThrow('Invalid path')
        })

        test('handles array creation when existing property is not array', () => {
            const target = { items: {} }

            applyPath(target, 'items[0].name', 'test')
            expect(target).toMatchInlineSnapshot(`
              {
                "items": {
                  "0": {
                    "name": "test",
                  },
                },
              }
            `)
        })
    })
})
