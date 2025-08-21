# File Tree

└── api
    ├── index.mdx
    ├── meta.json
    ├── products.mdx
    └── users.mdx


==================================================
FILE: api/index.mdx
==================================================
---
title: 'API Reference'
description: 'Complete API documentation for all endpoints including users, products, and authentication'
icon: 'code'
---

# API Reference

Welcome to the complete API documentation. Our RESTful API provides programmatic access to manage users, products, and other resources in your account.

## Quick Start

### 1. Get Your API Key

First, obtain your API key from the dashboard settings.

### 2. Make Your First API Call

Test your connection with a simple request to list users:

```bash
curl -X GET 'https://api.example.com/api/v1/users' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

### 3. Explore the API

Use the sidebar to navigate to specific endpoints:
- **Users API** - Manage user accounts and authentication
- **Products API** - Handle product catalog and inventory

## Authentication

All API requests require authentication using Bearer tokens. Include your API key in the Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

<Warning>
**Security Notice:** Keep your API keys secure. Never expose them in client-side code or public repositories.
</Warning>

## Base URL

All API endpoints are served from:

```
https://api.example.com/api/v1
```

## Rate Limits

API requests are subject to rate limits based on your subscription plan:

| Plan | Requests per minute |
|------|---------------------|
| Free | 100 |
| Pro | 1,000 |
| Enterprise | Custom |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627891234
```

## Response Format

All successful API responses return JSON data with a consistent structure:

```json
{
  "data": {
    // Response data varies by endpoint
  },
  "meta": {
    "request_id": "req_123456789",
    "timestamp": "2024-01-21T10:30:00Z"
  }
}
```

## Error Handling

Errors return appropriate HTTP status codes and detailed error messages:

```json
{
  "error": {
    "code": "resource_not_found",
    "message": "The requested resource was not found",
    "details": {
      "resource_id": "123",
      "resource_type": "user"
    }
  }
}
```

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

## Pagination

List endpoints support pagination using `limit` and `offset` parameters:

```bash
curl -X GET 'https://api.example.com/api/v1/users?limit=20&offset=40'
```

Paginated responses include:

```json
{
  "data": [...],
  "has_more": true,
  "total_count": 100,
  "next_offset": 60
}
```

## SDKs and Client Libraries

We provide official client libraries for popular programming languages:

### JavaScript/Node.js

```bash
npm install @example/api-client
```

```javascript
import { ExampleClient } from '@example/api-client';

const client = new ExampleClient('your-api-key');
const users = await client.users.list();
```

### Python

```bash
pip install example-api-client
```

```python
from example_api import ExampleClient

client = ExampleClient(api_key='your-api-key')
users = client.users.list()
```

### Ruby

```bash
gem install example-api-client
```

```ruby
require 'example_api'

client = ExampleApi::Client.new(api_key: 'your-api-key')
users = client.users.list
```

## Webhooks

Receive real-time notifications about events in your account. Configure webhooks in your dashboard settings.

### Supported Events

- `user.created` - New user registered
- `user.updated` - User information updated
- `user.deleted` - User account deleted
- `product.created` - New product added
- `product.updated` - Product information updated
- `product.deleted` - Product removed
- `order.created` - New order placed
- `order.updated` - Order status changed

### Webhook Payload Format

```json
{
  "event": "user.created",
  "data": {
    "id": "user_123456789",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "created_at": "2024-01-21T10:30:00Z"
}
```

## Getting Help

### Documentation
- API Guides - Step-by-step tutorials (coming soon)
- API Reference - Complete endpoint documentation
- FAQ - Common questions and answers (coming soon)

### Support
- Community Forum - Get help from other developers
- Issue Tracker - Report bugs and request features
- Support Email - Contact our support team

### Status
- Status Page - Check API availability and performance
- API Analytics - Monitor your API usage

## Changelog

Stay updated with API changes and new features:

### Recent Updates

**v1.2.0** (2024-01-15)
- Added bulk operations for users and products
- Improved error messages with more context
- Enhanced rate limiting with better headers

