import { describe, test, expect } from 'vitest'
import { TrieveSDK } from 'trieve-ts-sdk'
import { env } from './env'

describe('Trieve Groups API', () => {
    test('fetches groups from dataset', async () => {
        // Skip test if Trieve credentials are not available
        if (!env.TRIEVE_API_KEY || !env.TRIEVE_ORGANIZATION_ID) {
            console.log('Skipping test: Trieve credentials not configured')
            return
        }

        // Test dataset ID - using a test dataset that should exist
        const testDatasetId = '8edeb160-d7ee-4fda-bc6e-f55eb0ec3554'

        const trieve = new TrieveSDK({
            apiKey: env.TRIEVE_API_KEY,
            organizationId: env.TRIEVE_ORGANIZATION_ID,
            datasetId: testDatasetId,
        })

        const groupsResponse = await trieve.getGroupsForDataset({
            page: 1,
        })

        // Verify the response structure
        expect(groupsResponse).toMatchInlineSnapshot(`
          {
            "groups": [
              {
                "created_at": "2025-07-01T15:58:36.873378",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "f0385765-dfd9-432f-95db-8686e1191606",
                "metadata": {},
                "name": "/README",
                "tag_set": [],
                "tracking_id": "/README",
                "updated_at": "2025-07-01T15:58:36.873378",
              },
              {
                "created_at": "2025-07-01T15:58:41.798473",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "eedb7874-edb8-4a18-88f0-139c133e78f0",
                "metadata": {},
                "name": "/writing/user-focused",
                "tag_set": [],
                "tracking_id": "/writing/user-focused",
                "updated_at": "2025-07-01T15:58:41.798473",
              },
              {
                "created_at": "2025-07-06T07:36:01.453080",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "Test group for automated testing",
                "file_id": null,
                "id": "ed0185ed-ae8a-4195-baf7-3a8a3ee66919",
                "metadata": {},
                "name": "Test Group",
                "tag_set": [],
                "tracking_id": "test-group-1751787361266",
                "updated_at": "2025-07-06T07:36:01.453080",
              },
              {
                "created_at": "2025-07-01T15:58:36.873384",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "d7ce66bd-3ddd-4c18-9bd3-a1e9ebc99dd6",
                "metadata": {},
                "name": "Writing Accessible Documentation",
                "tag_set": [],
                "tracking_id": "Writing Accessible Documentation",
                "updated_at": "2025-07-01T15:58:36.873384",
              },
              {
                "created_at": "2025-07-01T15:58:36.873379",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "c18b28c4-b962-4cad-b7fa-99574ac368fb",
                "metadata": {},
                "name": "/essentials/code",
                "tag_set": [],
                "tracking_id": "/essentials/code",
                "updated_at": "2025-07-01T15:58:36.873379",
              },
              {
                "created_at": "2025-07-01T15:58:36.873380",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "b4115c51-fea0-4cb1-9910-e08ca70ab42d",
                "metadata": {},
                "name": "Images and Embeds",
                "tag_set": [],
                "tracking_id": "Images and Embeds",
                "updated_at": "2025-07-01T15:58:36.873380",
              },
              {
                "created_at": "2025-07-01T15:58:41.798471",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "afea34e6-26be-4144-8940-401f18978868",
                "metadata": {},
                "name": "/writing/content-structure",
                "tag_set": [],
                "tracking_id": "/writing/content-structure",
                "updated_at": "2025-07-01T15:58:41.798471",
              },
              {
                "created_at": "2025-07-01T15:58:36.873381",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "af9e54d8-d2a1-405b-bde6-476fd67eef42",
                "metadata": {},
                "name": "Markdown Syntax",
                "tag_set": [],
                "tracking_id": "Markdown Syntax",
                "updated_at": "2025-07-01T15:58:36.873381",
              },
              {
                "created_at": "2025-07-01T15:58:43.046906",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "a9f64ed7-200a-4d78-9f7e-58974f1aeabd",
                "metadata": {},
                "name": "Visual Design for Documentation",
                "tag_set": [],
                "tracking_id": "Visual Design for Documentation",
                "updated_at": "2025-07-01T15:58:43.046906",
              },
              {
                "created_at": "2025-07-01T15:58:36.873383",
                "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                "description": "",
                "file_id": null,
                "id": "a4024017-6dad-408c-982f-39046555290b",
                "metadata": {},
                "name": "/essentials/navigation",
                "tag_set": [],
                "tracking_id": "/essentials/navigation",
                "updated_at": "2025-07-01T15:58:36.873384",
              },
            ],
            "next_cursor": null,
            "total_pages": 3,
          }
        `)
    })

    test('searches for specific group in dataset', async () => {
        // Skip test if Trieve credentials are not available
        if (!env.TRIEVE_API_KEY || !env.TRIEVE_ORGANIZATION_ID) {
            console.log('Skipping test: Trieve credentials not configured')
            return
        }

        const trieve = new TrieveSDK({
            apiKey: env.TRIEVE_API_KEY,
            organizationId: env.TRIEVE_ORGANIZATION_ID,
            datasetId: '8edeb160-d7ee-4fda-bc6e-f55eb0ec3554',
        })

        // Search for groups with a specific query
        const searchResponse = await trieve.searchOverGroups({
            query: 'markdown',
            search_type: 'fulltext',
            score_threshold: 1,
            group_size: 4,
        })

        // Verify we get results
        expect(searchResponse).toMatchInlineSnapshot(`
          {
            "corrected_query": null,
            "id": "7ded4af0-e869-4adc-9f24-18d569b1b5c6",
            "results": [
              {
                "chunks": [
                  {
                    "chunk": {
                      "chunk_html": "Fumabase supports HTML tags in Markdown. This is helpful if you prefer HTML tags to Markdown syntax, and lets you create documentation with infinite flexibility.",
                      "created_at": "2025-07-01T15:58:36.908644",
                      "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                      "id": "10b4f674-de72-44b0-9959-2ed80f507402",
                      "image_urls": null,
                      "link": "/essentials/images",
                      "location": null,
                      "metadata": {
                        "page_id": "/essentials/images",
                        "page_title": "Images and Embeds",
                        "section": "Embeds and HTML elements",
                        "section_id": "embeds-and-html-elements",
                      },
                      "num_value": null,
                      "tag_set": [],
                      "time_stamp": null,
                      "tracking_id": "/essentials/images-embeds-and-html-elements-content",
                      "updated_at": "2025-07-01T15:58:36.908644",
                      "weight": 0,
                    },
                    "highlights": null,
                    "score": 8.575724,
                  },
                  {
                    "chunk": {
                      "chunk_html": "Using Markdown",
                      "created_at": "2025-07-01T15:58:36.908649",
                      "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                      "id": "65dfff47-dabc-4a7c-85b8-7696b13d351c",
                      "image_urls": null,
                      "link": "/essentials/images",
                      "location": null,
                      "metadata": {
                        "page_id": "/essentials/images",
                        "page_title": "Images and Embeds",
                        "section": "Using Markdown",
                        "section_id": "using-markdown",
                      },
                      "num_value": null,
                      "tag_set": [],
                      "time_stamp": null,
                      "tracking_id": "/essentials/images-using-markdown-heading",
                      "updated_at": "2025-07-01T15:58:36.908649",
                      "weight": 0,
                    },
                    "highlights": null,
                    "score": 8.532965,
                  },
                ],
                "file_id": null,
                "group": {
                  "created_at": "2025-07-01T15:58:36.873381",
                  "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                  "description": "",
                  "id": "97ff4c0b-b92f-4ad6-b83e-d34fcfa45bd6",
                  "metadata": {},
                  "name": "/essentials/images",
                  "tag_set": [],
                  "tracking_id": "/essentials/images",
                  "updated_at": "2025-07-01T15:58:36.873381",
                },
              },
              {
                "chunks": [
                  {
                    "chunk": {
                      "chunk_html": "Fumabase supports HTML tags in Markdown. This is helpful if you prefer HTML tags to Markdown syntax, and lets you create documentation with infinite flexibility.",
                      "created_at": "2025-07-01T15:58:36.908644",
                      "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                      "id": "10b4f674-de72-44b0-9959-2ed80f507402",
                      "image_urls": null,
                      "link": "/essentials/images",
                      "location": null,
                      "metadata": {
                        "page_id": "/essentials/images",
                        "page_title": "Images and Embeds",
                        "section": "Embeds and HTML elements",
                        "section_id": "embeds-and-html-elements",
                      },
                      "num_value": null,
                      "tag_set": [],
                      "time_stamp": null,
                      "tracking_id": "/essentials/images-embeds-and-html-elements-content",
                      "updated_at": "2025-07-01T15:58:36.908644",
                      "weight": 0,
                    },
                    "highlights": null,
                    "score": 8.575724,
                  },
                  {
                    "chunk": {
                      "chunk_html": "Using Markdown",
                      "created_at": "2025-07-01T15:58:36.908649",
                      "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                      "id": "65dfff47-dabc-4a7c-85b8-7696b13d351c",
                      "image_urls": null,
                      "link": "/essentials/images",
                      "location": null,
                      "metadata": {
                        "page_id": "/essentials/images",
                        "page_title": "Images and Embeds",
                        "section": "Using Markdown",
                        "section_id": "using-markdown",
                      },
                      "num_value": null,
                      "tag_set": [],
                      "time_stamp": null,
                      "tracking_id": "/essentials/images-using-markdown-heading",
                      "updated_at": "2025-07-01T15:58:36.908649",
                      "weight": 0,
                    },
                    "highlights": null,
                    "score": 8.532965,
                  },
                ],
                "file_id": null,
                "group": {
                  "created_at": "2025-07-01T15:58:36.873380",
                  "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
                  "description": "",
                  "id": "b4115c51-fea0-4cb1-9910-e08ca70ab42d",
                  "metadata": {},
                  "name": "Images and Embeds",
                  "tag_set": [],
                  "tracking_id": "Images and Embeds",
                  "updated_at": "2025-07-01T15:58:36.873380",
                },
              },
            ],
            "total_pages": 0,
          }
        `)
    })

    test('creates and deletes a test group', async () => {
        // Skip test if Trieve credentials are not available
        if (!env.TRIEVE_API_KEY || !env.TRIEVE_ORGANIZATION_ID) {
            console.log('Skipping test: Trieve credentials not configured')
            return
        }

        const trieve = new TrieveSDK({
            apiKey: env.TRIEVE_API_KEY,
            organizationId: env.TRIEVE_ORGANIZATION_ID,
            datasetId: '8edeb160-d7ee-4fda-bc6e-f55eb0ec3554',
        })

        const testGroupId = `test-group-${Date.now()}`

        // Create a test chunk group
        const createResponse = await trieve.createChunkGroup({
            name: 'Test Group',
            description: 'Test group for automated testing',
            tracking_id: testGroupId,
        })

        expect(createResponse).toMatchInlineSnapshot(`
          {
            "created_at": "2025-07-17T15:18:13.317039",
            "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
            "description": "Test group for automated testing",
            "id": "6ed5b8b1-8ec6-43a5-89ee-fcbde9a6a0c3",
            "metadata": {},
            "name": "Test Group",
            "tag_set": [],
            "tracking_id": "test-group-1752765493166",
            "updated_at": "2025-07-17T15:18:13.317039",
          }
        `)

        // Clean up - delete the test group
        if ('id' in createResponse) {
            await trieve.deleteGroup({
                groupId: createResponse.id,
                deleteChunks: true,
                trDataset: '8edeb160-d7ee-4fda-bc6e-f55eb0ec3554',
            })
        }
    })
})
