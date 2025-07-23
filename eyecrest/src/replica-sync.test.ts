import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';

// Round timestamp to nearest 2 minutes for stable snapshots
function roundToNearest2Minutes(timestamp: number): number {
  const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
  return Math.round(timestamp / twoMinutes) * twoMinutes;
}

const PRODUCTION_URL = 'https://eyecrest.org';
const TEST_DATASET_ID = 'replica-sync-test-' + roundToNearest2Minutes(Date.now());
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

describe('Replica Sync Tests', () => {
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

  test('should sync existing data when adding new replica regions', async () => {
    // Step 1: Create dataset with primary region only
    const createResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        primaryRegion: 'wnam' // Western North America only
      })
    });
    
    expect(createResponse.ok).toBe(true);
    console.log('✅ Created dataset with primary region wnam');

    // Step 2: Upload test data to primary region
    const testFiles = [
      {
        filename: 'sync-test-1.md',
        content: '# Sync Test 1\n\nThis file should be synced to new replicas.\n\n## Section A\n\nContent in section A.',
        weight: 1.5,
        metadata: { version: '1.0' }
      },
      {
        filename: 'sync-test-2.md',
        content: '# Sync Test 2\n\nAnother file for sync testing.\n\n## Section B\n\nContent in section B.'
      },
      {
        filename: 'docs/sync-test-3.md',
        content: '# Nested File\n\nThis file is in a subdirectory.\n\n## Important\n\nShould also be synced.'
      }
    ];

    const uploadResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: testFiles,
        waitForReplication: true
      })
    });

    expect(uploadResponse.ok).toBe(true);
    console.log('✅ Uploaded 3 test files to primary region');

    // Step 3: Add replica regions to existing dataset
    const addReplicasResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        replicaRegions: ['enam', 'weur'], // Add Eastern North America and Western Europe
        waitForReplication: true // Wait for sync to complete
      })
    });

    expect(addReplicasResponse.ok).toBe(true);
    console.log('✅ Added replica regions enam and weur with waitForReplication=true');

    // Step 4: First check that data exists in primary region
    const primarySearchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=sync`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'wnam'
        }
      }
    );
    
    expect(primarySearchResponse.ok).toBe(true);
    const primaryData = await primarySearchResponse.json() as any;
    console.log(`Primary region (wnam) has ${primaryData.results.length} results`);
    expect(primaryData.results.length).toBeGreaterThan(0);
    
    // Step 5: Verify data is available in new replica (enam)
    // (waitForReplication should have ensured sync completed)
    const enamSearchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=sync`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'enam'
        }
      }
    );

    expect(enamSearchResponse.ok).toBe(true);
    const enamData = await enamSearchResponse.json() as any;
    console.log(`Search in enam found ${enamData.results.length} results`);
    expect(enamData.region).toBe('enam');
    expect(enamData.results.length).toBeGreaterThan(0);
    expect(enamData.results.some((r: any) => r.filename === 'sync-test-1.md')).toBe(true);
    expect(enamData.results.some((r: any) => r.filename === 'sync-test-2.md')).toBe(true);

    // Step 6: Verify data is available in new replica (weur)
    const weurFileResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/sync-test-1.md`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'weur'
        }
      }
    );

    expect(weurFileResponse.ok).toBe(true);
    const weurFile = await weurFileResponse.json() as any;
    expect(weurFile.content).toContain('Sync Test 1');
    expect(weurFile.metadata).toEqual({ version: '1.0' });

    // Step 7: Verify nested file is also synced
    const nestedFileResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/docs/sync-test-3.md`,
      {
        headers: {
          ...authHeaders,
          'x-force-region': 'weur'
        }
      }
    );

    expect(nestedFileResponse.ok).toBe(true);
    const nestedFile = await nestedFileResponse.json() as any;
    expect(nestedFile.content).toContain('Nested File');
  }, 30000); // 30 second timeout

  test('should handle adding replicas to dataset with no data', async () => {
    const emptyDatasetId = 'empty-sync-test-' + roundToNearest2Minutes(Date.now());

    try {
      // Create dataset without any data
      const createResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${emptyDatasetId}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          primaryRegion: 'wnam'
        })
      });
      
      expect(createResponse.ok).toBe(true);

      // Add replicas to empty dataset
      const addReplicasResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${emptyDatasetId}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          replicaRegions: ['enam']
        })
      });

      expect(addReplicasResponse.ok).toBe(true);

      // Verify replica works (search should return empty results)
      const searchResponse = await fetch(
        `${PRODUCTION_URL}/v1/datasets/${emptyDatasetId}/search?query=test`,
        {
          headers: {
            ...authHeaders,
            'x-force-region': 'enam'
          }
        }
      );

      expect(searchResponse.ok).toBe(true);
      const searchData = await searchResponse.json() as any;
      expect(searchData.region).toBe('enam');
      expect(searchData.results).toEqual([]);
    } finally {
      // Clean up
      await fetch(`${PRODUCTION_URL}/v1/datasets/${emptyDatasetId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
    }
  });

  test('should handle incremental replica additions', async () => {
    const incrementalDatasetId = 'incremental-sync-test-' + roundToNearest2Minutes(Date.now());

    try {
      // Create dataset with one replica
      const createResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${incrementalDatasetId}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          primaryRegion: 'wnam',
          replicaRegions: ['enam']
        })
      });
      
      expect(createResponse.ok).toBe(true);

      // Upload data (will replicate to enam)
      await fetch(`${PRODUCTION_URL}/v1/datasets/${incrementalDatasetId}/files`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          files: [{
            filename: 'incremental.md',
            content: '# Incremental Test\n\nTesting incremental replica addition.'
          }],
          waitForReplication: true
        })
      });

      // Add another replica (weur)
      const addReplicaResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${incrementalDatasetId}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          replicaRegions: ['enam', 'weur'] // Keep enam, add weur
        })
      });

      expect(addReplicaResponse.ok).toBe(true);

      // No need to wait - waitForReplication handles it

      // Verify data in new replica (weur)
      const weurResponse = await fetch(
        `${PRODUCTION_URL}/v1/datasets/${incrementalDatasetId}/files/incremental.md`,
        {
          headers: {
            ...authHeaders,
            'x-force-region': 'weur'
          }
        }
      );

      expect(weurResponse.ok).toBe(true);
      const weurFile = await weurResponse.json() as any;
      expect(weurFile.content).toContain('Incremental Test');

      // Verify original replica (enam) still works
      const enamResponse = await fetch(
        `${PRODUCTION_URL}/v1/datasets/${incrementalDatasetId}/files/incremental.md`,
        {
          headers: {
            ...authHeaders,
            'x-force-region': 'enam'
          }
        }
      );

      expect(enamResponse.ok).toBe(true);
    } finally {
      // Clean up
      await fetch(`${PRODUCTION_URL}/v1/datasets/${incrementalDatasetId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
    }
  }, 20000); // 20 second timeout
});