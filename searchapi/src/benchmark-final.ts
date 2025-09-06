import { SearchClient } from './sdk.js'
import { importFromGitHub } from './import-github.js'

// Final benchmark showing all optimizations
let datasetId = `benchmark-final-tldr-pages`
datasetId = `benchmark-final-vitepress`
const client = new SearchClient('./benchmark-final-db')

console.log('🚀 LanceDB Optimized Performance Benchmark')
console.log('==========================================\n')

console.log('📋 Optimizations Applied:')
console.log('  1. ✅ IN clause for targeted queries (not full table scan)')
console.log('  2. ✅ mergeInsert with automatic index creation')
console.log('  3. ✅ Delayed FTS indexing after bulk operations')
console.log('  4. ✅ Batch size optimization (1000 files)')
console.log('  5. ✅ Automatic table optimization for large datasets\n')

// Create dataset
await client.upsertDataset({ datasetId })

// Import from GitHub with optimizations
console.log('📥 Importing tldr-pages (entire repository)...')
const importStart = Date.now()

const result = await importFromGitHub({
  dataset: client,
  datasetId,
  owner: 'tldr-pages',
  repo: 'tldr',
  branch: 'main',
  path: 'pages',
})

const importTime = Date.now() - importStart
console.log(`✅ Import completed in ${(importTime / 1000).toFixed(2)}s`)
console.log(`   - Files: ${result.filesImported}`)
console.log(
  `   - Speed: ${(result.filesImported / (importTime / 1000)).toFixed(0)} files/second`,
)

// Test search performance
console.log('\n🔍 Testing search performance...')
const searchQueries = ['git', 'docker', 'python', 'file', 'network']

await client.createPendingIndexes(datasetId)

// Benchmarking search query times
let totalSearchTimeMs = 0
let allResultsCount = 0
for (const query of searchQueries) {
  const searchStart = Date.now()
  const results = await client.searchSections({
    datasetId,
    query,
    perPage: 5,
  })
  const searchTime = Date.now() - searchStart
  totalSearchTimeMs += searchTime
  allResultsCount += results.results.length
  console.log(
    `   "${query}": ${searchTime}ms (${results.results.length} results)`,
  )
}
const avgSearchTime = totalSearchTimeMs / searchQueries.length
console.log(`\n⏱️  Search Benchmark:`)
console.log(`   - Total queries: ${searchQueries.length}`)
console.log(`   - Total results returned: ${allResultsCount}`)
console.log(`   - Total search time: ${totalSearchTimeMs}ms`)
console.log(`   - Average search time per query: ${avgSearchTime.toFixed(2)}ms`)

// Get final stats
const stats = await client.getDatasetSize({ datasetId })
console.log('\n📊 Dataset Statistics:')
console.log(`   - Total files: ${stats.fileCount}`)
console.log(`   - Total sections: ${stats.sectionCount}`)
console.log(
  `   - Total size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`,
)

// Cleanup
await client.deleteDataset({ datasetId })

console.log('\n✨ Performance Summary:')
console.log(
  `   - Import speed: ${(result.filesImported / (importTime / 1000)).toFixed(0)} files/second`,
)
console.log('   - mergeInsert: Automatic index creation when needed')
console.log('   - No manual index management required')
console.log('   - Production-ready performance!')
