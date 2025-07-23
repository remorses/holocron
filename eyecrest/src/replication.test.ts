import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';

// Round timestamp to nearest 2 minutes for stable snapshots
function roundToNearest2Minutes(timestamp: number): number {
  const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
  return Math.round(timestamp / twoMinutes) * twoMinutes;
}

const PRODUCTION_URL = 'https://eyecrest.org';
const TEST_DATASET_ID = 'replication-test-' + roundToNearest2Minutes(Date.now());
const JWT_TOKEN = env.EYECREST_EXAMPLE_JWT;

if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found in test environment');
}

const authHeaders = {
  'Authorization': `Bearer ${JWT_TOKEN}`
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...authHeaders
};

// No need to track files - we'll delete entire dataset

describe('Replication Tests', () => {
  beforeAll(async () => {
    // Create dataset with replicas in multiple regions
    const createResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        primaryRegion: 'wnam', // Western North America
        replicaRegions: ['enam', 'weur'] // Eastern North America, Western Europe
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create test dataset: ${error}`);
    }
    
    console.log('✅ Created dataset with replicas in wnam (primary), enam, weur');
  });

  afterAll(async () => {
    // Delete entire test dataset
    console.log(`🗑️  Deleting test dataset ${TEST_DATASET_ID}...`);

    const deleteResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}`, {
      method: 'DELETE',
      headers: authHeaders
    });

    if (deleteResponse.ok) {
      console.log('✅ Test dataset deleted successfully');
    } else {
      console.error('❌ Failed to delete test dataset:', await deleteResponse.text());
    }
  });

  test('should write to primary and read from replica using x-force-region', async () => {
    // Upload test file to primary region
    const testContent = `# Replication Test

This file tests cross-region replication.

## Section 1

Content that should be searchable from all regions.

## Section 2

More content for testing replication.`;

    const uploadResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'replication-test.md',
          content: testContent,
          weight: 1.5
        }],
        waitForReplication: true  // Wait for replication to complete
      })
    });

    expect(uploadResponse.ok).toBe(true);
    console.log('Upload completed with replication');

    // Search from primary region (wnam)
    const primarySearchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=replication`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'wnam'
        }
      }
    );

    if (!primarySearchResponse.ok) {
      console.error('Primary search failed:', await primarySearchResponse.text());
    }
    expect(primarySearchResponse.ok).toBe(true);
    const primaryData = await primarySearchResponse.json() as any;
    console.log('Primary search results:', JSON.stringify(primaryData, null, 2));
    expect(primaryData.region).toBe('wnam');
    expect(primaryData.results.length).toBeGreaterThan(0);
    expect(primaryData.results[0].filename).toBe('replication-test.md');

    // Search from replica region (enam)
    const replicaSearchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=replication`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'enam'
        }
      }
    );

    if (!replicaSearchResponse.ok) {
      console.error('Replica search failed:', await replicaSearchResponse.text());
    }
    expect(replicaSearchResponse.ok).toBe(true);
    const replicaData = await replicaSearchResponse.json() as any;
    console.log('Replica search results:', JSON.stringify(replicaData, null, 2));
    expect(replicaData.region).toBe('enam');
    expect(replicaData.results.length).toBeGreaterThan(0);
    expect(replicaData.results[0].filename).toBe('replication-test.md');

    // Verify content is the same
    expect(replicaData.results[0].snippet).toBe(primaryData.results[0].snippet);
  }, 30000); // 30 second timeout

  test('should fail when forcing region without dataset', async () => {
    // Try to force a region that doesn't have the dataset
    const invalidRegionResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=test`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'apac' // Asia Pacific - not in our replica list
        }
      }
    );

    expect(invalidRegionResponse.ok).toBe(false);
    expect(invalidRegionResponse.status).toBe(500);
    const error = await invalidRegionResponse.text();
    expect(error).toContain('Cannot force region apac');
    expect(error).toContain('dataset not available in that region');
  });

  test('should read file content from replica region', async () => {
    // First ensure we have a file uploaded with replication
    await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'replica-read-test.md',
          content: '# Replica Read Test\n\nThis file is for testing reads from replica regions.'
        }],
        waitForReplication: true
      })
    });

    // Get file from replica region (weur)
    const fileResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/replica-read-test.md`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'weur'
        }
      }
    );

    expect(fileResponse.ok).toBe(true);
    const fileData = await fileResponse.json() as any;
    expect(fileData.content).toContain('Replica Read Test');
    expect(fileData.content).toContain('testing reads from replica regions');
    expect(fileData.sha).toBeDefined();
  });

  test('should test waitForReplication parameter', async () => {
    // Upload with waitForReplication=false (fire and forget)
    const startTime = Date.now();
    const uploadResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'async-replication.md',
          content: 'This file tests async replication without waiting.'
        }],
        waitForReplication: false
      })
    });

    const uploadTime = Date.now() - startTime;
    expect(uploadResponse.ok).toBe(true);
    expect(uploadTime).toBeLessThan(1000); // Should be fast since not waiting

    // Try to read immediately from replica - might fail if replication hasn't completed
    const immediateSearchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=async`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'enam'
        }
      }
    );

    // It might or might not find the file immediately
    if (immediateSearchResponse.ok) {
      const data = await immediateSearchResponse.json() as any;
      console.log(`Immediate search found ${data.results.length} results`);
    }

    // Search again - replication should have completed by now
    
    const delayedSearchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=async`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'enam'
        }
      }
    );

    expect(delayedSearchResponse.ok).toBe(true);
    const delayedData = await delayedSearchResponse.json() as any;
    expect(delayedData.results.length).toBeGreaterThan(0);
    expect(delayedData.results[0].filename).toBe('async-replication.md');
  });

  test('should delete from primary and propagate to replicas', async () => {
    // First upload a file to delete (with replication)
    await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'to-delete.md',
          content: 'This file will be deleted to test replication.'
        }],
        waitForReplication: true  // Ensure file is replicated before we test deletion
      })
    });

    // Verify file exists in replica
    const beforeDeleteResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/to-delete.md`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'weur'
        }
      }
    );
    expect(beforeDeleteResponse.ok).toBe(true);

    // Delete the file (with replication)
    const deleteResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({
        filenames: ['to-delete.md'],
        waitForReplication: true  // Wait for deletion to replicate
      })
    });
    expect(deleteResponse.ok).toBe(true);

    // Verify file is gone from replica
    const afterDeleteResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/to-delete.md`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'weur'
        }
      }
    );
    expect(afterDeleteResponse.ok).toBe(false);
    expect(afterDeleteResponse.status).toBe(500);
    const error = await afterDeleteResponse.text();
    expect(error).toContain('File not found');
  }, 30000); // 30 second timeout
});