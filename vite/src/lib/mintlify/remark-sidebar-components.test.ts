import { describe, expect, test } from 'vitest'
import { remarkSidebarComponents } from './remark-sidebar-components.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkSidebarComponents', () => {
  test('wraps top-level request and response examples in Aside', () => {
    const result = runRemarkPlugin(`
<RequestExample>
  Request body
</RequestExample>

<ResponseExample>
  Response body
</ResponseExample>
`, remarkSidebarComponents)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Aside>
        <RequestExample>
          Request body
        </RequestExample>
      </Aside>

      <Aside>
        <ResponseExample>
          Response body
        </ResponseExample>
      </Aside>
      "
    `)
  })

  test('does not double-wrap examples already inside Aside', () => {
    const result = runRemarkPlugin(`
<Aside>
  <RequestExample>
    Request body
  </RequestExample>
</Aside>
`, remarkSidebarComponents)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Aside>
        <RequestExample>
          Request body
        </RequestExample>
      </Aside>
      "
    `)
  })
})
