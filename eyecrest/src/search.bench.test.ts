import { Bench } from 'tinybench';
import { env } from 'cloudflare:test';
import { EyecrestClient } from './sdk.js';

// JWT token from Cloudflare test environment
const JWT_TOKEN = env.EYECREST_EXAMPLE_JWT;
if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found in test environment. Make sure it is set in .dev.vars');
}

// Use a unique dataset ID for each test run
const datasetId = `test-org-123-xx-benchmark-${Date.now()}`;

const client = new EyecrestClient({
  token: JWT_TOKEN,
  baseUrl: 'https://eyecrest.org'
});

// Setup: Create dataset and upload test files
console.log(`\n📊 Starting benchmark with dataset: ${datasetId}`);
console.log('🔧 Creating dataset with primary region: weur');
const upsertStartTime = Date.now();

await client.upsertDataset({
  datasetId,
  primaryRegion: 'weur',
  waitForReplication: false
});

const upsertTime = (Date.now() - upsertStartTime) / 1000;
console.log(`✅ Dataset created in ${upsertTime.toFixed(2)} seconds`);

// Import from GitHub repository
console.log('📥 Importing from GitHub repository...');
const importStartTime = Date.now();

const importResult = await client.importFromGitHub({
  datasetId,
  owner: 'vuejs',
  repo: 'vitepress',
  branch: 'main',
  path: 'docs',
  waitForReplication: true
});

const importTime = (Date.now() - importStartTime) / 1000;
console.log(`✅ Import completed in ${importTime.toFixed(2)} seconds`);
console.log(`📁 Files imported: ${importResult.filesImported}`);
console.log(`💾 Total size: ${(importResult.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);

// Get dataset statistics
const stats = await client.getDatasetSize({ datasetId });
console.log(`📈 Sections created: ${stats.sectionCount}`);

console.log(`⏱️  Total setup time: ${((Date.now() - upsertStartTime) / 1000).toFixed(2)} seconds`);

// Log search results before benchmarking
console.log('\n📊 Search result counts:');
const searches = [
  'vite',
  'markdown',
  'configuration',
  'theme',
  'deploy'
];

for (const query of searches) {
  const result = await client.search({ datasetId, query, perPage: 20 });
  console.log(`  "${query}": ${result.results.length} results (page 1, hasNextPage: ${result.hasNextPage})`);
}
console.log('');

// Create and configure benchmark
const bench = new Bench({ 
  name: 'Eyecrest Search Benchmark',
  time: 500, // Run each benchmark for 500ms
  warmupTime: 100, // Warmup for 100ms
  warmupIterations: 5
});

// Add benchmark tasks
bench
  .add('search: "vite"', async () => {
    await client.search({
      datasetId,
      query: 'vite',
      perPage: 10
    });
  })
  .add('search: "markdown"', async () => {
    await client.search({
      datasetId,
      query: 'markdown',
      perPage: 10
    });
  })
  .add('search: "configuration"', async () => {
    await client.search({
      datasetId,
      query: 'configuration',
      perPage: 10
    });
  })
  .add('search: "theme"', async () => {
    await client.search({
      datasetId,
      query: 'theme',
      perPage: 10
    });
  })
  .add('search: "deploy"', async () => {
    await client.search({
      datasetId,
      query: 'deploy',
      perPage: 10
    });
  });

// Run the benchmark
console.log('\n🏃 Running benchmarks...\n');
await bench.run();

// Display results
console.log(bench.name);
console.table(bench.table());

// Display detailed stats
console.log('\n📊 Detailed Results:\n');
for (const task of bench.tasks) {
  if (task.result) {
    console.log(`${task.name}:`);
    console.log(`  Latency: ${(task.result.latency.mean / 1_000_000).toFixed(2)}ms ± ${task.result.latency.rme.toFixed(2)}%`);
    console.log(`  Throughput: ${task.result.throughput.mean.toFixed(2)} ops/s`);
    console.log(`  Samples: ${task.result.samples.length}`);
    console.log('');
  }
}

// Cleanup (optional - dataset will persist)
console.log('✅ Benchmark complete!');
console.log(`Dataset ID: ${datasetId}`);