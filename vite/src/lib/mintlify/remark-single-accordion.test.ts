import { describe, expect, test } from 'vitest'
import { remarkSingleAccordionItems } from './remark-single-accordion.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkSingleAccordionItems', () => {
  test('wraps a lone Accordion in AccordionGroup', () => {
    const result = runRemarkPlugin(`
<Accordion title="Hello">
  Body
</Accordion>
`, remarkSingleAccordionItems)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<AccordionGroup>
        <Accordion title=\"Hello\">
          Body
        </Accordion>
      </AccordionGroup>
      "
    `)
  })

  test('leaves grouped accordions unchanged', () => {
    const result = runRemarkPlugin(`
<AccordionGroup>
  <Accordion title="Hello">
    Body
  </Accordion>
</AccordionGroup>
`, remarkSingleAccordionItems)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<AccordionGroup>
        <Accordion title=\"Hello\">
          Body
        </Accordion>
      </AccordionGroup>
      "
    `)
  })
})
