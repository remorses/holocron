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
  // Use git commit SHA for consistent dataset ID
  const TEST_DATASET_ID = `search-research-${process.env.GITHUB_SHA || '2e26fe2'}`;
  let uploadedFiles: string[] = [];

  beforeAll(async () => {
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
            "cleanedSnippet": "In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -1.2769059546177988,
            "section": "Mixed Patterns",
            "sectionSlug": "mixed-patterns",
            "snippet": "In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and language conventions.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.2353847252625032,
            "section": "Mixed Cases",
            "sectionSlug": "mixed-cases",
            "snippet": "In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like  camelCase ,  camelCasePattern , and  thisIsCamelCase  follow this convention.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.171874847916563,
            "section": "CamelCase Patterns",
            "sectionSlug": "camelcase-patterns",
            "snippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.",
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
    expect(text).toMatchInlineSnapshot(`
      "### Mixed Patterns

      [kebab-case-test.md:1](/v1/datasets/search-research-2e26fe2/files/kebab-case-test.md#mixed-patterns)

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.

      ---

      ### Mixed Cases

      [camelCase-test.md:1](/v1/datasets/search-research-2e26fe2/files/camelCase-test.md#mixed-cases)

      In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.

      ---

      ### CamelCase Patterns

      [camelCase-test.md:1](/v1/datasets/search-research-2e26fe2/files/camelCase-test.md#camelcase-patterns)

      When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.
      "
    `);
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
            "cleanedSnippet": "The same data can be accessed using different notations:
      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`
      Choose the notation that best fits your language and framework conventions.",
            "filename": "dot.notation.test.md",
            "metadata": null,
            "score": -1.323551828046987,
            "section": "Mixed Notations",
            "sectionSlug": "mixed-notations",
            "snippet": "The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "In JavaScript and many other languages, dot notation is used for property access. Common patterns include  user.data ,  user.info ,  config.settings , and  profile.update .
      You can chain property access for nested objects:  object.property  or even deeper nesting like  nested.object.property .",
            "filename": "dot.notation.test.md",
            "metadata": null,
            "score": -0.7219841425932825,
            "section": "Dot Notation Patterns",
            "sectionSlug": "dot-notation-patterns",
            "snippet": "In JavaScript and many other languages, dot notation is used for property access. Common patterns include \`user.data\`, \`user.info\`, \`config.settings\`, and \`profile.update\`.

      You can chain property access for nested objects: \`object.property\` or even deeper nesting like \`nested.object.property\`.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -1.2985616886363094,
            "section": "Mixed Patterns",
            "sectionSlug": "mixed-patterns",
            "snippet": "In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "Kebab-case is commonly used in URLs, CSS classes, and CLI commands. Examples include  user-data ,  user-info ,  set-user-name , and  update-user-profile .
      This naming convention uses hyphens to separate words:  kebab-case ,  kebab-case-pattern , and  this-is-kebab-case .",
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -0.7219841425932825,
            "section": "Kebab Case Patterns",
            "sectionSlug": "kebab-case-patterns",
            "snippet": "Kebab-case is commonly used in URLs, CSS classes, and CLI commands. Examples include \`user-data\`, \`user-info\`, \`set-user-name\`, and \`update-user-profile\`.

      This naming convention uses hyphens to separate words: \`kebab-case\`, \`kebab-case-pattern\`, and \`this-is-kebab-case\`.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -0.7973135314512333,
            "section": "Multi-word Phrases",
            "sectionSlug": "multi-word-phrases",
            "snippet": "Here are some common multi-word technical phrases:

      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
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
            "cleanedSnippet": ""User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -2.467474297326108,
            "section": "Common Technical Phrases",
            "sectionSlug": "common-technical-phrases",
            "snippet": ""User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
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
    expect(text).toMatchInlineSnapshot(`
      "### Common Technical Phrases

      [exact-phrases.md:1](/v1/datasets/search-research-2e26fe2/files/exact-phrases.md#common-technical-phrases)

      "User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.
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
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
          },
        },
        "count": 2,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "cleanedSnippet": "Contact information might include email addresses such as  user@example.com  or  admin@test.org .",
            "filename": "special_chars_test.md",
            "metadata": null,
            "score": -0.24426339055549692,
            "section": "Email Addresses",
            "sectionSlug": "email-addresses",
            "snippet": "Contact information might include email addresses such as \`user@example.com\` or \`admin@test.org\`.",
            "startLine": null,
          },
          {
            "cleanedSnippet": ""User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -0.21223273710722873,
            "section": "Common Technical Phrases",
            "sectionSlug": "common-technical-phrases",
            "snippet": ""User authentication" is a common phrase in security documentation. Similarly, "database connection" requires configuration in most applications. Proper "error handling" should be robust and comprehensive.",
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
    expect(text).toMatchInlineSnapshot(`
      "### Mixed Notations

      [dot.notation.test.md:1](/v1/datasets/search-research-2e26fe2/files/dot.notation.test.md#mixed-notations)

      The same data can be accessed using different notations:

      - Dot notation: \`user.data\`
      - Kebab case: \`user-data\`
      - Camel case: \`userData\`
      - Snake case: \`user_data\`

      Choose the notation that best fits your language and framework conventions.

      ---

      ### Dot Notation Patterns

      [dot.notation.test.md:1](/v1/datasets/search-research-2e26fe2/files/dot.notation.test.md#dot-notation-patterns)

      In JavaScript and many other languages, dot notation is used for property access. Common patterns include \`user.data\`, \`user.info\`, \`config.settings\`, and \`profile.update\`.

      You can chain property access for nested objects: \`object.property\` or even deeper nesting like \`nested.object.property\`.

      ---

      ### Mixed Patterns

      [kebab-case-test.md:1](/v1/datasets/search-research-2e26fe2/files/kebab-case-test.md#mixed-patterns)

      In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.

      ---

      ### Kebab Case Patterns

      [kebab-case-test.md:1](/v1/datasets/search-research-2e26fe2/files/kebab-case-test.md#kebab-case-patterns)

      Kebab-case is commonly used in URLs, CSS classes, and CLI commands. Examples include \`user-data\`, \`user-info\`, \`set-user-name\`, and \`update-user-profile\`.

      This naming convention uses hyphens to separate words: \`kebab-case\`, \`kebab-case-pattern\`, and \`this-is-kebab-case\`.

      ---

      ### Mixed Cases

      [camelCase-test.md:1](/v1/datasets/search-research-2e26fe2/files/camelCase-test.md#mixed-cases)

      In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.

      ---

      ### Multi-word Phrases

      [exact-phrases.md:1](/v1/datasets/search-research-2e26fe2/files/exact-phrases.md#multi-word-phrases)

      Here are some common multi-word technical phrases:

      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.
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
            "cleanedSnippet": "In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and language conventions.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.398563897382732,
            "section": "Mixed Cases",
            "sectionSlug": "mixed-cases",
            "snippet": "In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like  camelCase ,  camelCasePattern , and  thisIsCamelCase  follow this convention.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.0414712365394965,
            "section": "CamelCase Patterns",
            "sectionSlug": "camelcase-patterns",
            "snippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "filename": "special_chars_test.md",
            "metadata": null,
            "score": -0.9261562168328792,
            "section": "Array and Object Access",
            "sectionSlug": "array-and-object-access",
            "snippet": "JavaScript provides multiple ways to access data:

      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "startLine": null,
          },
          {
            "cleanedSnippet": "Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -0.7973135314512333,
            "section": "Multi-word Phrases",
            "sectionSlug": "multi-word-phrases",
            "snippet": "Here are some common multi-word technical phrases:

      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -0.7705158567427064,
            "section": "Mixed Patterns",
            "sectionSlug": "mixed-patterns",
            "snippet": "In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
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
            "cleanedSnippet": "In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -2.5538119092355975,
            "section": "Mixed Patterns",
            "sectionSlug": "mixed-patterns",
            "snippet": "In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and language conventions.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -2.4707694505250064,
            "section": "Mixed Cases",
            "sectionSlug": "mixed-cases",
            "snippet": "In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like  camelCase ,  camelCasePattern , and  thisIsCamelCase  follow this convention.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -2.343749695833126,
            "section": "CamelCase Patterns",
            "sectionSlug": "camelcase-patterns",
            "snippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.",
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
            "cleanedSnippet": "In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and language conventions.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.7938463133948674,
            "section": "Mixed Cases",
            "sectionSlug": "mixed-cases",
            "snippet": "In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "JavaScript provides multiple ways to access data:
      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "filename": "special_chars_test.md",
            "metadata": null,
            "score": -1.5348345888423418,
            "section": "Array and Object Access",
            "sectionSlug": "array-and-object-access",
            "snippet": "JavaScript provides multiple ways to access data:

      - Array access: \`array[0]\`
      - Object bracket notation: \`object["key"]\`
      - Map methods: \`map.get("key")\`",
            "startLine": null,
          },
          {
            "cleanedSnippet": "Here are some common multi-word technical phrases:
      - To retrieve information: "get user data"
      - For modifications: "update user profile"
      - For deletions: "delete user account"
      Each of these phrases represents a specific action in our API.",
            "filename": "exact-phrases.md",
            "metadata": null,
            "score": -1.3213153072687398,
            "section": "Multi-word Phrases",
            "sectionSlug": "multi-word-phrases",
            "snippet": "Here are some common multi-word technical phrases:

      - To retrieve information: "get user data"
      - For modifications: "update user profile"  
      - For deletions: "delete user account"

      Each of these phrases represents a specific action in our API.",
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
            "cleanedSnippet": "In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -1.2769059546177988,
            "section": "Mixed Patterns",
            "sectionSlug": "mixed-patterns",
            "snippet": "In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and language conventions.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.2353847252625032,
            "section": "Mixed Cases",
            "sectionSlug": "mixed-cases",
            "snippet": "In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like  camelCase ,  camelCasePattern , and  thisIsCamelCase  follow this convention.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.171874847916563,
            "section": "CamelCase Patterns",
            "sectionSlug": "camelcase-patterns",
            "snippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.",
            "startLine": null,
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
            "cleanedSnippet": "In projects, you often see multiple naming conventions side by side:
      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`
      Understanding when to use each pattern is important for maintaining consistent code.",
            "filename": "kebab-case-test.md",
            "metadata": null,
            "score": -1.2769059546177988,
            "section": "Mixed Patterns",
            "sectionSlug": "mixed-patterns",
            "snippet": "In projects, you often see multiple naming conventions side by side:

      - Kebab case: \`user-data\`
      - Camel case: \`getUserData\`  
      - Dot notation: \`user.data\`
      - Snake case: \`user_data\`

      Understanding when to use each pattern is important for maintaining consistent code.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "In real-world code, you might encounter different variations:
      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`
      Each style has its use cases depending on the context and language conventions.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.2353847252625032,
            "section": "Mixed Cases",
            "sectionSlug": "mixed-cases",
            "snippet": "In real-world code, you might encounter different variations:

      - Function calls: \`getUserData()\`
      - Method access: \`user.getData\`
      - Alternative styles: \`user-get-data\` (kebab-case)
      - Snake case variant: \`user_get_data\`

      Each style has its use cases depending on the context and language conventions.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like  getUserData  and  getUserInfo  are common patterns. Other examples include  setUserName  and  updateUserProfile .
      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like  camelCase ,  camelCasePattern , and  thisIsCamelCase  follow this convention.",
            "filename": "camelCase-test.md",
            "metadata": null,
            "score": -1.171874847916563,
            "section": "CamelCase Patterns",
            "sectionSlug": "camelcase-patterns",
            "snippet": "When working with JavaScript and TypeScript, we often use camelCase naming conventions. For example, functions like \`getUserData\` and \`getUserInfo\` are common patterns. Other examples include \`setUserName\` and \`updateUserProfile\`.

      The camelCase pattern is widely adopted in the JavaScript ecosystem. Variables like \`camelCase\`, \`camelCasePattern\`, and \`thisIsCamelCase\` follow this convention.",
            "startLine": null,
          },
        ],
      }
    `);
  });
});