**v1.1.0** (2024-01-01)
- Added webhook support for real-time notifications
- Introduced pagination for all list endpoints
- Improved documentation with more examples

<Info>
Subscribe to our API changelog RSS feed to receive updates about new features and changes.
</Info>

## API Stability

Our API follows semantic versioning. The current version (v1) is stable and backward-compatible. We will provide advance notice for any breaking changes in future major versions.

<Check>
Ready to start building? Check out the specific API sections in the sidebar to explore detailed endpoint documentation.
</Check>


==================================================
FILE: api/meta.json
==================================================
{
  "title": "API Documentation",
  "icon": "code",
  "pages": ["index", "users", "products"],
  "defaultOpen": true
}


==================================================
FILE: api/products.mdx
==================================================
---
title: 'Products API'
description: 'Complete API documentation for product management and catalog operations'
icon: 'package'
---

# Products API

Manage your product catalog, inventory, and product-related operations through our RESTful API endpoints.

## Authentication

All API requests require authentication using Bearer tokens. Include your API key in the Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

<Info>
Products API supports both read and write operations for managing your product catalog.
</Info>

## Endpoints

### List Products

Retrieve a paginated list of products in your catalog.

```http
GET /api/v1/products
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Number of products to return (default: 20, max: 100) |
| `offset` | integer | No | Number of products to skip for pagination |
| `category` | string | No | Filter products by category |
| `status` | string | No | Filter by product status: `active`, `draft`, `archived` |
| `price_min` | number | No | Minimum price filter |
| `price_max` | number | No | Maximum price filter |
| `in_stock` | boolean | No | Filter by inventory availability |

#### Example Request

```bash
curl -X GET 'https://api.example.com/api/v1/products?limit=10&category=electronics&in_stock=true' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

#### Response

```json
{
  "data": [
    {
      "id": "prod_123456789",
      "name": "Wireless Headphones",
      "description": "Premium wireless headphones with noise cancellation",
      "price": 199.99,
      "currency": "USD",
      "category": "electronics",
      "sku": "WH-1000XM4",
      "stock_quantity": 45,
      "in_stock": true,
      "images": [
        "https://example.com/images/headphones-1.jpg",
        "https://example.com/images/headphones-2.jpg"
      ],
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-18T09:15:00Z"
    }
  ],
  "has_more": true,
  "total_count": 125
}
```

### Get Product

Retrieve detailed information about a specific product.

```http
GET /api/v1/products/{product_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | string | Yes | Unique identifier for the product |

#### Example Request

```bash
curl -X GET 'https://api.example.com/api/v1/products/prod_123456789' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

#### Response

```json
{
  "id": "prod_123456789",
  "name": "Wireless Headphones",
  "description": "Premium wireless headphones with active noise cancellation and 30-hour battery life",
  "price": 199.99,
  "currency": "USD",
  "compare_at_price": 249.99,
  "cost_price": 120.00,
  "category": "electronics",
  "sku": "WH-1000XM4",
  "barcode": "1234567890123",
  "weight": 0.254,
  "weight_unit": "kg",
  "dimensions": {
    "length": 18.5,
    "width": 17.0,
    "height": 7.8,
    "unit": "cm"
  },
  "stock_quantity": 45,
  "in_stock": true,
  "low_stock_threshold": 10,
  "images": [
    {
      "url": "https://example.com/images/headphones-1.jpg",
      "alt": "Wireless Headphones Front View",
      "position": 1
    },
    {
      "url": "https://example.com/images/headphones-2.jpg",
      "alt": "Wireless Headphones Side View",
      "position": 2
    }
  ],
  "variants": [
    {
      "id": "var_123",
      "name": "Black",
      "sku": "WH-1000XM4-BK",
      "price": 199.99,
      "stock_quantity": 25
    },
    {
      "id": "var_124",
      "name": "Silver",
      "sku": "WH-1000XM4-SL",
      "price": 199.99,
      "stock_quantity": 20
    }
  ],
  "status": "active",
  "tags": ["wireless", "headphones", "audio", "premium"],
  "metadata": {
    "manufacturer": "Sony",
    "warranty": "2 years",
    "color_options": ["black", "silver"]
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-18T09:15:00Z"
}
```

