import { ModelMessage, tool, UIMessage } from 'ai'
import dedent from 'string-dedent'
import type { JSONSchema7 } from 'json-schema'
import * as schemaLib from 'json-schema-library'
import { z } from 'zod'
import { optionalToNullable } from './zod'
import { extractNamePathsFromSchema } from './schema-path-utils'

const compileSchema = schemaLib.compileSchema || schemaLib?.['default']?.compileSchema

export interface RenderFormToolConfig {
  jsonSchema?: JSONSchema7
  replaceOptionalsWithNulls?: boolean
  description?: string
  notifyError?: (error: any, msg?: string) => void
  onExecute?: (params: { messages: ModelMessage[] }) => string | undefined | Promise<string | undefined>
}

export function createRenderFormTool({
  jsonSchema,
  description,
  replaceOptionalsWithNulls,
  notifyError = (err, msg) => console.error(msg || 'Error in createRenderFormTool', err),
  onExecute,
}: RenderFormToolConfig) {
  let uiFieldsSchema = UIFieldSchema
  if (replaceOptionalsWithNulls) {
    uiFieldsSchema = optionalToNullable(uiFieldsSchema)
  }
  let exampleNamePaths = [] as string[]
  if (jsonSchema) {
    exampleNamePaths = extractNamePathsFromSchema(jsonSchema)

  }

  const compiledSchema = compileSchema(jsonSchema || {})
  const RenderFormParameters = z.object({
    fields: z.array(uiFieldsSchema),
  })

  // Helper function to get type for name in schema
  function getTypeForNameInSchema(name: string) {
    const pointer =
      '#' +
      '/' +
      name
        .split('.')
        .map((part) => (isNaN(Number(part)) ? part : 'items'))
        .join('/')
    const { node, error } = compiledSchema.getNode(pointer)
    if (error) {
      notifyError(error, `Failed to get schema node for pointer: ${pointer}`)
    }
    return node?.schema
  }

  return tool({
    description: dedent`
        Render a form to the user can provide structured data. NEVER render more than 1 form input at a time, except for list of fields (arrays of strings or objects)

        IMPORTANT: Do NOT use this tool to:
        - Remove array fields or array items
        - Remove/delete any fields from the data
        - Perform bulk deletions or removals
        Instead modify the file directly with string and replace for those operations.

        Array-style names such as items.0.color are supported. When the user wants to add an item to the array you MUST also render all the other items in the existing array.

        Use radio type for small number of options (less than 4) where you want to show option descriptions alongside the choices.

        Switch should only be used for boolean values.

        If your workflow requires asking for a lot of fields, split your data collection in multiple messages. plan first on what you will need to ask in full and decide on the few fields to ask first.

        NEVER ask the user to fill more than 1 or 2 fields in case of non array fields. Instead ask for 1 input and deduce the rest. For example NEVER ask the user to provide both company name and domain, deduce the company name from the domain. Or use web search and fetch to find related information.

        Only render many form fields in the case of list of items or fields that are part of an object.

        If the user submits a form without adding the fields you want DO NOT ask the user to fill the form again. Instead render another form in a new message.
        Previous messages forms are disabled and the user cannot submit them again. Render a simpler shorter form the user can fill in. Use relevant default values.

        Always try to fill in the default values (or existing json values) so the user has less things to type and check.

        ${exampleNamePaths.length
        ? `These are the only available values for the parameter "name" where {index} is a number: ${exampleNamePaths.join(', ')}`
        : ''
      }

        ${description || ''}
      `,
    inputSchema: RenderFormParameters,
    async execute(params: z.infer<typeof RenderFormParameters>, { messages }) {
      let appendToPrompt = ''
      if (onExecute) {
        const res = await onExecute({ messages })
        if (typeof res === 'string' && res) {
          appendToPrompt = res
        }
      }

      if (!jsonSchema) {
        return (
          'Rendered form to the user, the response will be sent back as a message from the user. DO NOT RENDER THE SAME FORM TWICE\n' +
          appendToPrompt
        )
      }

      const errors: string[] = []
      for (const field of params.fields) {
        if (field.name.match(/\[\s*index\s*\]/)) {
          errors.push(`field.name "${field.name}" contains "[index]" syntax; please use field.index instead`)
        }
        const schema = getTypeForNameInSchema(field.name)
        if (!schema) {
          errors.push(`name ${field.name} is not valid for the schema`)
        }
        if (!isScalarSchema(schema)) {
          errors.push(
            `name ${field.name} is not a scalar, instead it has the following schema: ${JSON.stringify(schema)}`,
          )
        }
        const validTypes = getValidFieldTypesForSchema(schema)
        if (validTypes.length > 0 && !validTypes.includes(field.type)) {
          errors.push(
            `field type "${field.type}" is not valid for ${field.name}. Valid types are: ${validTypes.join(', ')}`,
          )
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.map((err) => `• ${err}`).join('\n'))
      }

      return (
        `Rendered form to the user. You can now assume the user has made the update to the data in the next message (do not read the associated file again now, updates are reflected only in the next message).\n` +
        appendToPrompt
      )
    },
  })
}

