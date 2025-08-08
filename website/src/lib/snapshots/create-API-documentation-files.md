# File Tree

├── api
│   ├── authentication.mdx
│   ├── examples.mdx
│   ├── index.mdx
│   ├── products.mdx
│   └── users.mdx
└── README.md


==================================================
FILE: api/authentication.mdx
==================================================
---
title: 'Authentication'
description: 'How to authenticate with the API using API keys'
icon: 'key'
---

# Authentication

You authenticate requests using an API key sent in the Authorization header.

## Header

```http
Authorization: Bearer YOUR_API_KEY
```

## Obtaining an API key

Generate API keys from your dashboard. Keep them secret and rotate periodically.

## Example

```bash
curl -X GET 'https://api.example.com/v1/users' \
  -H 'Authorization: Bearer sk_test_1234567890' \
  -H 'Accept: application/json'
```

<Warning>
Never embed production API keys in client-side code or public repositories.
</Warning>




==================================================
FILE: api/examples.mdx
==================================================
---
title: 'Examples'
description: 'Code samples for Users and Products API'
icon: 'code'
---

# Examples

## Create user (Node.js)

```javascript
// create-user.js
import fetch from 'node-fetch';

const API_KEY = process.env.API_KEY;

async function createUser() {
  const res = await fetch('https://api.example.com/v1/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: 'new@example.com', name: 'New User' })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create user: ${res.status} ${err}`);
  }

  return res.json();
}

createUser().then(u => console.log(u)).catch(e => console.error(e));
```

## Create product (curl)

```bash
curl -X POST 'https://api.example.com/v1/products' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Blue Hoodie","price_cents":4999,"currency":"USD","available":true}'
```

## Error handling

- Check HTTP status codes.
- Read `error` field in JSON response for details.




==================================================
FILE: api/index.mdx
==================================================
---
title: 'API Reference'
description: 'Reference for Users and Products REST API'
icon: 'server'
---

# API Reference

Base URL: https://api.example.com/v1

This reference documents the Users and Products endpoints. Use the API Key authentication described in the Authentication page.

## Quick links

- [Authentication](/api/authentication)
- [Users endpoints](/api/users)
- [Products endpoints](/api/products)
- [Examples](/api/examples)

## Common headers

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Accept: application/json
```

## Rate limiting

- Standard plan: 60 requests/minute
- If you need higher limits contact support

<Tip>
Use idempotency keys with POST requests when retrying to avoid duplicate resources: `Idempotency-Key: <uuid>`
</Tip>





==================================================
FILE: api/products.mdx
==================================================
---
title: 'Products API'
description: 'Endpoints to manage product catalog'
icon: 'box'
---

# Products

Base path: /products

## Schema

```json
{
  "Product": {
    "id": "string",
    "name": "string",
    "description": "string",
    "price_cents": "integer",
    "currency": "string",
    "available": "boolean",
    "metadata": "object"
  }
}
```

## Endpoints

### GET /products

List products. Supports `limit`, `cursor`, and `available` filter.

```bash
curl -X GET 'https://api.example.com/v1/products?available=true&limit=20' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**Response (200)**

```json
{
  "object": "list",
  "data": [
    {"id":"prd_1","name":"T-shirt","price_cents":1999}
  ],
  "has_more": false
}
```

### GET /products/{id}

Retrieve product by id.

### POST /products

Create a new product.

Request body:

```json
{
  "name": "Blue Hoodie",
  "description": "Comfortable cotton hoodie",
  "price_cents": 4999,
  "currency": "USD",
  "available": true
}
```

**Response (201)** — created product object

### PUT /products/{id}

Update product fields.

### DELETE /products/{id}

Delete a product (soft-delete). Returns 204 on success.

**Errors**

- 400 Bad Request — invalid price or missing name
- 404 Not Found — product not found




==================================================
FILE: api/users.mdx
==================================================
---
title: 'Users API'
description: 'Endpoints to create, read, update, and delete users'
icon: 'users'
---

# Users

Base path: /users

## Schemas

```json
{
  "User": {
    "id": "string",
    "email": "string",
    "name": "string",
    "created_at": "integer",
    "metadata": "object"
  }
}
```

## Endpoints

### GET /users

List users.

- Query params: `limit` (int, default 20), `cursor` (string)

```bash
curl -X GET 'https://api.example.com/v1/users?limit=10' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**Response (200)**

```json
{
  "object": "list",
  "data": [
    {"id":"usr_1","email":"alice@example.com","name":"Alice"}
  ],
  "has_more": false
}
```

### GET /users/{id}

Fetch a single user by id.

```bash
curl -X GET 'https://api.example.com/v1/users/usr_1' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**Response (200)**

```json
{
  "id": "usr_1",
  "email": "alice@example.com",
  "name": "Alice",
  "created_at": 1690000000
}
```

**Errors**

- 404 Not Found — user does not exist

### POST /users

Create a new user.

Request body:

```json
{
  "email": "sarah@example.com",
  "name": "Sarah Chen",
  "metadata": {"source":"signup"}
}
```

```bash
curl -X POST 'https://api.example.com/v1/users' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"sarah@example.com","name":"Sarah"}'
```

**Response (201)**

```json
{
  "id": "usr_abcd1234",
  "email": "sarah@example.com",
  "name": "Sarah",
  "created_at": 1690001234
}
```

**Errors**

- 400 Bad Request — validation failed
- 409 Conflict — email already in use

### PUT /users/{id}

Update an existing user. Supply only fields to change.

```bash
curl -X PUT 'https://api.example.com/v1/users/usr_abcd1234' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sarah Chen"}'
```

**Response (200)** — updated user object

### DELETE /users/{id}

Delete a user (soft-delete).

```bash
curl -X DELETE 'https://api.example.com/v1/users/usr_abcd1234' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**Response (204)** — empty body




==================================================
FILE: README.md
==================================================
# API Documentation

This project contains API documentation for Users and Products endpoints.

See the API section: /api

To preview locally install the Fumabase CLI and run `fumabase dev` at the project root.