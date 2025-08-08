# File Tree

├── api
│   ├── authentication.mdx
│   ├── errors.mdx
│   ├── products.mdx
│   └── users.mdx
├── index.mdx
├── quickstart.mdx
└── README.md


==================================================
FILE: api/authentication.mdx
==================================================
---
title: 'Authentication'
description: 'Authenticate requests using API keys.'
icon: 'key'
---

# Authentication

We use API keys to authenticate requests. Include your key in the Authorization header.

## Obtain API Key

Generate or find your API key in the user dashboard under **API Settings**.

## Authorization Header

All requests require the header:

```
Authorization: Bearer YOUR_API_KEY
```

## Example

<CodeGroup>
```bash curl
curl -X GET "https://api.example.com/v1/users" \
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"
```
```http
GET /v1/users HTTP/1.1
Host: api.example.com
Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc
```
</CodeGroup>


==================================================
FILE: api/errors.mdx
==================================================
---
title: 'Error Handling'
description: 'Standard error responses and status codes.'
icon: 'info'
---

# Error Handling

All error responses follow this JSON format:

```json
{
  "error": {
    "type": "invalid_request",
    "message": "Detailed error message"
  }
}
```

## HTTP Status Codes

- 400 Bad Request: Validation errors
- 401 Unauthorized: Missing or invalid API key
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource does not exist
- 500 Internal Server Error: Unexpected server error

## Example Error

```bash
curl -X GET "https://api.example.com/v1/users/nonexistent" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

> **Response** (404 Not Found)
```json
{
  "error": {
    "type": "not_found",
    "message": "User not found"
  }
}
```


==================================================
FILE: api/products.mdx
==================================================
---
title: 'Products'
description: 'Endpoints to create, retrieve, update, and delete products.'
icon: 'box'
---

# Products Endpoints

Base path: `/v1/products`

## List Products

```bash
curl -X GET "https://api.example.com/v1/products" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

> **Response** (200 OK)
```json
{
  "data": [
    { "id": "prod_1", "name": "Widget", "price": 9.99 }
  ],
  "has_more": false
}
```

## Create Product

```bash
curl -X POST "https://api.example.com/v1/products" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Gadget","price":19.99}'
```

> **Response** (201 Created)
```json
{
  "id": "prod_2",
  "name": "Gadget",
  "price": 19.99
}
```

## Retrieve Product

```bash
curl -X GET "https://api.example.com/v1/products/{id}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Update Product

```bash
curl -X PATCH "https://api.example.com/v1/products/{id}" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"price":29.99}'
```

## Delete Product

```bash
curl -X DELETE "https://api.example.com/v1/products/{id}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```


==================================================
FILE: api/users.mdx
==================================================
---
title: 'Users'
description: 'Endpoints to create, retrieve, update, and delete users.'
icon: 'users'
---

# Users Endpoints

Base path: `/v1/users`

## List Users

```bash
curl -X GET "https://api.example.com/v1/users" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

> **Response** (200 OK)
```json
{
  "data": [
    { "id": "user_1", "email": "user@example.com", "name": "Alice" }
  ],
  "has_more": false
}
```

## Create User

```bash
curl -X POST "https://api.example.com/v1/users" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","name":"Bob"}'
```

> **Response** (201 Created)
```json
{
  "id": "user_2",
  "email": "new@example.com",
  "name": "Bob"
}
```

## Retrieve User

```bash
curl -X GET "https://api.example.com/v1/users/{id}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Update User

```bash
curl -X PATCH "https://api.example.com/v1/users/{id}" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie"}'
```

## Delete User

```bash
curl -X DELETE "https://api.example.com/v1/users/{id}" \
  -H "Authorization: Bearer YOUR_API_KEY"
```


==================================================
FILE: index.mdx
==================================================
---
title: 'API Documentation'
description: 'Overview of available API endpoints for authentication, users, and products.'
icon: 'server'
---

# API Documentation

Welcome to the API reference. Explore our available endpoints below.

<CardGroup cols={3}>
<Card title="Authentication" icon="key" href="/api/authentication">
Learn how to authenticate requests.
</Card>
<Card title="Users" icon="users" href="/api/users">
Manage user accounts.
</Card>
<Card title="Products" icon="box" href="/api/products">
Manage product data.
</Card>
</CardGroup>


==================================================
FILE: quickstart.mdx
==================================================
---
title: 'Quickstart'
description: 'Get started with making your first API request.'
icon: 'rocket'
---

# Quickstart

## Prerequisites

- API Key (create one in your dashboard)
- HTTP client (curl, Postman, or any HTTP library)

## First Request

Use the following curl command to list users:

```bash
curl -X GET "https://api.example.com/v1/users" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

<Check>
You should receive a 200 response with a list of users.
</Check>


==================================================
FILE: README.md
==================================================
# API Documentation

This is the documentation for the API, including endpoints for authentication, users, and products.

## Development

1. Install Fumabase CLI: `npm i -g fumabase`
2. Start dev server: `fumabase dev`