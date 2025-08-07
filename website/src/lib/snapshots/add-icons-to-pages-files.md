# File Tree

├── api
│   ├── overview.mdx
│   └── reference.mdx
├── concepts
│   └── overview.mdx
├── examples
│   └── usage.mdx
├── getting-started.mdx
├── guides
│   └── configuration.mdx
├── index.mdx
└── installation.mdx


==================================================
FILE: api/overview.mdx
==================================================
---
title: API Overview
---

# API Overview

Overview of our API endpoints.


==================================================
FILE: api/reference.mdx
==================================================
---
title: 'API Reference'
description: 'Full API documentation'
icon: 'code'
---

# API Reference

Explore all available API endpoints, parameters, and response schemas.

## Example Endpoint

### GET /v1/resources

Retrieve a list of resources.

```bash
curl https://api.example.com/v1/resources \
  -H "Authorization: Bearer YOUR_API_KEY"
```

<Accordion title="Response Example">
```json
{
  "data": [],
  "has_more": false
}
```
</Accordion>



==================================================
FILE: concepts/overview.mdx
==================================================
---
title: 'Concepts Overview'
description: 'Key concepts explained'
icon: 'book'
---

# Concepts Overview

Learn the fundamental concepts that power this platform, including core terminology, architecture, and workflows.

- **Resources:** Building blocks you interact with via the API.
- **Requests:** HTTP calls to create, read, update, or delete resources.
- **Authentication:** Secure access via API keys or OAuth.



==================================================
FILE: examples/usage.mdx
==================================================
---
title: 'Examples'
description: 'Code examples and tutorials'
icon: 'play'
---

# Examples

Follow these examples to integrate quickly.

## Basic Usage

```javascript
import { Client } from '@company/sdk';
const client = new Client('YOUR_API_KEY');
client.getResources().then(console.log);
```

## Error Handling

```javascript
client.getResources()
  .then(console.log)
  .catch(err => console.error('API Error:', err));
```



==================================================
FILE: getting-started.mdx
==================================================
---
title: 'Getting Started'
description: 'Set up and run your first example'
icon: 'rocket'
---

## Prerequisites

- Node.js 14 or newer
- npm or yarn

## Quick Start

1. Clone the repository:

```bash
git clone https://github.com/your/repo.git
cd repo
```
2. Install dependencies:

```bash
npm install
```
3. Start the development server:

```bash
npm run dev
```

You're now ready to explore the guides and API reference.


==================================================
FILE: guides/configuration.mdx
==================================================
---
title: Configuration
---

# Configuration Guide

How to configure the application.


==================================================
FILE: index.mdx
==================================================
---
title: 'Home'
description: 'Overview of the project and navigation'
icon: 'home'
---

# Welcome to Your Documentation Site

This documentation site provides guides and references to get you started quickly. Use the sidebar to navigate through different sections.


==================================================
FILE: installation.mdx
==================================================
---
title: 'Installation'
description: 'Install the CLI and prerequisites'
icon: 'download'
---

## Install the Fumabase CLI

To preview your documentation locally, install the Fumabase CLI:

```bash
npm install -g fumabase
```

## Environment Setup

Ensure you have:

- A GitHub repository with write access
- Node.js and npm installed

Then, run:

```bash
fumabase init
```