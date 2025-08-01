import { SearchClient } from './sdk.js'
import { importFromGitHub } from './import-github.js'

// Use a unique dataset ID for each test run with timestamp
const datasetId = `test-lancedb-benchmark`

// Initialize client (defaults to LanceDB cloud)
// Use environment variable if provided, otherwise use default cloud database
const lanceDbUri = process.env.LANCEDB_URI
const dataset = new SearchClient(lanceDbUri)

if (!lanceDbUri || lanceDbUri === 'db://fumabase-co7ad3') {
    console.log('☁️  Using LanceDB Cloud (fumabase-co7ad3)')
} else if (lanceDbUri.startsWith('db://')) {
    console.log('☁️  Using LanceDB Cloud:', lanceDbUri)
} else {
    console.log('💾 Using local LanceDB at:', lanceDbUri)
}

// Setup: Create dataset and upload test files
console.log(`\n📊 Starting benchmark with dataset: ${datasetId}`)
console.log('🔧 Creating dataset')
const upsertStartTime = Date.now()

// Create the dataset
await dataset.upsertDataset({ datasetId })


const upsertTime = (Date.now() - upsertStartTime) / 1000
console.log(`✅ Dataset created in ${upsertTime.toFixed(2)} seconds`)

// Import from GitHub repository
console.log('📥 Importing from GitHub repository...')
const importStartTime = Date.now()

const importResult = await importFromGitHub({
    dataset,
    datasetId,
    owner: 'tldr-pages',
    repo: 'tldr',
    branch: 'main',
    path: 'pages', // Directory with markdown files
})

const importTime = (Date.now() - importStartTime) / 1000
console.log(`✅ Import completed in ${importTime.toFixed(2)} seconds`)
console.log(`📁 Files imported: ${importResult.filesImported}`)
console.log(`💾 Total size: ${(importResult.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`)

if (importResult.filesImported === 0) {
    console.error('❌ No files were imported. Please check the repository and path.')
    process.exit(1)
}

// Get dataset statistics
const stats = await dataset.getDatasetSize({ datasetId })
console.log(`📈 Sections created: ${stats.sectionCount}`)

console.log(`⏱️  Total setup time: ${((Date.now() - upsertStartTime) / 1000).toFixed(2)} seconds`)

// Define search queries to benchmark
const searchQueries = [
    { query: 'file', description: 'File operations' },
    { query: 'git', description: 'Version control' },
    { query: 'docker', description: 'Containerization' },
    { query: 'python', description: 'Programming language' },
    { query: 'network', description: 'Networking' }
]

// Test search functionality before benchmarking
console.log('\n🔍 Testing search functionality...')
try {
    const testResult = await dataset.searchSections({
        datasetId,
        query: searchQueries[0].query,
        perPage: 10
    })
    console.log(`✅ Search working! Found ${testResult.results.length} results for "${searchQueries[0].query}"`)
    if (testResult.results.length > 0) {
        console.log(`   First result: ${testResult.results[0].filename} - ${testResult.results[0].snippet.substring(0, 50)}...`)
    }
} catch (error) {
    console.error('❌ Search test failed:', error)
    process.exit(1)
}

// Log search result counts
console.log('\n📊 Search result counts:')
for (const { query, description } of searchQueries) {
    try {
        const result = await dataset.searchSections({
            datasetId,
            query,
            perPage: 20
        })
        console.log(`  "${query}" (${description}): ${result.results.length} results`)
    } catch (error: any) {
        console.error(`  "${query}": ERROR - ${error.message}`)
    }
}

// Run benchmarks
const ITERATIONS = 5
console.log(`\n🏃 Running benchmarks (${ITERATIONS} iterations per query)...\n`)
console.log('LanceDB Search Benchmark')
console.log('========================\n')

const results: Array<{ query: string; times: number[]; avg: number }> = []

// Double loop: queries and iterations
for (const { query, description } of searchQueries) {
    console.log(`Benchmarking "${query}" (${description}):`);
    const times: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
        const startTime = performance.now()
        await dataset.searchSections({
            datasetId,
            query,
            perPage: 10
        })
        const elapsed = performance.now() - startTime
        times.push(elapsed)
        console.log(`  Run ${i + 1}: ${elapsed.toFixed(2)}ms`)
    }

    const avg = times.reduce((sum, t) => sum + t, 0) / times.length
    results.push({ query, times, avg })
    console.log(`  Average: ${avg.toFixed(2)}ms\n`)
}

// Display summary results
console.log('\n📊 Summary Results:\n')
console.log('Query             | Avg (ms) | Min (ms) | Max (ms)')
console.log('------------------|----------|----------|----------')
for (const result of results) {
    const paddedQuery = result.query.padEnd(17)
    const min = Math.min(...result.times)
    const max = Math.max(...result.times)
    console.log(`${paddedQuery} | ${result.avg.toFixed(2).padStart(8)} | ${min.toFixed(2).padStart(8)} | ${max.toFixed(2).padStart(8)}`)
}

// Calculate and show overall average
const overallAvg = results.reduce((sum, r) => sum + r.avg, 0) / results.length
console.log('------------------|----------|----------|----------')
console.log(`Overall Average   | ${overallAvg.toFixed(2).padStart(8)} |          |`)

// Cleanup
console.log('\n🧹 Cleaning up...')
try {
    await dataset.deleteDataset({ datasetId })
    console.log('✅ Dataset deleted successfully')
} catch (error) {
    console.warn('⚠️  Failed to cleanup dataset:', error)
}

console.log('\n✅ Benchmark complete!')
console.log(`Dataset ID: ${datasetId}`)
console.log(`Repository: tldr-pages/tldr`)
console.log(`Path: pages/`)
console.log(`Iterations per query: ${ITERATIONS}`)
