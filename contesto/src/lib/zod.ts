import { z } from 'zod'

/**
 * Recursively converts every `.optional()` in a schema to
 * "required + nullable" so that no field can be `undefined`
 * (OpenAI‑JSON compliant) but all may be `null`.
 */
export function optionalToNullable<S extends z.ZodTypeAny>(schema: S): z.ZodTypeAny {
  // 1 · Optional ─► unwrap ─► make nullable
  if (schema instanceof z.ZodOptional) {
    return optionalToNullable(schema.unwrap() as any).nullable() as any
  }

  // 2 · Object ─► run on every property (keeps passthrough/strict options)
  if (schema instanceof z.ZodObject) {
    const transformed = Object.fromEntries(Object.entries(schema.shape).map(([k, v]) => [k, optionalToNullable(v)]))
    return z.object(transformed) as any
  }

  // 3 · Collections / composites
  if (schema instanceof z.ZodArray) return z.array(optionalToNullable(schema.element as any)) as any
  if (schema instanceof z.ZodRecord)
    return z.record(z.string(), optionalToNullable(schema.valueType as any)) as any
  if (schema instanceof z.ZodTuple)
    return z.tuple(schema.def.items.map((x) => optionalToNullable(x as any)) as any) as any
  if (schema instanceof z.ZodUnion)
    return z.union(schema.def.options.map((x) => optionalToNullable(x as any))) as any
  if (schema instanceof z.ZodIntersection)
    return z.intersection(
      optionalToNullable(schema.def.left as any),
      optionalToNullable(schema.def.right as any),
    ) as any

  // 4 · Leaf schema ─► untouched
  // 4 · Additional collection types
  if (schema instanceof z.ZodMap)
    return z.map(
      optionalToNullable(schema.def.keyType as any),
      optionalToNullable(schema.def.valueType as any),
    ) as any
  if (schema instanceof z.ZodSet) return z.set(optionalToNullable(schema.def.valueType as any)) as any
  if (schema instanceof z.ZodPromise) return z.promise(optionalToNullable(schema.def.type as any)) as any

  // 5 · Leaf schema ─► untouched
  return schema as any
}

/**
 * Removes null values from an object for fields that are optional in the schema.
 * This is useful for cleaning data before validation or serialization.
 */
