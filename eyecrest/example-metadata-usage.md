# Metadata Usage Example

The files table now supports an optional metadata field that can store arbitrary JSON data.

## API Usage

When uploading files, you can include metadata:

```json
PUT /v1/datasets/{datasetId}/files
{
  "files": [
    {
      "filename": "docs/api-guide.md",
      "content": "# API Guide\n\nContent here...",
      "metadata": {
        "author": "John Doe",
        "version": "1.0.0",
        "tags": ["api", "documentation"],
        "lastReviewed": "2024-01-15"
      }
    }
  ]
}
```

## Retrieving Files with Metadata

When fetching a file, the metadata is returned:

```json
GET /v1/datasets/{datasetId}/files/docs/api-guide.md

Response:
{
  "content": "# API Guide\n\nContent here...",
  "sha": "abc123...",
  "metadata": {
    "author": "John Doe",
    "version": "1.0.0",
    "tags": ["api", "documentation"],
    "lastReviewed": "2024-01-15"
  }
}
```

## Search Results with Metadata

Search results now include metadata from the source file:

```json
GET /v1/datasets/{datasetId}/search?query=api

Response:
{
  "results": [
    {
      "filename": "docs/api-guide.md",
      "section": "API Guide",
      "sectionSlug": "api-guide",
      "snippet": "API documentation...",
      "score": 1.5,
      "startLine": 1,
      "metadata": {
        "author": "John Doe",
        "version": "1.0.0",
        "tags": ["api", "documentation"],
        "lastReviewed": "2024-01-15"
      }
    }
  ],
  "count": 1,
  "page": 0,
  "perPage": 20
}
```