### Create Product

Create a new product in your catalog.

```http
POST /api/v1/products
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Product name |
| `description` | string | No | Product description |
| `price` | number | Yes | Product price |
| `currency` | string | No | Currency code (default: USD) |
| `category` | string | No | Product category |
| `sku` | string | No | Stock keeping unit |
| `stock_quantity` | integer | No | Initial stock quantity |
| `images` | array | No | Array of image URLs |
| `status` | string | No | Product status: `active`, `draft` (default: draft) |

#### Example Request

```bash
curl -X POST 'https://api.example.com/api/v1/products' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Smart Watch Series 5",
    "description": "Advanced smartwatch with health monitoring features",
    "price": 349.99,
    "currency": "USD",
    "category": "wearables",
    "sku": "SW-S5-BL",
    "stock_quantity": 50,
    "images": [
      "https://example.com/images/watch-1.jpg",
      "https://example.com/images/watch-2.jpg"
    ],
    "status": "active"
  }'
```

#### Response

```json
{
  "id": "prod_987654321",
  "name": "Smart Watch Series 5",
  "description": "Advanced smartwatch with health monitoring features",
  "price": 349.99,
  "currency": "USD",
  "category": "wearables",
  "sku": "SW-S5-BL",
  "stock_quantity": 50,
  "in_stock": true,
  "images": [
    "https://example.com/images/watch-1.jpg",
    "https://example.com/images/watch-2.jpg"
  ],
  "status": "active",
  "created_at": "2024-01-21T08:45:00Z",
  "updated_at": "2024-01-21T08:45:00Z"
}
```

### Update Product

Update an existing product's information.

```http
PATCH /api/v1/products/{product_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | string | Yes | Unique identifier for the product |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Product name |
| `description` | string | No | Product description |
| `price` | number | No | Product price |
| `category` | string | No | Product category |
| `sku` | string | No | Stock keeping unit |
| `stock_quantity` | integer | No | Stock quantity |
| `status` | string | No | Product status: `active`, `draft`, `archived` |
| `images` | array | No | Array of image URLs |

#### Example Request

```bash
curl -X PATCH 'https://api.example.com/api/v1/products/prod_123456789' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "price": 179.99,
    "stock_quantity": 35,
    "status": "active"
  }'
```

#### Response

```json
{
  "id": "prod_123456789",
  "name": "Wireless Headphones",
  "price": 179.99,
  "stock_quantity": 35,
  "in_stock": true,
  "status": "active",
  "updated_at": "2024-01-21T09:30:00Z"
}
```

### Delete Product

Permanently delete a product from your catalog.

```http
DELETE /api/v1/products/{product_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | string | Yes | Unique identifier for the product |

#### Example Request

```bash
curl -X DELETE 'https://api.example.com/api/v1/products/prod_123456789' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

#### Response

```json
{
  "deleted": true,
  "id": "prod_123456789"
}
```

### Update Inventory

Update product inventory levels.

```http
POST /api/v1/products/{product_id}/inventory
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | string | Yes | Unique identifier for the product |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `quantity` | integer | Yes | New stock quantity |
| `operation` | string | No | Operation type: `set`, `increment`, `decrement` (default: set) |

#### Example Request

```bash
curl -X POST 'https://api.example.com/api/v1/products/prod_123456789/inventory' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "quantity": 25,
    "operation": "set"
  }'
```

#### Response

```json
{
  "id": "prod_123456789",
  "stock_quantity": 25,
  "in_stock": true,
  "updated_at": "2024-01-21T10:15:00Z"
}
```

## Error Responses

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Product not found |
| 409 | Conflict - SKU already exists |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": {
    "code": "product_not_found",
    "message": "Product with ID prod_123 not found",
    "details": {
      "product_id": "prod_123"
    }
  }
}
```

## Rate Limits

