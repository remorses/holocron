import { EyecrestClient } from './sdk.js';

// JWT token from environment (provided by doppler)
const JWT_TOKEN = process.env.EYECREST_EXAMPLE_JWT;
if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found. Make sure to run with doppler: doppler run -- tsx src/test-neon.ts');
}

// Use a unique dataset ID for each test run
const datasetId = `test-neon-${Date.now()}`;

const client = new EyecrestClient({
  token: JWT_TOKEN,
  baseUrl: 'https://eyecrest.org'
});

// Test: Create dataset with Neon provider
console.log(`\n🔧 Creating dataset with Neon provider: ${datasetId}`);
const startTime = Date.now();

try {
  await client.upsertDataset({
    datasetId,
    primaryRegion: 'weur',
    waitForReplication: false,
    provider: 'neon' // Using Neon provider
  });
  console.log(`✅ Dataset created in ${(Date.now() - startTime) / 1000} seconds`);
} catch (error) {
  console.error('❌ Failed to create dataset:', error);
  process.exit(1);
}

// Test: Upload some files
console.log('\n📤 Uploading test files...');
const uploadStart = Date.now();

try {
  await client.upsertFiles({
    datasetId,
    files: [
      {
        filename: 'test.md',
        content: `# Test Document

This is a test document for the Neon provider.

## Section 1

Here is some content about JavaScript and TypeScript.

## Section 2

This section talks about React and Next.js frameworks.`
      },
      {
        filename: 'readme.md',
        content: `# README

This is another test file.

## Installation

Run npm install to get started.

## Usage

Import the library and use it in your project.`
      }
    ],
    waitForReplication: false
  });
  console.log(`✅ Files uploaded in ${(Date.now() - uploadStart) / 1000} seconds`);
} catch (error) {
  console.error('❌ Failed to upload files:', error);
  process.exit(1);
}

// Test: Get dataset size
console.log('\n📊 Getting dataset size...');
try {
  const size = await client.getDatasetSize({ datasetId });
  console.log('Dataset stats:', size);
} catch (error) {
  console.error('❌ Failed to get dataset size:', error);
}

// Test: Search for content
console.log('\n🔍 Testing search functionality...');
const queries = ['JavaScript', 'React', 'installation'];

for (const query of queries) {
  try {
    const results = await client.search({
      datasetId,
      query,
      perPage: 5
    });
    console.log(`\nQuery: "${query}"`);
    console.log(`Found ${results.results.length} results`);
    if (results.results.length > 0) {
      console.log(`First result: ${results.results[0].filename} - ${results.results[0].snippet.substring(0, 50)}...`);
    }
  } catch (error) {
    console.error(`❌ Search failed for "${query}":`, error);
  }
}

// Test: Get file contents
console.log('\n📄 Getting file contents...');
try {
  const content = await client.getFile({
    datasetId,
    filePath: 'test.md',
    showLineNumbers: true
  });
  console.log('File content (first 5 lines):');
  console.log(content.content.split('\n').slice(0, 5).join('\n'));
} catch (error) {
  console.error('❌ Failed to get file contents:', error);
}

// Cleanup
console.log('\n🧹 Cleaning up...');
try {
  await client.deleteDataset({ datasetId });
  console.log('✅ Dataset deleted successfully');
} catch (error) {
  console.error('❌ Failed to delete dataset:', error);
}

console.log('\n✅ Neon provider test complete!');