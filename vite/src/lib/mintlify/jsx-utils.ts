type LiteralAttributeValue = string | null

type Expression = {
  type: 'ArrayExpression' | 'Literal'
  elements?: Array<{ type: 'Literal'; value: string }>
  value?: string | boolean
  raw?: string
}

export function createElement(name: string, attributes: object[], children: unknown[] = []): object {
  return {
    type: 'mdxJsxFlowElement',
    name,
    attributes,
    children,
  }
}

export function literalAttribute(name: string, value: LiteralAttributeValue): object {
  return {
    type: 'mdxJsxAttribute',
    name,
    value,
  }
}

export function expressionAttribute(name: string, expression: Expression): object {
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
