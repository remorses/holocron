# FTS5 Search Behavior Notes

Based on the search tests in `src/search.test.ts`, here's what we learned about how SQLite FTS5 with porter tokenizer behaves:

## Key Findings

### 1. Only Markdown Files Are Indexed
- TypeScript files (`.ts`) are NOT parsed into sections and indexed
- Only `.md` and `.mdx` files are processed by the markdown parser
- This means code searches won't find content in TypeScript files

### 2. Tokenization Rules
The porter tokenizer treats the following as word separators:
- **Hyphens (`-`)**: `user-data` → `user` AND `data`
- **Dots (`.`)**: `user.data` → `user` AND `data`
- **Underscores (`_`)**: `user_data` → `user` AND `data`
- **Special chars (`@`, `/`, `:`)**: `@cloudflare/workers` → `cloudflare` AND `workers`

### 3. Search Features That Work

#### Exact Phrase Search
```
"Durable Object" - finds exact phrase matches
"full-text search" - respects phrase boundaries
```

#### Boolean Operators
```
SQLite OR sqlite - finds documents with either term
file NOT test - excludes documents containing "test"
jwt token - implicit AND operation
```

#### Stemming
Porter stemmer reduces words to root forms:
- `parsing` matches `parse`, `parsed`, `parser`
- `stores` matches `store`, `storing`, `stored`

#### Prefix Matching
```
upsert* - matches words starting with "upsert"
```

### 4. Search Features With Limitations

#### NEAR Operator
- Syntax is supported but often returns no results
- Proximity search seems very strict

#### Case Sensitivity
- Searches are case-insensitive by default
- `SQLite` and `sqlite` return the same results

### 5. Best Practices for Searchable Content

1. **Use Markdown files** for documentation that needs to be searchable
2. **Avoid special characters** in key terms you want to search for
3. **Use spaces** instead of hyphens/dots for multi-word concepts if exact matching is important
4. **Leverage exact phrases** with quotes when you need precise matches
5. **Consider stemming** - use root forms of words in queries

### 6. Scoring
- Results are ordered by BM25 score (relevance)
- Negative scores are normal (closer to 0 = more relevant)
- Multiple matches in a section increase relevance

## Example Search Patterns

```javascript
// Good patterns that work well:
"exact phrase"          // Exact phrase matching
word1 OR word2         // Either term
word1 word2            // Both terms (AND)
word NOT excluded      // Exclusion
prefix*                // Prefix matching

// Patterns that need adjustment:
user-data              // Becomes: user data
user.property          // Becomes: user property
@scope/package         // Becomes: scope package
snake_case_term        // Becomes: snake case term
```

## Testing Search Features

The test file demonstrates various search scenarios:
- Exact phrase matching with quotes
- Boolean operators (OR, NOT, implicit AND)
- Stemming behavior
- Special character handling
- Prefix matching with wildcards
- Result limiting with maxChunksPerFile

These tests serve as both validation and documentation of the search behavior.