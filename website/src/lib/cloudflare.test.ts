import { describe, it } from 'vitest'
import { cloudflareClient } from './cloudflare'

describe.skip('CloudflareClient', () => {
    const domain = 'test.holocron.live'
    it('should create a domain and log the result', async () => {
        // You should replace 'example.com' with a real test domain if running for real.
        const result = await cloudflareClient.createDomain(domain)
        console.log(result)
        // void {
        //     result: {
        //         id: '8c4676b9-58d6-402f-a998-aa52ed3d9024',
        //         hostname: 'test.holocron.live',
        //         ssl: {
        //             id: 'd7f3eef2-0ec4-46ae-93c9-27f9ca9e13ad',
        //             type: 'dv',
        //             method: 'http',
        //             status: 'initializing',
        //             wildcard: false,
        //             certificate_authority: 'google',
        //         },
        //         status: 'pending',
        //         ownership_verification: {
        //             type: 'txt',
        //             name: '_cf-custom-hostname.test.holocron.live',
        //             value: 'a0b30a0a-bcca-4d12-abbd-2ab147b41002',
        //         },
        //         ownership_verification_http: {
        //             http_url:
        //                 'http://test.holocron.live/.well-known/cf-custom-hostname-challenge/8c4676b9-58d6-402f-a998-aa52ed3d9024',
        //             http_body: 'a0b30a0a-bcca-4d12-abbd-2ab147b41002',
        //         },
        //         created_at: '2025-06-26T14:08:11.886267Z',
        //     },
        //     success: true,
        //     errors: [],
        //     messages: [],
        // }
    })
    it('should remove a domain and log the result', async () => {
        const result = await cloudflareClient.removeDomain(domain)
        console.log(result)

        // void {
        //   result: {
        //     id: '8c4676b9-58d6-402f-a998-aa52ed3d9024',
        //     ssl: null,
        //     created_at: '2025-06-26T14:08:11.886267Z'
        //   },
        //   success: true,
        //   errors: [],
        //   messages: []
        // }
    })
})