- **Free tier:** 200 requests per minute
- **Pro tier:** 2,000 requests per minute
- **Enterprise:** Custom limits available

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 185
X-RateLimit-Reset: 1627891234
```


==================================================
FILE: api/users.mdx
==================================================
---
title: 'Users API'
description: 'Complete API documentation for user management endpoints'
icon: 'users'
---

# Users API

Manage user accounts, authentication, and user-related operations through our RESTful API endpoints.

## Authentication

All API requests require authentication using Bearer tokens. Include your API key in the Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

<Warning>
Keep your API keys secure and never expose them in client-side code.
</Warning>

## Endpoints

### List Users

Retrieve a paginated list of users in your account.

```http
GET /api/v1/users
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Number of users to return (default: 20, max: 100) |
| `offset` | integer | No | Number of users to skip for pagination |
| `email` | string | No | Filter users by email address |
| `status` | string | No | Filter by user status: `active`, `inactive`, `pending` |

#### Example Request

```bash
curl -X GET 'https://api.example.com/api/v1/users?limit=10&status=active' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

#### Response

```json
{
  "data": [
    {
      "id": "user_123456789",
      "email": "user@example.com",
      "name": "John Doe",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "last_login": "2024-01-20T14:22:00Z"
    }
  ],
  "has_more": true,
  "total_count": 45
}
```

### Get User

Retrieve detailed information about a specific user.

```http
GET /api/v1/users/{user_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Unique identifier for the user |

#### Example Request

```bash
curl -X GET 'https://api.example.com/api/v1/users/user_123456789' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

#### Response

```json
{
  "id": "user_123456789",
  "email": "user@example.com",
  "name": "John Doe",
  "status": "active",
  "email_verified": true,
  "phone": "+1234567890",
  "avatar_url": "https://example.com/avatars/user_123456789.png",
  "metadata": {
    "company": "Example Corp",
    "department": "Engineering"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-18T09:15:00Z",
  "last_login": "2024-01-20T14:22:00Z"
}
```

### Create User

Create a new user account.

```http
POST /api/v1/users
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `name` | string | Yes | User's full name |
| `password` | string | No | User's password (required if no invite) |
| `phone` | string | No | User's phone number |
| `metadata` | object | No | Additional user metadata |

#### Example Request

```bash
curl -X POST 'https://api.example.com/api/v1/users' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "new.user@example.com",
    "name": "New User",
    "password": "securepassword123",
    "metadata": {
      "company": "Example Corp",
      "role": "developer"
    }
  }'
```

#### Response

```json
{
  "id": "user_987654321",
  "email": "new.user@example.com",
  "name": "New User",
  "status": "active",
  "created_at": "2024-01-21T08:45:00Z",
  "invite_url": "https://app.example.com/invite/token_abc123"
}
```

### Update User

Update an existing user's information.

```http
PATCH /api/v1/users/{user_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Unique identifier for the user |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | User's full name |
| `email` | string | No | User's email address |
| `phone` | string | No | User's phone number |
| `status` | string | No | User status: `active`, `inactive` |
| `metadata` | object | No | Additional user metadata |

#### Example Request

```bash
curl -X PATCH 'https://api.example.com/api/v1/users/user_123456789' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John Updated",
    "metadata": {
      "department": "Product",
      "role": "manager"
    }
  }'
```

#### Response

```json
{
  "id": "user_123456789",
  "email": "user@example.com",
  "name": "John Updated",
  "status": "active",
  "updated_at": "2024-01-21T09:30:00Z"
}
```

### Delete User

Permanently delete a user account.

```http
DELETE /api/v1/users/{user_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | Unique identifier for the user |

#### Example Request

```bash
curl -X DELETE 'https://api.example.com/api/v1/users/user_123456789' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

#### Response

```json
{
  "deleted": true,
  "id": "user_123456789"
}
```

## Error Responses

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - User not found |
| 409 | Conflict - User already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": {
    "code": "user_not_found",
    "message": "User with ID user_123 not found",
    "details": {
      "user_id": "user_123"
    }
  }
}
```

## Rate Limits

- **Free tier:** 100 requests per minute
- **Pro tier:** 1,000 requests per minute
- **Enterprise:** Custom limits available

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627891234
```