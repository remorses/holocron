import type { RootContent } from 'mdast'

type NativeJsxElementNode = Extract<RootContent, { type: 'mdxJsxFlowElement' }>
type NativeJsxAttribute = Extract<NativeJsxElementNode['attributes'][number], { type: 'mdxJsxAttribute' }>
type Expression = Extract<NativeProgramBody, { type: 'ExpressionStatement' }>['expression'] & { raw?: string }

export type JsxAttribute = NativeJsxAttribute
export type JsxElementNode = NativeJsxElementNode

type NativeProgramBody = NonNullable<
  NonNullable<Exclude<NativeJsxAttribute['value'], string | null | undefined>['data']>['estree']
>['body'][number]

export function createElement({
  name,
  attributes,
  children = [],
}: {
  name: string
  attributes: JsxAttribute[]
  children?: JsxElementNode['children']
}): JsxElementNode {
  return {
    type: 'mdxJsxFlowElement',
    name,
    attributes,
    children,
  }
}

export function literalAttribute(name: string, value: string | null): JsxAttribute {
  return {
    type: 'mdxJsxAttribute',
    name,
    value,
  }
}

export function expressionAttribute(name: string, expression: Expression): JsxAttribute {
  return {
    type: 'mdxJsxAttribute',
    name,
    value: {
      type: 'mdxJsxAttributeValueExpression',
      value: expression.raw ?? '',
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'ExpressionStatement',
              expression,
            },
          ],
        },
      },
    },
  }
}

export function stringArrayExpression(values: string[]): Expression {
  return {
      type: 'ArrayExpression',
      elements: values.map((value) => ({
        type: 'Literal',
        value,
      })),
    raw: `[${values.map((value) => JSON.stringify(value)).join(', ')}]`,
  }
}

export function booleanExpression(value: boolean): Expression {
  return {
    type: 'Literal',
    value,
    raw: String(value),
  }
}

export function numberExpression(value: number): Expression {
  return {
    type: 'Literal',
    value,
    raw: String(value),
  }
}
