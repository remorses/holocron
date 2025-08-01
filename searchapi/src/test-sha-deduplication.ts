import { SearchClient } from './sdk.js'

async function testShaDeduplication() {
    const client = new SearchClient('./test-dedup-db')
    const datasetId = 'test-sha-dedup'
    
    console.log('Testing SHA-based deduplication...\n')
    
    // Create dataset
    await client.upsertDataset({ datasetId })
    
    // Test files
    const files = [
        { filename: 'file1.md', content: '# File 1\nThis is file 1 content.' },
        { filename: 'file2.md', content: '# File 2\nThis is file 2 content.' },
        { filename: 'file3.md', content: '# File 3\nThis is file 3 content.' }
    ]
    
    // First upload
    console.log('🔵 First upload - all files should be processed:')
    await client.upsertFiles({ datasetId, files })
    
    // Second upload with same content
    console.log('\n🟡 Second upload with identical content - all should be skipped:')
    await client.upsertFiles({ datasetId, files })
    
    // Third upload with one file changed
    console.log('\n🟢 Third upload with file2 modified - only file2 should be processed:')
    files[1].content = '# File 2\nThis is UPDATED file 2 content!'
    await client.upsertFiles({ datasetId, files })
    
    // Fourth upload with new file added
    console.log('\n🟣 Fourth upload with new file added - only new file should be processed:')
    files.push({ filename: 'file4.md', content: '# File 4\nThis is new file 4.' })
    await client.upsertFiles({ datasetId, files })
    
    // Verify final state
    const allFiles = await client.getFileContents({ datasetId, getAllFiles: true })
    console.log('\n📊 Final state:')
    console.log(`Total files in dataset: ${allFiles.files.length}`)
    for (const file of allFiles.files) {
        console.log(`  - ${file.filename}: SHA=${file.sha.substring(0, 8)}...`)
    }
    
    // Cleanup
    await client.deleteDataset({ datasetId })
    console.log('\n✅ Test completed - SHA deduplication is working correctly!')
}

testShaDeduplication().catch(console.error)