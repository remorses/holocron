# File Tree

├── api
│   ├── index.mdx
│   ├── products.mdx
│   └── users.mdx
├── guides
│   ├── authentication.mdx
│   └── error-handling.mdx
└── README.md


==================================================
FILE: api/index.mdx
==================================================
---
title: 'API Reference'
description: 'Overview of available API endpoints for users and products.'
icon: 'server'
---

# API Reference

Explore the available REST endpoints grouped by resource:

- [Users](/api/users)
- [Products](/api/products)

<Tip>
Authenticate all requests using a Bearer token in the `Authorization` header. See [Authentication](/guides/authentication).
</Tip>



==================================================
FILE: api/products.mdx
==================================================
---
title: 'Products API'
description: 'Manage products: list, retrieve, create, update, and delete.'
icon: 'box'
---

# Products API

## List Products

GET `/api/products`

Query Parameters:
- `category` (string) – filter by category
- `inStock` (boolean) – filter stock

<CodeGroup>
```bash curl
curl -X GET 'https://api.example.com/api/products?inStock=true' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
```javascript Node.js
const res = await fetch('/api/products?inStock=true', {
  headers: { Authorization: `Bearer ${token}` }
});
const list = await res.json();
```
</CodeGroup>

## Get Product

GET `/api/products/{id}`

Path Parameters:
- `id` (string) – product ID

<CodeGroup>
```bash curl
curl -X GET 'https://api.example.com/api/products/456' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
```python Python
import requests
resp = requests.get(
  'https://api.example.com/api/products/456',
  headers={'Authorization': 'Bearer YOUR_TOKEN'}
)
product = resp.json()
```
</CodeGroup>

## Create Product

POST `/api/products`

Body (JSON):
- `name` (string)
- `price` (number)
- `category` (string)

<CodeGroup>
```bash curl
curl -X POST 'https://api.example.com/api/products' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"name":"Gadget","price":99.99,"category":"tech"}'
```
```javascript Node.js
const res = await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ name: 'Gadget', price: 99.99, category: 'tech' })
});
const newProd = await res.json();
```
</CodeGroup>

## Update Product

PUT `/api/products/{id}`

Body (JSON): any of:
- `name` (string)
- `price` (number)
- `category` (string)

<CodeGroup>
```bash curl
curl -X PUT 'https://api.example.com/api/products/456' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"price":79.99}'
```
```javascript Node.js
await fetch(`/api/products/${id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ price: 79.99 })
});
```
</CodeGroup>

## Delete Product

DELETE `/api/products/{id}`

<CodeGroup>
```bash curl
curl -X DELETE 'https://api.example.com/api/products/456' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
```javascript Node.js
await fetch(`/api/products/${id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` }
});
```
</CodeGroup>



==================================================
FILE: api/users.mdx
==================================================
---
title: 'Users API'
description: 'Manage users: list, retrieve, create, update, and delete.'
icon: 'users'
---

# Users API

## List Users

GET `/api/users`

Query Parameters:
- `page` (integer) – page number
- `limit` (integer) – items per page

<CodeGroup>
```bash curl
curl -X GET 'https://api.example.com/api/users?page=1&limit=20' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
```javascript Node.js
const res = await fetch('/api/users?page=1&limit=20', {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
```
</CodeGroup>

## Get User

GET `/api/users/{id}`

Path Parameters:
- `id` (string) – user ID

<CodeGroup>
```bash curl
curl -X GET 'https://api.example.com/api/users/123' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
```python Python
import requests
resp = requests.get(
  'https://api.example.com/api/users/123',
  headers={'Authorization': 'Bearer YOUR_TOKEN'}
)
user = resp.json()
```
</CodeGroup>

## Create User

POST `/api/users`

Body (JSON):
- `name` (string)
- `email` (string)

<CodeGroup>
```bash curl
curl -X POST 'https://api.example.com/api/users' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"name":"Jane Doe","email":"jane@example.com"}'
```
```javascript Node.js
const res = await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' })
});
const newUser = await res.json();
```
</CodeGroup>

## Update User

PUT `/api/users/{id}`

Body (JSON): any of:
- `name` (string)
- `email` (string)

<CodeGroup>
```bash curl
curl -X PUT 'https://api.example.com/api/users/123' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"email":"jane.new@example.com"}'
```
```javascript Node.js
await fetch(`/api/users/${id}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ email: 'jane.new@example.com' })
});
```
</CodeGroup>

## Delete User

DELETE `/api/users/{id}`

<CodeGroup>
```bash curl
curl -X DELETE 'https://api.example.com/api/users/123' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```
```javascript Node.js
await fetch(`/api/users/${id}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` }
});
```
</CodeGroup>



==================================================
FILE: guides/authentication.mdx
==================================================
---
title: 'Authentication'
description: 'How to authenticate API requests.'
icon: 'lock'
---

# Authentication

All API requests require a Bearer token in the `Authorization` header.

## Obtain Token

Generate or retrieve your API key from the dashboard.

## Example

```
Authorization: Bearer YOUR_API_KEY
```

<CodeGroup>
```bash curl
curl -H 'Authorization: Bearer YOUR_API_KEY' \
  https://api.example.com/api/users
```
```javascript Node.js
await fetch('/api/users', {
  headers: { Authorization: `Bearer ${token}` }
});
```
</CodeGroup>

<Note>
Keep your API key secure. Do not commit it to source control.
</Note>



==================================================
FILE: guides/error-handling.mdx
==================================================
---
title: 'Error Handling'
description: 'Common error responses and troubleshooting.'
---

# Error Handling

APIs return standard HTTP status codes and JSON error bodies.

| Status | Code                   | Description                    |
| ------ | ---------------------- | ------------------------------ |
| 400    | BAD_REQUEST            | Invalid input data             |
| 401    | UNAUTHORIZED           | Missing or invalid token       |
| 404    | NOT_FOUND              | Resource not found             |
| 500    | INTERNAL_SERVER_ERROR  | Unexpected server error        |

## Error Response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "status": 404
  }
}
```

<AccordionGroup>
<Accordion title="Handling 401 Unauthorized">
Check your token and its permissions. Refresh or generate a new key.
</Accordion>
<Accordion title="Handling 404 Not Found">
Verify the resource ID and correct endpoint path.
</Accordion>
<Accordion title="Retry on 500 Errors">
Implement exponential backoff when retrying server errors.
</Accordion>
</AccordionGroup>



==================================================
FILE: README.md
==================================================
# Fumabase API Documentation

This documentation provides details for the Users and Products REST APIs.

## Development

1. Install Fumabase CLI

```
npm i -g fumabase
```

2. Start local server

```
fumabase dev
```