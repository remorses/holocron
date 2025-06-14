import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { app } from 'website/src/lib/spiceflow'
import { createSpiceflowClient } from 'spiceflow/client'

async function main() {
    console.log('Creating Spiceflow client...')
    const client = createSpiceflowClient(app)

    console.log('Fetching OpenAPI spec...')
    const { data: openapiJson, error } = await client.api.openapi.get()
    if (error) {
        console.error('Failed to fetch OpenAPI spec:', error)
        throw error
    }

    const outputPath = path.resolve('./openapi.yml')
    console.log('Writing OpenAPI spec to', outputPath)
    fs.writeFileSync(
        outputPath,
        yaml.dump(openapiJson, {
            indent: 2,
            lineWidth: -1,
        }),
    )
    console.log('Successfully wrote OpenAPI spec')
}

main().catch((e) => {
    console.error('Failed to generate OpenAPI spec:', e)
    process.exit(1)
})