export function getTypeForNameInSchema(name: string, compiledSchema: any) {
  const pointer =
    '#' +
    '/' +
    name
      .split('.')
      .map((part) => (isNaN(Number(part)) ? part : 'items'))
      .join('/')
  console.log(pointer)
  const { node, error } = compiledSchema.getNode(pointer)
  if (error) {
    console.error(`Failed to get schema node for pointer: ${pointer}`, error)
  }
  return node?.schema
}

type FieldType = z.infer<typeof FieldTypeEnum>

export function getValidFieldTypesForSchema(schema: any): FieldType[] {
  if (!schema || typeof schema !== 'object') {
    return []
  }

  if (schema.enum) {
    const enumLength = Array.isArray(schema.enum) ? schema.enum.length : 0
    if (enumLength <= 3) {
      return ['radio', 'select']
    }
    return ['select']
  }

  if (schema.const) {
    return ['input', 'textarea']
  }

  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const allTypes = new Set<FieldType>()
    for (const subSchema of schema.anyOf) {
      const types = getValidFieldTypesForSchema(subSchema)
      types.forEach((t) => allTypes.add(t))
    }
    return Array.from(allTypes)
  }

  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    const allTypes = new Set<FieldType>()
    for (const subSchema of schema.oneOf) {
      const types = getValidFieldTypesForSchema(subSchema)
      types.forEach((t) => allTypes.add(t))
    }
    return Array.from(allTypes)
  }

  if (schema.allOf && Array.isArray(schema.allOf)) {
    const allTypes = new Set<FieldType>()
    for (const subSchema of schema.allOf) {
      const types = getValidFieldTypesForSchema(subSchema)
      types.forEach((t) => allTypes.add(t))
    }
    return Array.from(allTypes)
  }

  const schemaType = schema.type

  if (Array.isArray(schemaType)) {
    const allTypes = new Set<FieldType>()
    for (const type of schemaType) {
      if (type === 'string') {
        ;['input', 'password', 'textarea', 'select', 'radio', 'color_picker', 'date_picker'].forEach((t) =>
          allTypes.add(t as FieldType),
        )
      } else if (type === 'number' || type === 'integer') {
        ;['number', 'slider'].forEach((t) => allTypes.add(t as FieldType))
      } else if (type === 'boolean') {
        allTypes.add('switch')
      }
    }
    return Array.from(allTypes)
  }

  if (schemaType === 'string') {
    return ['input', 'password', 'textarea', 'select', 'radio', 'color_picker', 'date_picker']
  }

  if (schemaType === 'number' || schemaType === 'integer') {
    return ['number', 'slider']
  }

  if (schemaType === 'boolean') {
    return ['switch']
  }

  return []
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

// Legacy schema exports
const FieldTypeEnum = z.enum([
  'input',
  'password',
  'textarea',
  'number',
  'select',
  'radio',
  'slider',
  'switch',
  'color_picker',
  'date_picker',
  'image_upload',
  'button',
])

export const UIFieldSchema = z.object({
  name: z.string().describe(`Field path with parts delimited by dot, for example object.field.child . for array items you can use parent.{index}.objectField where index is a number. NEVER use [index] syntax, for example instead of domains[0] use domains.0`),
  type: FieldTypeEnum,
  label: z
    .string()
    .describe('Label describing what this field does to the user. For array items use First, Second, Third prefixes'),
  description: z.string().optional(),
  // Common fields
  required: z.boolean().optional(),
  // Group title for grouping consecutive fields
  groupTitle: z
    .string()
    .optional()
    .describe(
      `Optional group title. When consecutive fields share the same groupTitle, they will be wrapped in a container with this title. ALWAYS and ONLY use this for array of objects to put each object in the array into its own group. `,
    ),
  // Input/textarea/password fields
  placeholder: z.string().optional(),
  initialValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  // Number/slider fields
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  // Select field
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  // Button field
  href: z.string().optional(),
})

export const RenderFormParameters = z.object({
  fields: z.array(UIFieldSchema),
})

export type UIField = z.infer<typeof UIFieldSchema>
export type RenderFormParameters = z.infer<typeof RenderFormParameters>
