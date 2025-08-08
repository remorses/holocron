# File Tree

├── index.mdx
└── quickstart.mdx


==================================================
FILE: index.mdx
==================================================
---
title: 'API Reference'
description: 'Comprehensive API documentation for Users and Products'
icon: 'book-open'
---

# API Reference

Welcome to the API documentation. Explore the Users and Products endpoints below.

- [Users](/api/users)
- [Products](/api/products)


==================================================
FILE: quickstart.mdx
==================================================
---
title: 'Quick Start'
description: 'Get started with the API'
icon: 'rocket'
---

# Quick Start

1. Obtain your API key from the dashboard.
2. Set the `API_KEY` environment variable:

```bash
export API_KEY=your_api_key_here
```

3. All requests use the base URL: `https://api.example.com`
4. Include the `Authorization` header:

```http
Authorization: Bearer YOUR_API_KEY
```