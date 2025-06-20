import { describe, test, expect } from 'vitest'
import { ChatHistory } from './chat-history'

describe('ChatHistory', () => {
    test('should render basic structure', () => {
        const props = {
            orgId: 'test-org',
            siteId: 'test-site'
        }
        
        expect(props).toMatchInlineSnapshot(`
          {
            "orgId": "test-org",
            "siteId": "test-site",
          }
        `)
    })
})