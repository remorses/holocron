import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';

const PRODUCTION_URL = 'https://eyecrest.org';

// JWT token from Cloudflare test environment
const JWT_TOKEN = env.EYECREST_EXAMPLE_JWT;
if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found in test environment');
}

// Common headers with authentication
const authHeaders = {
  'Authorization': `Bearer ${JWT_TOKEN}`
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...authHeaders
};

describe('Eyecrest Search Tokenization Research', () => {
  // Use unique dataset for each test run
  const TEST_DATASET_ID = `search-research-${Date.now()}`;
  let uploadedFiles: string[] = [];

  beforeAll(async () => {
    // Create some test content with various patterns
    const filesToUpload = [
      {
        filename: 'camelCase-test.md',
        content: `# CamelCase Patterns

getUserData getUserInfo setUserName updateUserProfile

camelCase camelCasePattern thisIsCamelCase

## Mixed Cases

getUserData() user.getData user-get-data user_get_data`
      },
      {
        filename: 'kebab-case-test.md',
        content: `# Kebab Case Patterns

user-data user-info set-user-name update-user-profile

kebab-case kebab-case-pattern this-is-kebab-case

## Mixed Patterns

user-data getUserData user.data user_data`
      },
      {
        filename: 'dot.notation.test.md',
        content: `# Dot Notation Patterns

user.data user.info config.settings profile.update

object.property nested.object.property

## Mixed Notations

user.data user-data userData user_data`
      },
      {
        filename: 'special_chars_test.md',
        content: `# Special Characters

@cloudflare/workers @typescript/types @babel/core

user@example.com admin@test.org

${"`"}code block${"`"} ${"`"}inline code${"`"}

$variable ${"{"}template${"}"}

array[0] object["key"] map.get("key")

/* comment */ // single line
<!-- html comment -->

http://example.com https://test.org

C:\\Windows\\System32 /usr/local/bin

function() => { return true; }`
      },
      {
        filename: 'exact-phrases.md',
        content: `# Exact Phrase Testing

"user authentication" is a common phrase
"database connection" requires configuration
"error handling" should be robust

The phrase "API endpoint" is important
We use "REST API" standards
Returns "JSON response" format

Multi-word: "get user data"
Another: "update user profile"
Action: "delete user account"`
      }
    ];
    
    uploadedFiles = filesToUpload.map(f => f.filename);

    console.log(`📤 Uploading ${filesToUpload.length} files to dataset: ${TEST_DATASET_ID}`);

    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ files: filesToUpload })
    });

    if (!response.ok) {
      throw new Error(`Failed to upload test files: ${await response.text()}`);
    }

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up test dataset
    console.log(`🗑️  Cleaning up ${uploadedFiles.length} test files from ${TEST_DATASET_ID}`);
    
    await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({ filenames: uploadedFiles })
    });
  });

  test('camelCase tokenization - JSON', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getUserData`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
            "results.2.metadata": [
              "undefined",
            ],
            "results.2.startLine": [
              "undefined",
            ],
          },
        },
        "count": 3,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -0.5726722510252349,
            "section": "CamelCase Patterns",
            "snippet": "getUserData getUserInfo setUserName updateUserProfile

      camelCase camelCasePattern thisIsCamelCase",
            "startLine": null,
          },
          {
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -0.5496502509840194,
            "section": "Mixed Cases",
            "snippet": "getUserData() user.getData user-get-data user_get_data",
            "startLine": null,
          },
          {
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -0.5609251279272813,
            "section": "Mixed Patterns",
            "snippet": "user-data getUserData user.data user_data",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('camelCase tokenization - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=getUserData`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`""### CamelCase Patterns\\n\\n[camelCase-test.md:1](/v1/datasets/search-research-1753180779545/files/camelCase-test.md)\\n\\ngetUserData getUserInfo setUserName updateUserProfile\\n\\ncamelCase camelCasePattern thisIsCamelCase\\n\\n---\\n\\n### Mixed Cases\\n\\n[camelCase-test.md:1](/v1/datasets/search-research-1753180779545/files/camelCase-test.md)\\n\\ngetUserData() user.getData user-get-data user_get_data\\n\\n---\\n\\n### Mixed Patterns\\n\\n[kebab-case-test.md:1](/v1/datasets/search-research-1753180779545/files/kebab-case-test.md)\\n\\nuser-data getUserData user.data user_data\\n""`);
  });

  test('kebab-case tokenization - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=user-data`,
      { headers: authHeaders }
    );

    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`"{"remote":true,"message":"no such column: data: SQLITE_ERROR"}"`);
  });

  test('dot.notation tokenization - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=user.data`,
      { headers: authHeaders }
    );

    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`"{"remote":true,"message":"fts5: syntax error near \\".\\": SQLITE_ERROR"}"`);
  });

  test('snake_case tokenization', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=user_data`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
            "results.2.metadata": [
              "undefined",
            ],
            "results.2.startLine": [
              "undefined",
            ],
            "results.3.metadata": [
              "undefined",
            ],
            "results.3.startLine": [
              "undefined",
            ],
            "results.4.metadata": [
              "undefined",
            ],
            "results.4.startLine": [
              "undefined",
            ],
          },
        },
        "count": 5,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -0.000001749397590361446,
            "section": "Mixed Patterns",
            "snippet": "user-data getUserData user.data user_data",
            "startLine": null,
          },
          {
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -9.79757085020243e-7,
            "section": "Kebab Case Patterns",
            "snippet": "user-data user-info set-user-name update-user-profile

      kebab-case kebab-case-pattern this-is-kebab-case",
            "startLine": null,
          },
          {
            "filename": "dot.notation.test.md",
            "metadata": null,
            "score": -0.000001749397590361446,
            "section": "Mixed Notations",
            "snippet": "user.data user-data userData user_data",
            "startLine": null,
          },
          {
            "filename": "dot.notation.test.md",
            "metadata": null,
            "score": -0.000001085201793721973,
            "section": "Dot Notation Patterns",
            "snippet": "user.data user.info config.settings profile.update

      object.property nested.object.property",
            "startLine": null,
          },
          {
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -7.138643067846608e-7,
            "section": "Exact Phrase Testing",
            "snippet": ""user authentication" is a common phrase
      "database connection" requires configuration
      "error handling" should be robust

      The phrase "API endpoint" is important
      We use "REST API" standards
      Returns "JSON response" format

      Multi-word: "get user data"
      Another: "update user profile"
      Action: "delete user account"",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('@ symbol tokenization', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=@cloudflare/workers`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near "@": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('email address tokenization', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=user@example.com`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near "@": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('exact phrase with quotes - JSON', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query="user authentication"`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
          },
        },
        "count": 1,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -1.1489202796727207,
            "section": "Exact Phrase Testing",
            "snippet": ""user authentication" is a common phrase
      "database connection" requires configuration
      "error handling" should be robust

      The phrase "API endpoint" is important
      We use "REST API" standards
      Returns "JSON response" format

      Multi-word: "get user data"
      Another: "update user profile"
      Action: "delete user account"",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('exact phrase with quotes - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query="user authentication"`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`""### Exact Phrase Testing\\n\\n[exact-phrases.md:1](/v1/datasets/search-research-1753180779545/files/exact-phrases.md)\\n\\n\\"user authentication\\" is a common phrase\\n\\"database connection\\" requires configuration\\n\\"error handling\\" should be robust\\n\\nThe phrase \\"API endpoint\\" is important\\nWe use \\"REST API\\" standards\\nReturns \\"JSON response\\" format\\n\\nMulti-word: \\"get user data\\"\\nAnother: \\"update user profile\\"\\nAction: \\"delete user account\\"\\n""`);
  });

  test('partial phrase with quotes', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query="user auth"`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "count": 0,
        "page": 0,
        "perPage": 20,
        "results": [],
      }
    `);
  });

  test('OR operator', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getUserData OR user-data`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "no such column: data: SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('NOT operator', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=user NOT data`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
          },
        },
        "count": 1,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "special_chars_test.md",
            "metadata": null,
            "score": -6.97406340057637e-7,
            "section": "Special Characters",
            "snippet": "@cloudflare/workers @typescript/types @babel/core

      user@example.com admin@test.org

      \`code block\` \`inline code\`

      $variable {template}

      array[0] object["key"] map.get("key")

      /* comment */ // single line

      <!-- html comment -->


      http://example.com https://test.org

      C:\\Windows\\System32 /usr/local/bin

      function() => { return true; }",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('AND operator (implicit) - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=user data`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`""### Mixed Patterns\\n\\n[kebab-case-test.md:1](/v1/datasets/search-research-1753180779545/files/kebab-case-test.md)\\n\\nuser-data getUserData user.data user_data\\n\\n---\\n\\n### Kebab Case Patterns\\n\\n[kebab-case-test.md:1](/v1/datasets/search-research-1753180779545/files/kebab-case-test.md)\\n\\nuser-data user-info set-user-name update-user-profile\\n\\nkebab-case kebab-case-pattern this-is-kebab-case\\n\\n---\\n\\n### Mixed Notations\\n\\n[dot.notation.test.md:1](/v1/datasets/search-research-1753180779545/files/dot.notation.test.md)\\n\\nuser.data user-data userData user_data\\n\\n---\\n\\n### Dot Notation Patterns\\n\\n[dot.notation.test.md:1](/v1/datasets/search-research-1753180779545/files/dot.notation.test.md)\\n\\nuser.data user.info config.settings profile.update\\n\\nobject.property nested.object.property\\n\\n---\\n\\n### Mixed Cases\\n\\n[camelCase-test.md:1](/v1/datasets/search-research-1753180779545/files/camelCase-test.md)\\n\\ngetUserData() user.getData user-get-data user_get_data\\n\\n---\\n\\n### Exact Phrase Testing\\n\\n[exact-phrases.md:1](/v1/datasets/search-research-1753180779545/files/exact-phrases.md)\\n\\n\\"user authentication\\" is a common phrase\\n\\"database connection\\" requires configuration\\n\\"error handling\\" should be robust\\n\\nThe phrase \\"API endpoint\\" is important\\nWe use \\"REST API\\" standards\\nReturns \\"JSON response\\" format\\n\\nMulti-word: \\"get user data\\"\\nAnother: \\"update user profile\\"\\nAction: \\"delete user account\\"\\n""`);
  });

  test('prefix search with asterisk', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=get*`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
            "results.2.metadata": [
              "undefined",
            ],
            "results.2.startLine": [
              "undefined",
            ],
            "results.3.metadata": [
              "undefined",
            ],
            "results.3.startLine": [
              "undefined",
            ],
            "results.4.metadata": [
              "undefined",
            ],
            "results.4.startLine": [
              "undefined",
            ],
          },
        },
        "count": 5,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -0.000001829867674858223,
            "section": "Mixed Cases",
            "snippet": "getUserData() user.getData user-get-data user_get_data",
            "startLine": null,
          },
          {
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -0.0000016079734219269104,
            "section": "CamelCase Patterns",
            "snippet": "getUserData getUserInfo setUserName updateUserProfile

      camelCase camelCasePattern thisIsCamelCase",
            "startLine": null,
          },
          {
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -0.000001241025641025641,
            "section": "Mixed Patterns",
            "snippet": "user-data getUserData user.data user_data",
            "startLine": null,
          },
          {
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -7.138643067846608e-7,
            "section": "Exact Phrase Testing",
            "snippet": ""user authentication" is a common phrase
      "database connection" requires configuration
      "error handling" should be robust

      The phrase "API endpoint" is important
      We use "REST API" standards
      Returns "JSON response" format

      Multi-word: "get user data"
      Another: "update user profile"
      Action: "delete user account"",
            "startLine": null,
          },
          {
            "filename": "special_chars_test.md",
            "metadata": null,
            "score": -6.97406340057637e-7,
            "section": "Special Characters",
            "snippet": "@cloudflare/workers @typescript/types @babel/core

      user@example.com admin@test.org

      \`code block\` \`inline code\`

      $variable {template}

      array[0] object["key"] map.get("key")

      /* comment */ // single line

      <!-- html comment -->


      http://example.com https://test.org

      C:\\Windows\\System32 /usr/local/bin

      function() => { return true; }",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('NEAR operator', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=user NEAR data`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "count": 0,
        "page": 0,
        "perPage": 20,
        "results": [],
      }
    `);
  });

  test('parentheses tokenization', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getUserData()`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near ")": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('bracket tokenization', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=array[0]`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near "[": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('URL tokenization', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=https://test.org`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "no such column: https: SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('path tokenization (forward slash)', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=/usr/local/bin`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near "/": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('path tokenization (backslash)', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=C:\\Windows\\System32`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "no such column: C: SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('template literal syntax', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=$variable`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near "$": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('arrow function syntax', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query==>`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near "=": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('comment syntax', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=/*`,
      { headers: authHeaders }
    );

    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "message": "fts5: syntax error near "/": SQLITE_ERROR",
        "remote": true,
      }
    `);
  });

  test('mixed case sensitivity', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getUserData GETUSERDATA`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
            "results.2.metadata": [
              "undefined",
            ],
            "results.2.startLine": [
              "undefined",
            ],
          },
        },
        "count": 3,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.1453445020504698,
            "section": "CamelCase Patterns",
            "snippet": "getUserData getUserInfo setUserName updateUserProfile

      camelCase camelCasePattern thisIsCamelCase",
            "startLine": null,
          },
          {
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.0993005019680389,
            "section": "Mixed Cases",
            "snippet": "getUserData() user.getData user-get-data user_get_data",
            "startLine": null,
          },
          {
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -1.1218502558545627,
            "section": "Mixed Patterns",
            "snippet": "user-data getUserData user.data user_data",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('stemming: get vs gets vs getting', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getting`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
            "results.2.metadata": [
              "undefined",
            ],
            "results.2.startLine": [
              "undefined",
            ],
          },
        },
        "count": 3,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -0.7079637536946268,
            "section": "Mixed Cases",
            "snippet": "getUserData() user.getData user-get-data user_get_data",
            "startLine": null,
          },
          {
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -0.3226560470378167,
            "section": "Exact Phrase Testing",
            "snippet": ""user authentication" is a common phrase
      "database connection" requires configuration
      "error handling" should be robust

      The phrase "API endpoint" is important
      We use "REST API" standards
      Returns "JSON response" format

      Multi-word: "get user data"
      Another: "update user profile"
      Action: "delete user account"",
            "startLine": null,
          },
          {
            "filename": "special_chars_test.md",
            "metadata": null,
            "score": -0.3152172909101437,
            "section": "Special Characters",
            "snippet": "@cloudflare/workers @typescript/types @babel/core

      user@example.com admin@test.org

      \`code block\` \`inline code\`

      $variable {template}

      array[0] object["key"] map.get("key")

      /* comment */ // single line

      <!-- html comment -->


      http://example.com https://test.org

      C:\\Windows\\System32 /usr/local/bin

      function() => { return true; }",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('non-existent term', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=xyznonexistentterm`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "count": 0,
        "page": 0,
        "perPage": 20,
        "results": [],
      }
    `);
  });
});