import { z } from 'zod'

/**
 * Recursively converts every `.optional()` in a schema to
 * "required + nullable" so that no field can be `undefined`
 * (OpenAI‑JSON compliant) but all may be `null`.
 */
export function optionalToNullable<S extends z.ZodTypeAny>(schema: S): S {
    // 1 · Optional ─► unwrap ─► make nullable
    if (schema instanceof z.ZodOptional) {
        return optionalToNullable(schema.unwrap() as any).nullable()
    }

    // 2 · Object ─► run on every property (keeps passthrough/strict options)
    if (schema instanceof z.ZodObject) {
        const transformed = Object.fromEntries(
            Object.entries(schema.shape).map(([k, v]) => [
                k,
                optionalToNullable(v),
            ]),
        )
        return z.object(transformed) as unknown as S
    }

    // 3 · Collections / composites
    if (schema instanceof z.ZodArray)
        return z.array(
            optionalToNullable(schema.element as any),
        ) as unknown as S
    if (schema instanceof z.ZodRecord)
        return z.record(
            z.string(),
            optionalToNullable(schema.valueType as any),
        ) as unknown as S
    if (schema instanceof z.ZodTuple)
        return z.tuple(
            schema.def.items.map((x) => optionalToNullable(x as any)) as any,
        ) as unknown as S
    if (schema instanceof z.ZodUnion)
        return z.union(
            schema.def.options.map((x) => optionalToNullable(x as any)),
        ) as unknown as S
    if (schema instanceof z.ZodIntersection)
        return z.intersection(
            optionalToNullable(schema.def.left as any),
            optionalToNullable(schema.def.right as any),
        ) as unknown as S

    // 4 · Leaf schema ─► untouched
    // 4 · Additional collection types
    if (schema instanceof z.ZodMap)
        return z.map(
            optionalToNullable(schema.def.keyType as any),
            optionalToNullable(schema.def.valueType as any),
        ) as unknown as S
    if (schema instanceof z.ZodSet)
        return z.set(
            optionalToNullable(schema.def.valueType as any),
        ) as unknown as S
    if (schema instanceof z.ZodPromise)
        return z.promise(
            optionalToNullable(schema.def.type as any),
        ) as unknown as S

    // 5 · Leaf schema ─► untouched
    return schema
}