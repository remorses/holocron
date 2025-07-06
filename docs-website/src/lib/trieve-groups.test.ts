import { describe, test, expect } from 'vitest'
import { TrieveSDK } from 'trieve-ts-sdk'
import { env } from './env'
import { getAllTrieveGroups } from './trieve-search'

describe('Trieve Groups API', () => {
    test('fetches ALL groups using getAllTrieveGroups function', async () => {
        // Skip test if Trieve credentials are not available
        if (!env.TRIEVE_API_KEY || !env.TRIEVE_ORGANIZATION_ID) {
            console.log('Skipping test: Trieve credentials not configured')
            return
        }

        const testDatasetId = '8edeb160-d7ee-4fda-bc6e-f55eb0ec3554'

        const allGroups = await getAllTrieveGroups({
            trieveDatasetId: testDatasetId,
        })

        // Verify we get an array of groups
        expect(Array.isArray(allGroups)).toBe(true)
        expect(allGroups.length).toBeGreaterThan(0)

        expect(allGroups.map((x) => x.tracking_id).sort())
            .toMatchInlineSnapshot(`
          [
            "/README",
            "/writing/user-focused",
            "test-group-1751787361266",
            "Writing Accessible Documentation",
            "/essentials/code",
            "Images and Embeds",
            "/writing/content-structure",
            "Markdown Syntax",
            "Visual Design for Documentation",
            "/essentials/navigation",
            "/writing/visual-design",
            "/essentials/images",
            "test-group-1751787074037",
            "/writing/accessibility",
            "/essentials/markdown",
            "/writing/code-examples",
            "Code Blocks",
            "Writing Effective Code Examples",
            "Fumabase Starter Kit",
            "Navigation",
            "Content Structure That Works",
            "User-Focused Documentation",
          ]
        `)
        expect(allGroups).toMatchInlineSnapshot(`
          [
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
            {
              "created_at": "2025-07-01T15:58:43.046907",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "a29248d7-810a-4b93-bfa5-fc3ed4ab7c40",
              "metadata": {},
              "name": "/writing/visual-design",
              "tag_set": [],
              "tracking_id": "/writing/visual-design",
              "updated_at": "2025-07-01T15:58:43.046907",
            },
            {
              "created_at": "2025-07-01T15:58:36.873381",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "97ff4c0b-b92f-4ad6-b83e-d34fcfa45bd6",
              "metadata": {},
              "name": "/essentials/images",
              "tag_set": [],
              "tracking_id": "/essentials/images",
              "updated_at": "2025-07-01T15:58:36.873381",
            },
            {
              "created_at": "2025-07-06T07:31:14.208869",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "Test group for automated testing",
              "file_id": null,
              "id": "90e226fd-a89a-48da-b399-6b9f726f759f",
              "metadata": {},
              "name": "Test Group",
              "tag_set": [],
              "tracking_id": "test-group-1751787074037",
              "updated_at": "2025-07-06T07:31:14.208869",
            },
            {
              "created_at": "2025-07-01T15:58:36.873384",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "81e100f4-b9ad-44d1-b6d2-e42a36f131f9",
              "metadata": {},
              "name": "/writing/accessibility",
              "tag_set": [],
              "tracking_id": "/writing/accessibility",
              "updated_at": "2025-07-01T15:58:36.873384",
            },
            {
              "created_at": "2025-07-01T15:58:36.873382",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "80f924b2-3dc6-4c68-98f5-369f903f5997",
              "metadata": {},
              "name": "/essentials/markdown",
              "tag_set": [],
              "tracking_id": "/essentials/markdown",
              "updated_at": "2025-07-01T15:58:36.873382",
            },
            {
              "created_at": "2025-07-01T15:58:41.798470",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "7d23e230-272e-4f9e-845e-0ed3cb5449d8",
              "metadata": {},
              "name": "/writing/code-examples",
              "tag_set": [],
              "tracking_id": "/writing/code-examples",
              "updated_at": "2025-07-01T15:58:41.798470",
            },
            {
              "created_at": "2025-07-01T15:58:36.873379",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "463afcc3-711f-4ae4-89cc-e4f26f37c90e",
              "metadata": {},
              "name": "Code Blocks",
              "tag_set": [],
              "tracking_id": "Code Blocks",
              "updated_at": "2025-07-01T15:58:36.873379",
            },
            {
              "created_at": "2025-07-01T15:58:41.798469",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "3f2f26b1-fe0d-42f5-96ea-8526b38d4b6a",
              "metadata": {},
              "name": "Writing Effective Code Examples",
              "tag_set": [],
              "tracking_id": "Writing Effective Code Examples",
              "updated_at": "2025-07-01T15:58:41.798470",
            },
            {
              "created_at": "2025-07-01T15:58:36.873377",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "31c830e2-abdc-4801-94b3-5a82e51e3975",
              "metadata": {},
              "name": "Fumabase Starter Kit",
              "tag_set": [],
              "tracking_id": "Fumabase Starter Kit",
              "updated_at": "2025-07-01T15:58:36.873378",
            },
            {
              "created_at": "2025-07-01T15:58:36.873382",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "2c8ea17d-3907-4e6a-bcfc-8dcc8aa83301",
              "metadata": {},
              "name": "Navigation",
              "tag_set": [],
              "tracking_id": "Navigation",
              "updated_at": "2025-07-01T15:58:36.873382",
            },
            {
              "created_at": "2025-07-01T15:58:41.798471",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "232df5cc-6405-4a2d-9c2a-bc5ce8c632c0",
              "metadata": {},
              "name": "Content Structure That Works",
              "tag_set": [],
              "tracking_id": "Content Structure That Works",
              "updated_at": "2025-07-01T15:58:41.798471",
            },
            {
              "created_at": "2025-07-01T15:58:41.798472",
              "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
              "description": "",
              "file_id": null,
              "id": "101bd613-f1e8-46b1-80e7-4a27b31407a2",
              "metadata": {},
              "name": "User-Focused Documentation",
              "tag_set": [],
              "tracking_id": "User-Focused Documentation",
              "updated_at": "2025-07-01T15:58:41.798472",
            },
          ]
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
            "id": "9a0133ec-ffee-40fb-9b73-dafac84dd475",
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
            "created_at": "2025-07-06T07:42:19.072911",
            "dataset_id": "8edeb160-d7ee-4fda-bc6e-f55eb0ec3554",
            "description": "Test group for automated testing",
            "id": "c0466d16-b7ee-45f4-9342-956bad3f62b7",
            "metadata": {},
            "name": "Test Group",
            "tag_set": [],
            "tracking_id": "test-group-1751787738888",
            "updated_at": "2025-07-06T07:42:19.072911",
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
