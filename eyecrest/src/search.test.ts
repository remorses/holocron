import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';

const PRODUCTION_URL = 'https://eyecrest.org';

// Round timestamp to nearest 2 minutes for stable snapshots
function roundToNearest2Minutes(timestamp: number): number {
  const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
  return Math.round(timestamp / twoMinutes) * twoMinutes;
}

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

describe('Eyecrest Performance Tests', () => {
  test('upsert performance with multiple files', async () => {
    const perfDatasetId = `perf-test-${roundToNearest2Minutes(Date.now())}`;
    
    // Create dataset first
    const createResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${perfDatasetId}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({})
    });
    
    if (!createResponse.ok) {
      console.error(`Failed to create test dataset: ${await createResponse.text()}`);
    }
    
    // Create 10 test files
    const testFiles = Array.from({ length: 10 }, (_, i) => ({
      filename: `perf-test-${i}.md`,
      content: `# Performance Test File ${i}

## Section 1
This is a test file to measure performance. ${Array(100).fill('Lorem ipsum dolor sit amet. ').join('')}

## Section 2
More content here. ${Array(100).fill('consectetur adipiscing elit. ').join('')}

## Section 3
Even more content. ${Array(100).fill('sed do eiusmod tempor. ').join('')}

## Section 4
Additional sections. ${Array(100).fill('incididunt ut labore. ').join('')}

## Section 5
Final section. ${Array(100).fill('et dolore magna aliqua. ').join('')}`
    }));

    console.log(`🚀 Uploading ${testFiles.length} files to measure performance...`);
    
    const uploadStart = Date.now();
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${perfDatasetId}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ files: testFiles })
    });

    expect(response.ok).toBe(true);
    const uploadTime = Date.now() - uploadStart;
    console.log(`✅ Upload completed in ${uploadTime}ms (${Math.round(uploadTime / testFiles.length)}ms per file)`);

    // Re-upload same files to test SHA skipping
    console.log(`🔄 Re-uploading same files to test SHA skipping...`);
    const reuploadStart = Date.now();
    const reuploadResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${perfDatasetId}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ files: testFiles })
    });

    expect(reuploadResponse.ok).toBe(true);
    const reuploadTime = Date.now() - reuploadStart;
    console.log(`✅ Re-upload completed in ${reuploadTime}ms (should be faster due to SHA skipping)`);

    // Clean up
    await fetch(`${PRODUCTION_URL}/v1/datasets/${perfDatasetId}/files`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({ filenames: testFiles.map(f => f.filename) })
    });
  });
});

