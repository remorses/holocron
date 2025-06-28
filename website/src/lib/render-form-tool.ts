import { z } from 'zod'
import schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema
import {
    docsJsonSchema,
    exampleNamePathsForDocsJson,
} from 'docs-website/src/lib/docs-json'
import { notifyError } from './errors'

const FieldTypeEnum = z.enum([
    'input',
    'password',
    'textarea',
    'number',
    'select',
    'slider',
    'switch',
    'color_picker',
    'date_picker',
    'image_upload',
    'button',
])

export const UIFieldSchema = z
    .object({
        name: z.string(),
        type: FieldTypeEnum,
        label: z.string(),
        description: z.string().nullable(),
        // Common fields
        required: z.boolean().nullable(),
        // Input/textarea/password fields
        placeholder: z.string().nullable(),
        initialValue: z.union([
            z.string().nullable(),
            z.number().nullable(),
            z.boolean().nullable(),
        ]),
        // Number/slider fields
        min: z.number().nullable(),
        max: z.number().nullable(),
        step: z.number().nullable(),
        // Select field
        options: z
            .array(z.object({ label: z.string(), value: z.string() }))
            .nullable(),
        // Button field
        href: z.string().nullable(),
    })
    .describe(
        `Each field requires a name property that describes the filed updated on that fumabase.json scalar field, it can be ${exampleNamePathsForDocsJson.join(', ')} where {index} is a number. NEVER use [index] syntax, for example instead of domains[0] use domains.0`,
    )

export type UIField = z.infer<typeof UIFieldSchema>

export const RenderFormParameters = z.object({
    fields: z.array(UIFieldSchema),
})

type RenderFormParameters = z.infer<typeof RenderFormParameters>

export function createRenderFormExecute({}) {
    return async (params: RenderFormParameters) => {
        const errors: string[] = []
        try {
            for (const field of params.fields) {
                if (field.name.match(/\[\s*index\s*\]/)) {
                    errors.push(
                        `field.name "${field.name}" contains "[index]" syntax; please use field.index instead.`,
                    )
                }
                const schema = getTypeForNameInSchema(field.name)
                if (!schema) {
                    errors.push(
                        `name ${field.name} is not valid for the fumabase.json schema`,
                    )
                }
                if (!isScalarSchema(schema)) {
                    errors.push(
                        `name ${field.name} is not a scalar, instead it has the following schema: ${JSON.stringify(schema)}`,
                    )
                }
            }
            return errors.length > 0 ? { errors } : `rendered form to the user`
        } catch (err) {
            notifyError(err, 'createRenderFormExecute')
            errors.push(
                `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
            )
            return { errors }
        }
    }
}
export const compiledDocsJsonSchema = compileSchema(docsJsonSchema)

export function getTypeForNameInSchema(
    name: string,
    schema = compiledDocsJsonSchema,
) {
    const pointer =
        '#' +
        '/' +
        name
            .split('.')
            .map((part) => (isNaN(Number(part)) ? part : 'items'))
            .join('/')
    console.log(pointer)
    const { node, error } = schema.getNode(pointer)
    return node?.schema
}

export function isScalarSchema(schema: any): boolean {
    // A scalar is any JSON Schema type that is not an array or object
    const scalarTypes = ['string', 'number', 'integer', 'boolean', 'null']
    if (!schema || typeof schema !== 'object') return false
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
        // It's scalar if any of the anyOf sub-schemas are scalar
        return schema.anyOf.some((subSchema: any) => isScalarSchema(subSchema))
    }
    if (schema.enum) {
        // If it's an enum, check if the underlying type is scalar (assume enums of scalars)
        if (schema.type && Array.isArray(schema.type)) {
            return schema.type.some((type: any) => scalarTypes.includes(type))
        }
        if (schema.type) {
            return scalarTypes.includes(schema.type)
        }
        // If type is not specified but enum is present, assume scalar
        return true
    }
    if (schema.const) {
        // If const present, considered scalar
        return true
    }
    if (schema.oneOf && Array.isArray(schema.oneOf)) {
        // It's scalar if any of the oneOf sub-schemas are scalar
        return schema.oneOf.some((subSchema: any) => isScalarSchema(subSchema))
    }
    if (schema.allOf && Array.isArray(schema.allOf)) {
        // It's scalar if any of the allOf sub-schemas are scalar
        return schema.allOf.some((subSchema: any) => isScalarSchema(subSchema))
    }
    if (schema.type === 'array' || schema.type === 'object') {
        return false
    }
    if (Array.isArray(schema.type)) {
        // If multiple types, it's scalar if any are scalar
        return schema.type.some((type: any) => scalarTypes.includes(type))
    }
    return scalarTypes.includes(schema.type)
}