export function removeNullsForOptionals<S extends z.ZodTypeAny>(schema: S, value: unknown): unknown {
  // 1 · Handle null/undefined values at the top level
  if (value === null || value === undefined) {
    return value
  }

  // 2 · Optional fields - if the value is null, remove it (return undefined)
  if (schema instanceof z.ZodOptional) {
    if (value === null) {
      return undefined
    }
    return removeNullsForOptionals(schema.unwrap() as any, value)
  }

  // 3 · Nullable fields - process the inner value but keep nulls
  if (schema instanceof z.ZodNullable) {
    return removeNullsForOptionals(schema.unwrap() as any, value)
  }

  // 4 · Objects - process each field
  if (schema instanceof z.ZodObject && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const result: Record<string, unknown> = {}
    const shape = schema.shape
    
    for (const key in value as any) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const fieldSchema = shape[key]
        const fieldValue = (value as any)[key]
        
        if (fieldSchema) {
          // Check if this field schema is optional and value is null
          if (fieldSchema instanceof z.ZodOptional && fieldValue === null) {
            // Skip this field entirely (don't add to result)
            continue
          }
          
          const processedValue = removeNullsForOptionals(fieldSchema, fieldValue)
          if (processedValue !== undefined) {
            result[key] = processedValue
          }
        } else {
          // Keep fields not in schema (for passthrough objects)
          result[key] = fieldValue
        }
      }
    }
    
    return result
  }

  // 5 · Arrays - process each element
  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    return value
      .map(item => {
        // If array element is optional and null, return undefined to filter it out
        if (schema.element instanceof z.ZodOptional && item === null) {
          return undefined
        }
        return removeNullsForOptionals(schema.element as any, item)
      })
      .filter(item => item !== undefined)
  }

  // 6 · Records - process each value
  if (schema instanceof z.ZodRecord && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const result: Record<string, unknown> = {}
    for (const key in value as any) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const fieldValue = (value as any)[key]
        // Check if the value type is optional and value is null
        if (schema.valueType instanceof z.ZodOptional && fieldValue === null) {
          // Skip this entry entirely
          continue
        }
        result[key] = removeNullsForOptionals(schema.valueType as any, fieldValue)
      }
    }
    return result
  }

  // 7 · Unions - try each option
  if (schema instanceof z.ZodUnion) {
    // For unions, we can't determine which branch without parsing
    // So we return the value as is
    return value
  }

  // 8 · Tuples
  if (schema instanceof z.ZodTuple && Array.isArray(value)) {
    return value.map((item, index) => {
      const itemSchema = schema.def.items[index]
      if (!itemSchema) {
        return item
      }
      // For tuples, if the item is optional and null, return undefined
      if (itemSchema instanceof z.ZodOptional && item === null) {
        return undefined
      }
      return removeNullsForOptionals(itemSchema as any, item)
    })
  }

  // 9 · Intersections
  if (schema instanceof z.ZodIntersection) {
    // For intersections, we need to handle both sides
    // This is a simplified approach - just return as is
    return value
  }

  // 10 · Lazy schemas (for circular references)
  if (schema instanceof z.ZodLazy) {
    // For lazy schemas, we can't easily unwrap them without evaluating
    // So we return the value as is
    return value
  }

  // 11 · Non-JSON types - return as is
  // Maps, Sets, Promises, etc. are not JSON-serializable
  if (value instanceof Map || value instanceof Set || value instanceof Promise) {
    return value
  }

  // 14 · Discriminated unions
  if (schema instanceof z.ZodDiscriminatedUnion) {
    // For discriminated unions, we can't determine which branch without the discriminator
    // So we return the value as is
    return value
  }

  // 15 · Effects (transforms, refinements)
  if ('_def' in schema && schema._def && 'schema' in schema._def) {
    // Process the inner schema for ZodEffects/ZodTransform
    return removeNullsForOptionals(schema._def.schema as any, value)
  }

  // 16 · Other types - return as is
  return value
}

/**
 * Repairs tool call arguments that failed validation by using an LLM to fix the input.
 * This function takes a failed tool call and attempts to repair it by generating
 * a corrected version that matches the expected schema.
 * 
 * @param params - The repair parameters
 * @param params.toolCall - The tool call that failed validation
 * @param params.tool - The tool definition with input schema
 * @param params.inputSchema - The JSON schema for the tool input
 * @param params.error - The error that occurred during validation
 * @param params.generateObjectFn - Function to generate the repaired object using an LLM
 * @returns The repaired tool call with corrected input, or null if repair fails
 */
export async function repairToolCall({
  toolCall,
  tool,
  inputSchema,
  error,
  generateObjectFn,
}: {
  toolCall: {
    toolName: string
    toolCallId: string
    input: unknown
  }
  tool: {
    inputSchema?: z.ZodTypeAny
  }
  inputSchema: unknown
  error: Error
  generateObjectFn: (params: {
    schema: z.ZodTypeAny
    prompt: string
  }) => Promise<{ object: unknown }>
}): Promise<{
  toolCallId: string
  toolName: string
  input: string
} | null> {
  if (!tool.inputSchema) {
    return null
  }

  try {
    const { object: repairedArgs } = await generateObjectFn({
      schema: optionalToNullable(tool.inputSchema),
      prompt: `The model tried to call the tool "${toolCall.toolName}" with the following inputs:
<input>
${JSON.stringify(toolCall.input)}
</input>
The tool accepts the following schema:
<schema>
${JSON.stringify(inputSchema)}
</schema>
Please fix the input argument to respect the json schema, keeping the same tool call intent`,
    })

    return {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: JSON.stringify(removeNullsForOptionals(tool.inputSchema, repairedArgs))
    }
  } catch (repairError) {
    // If repair fails, return null
    return null
  }
}
