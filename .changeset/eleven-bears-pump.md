---
'eyecrest': patch
---

Make snippet length configurable via query parameter. The `snippetLength` parameter can now be set in search requests with a maximum of 500 characters and a default of 300. Also updated search tests to use proper markdown content instead of single-line word lists for more realistic testing.