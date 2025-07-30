import { EyecrestClient } from './sdk.js';

// JWT token from environment (provided by doppler)
const JWT_TOKEN = process.env.EYECREST_EXAMPLE_JWT;
if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found. Make sure to run with doppler: doppler run -- tsx src/search-benchmark-github.ts');
}

// Use a unique dataset ID for each test run
const datasetId = `test-org-123-xx-benchmark`;

const client = new EyecrestClient({
  token: JWT_TOKEN,
  baseUrl: 'https://eyecrest.org'
});

// Setup: Create dataset and upload test files
console.log(`\n📊 Starting benchmark with dataset: ${datasetId}`);
console.log('🔧 Creating dataset with primary region: weur');
const upsertStartTime = Date.now();

await client.deleteDataset({
  datasetId,

}).catch(() => null);
await client.upsertDataset({
  datasetId,
  primaryRegion: 'weur',
  waitForReplication: false,
  provider: 'upstash'
});


const upsertTime = (Date.now() - upsertStartTime) / 1000;
console.log(`✅ Dataset created in ${upsertTime.toFixed(2)} seconds`);

// Import from GitHub repository
console.log('📥 Importing from GitHub repository...');
const importStartTime = Date.now();

const importResult = await client.importFromGitHub({
  datasetId,
  owner: 'vercel',
  repo: 'next.js',
  branch: 'canary',
  path: '',
  waitForReplication: true
});

const importTime = (Date.now() - importStartTime) / 1000;
console.log(`✅ Import completed in ${importTime.toFixed(2)} seconds`);
console.log(`📁 Files imported: ${importResult.filesImported}`);
console.log(`💾 Total size: ${(importResult.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
const size = await client.getDatasetSize({
  datasetId,

});
console.log(size)

// Get dataset statistics
const stats = await client.getDatasetSize({ datasetId });
console.log(`📈 Sections created: ${stats.sectionCount}`);

console.log(`⏱️  Total setup time: ${((Date.now() - upsertStartTime) / 1000).toFixed(2)} seconds`);

// Define search queries to benchmark
const searchQueries = [
  { query: 'react', description: 'UI framework' },
  { query: 'javascript', description: 'Programming language' },
  { query: 'certification', description: 'Course content' },
  { query: 'algorithm', description: 'Computer science' },
  { query: 'responsive', description: 'Web design' }
];

// Test search functionality before benchmarking
console.log('\n🔍 Testing search functionality...');
try {
  const testResult = await client.search({ datasetId, query: searchQueries[0].query, perPage: 10 });
  console.log(`✅ Search working! Found ${testResult.results.length} results for "${searchQueries[0].query}"`);
  if (testResult.results.length > 0) {
    console.log(`   First result: ${testResult.results[0].filename} - ${testResult.results[0].snippet.substring(0, 50)}...`);
  }
} catch (error) {
  console.error('❌ Search test failed:', error);
  process.exit(1);
}

// Log search result counts
console.log('\n📊 Search result counts:');
for (const { query, description } of searchQueries) {
  try {
    const result = await client.search({ datasetId, query, perPage: 20 });
    console.log(`  "${query}" (${description}): ${result.results.length} results`);
  } catch (error) {
    console.error(`  "${query}": ERROR - ${error.message}`);
  }
}

// Run benchmarks
const ITERATIONS = 5;
console.log(`\n🏃 Running benchmarks (${ITERATIONS} iterations per query)...\n`);
console.log('Eyecrest Search Benchmark');
console.log('=========================\n');

const results: Array<{ query: string; times: number[]; avg: number }> = [];

// Double loop: queries and iterations
for (const { query, description } of searchQueries) {
  console.log(`Benchmarking "${query}" (${description}):`);
  const times: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const startTime = performance.now();
    await client.search({
      datasetId,
      query,
      perPage: 10
    });
    const elapsed = performance.now() - startTime;
    times.push(elapsed);
    console.log(`  Run ${i + 1}: ${elapsed.toFixed(2)}ms`);
  }

  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  results.push({ query, times, avg });
  console.log(`  Average: ${avg.toFixed(2)}ms\n`);
}

// Display summary results
console.log('\n📊 Summary Results:\n');
console.log('Query             | Avg (ms) | Min (ms) | Max (ms)');
console.log('------------------|----------|----------|----------');
for (const result of results) {
  const paddedQuery = result.query.padEnd(17);
  const min = Math.min(...result.times);
  const max = Math.max(...result.times);
  console.log(`${paddedQuery} | ${result.avg.toFixed(2).padStart(8)} | ${min.toFixed(2).padStart(8)} | ${max.toFixed(2).padStart(8)}`);
}

// Calculate and show overall average
const overallAvg = results.reduce((sum, r) => sum + r.avg, 0) / results.length;
console.log('------------------|----------|----------|----------');
console.log(`Overall Average   | ${overallAvg.toFixed(2).padStart(8)} |          |`);

// Cleanup (optional - dataset will persist)
console.log('\n✅ Benchmark complete!');
console.log(`Dataset ID: ${datasetId}`);
console.log(`Repository: freeCodeCamp/freeCodeCamp`);
console.log(`Iterations per query: ${ITERATIONS}`);
