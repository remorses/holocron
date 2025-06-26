import { z } from 'zod'
import schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema
import {
    docsJsonSchema,
    exampleNamePathsForDocsJson,
} from 'docs-website/src/lib/docs-json'
import { notifyError } from './errors'

const stringReq = z.string().nullable()
const boolReq = z.boolean().nullable()
const numberReq = z.number().nullable()

export const InputField = z
    .object({
        name: z.string(),
        type: z.literal('input'),
        label: z.string(),
        description: stringReq,
        placeholder: stringReq,
        prefix: stringReq,
        required: boolReq,
        initialValue: stringReq,
    })
    .describe(
        `should be used for one line strings, for example the name of the website or a domain`,
    )

export const PasswordField = z.object({
    name: z.string(),
    type: z.literal('password'),
    label: z.string(),
    description: stringReq,
    placeholder: stringReq,
    required: boolReq,
    initialValue: stringReq,
})

export const TextareaField = z
    .object({
        name: z.string(),
        type: z.literal('textarea'),
        label: z.string(),
        description: stringReq,
        placeholder: stringReq,
        required: boolReq,
        initialValue: stringReq,
    })
    .describe(
        `textarea should only be used only for multi line strings, for example a description value. NEVER use it for short values like domains`,
    )

export const NumberField = z.object({
    name: z.string(),
    type: z.literal('number'),
    label: z.string(),
    description: stringReq,
    min: numberReq,
    max: numberReq,
    step: numberReq,
    placeholder: stringReq,
    required: boolReq,
    initialValue: numberReq,
})

export const SelectField = z
    .object({
        name: z.string(),
        type: z.literal('select'),
        label: z.string(),
        description: stringReq,
        options: z
            .array(z.object({ label: z.string(), value: z.string() }))
            .min(1),
        placeholder: stringReq,
        required: boolReq,
        initialValue: stringReq,
    })
    .describe(
        `should be used only when you already know the possible options for a string value, for example for contextual actions `,
    )

export const SliderField = z
    .object({
        name: z.string(),
        type: z.literal('slider'),
        label: z.string(),
        description: stringReq,
        min: numberReq,
        max: numberReq,
        step: numberReq,
        required: boolReq,
        initialValue: numberReq,
    })
    .describe(
        `use this for values that have a min and max, for example the width of the website, with a min of 0 and max of 3000`,
    )

export const SwitchField = z.object({
    name: z.string(),
    type: z.literal('switch'),
    label: z.string(),
    description: stringReq,
    required: boolReq,
    initialValue: boolReq,
})

export const ColorPickerField = z.object({
    name: z.string(),
    type: z.literal('color_picker'),
    buttonText: z.string(),
    description: stringReq,
    required: boolReq,
    initialValue: stringReq,
})

export const DatePickerField = z.object({
    name: z.string(),
    type: z.literal('date_picker'),
    label: z.string(),
    description: stringReq,
    required: boolReq,
    initialValue: stringReq,
})

export const ImageUploadField = z.object({
    name: z.string(),
    type: z.literal('image_upload'),
    label: z.string(),
    description: stringReq,
    required: boolReq,
})

export const ButtonHrefEnum = z.enum([
    '/',
    '/docs',
    '/pricing',
    'https://github.com/your-org',
])

export const ButtonField = z.object({
    name: z.string(),
    type: z.literal('button'),
    label: z.string(),
    description: stringReq,
    href: ButtonHrefEnum,
})

export const UIFieldSchema = z
    .discriminatedUnion('type', [
        InputField,
        PasswordField,
        TextareaField,
        NumberField,
        SelectField,
        SliderField,
        SwitchField,
        ColorPickerField,
        DatePickerField,
        ImageUploadField,
        ButtonField,
    ])
    .describe(
        `Each field requires a name property that describes the filed updated on that docs.json scalar field, it can be ${exampleNamePathsForDocsJson.join(', ')} where {index} is a number. NEVER use [index] syntax, for example instead of domains[0] use domains.0`,
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
                        `name ${field.name} is not valid for the docs.json schema`,
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