describe('Eyecrest Search Tokenization Research', () => {
  // Use timestamp for unique dataset ID to avoid schema conflicts
  const TEST_DATASET_ID = `search-research-${roundToNearest2Minutes(Date.now())}`;
  let uploadedFiles: string[] = [];

  beforeAll(async () => {
    // Create dataset first
    const createResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({})
    });
    
    if (!createResponse.ok) {
      console.error(`Failed to create test dataset: ${await createResponse.text()}`);
      // Dataset might already exist, continue anyway
    }
    // Create some test content with various patterns
    const filesToUpload = [
      {
        filename: 'camelCase-test.md',
        content: `# CamelCase Patterns

When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.

## Mixed Cases

In real-world code, you might encounter different variations:

- Function calls: \`getUserData()\`
- Method access: \`user.getData\`
- Alternative styles: \`user-get-data\` (kebab-case)
- Snake case variant: \`user_get_data\`

Each style has its use cases depending on the context and language conventions.`
      },
      {
        filename: 'kebab-case-test.md',
        content: `# Kebab Case Patterns

Kebab-case is commonly used in URLs, CSS classes, and CLI commands. Examples include \`user-data\`, \`user-info\`, \`set-user-name\`, and \`update-user-profile\`.

This naming convention uses hyphens to separate words: \`kebab-case\`, \`kebab-case-pattern\`, and \`this-is-kebab-case\`.

## Mixed Patterns

In projects, you often see multiple naming conventions side by side:

- Kebab case: \`user-data\`
- Camel case: \`getUserData\`  
- Dot notation: \`user.data\`
- Snake case: \`user_data\`

Understanding when to use each pattern is important for maintaining consistent code.`
      },
      {
        filename: 'dot.notation.test.md',
        content: `# Dot Notation Patterns

In JavaScript and many other languages, dot notation is used for property access. Common patterns include \`user.data\`, \`user.info\`, \`config.settings\`, and \`profile.update\`.

You can chain property access for nested objects: \`object.property\` or even deeper nesting like \`nested.object.property\`.

## Mixed Notations

The same data can be accessed using different notations:

- Dot notation: \`user.data\`
- Kebab case: \`user-data\`
- Camel case: \`userData\`
- Snake case: \`user_data\`

Choose the notation that best fits your language and framework conventions.`
      },
      {
        filename: 'special_chars_test.md',
        content: `# Special Characters

## NPM Scoped Packages

Modern JavaScript packages often use scoped names like \`@cloudflare/workers\`, \`@typescript/types\`, and \`@babel/core\`. These help organize related packages.

## Email Addresses

Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.

## Code Examples

Here's how to use backticks for \`code blocks\` and \`inline code\` in markdown.

Template literals use \`$variable\` or \`\${template}\` syntax.

## Array and Object Access

JavaScript provides multiple ways to access data:
- Array access: \`array[0]\`
- Object bracket notation: \`object["key"]\`
- Map methods: \`map.get("key")\`

## Comments

Different comment styles:
- Block comments: \`/* comment */\`
- Single line: \`// single line\`
- HTML comments: \`<!-- html comment -->\`

## URLs and Paths

Web URLs: \`http://example.com\` and \`https://test.org\`

File paths vary by OS:
- Windows: \`C:\\Windows\\System32\`
- Unix: \`/usr/local/bin\`

## Arrow Functions

Modern JavaScript uses arrow functions: \`function() => { return true; }\``
      },
      {
        filename: 'exact-phrases.md',
        content: `# Exact Phrase Testing

## Common Technical Phrases

"User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.

## API Documentation

The phrase "API endpoint" is important when documenting services. We use "REST API" standards throughout our applications. Most endpoints return "JSON response" format for consistency.

## Multi-word Phrases

Here are some common multi-word technical phrases:
- To retrieve information: "get user data"
- For modifications: "update user profile"  
- For deletions: "delete user account"

Each of these phrases represents a specific action in our API.`
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

  test('camelCase tokenization - JSON', async () => {
    const searchStart = Date.now();
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getUserData`,
      { headers: authHeaders }
    );
    const searchTime = Date.now() - searchStart;

    expect(response.ok).toBe(true);
    const data = await response.json() as any;
    console.log(`⏱️  Search for 'getUserData' took ${searchTime}ms and found ${data.results.length} results`);
    expect(data).toMatchInlineSnapshot(`""`);
  });

  test('camelCase tokenization - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=getUserData`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`""`);
  });

  test('kebab-case tokenization - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=user-data`,
      { headers: authHeaders }
    );

    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`""`);
  });

  test('dot.notation tokenization - TXT', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=user.data`,
      { headers: authHeaders }
    );

    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`
      "### Mixed Notations

      [dot.notation.test.md:7](/v1/datasets/search-research-1753820400000/files/dot.notation.test.md?start=7)

      ## Mixed Notations

      The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.

      ---

      ## Dot Notation Patterns

      [dot.notation.test.md:1](/v1/datasets/search-research-1753820400000/files/dot.notation.test.md?start=1)

      # Dot Notation Patterns

      In JavaScript and many other languages, dot notation is used for property access. Common patterns include \`user.data\`, \`user.info\`, \`config.settings\`, and \`profile.update\`.

      You can chain property access for nested objects: \`object.property\` or even deeper nesting like \`nest

      ---

      ### Mixed Patterns

      [kebab-case-test.md:7](/v1/datasets/search-research-1753820400000/files/kebab-case-test.md?start=7)

      ## Mixed Patterns

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.
      "
    `);
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Mixed Notations
      The same data can be accessed using different notations:
      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`
      Choose the notation that best fits your language and framework conventions.",
            "filename": "dot.notation.test.md",
            "score": 1.794085,
            "sectionSlug": "mixed-notations",
            "snippet": "## Mixed Notations

      The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Mixed Patterns
      In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "score": 1.7225336,
            "sectionSlug": "mixed-patterns",
            "snippet": "## Mixed Patterns

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": 7,
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "NPM Scoped Packages
      Modern JavaScript packages often use scoped names like  @cloudflare/workers ,  @typescript/types , and  @babel/core . These help organize related packages.",
            "filename": "special_chars_test.md",
            "score": 2.0175695,
            "sectionSlug": "npm-scoped-packages",
            "snippet": "## NPM Scoped Packages

      Modern JavaScript packages often use scoped names like \`@cloudflare/workers\`, \`@typescript/types\`, and \`@babel/core\`. These help organize related packages.",
            "startLine": 3,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Email Addresses
      Contact information might include email addresses such as  user@example.com  or  admin@test.org .",
            "filename": "special_chars_test.md",
            "score": 4.358673,
            "sectionSlug": "email-addresses",
            "snippet": "## Email Addresses

      Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Multi-word Phrases
      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "score": 2.5836477,
            "sectionSlug": "multi-word-phrases",
            "snippet": "## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": 11,
          },
          {
            "cleanedSnippet": "Common Technical Phrases
      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "filename": "exact-phrases.md",
            "score": 1.7568805,
            "sectionSlug": "common-technical-phrases",
            "snippet": "## Common Technical Phrases

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "startLine": 3,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Common Technical Phrases
      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "filename": "exact-phrases.md",
            "score": 8.358861,
            "sectionSlug": "common-technical-phrases",
            "snippet": "## Common Technical Phrases

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "startLine": 3,
          },
          {
            "cleanedSnippet": "Multi-word Phrases
      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "score": 7.442278,
            "sectionSlug": "multi-word-phrases",
            "snippet": "## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": 11,
          },
          {
            "cleanedSnippet": "API Documentation
      The phrase "API endpoint" is important when documenting services. We use "REST API" standards throughout our applications. Most endpoints return "JSON response" format for consistency.",
            "filename": "exact-phrases.md",
            "score": 5.0999794,
            "sectionSlug": "api-documentation",
            "snippet": "## API Documentation

      The phrase "API endpoint" is important when documenting services. We use "REST API" standards throughout our applications. Most endpoints return "JSON response" format for consistency.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Array and Object Access
      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "filename": "special_chars_test.md",
            "score": 4.5216317,
            "sectionSlug": "array-and-object-access",
            "snippet": "## Array and Object Access

      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "startLine": 17,
          },
          {
            "cleanedSnippet": "Email Addresses
      Contact information might include email addresses such as  user@example.com  or  admin@test.org .",
            "filename": "special_chars_test.md",
            "score": 2.0925488,
            "sectionSlug": "email-addresses",
            "snippet": "## Email Addresses

      Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.",
            "startLine": 7,
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
    expect(text).toMatchInlineSnapshot(`
      "### Common Technical Phrases

      [exact-phrases.md:3](/v1/datasets/search-research-1753820400000/files/exact-phrases.md?start=3)

      ## Common Technical Phrases

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.

      ---

      ### Multi-word Phrases

      [exact-phrases.md:11](/v1/datasets/search-research-1753820400000/files/exact-phrases.md?start=11)

      ## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.

      ---

      ### API Documentation

      [exact-phrases.md:7](/v1/datasets/search-research-1753820400000/files/exact-phrases.md?start=7)

      ## API Documentation

      The phrase "API endpoint" is important when documenting services. We use "REST API" standards throughout our applications. Most endpoints return "JSON response" format for consistency.

      ---

      ### Array and Object Access

      [special_chars_test.md:17](/v1/datasets/search-research-1753820400000/files/special_chars_test.md?start=17)

      ## Array and Object Access

      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`

      ---

      ### Email Addresses

      [special_chars_test.md:7](/v1/datasets/search-research-1753820400000/files/special_chars_test.md?start=7)

      ## Email Addresses

      Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.
      "
    `);
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Multi-word Phrases
      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "score": 7.442278,
            "sectionSlug": "multi-word-phrases",
            "snippet": "## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": 11,
          },
          {
            "cleanedSnippet": "Common Technical Phrases
      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "filename": "exact-phrases.md",
            "score": 6.671945,
            "sectionSlug": "common-technical-phrases",
            "snippet": "## Common Technical Phrases

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "startLine": 3,
          },
          {
            "cleanedSnippet": "API Documentation
      The phrase "API endpoint" is important when documenting services. We use "REST API" standards throughout our applications. Most endpoints return "JSON response" format for consistency.",
            "filename": "exact-phrases.md",
            "score": 5.0999794,
            "sectionSlug": "api-documentation",
            "snippet": "## API Documentation

      The phrase "API endpoint" is important when documenting services. We use "REST API" standards throughout our applications. Most endpoints return "JSON response" format for consistency.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Array and Object Access
      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "filename": "special_chars_test.md",
            "score": 4.5216317,
            "sectionSlug": "array-and-object-access",
            "snippet": "## Array and Object Access

      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "startLine": 17,
          },
          {
            "cleanedSnippet": "Email Addresses
      Contact information might include email addresses such as  user@example.com  or  admin@test.org .",
            "filename": "special_chars_test.md",
            "score": 2.0925488,
            "sectionSlug": "email-addresses",
            "snippet": "## Email Addresses

      Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.",
            "startLine": 7,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Mixed Patterns
      In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "score": 3.3736258,
            "sectionSlug": "mixed-patterns",
            "snippet": "## Mixed Patterns

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Kebab Case Patterns
      Kebab-case is commonly used in URLs, CSS classes, and CLI commands. Examples include  user-data ,  user-info ,  set-user-name , and  update-user-profile .
      This naming convention uses hyphens to separate words:  kebab-case ,  kebab-case-pattern , and  this-is-kebab-case .",
            "filename": "kebab-case-test.md",
            "score": 1.7568805,
            "sectionSlug": "kebab-case-patterns",
            "snippet": "# Kebab Case Patterns

      Kebab-case is commonly used in URLs, CSS classes, and CLI commands. Examples include \`user-data\`, \`user-info\`, \`set-user-name\`, and \`update-user-profile\`.

      This naming convention uses hyphens to separate words: \`kebab-case\`, \`kebab-case-pattern\`, and \`this-is-kebab-case\`.",
            "startLine": 1,
          },
          {
            "cleanedSnippet": "Mixed Notations
      The same data can be accessed using different notations:
      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`
      Choose the notation that best fits your language and framework conventions.",
            "filename": "dot.notation.test.md",
            "score": 1.7568805,
            "sectionSlug": "mixed-notations",
            "snippet": "## Mixed Notations

      The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Mixed Cases
      In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and languag",
            "filename": "camelCase-test.md",
            "score": 1.6868129,
            "sectionSlug": "mixed-cases",
            "snippet": "## Mixed Cases

      In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and languag",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "CamelCase Patterns
      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the",
            "filename": "camelCase-test.md",
            "score": 1.5816791,
            "sectionSlug": "camelcase-patterns",
            "snippet": "# CamelCase Patterns

      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the",
            "startLine": 1,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Multi-word Phrases
      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "score": 4.24833,
            "sectionSlug": "multi-word-phrases",
            "snippet": "## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": 11,
          },
          {
            "cleanedSnippet": "Common Technical Phrases
      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "filename": "exact-phrases.md",
            "score": 1.7568805,
            "sectionSlug": "common-technical-phrases",
            "snippet": "## Common Technical Phrases

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "startLine": 3,
          },
          {
            "cleanedSnippet": "Email Addresses
      Contact information might include email addresses such as  user@example.com  or  admin@test.org .",
            "filename": "special_chars_test.md",
            "score": 2.1793365,
            "sectionSlug": "email-addresses",
            "snippet": "## Email Addresses

      Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Array and Object Access
      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "filename": "special_chars_test.md",
            "score": 1.7568805,
            "sectionSlug": "array-and-object-access",
            "snippet": "## Array and Object Access

      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "startLine": 17,
          },
          {
            "cleanedSnippet": "Mixed Notations
      The same data can be accessed using different notations:
      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`
      Choose the notation that best fits your language and framework conventions.",
            "filename": "dot.notation.test.md",
            "score": 1.7568805,
            "sectionSlug": "mixed-notations",
            "snippet": "## Mixed Notations

      The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.",
            "startLine": 7,
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
    expect(text).toMatchInlineSnapshot(`
      "### Multi-word Phrases

      [exact-phrases.md:11](/v1/datasets/search-research-1753820400000/files/exact-phrases.md?start=11)

      ## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.

      ---

      ### Common Technical Phrases

      [exact-phrases.md:3](/v1/datasets/search-research-1753820400000/files/exact-phrases.md?start=3)

      ## Common Technical Phrases

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.

      ---

      ### Email Addresses

      [special_chars_test.md:7](/v1/datasets/search-research-1753820400000/files/special_chars_test.md?start=7)

      ## Email Addresses

      Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.

      ---

      ### Array and Object Access

      [special_chars_test.md:17](/v1/datasets/search-research-1753820400000/files/special_chars_test.md?start=17)

      ## Array and Object Access

      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`

      ---

      ### Mixed Notations

      [dot.notation.test.md:7](/v1/datasets/search-research-1753820400000/files/dot.notation.test.md?start=7)

      ## Mixed Notations

      The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.
      "
    `);
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Multi-word Phrases
      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "score": 1.6999347,
            "sectionSlug": "multi-word-phrases",
            "snippet": "## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": 11,
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Multi-word Phrases
      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "score": 4.162021,
            "sectionSlug": "multi-word-phrases",
            "snippet": "## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": 11,
          },
          {
            "cleanedSnippet": "Common Technical Phrases
      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "filename": "exact-phrases.md",
            "score": 1.7211877,
            "sectionSlug": "common-technical-phrases",
            "snippet": "## Common Technical Phrases

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "startLine": 3,
          },
          {
            "cleanedSnippet": "Email Addresses
      Contact information might include email addresses such as  user@example.com  or  admin@test.org .",
            "filename": "special_chars_test.md",
            "score": 2.135061,
            "sectionSlug": "email-addresses",
            "snippet": "## Email Addresses

      Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "Array and Object Access
      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "filename": "special_chars_test.md",
            "score": 1.7211877,
            "sectionSlug": "array-and-object-access",
            "snippet": "## Array and Object Access

      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "startLine": 17,
          },
          {
            "cleanedSnippet": "Mixed Notations
      The same data can be accessed using different notations:
      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`
      Choose the notation that best fits your language and framework conventions.",
            "filename": "dot.notation.test.md",
            "score": 1.7211877,
            "sectionSlug": "mixed-notations",
            "snippet": "## Mixed Notations

      The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.",
            "startLine": 7,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Mixed Cases
      In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and languag",
            "filename": "camelCase-test.md",
            "score": 1.7225336,
            "sectionSlug": "mixed-cases",
            "snippet": "## Mixed Cases

      In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and languag",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "CamelCase Patterns
      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the",
            "filename": "camelCase-test.md",
            "score": 1.6151735,
            "sectionSlug": "camelcase-patterns",
            "snippet": "# CamelCase Patterns

      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the",
            "startLine": 1,
          },
          {
            "cleanedSnippet": "Mixed Patterns
      In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "score": 1.7225336,
            "sectionSlug": "mixed-patterns",
            "snippet": "## Mixed Patterns

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": 7,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Array and Object Access
      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "filename": "special_chars_test.md",
            "score": 4.41263,
            "sectionSlug": "array-and-object-access",
            "snippet": "## Array and Object Access

      JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "startLine": 17,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "URLs and Paths
      Web URLs:  http://example.com  and  https://test.org
      File paths vary by OS:
      - Windows: \`C:\\Windows\\System32\`
      - Unix: \`/usr/local/bin\`",
            "filename": "special_chars_test.md",
            "score": 4.0139623,
            "sectionSlug": "urls-and-paths",
            "snippet": "## URLs and Paths

      Web URLs: \`http://example.com\` and \`https://test.org\`

      File paths vary by OS:
      - Windows: \`C:\\Windows\\System32\`
      - Unix: \`/usr/local/bin\`",
            "startLine": 31,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "URLs and Paths
      Web URLs:  http://example.com  and  https://test.org
      File paths vary by OS:
      - Windows: \`C:\\Windows\\System32\`
      - Unix: \`/usr/local/bin\`",
            "filename": "special_chars_test.md",
            "score": 2.0494819,
            "sectionSlug": "urls-and-paths",
            "snippet": "## URLs and Paths

      Web URLs: \`http://example.com\` and \`https://test.org\`

      File paths vary by OS:
      - Windows: \`C:\\Windows\\System32\`
      - Unix: \`/usr/local/bin\`",
            "startLine": 31,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "URLs and Paths
      Web URLs:  http://example.com  and  https://test.org
      File paths vary by OS:
      - Windows: \`C:\\Windows\\System32\`
      - Unix: \`/usr/local/bin\`",
            "filename": "special_chars_test.md",
            "score": 4.0139623,
            "sectionSlug": "urls-and-paths",
            "snippet": "## URLs and Paths

      Web URLs: \`http://example.com\` and \`https://test.org\`

      File paths vary by OS:
      - Windows: \`C:\\Windows\\System32\`
      - Unix: \`/usr/local/bin\`",
            "startLine": 31,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Code Examples
      Here's how to use backticks for  code blocks  and  inline code  in markdown.
      Template literals use  $variable  or  \${template}  syntax.",
            "filename": "special_chars_test.md",
            "score": 2.08242,
            "sectionSlug": "code-examples",
            "snippet": "## Code Examples

      Here's how to use backticks for \`code blocks\` and \`inline code\` in markdown.

      Template literals use \`$variable\` or \`\${template}\` syntax.",
            "startLine": 11,
          },
          {
            "cleanedSnippet": "CamelCase Patterns
      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the",
            "filename": "camelCase-test.md",
            "score": 1.6151735,
            "sectionSlug": "camelcase-patterns",
            "snippet": "# CamelCase Patterns

      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the",
            "startLine": 1,
          },
        ],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [],
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Mixed Cases
      In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and languag",
            "filename": "camelCase-test.md",
            "score": 1.9418484,
            "sectionSlug": "mixed-cases",
            "snippet": "## Mixed Cases

      In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and languag",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "CamelCase Patterns
      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the",
            "filename": "camelCase-test.md",
            "score": 1.820819,
            "sectionSlug": "camelcase-patterns",
            "snippet": "# CamelCase Patterns

      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the",
            "startLine": 1,
          },
          {
            "cleanedSnippet": "Mixed Patterns
      In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "score": 1.9418484,
            "sectionSlug": "mixed-patterns",
            "snippet": "## Mixed Patterns

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": 7,
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Multi-word Phrases
      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "score": 1.6999347,
            "sectionSlug": "multi-word-phrases",
            "snippet": "## Multi-word Phrases

      Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": 11,
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [],
      }
    `);
  });

  test('configurable snippet length - shorter', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getUserData&snippetLength=100`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    // Note: SQLite snippet function may return longer snippets than requested
    expect(data).toMatchInlineSnapshot(`
      {
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Mixed Cases
      In real-world code, you might encounter different variations:
      - Function calls: \`ge",
            "filename": "camelCase-test.md",
            "score": 1.7225336,
            "sectionSlug": "mixed-cases",
            "snippet": "## Mixed Cases

      In real-world code, you might encounter different variations:

      - Function calls: \`ge",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "CamelCase Patterns
      When working with JavaScript and TypeScript, we often use camelCase naming con",
            "filename": "camelCase-test.md",
            "score": 1.6151735,
            "sectionSlug": "camelcase-patterns",
            "snippet": "# CamelCase Patterns

      When working with JavaScript and TypeScript, we often use camelCase naming con",
            "startLine": 1,
          },
          {
            "cleanedSnippet": "Mixed Patterns
      In projects, you often see multiple naming conventions side by side:
      - Kebab cas",
            "filename": "kebab-case-test.md",
            "score": 1.7225336,
            "sectionSlug": "mixed-patterns",
            "snippet": "## Mixed Patterns

      In projects, you often see multiple naming conventions side by side:

      - Kebab cas",
            "startLine": 7,
          },
        ],
      }
    `);
  });

  test('configurable snippet length - maximum', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=getUserData&snippetLength=500`,
      { headers: authHeaders }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toMatchInlineSnapshot(`
      {
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Mixed Cases
      In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and language conventions.",
            "filename": "camelCase-test.md",
            "score": 1.7225336,
            "sectionSlug": "mixed-cases",
            "snippet": "## Mixed Cases

      In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.",
            "startLine": 7,
          },
          {
            "cleanedSnippet": "CamelCase Patterns
      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like  camelCase ,  camelCasePattern , and  thisIsCamelCase  follow this convention.",
            "filename": "camelCase-test.md",
            "score": 1.6151735,
            "sectionSlug": "camelcase-patterns",
            "snippet": "# CamelCase Patterns

      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.",
            "startLine": 1,
          },
          {
            "cleanedSnippet": "Mixed Patterns
      In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "score": 1.7225336,
            "sectionSlug": "mixed-patterns",
            "snippet": "## Mixed Patterns

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": 7,
          },
        ],
      }
    `);
  });
});