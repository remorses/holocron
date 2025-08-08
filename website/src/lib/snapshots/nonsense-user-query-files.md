# File Tree

├── getting-started
│   └── index.mdx
├── guides
│   ├── configuration.mdx
│   └── installation.mdx
├── README.md
├── reference
│   ├── api-reference.mdx
│   └── cli-commands.mdx
└── tutorials
    └── hello-world.mdx


==================================================
FILE: getting-started/index.mdx
==================================================
---
title: 'Getting Started'
description: 'Overview of setup and first steps'
icon: 'rocket'
---

# Getting Started

Welcome to our documentation! This guide walks you through installation, configuration, and your first example.

## Installation

```bash
npm install your-package
```

## Quick Start

```javascript
import { Client } from 'your-package';

const client = new Client({ apiKey: 'YOUR_KEY' });
await client.init();
console.log('Ready!');
```


==================================================
FILE: guides/configuration.mdx
==================================================
---
title: 'Configuration'
description: 'Configure application settings'
icon: 'settings'
---

# Configuration

Customize your setup by creating a configuration file (e.g., `config.json`):

```json
{
  "apiKey": "YOUR_KEY",
  "timeout": 5000
}
```

Import and initialize with config:

```javascript
import { Client } from 'your-package';
import config from './config.json';

const client = new Client(config);
```


==================================================
FILE: guides/installation.mdx
==================================================
---
title: 'Installation'
description: 'Install and set up the application'
icon: 'download'
---

# Installation

Follow these steps to install the application:

1. Install via npm:

   ```bash
   npm install your-package
   ```

2. Or via Yarn:

   ```bash
   yarn add your-package
   ```


==================================================
FILE: README.md
==================================================
# Documentation Site

## Development

1. Install the Fumabase CLI

```bash
npm i -g fumabase
```

2. Start local development server

```bash
fumabase dev
```  

## Next Steps

Explore the documentation below to learn how to install, configure, and use the product.


==================================================
FILE: reference/api-reference.mdx
==================================================
---
title: 'API Reference'
description: 'Detailed API endpoints and usage'
icon: 'code'
---

# API Reference

## GET /items

Retrieve a list of items.

**Request**

```http
GET /api/items HTTP/1.1
Authorization: Bearer YOUR_KEY
```

**Response**

```json
[{ "id": 1, "name": "Item 1" }]
```


==================================================
FILE: reference/cli-commands.mdx
==================================================
---
title: 'CLI Commands'
description: 'Command-line interface usage'
icon: 'terminal'
---

# CLI Commands

Use the CLI for common tasks:

## Initialize project

```bash
your-cli init
```

## Build documentation

```bash
your-cli build
```

## Serve locally

```bash
your-cli serve
```


==================================================
FILE: tutorials/hello-world.mdx
==================================================
---
title: 'Hello World Tutorial'
description: 'Create and run your first example'
icon: 'terminal'
---

# Hello World

In this tutorial, you'll write and run a simple "Hello World" example.

```javascript
import { Client } from 'your-package';

async function main() {
  const client = new Client({ apiKey: 'YOUR_KEY' });
  await client.init();
  console.log('Hello, World!');
}

main();
```