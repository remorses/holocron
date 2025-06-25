import { z } from 'zod'
import schemaLib from 'json-schema-library'
const compileSchema = schemaLib.compileSchema
import { docsJsonSchema } from 'docs-website/src/lib/docs-json'
import { notifyError } from './errors'

const stringReq = z.string().nullable()
const boolReq = z.boolean().nullable()
const numberReq = z.number().nullable()

export const InputField = z.object({
    type: z.literal('input'),
    name: z.string(),
    label: z.string(),
    placeholder: stringReq,
    prefix: stringReq,
    required: boolReq,
    description: stringReq,
    defaultValue: stringReq,
})

export const PasswordField = z.object({
    type: z.literal('password'),
    name: z.string(),
    label: z.string(),
    placeholder: stringReq,
    required: boolReq,
    description: stringReq,
    defaultValue: stringReq,
})

export const TextareaField = z.object({
    type: z.literal('textarea'),
    name: z.string(),
    label: z.string(),
    placeholder: stringReq,
    required: boolReq,
    description: stringReq,
    defaultValue: stringReq,
})

export const NumberField = z.object({
    type: z.literal('number'),
    name: z.string(),
    label: z.string(),
    min: numberReq,
    max: numberReq,
    step: numberReq,
    placeholder: stringReq,
    required: boolReq,
    description: stringReq,
    defaultValue: numberReq,
})

export const SelectField = z.object({
    type: z.literal('select'),
    name: z.string(),
    label: z.string(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
    placeholder: stringReq,
    required: boolReq,
    description: stringReq,
    defaultValue: stringReq,
})

export const SliderField = z.object({
    type: z.literal('slider'),
    name: z.string(),
    label: z.string(),
    min: numberReq,
    max: numberReq,
    step: numberReq,
    required: boolReq,
    description: stringReq,
    defaultValue: numberReq,
})

export const SwitchField = z.object({
    type: z.literal('switch'),
    name: z.string(),
    label: z.string(),
    required: boolReq,
    description: stringReq,
    defaultValue: boolReq,
})

export const ColorPickerField = z.object({
    type: z.literal('color_picker'),
    name: z.string(),
    label: z.string(),
    required: boolReq,
    description: stringReq,
    defaultValue: stringReq,
})

export const DatePickerField = z.object({
    type: z.literal('date_picker'),
    name: z.string(),
    label: z.string(),
    required: boolReq,
    description: stringReq,
    defaultValue: stringReq,
})

export const ImageUploadField = z.object({
    type: z.literal('image_upload'),
    name: z.string(),
    label: z.string(),
    required: boolReq,
    description: stringReq,
})

export const ButtonHrefEnum = z.enum([
    '/',
    '/docs',
    '/pricing',
    'https://github.com/your-org',
])

export const ButtonField = z.object({
    type: z.literal('button'),
    name: z.string(),
    label: z.string(),
    href: ButtonHrefEnum,
    description: stringReq,
})

export const UIFieldSchema = z.discriminatedUnion('type', [
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
                if (!getTypeForNameInSchema(field.name)) {
                    errors.push(
                        `name ${field.name} is not valid for the docs.json schema`,
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
    if (Array.isArray(schema.type)) {
        // If multiple types, it's scalar if any are scalar
        return schema.type.some((type: any) => scalarTypes.includes(type))
    }
    return scalarTypes.includes(schema.type)
}
