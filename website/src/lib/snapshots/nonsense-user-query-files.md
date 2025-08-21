# File Tree

├── customization
│   ├── configuration.mdx
│   └── meta.json
├── essentials
│   ├── code.mdx
│   ├── frontmatter.mdx
│   ├── images.mdx
│   └── meta.json
├── index.mdx
└── writing
    ├── best-practices.mdx
    └── meta.json


==================================================
FILE: customization/configuration.mdx
==================================================
---
title: 'Site Configuration'
description: 'Customize your documentation site with branding, navigation, and theme settings'
icon: 'settings'
---

# Site Configuration

Customize your documentation website through the `fumabase.jsonc` configuration file.

## Basic Configuration

### Site Identity

Set your site name and description:

```jsonc title="fumabase.jsonc"
{
    "name": "Your Product Name",
    "description": "Brief description of your product or service"
}
```

### Logo Configuration

Add your logo for light and dark modes:

```jsonc title="fumabase.jsonc"
{
    "logo": {
        "light": "/logo-light.png",
        "dark": "/logo-dark.png",
        "href": "/",
        "text": "Your Brand"
    }
}
```

<Tip>
If you don't have logo images, use the `text` property to display your brand name as text.
</Tip>

## Navigation Settings

### Navbar Links

Add custom links to your navigation bar:

```jsonc title="fumabase.jsonc"
{
    "navbar": {
        "links": [
            {
                "label": "Pricing",
                "href": "https://your-site.com/pricing"
            },
            {
                "label": "Blog",
                "href": "https://your-site.com/blog"
            },
            {
                "label": "Support",
                "href": "https://your-site.com/support"
            }
        ],
        "primary": {
            "type": "button",
            "label": "Get Started",
            "href": "https://your-site.com/signup"
        }
    }
}
```

### Primary Action Button

Choose between a custom button or GitHub link:

<CodeGroup>
```jsonc Custom Button
"primary": {
    "type": "button",
    "label": "Sign Up",
    "href": "https://your-site.com/signup"
}
```

```jsonc GitHub Link
"primary": {
    "type": "github",
    "href": "https://github.com/your-org/your-repo"
}
```
</CodeGroup>

## Footer Configuration

### Social Media Links

Add social media profiles to your footer:

```jsonc title="fumabase.jsonc"
{
    "footer": {
        "socials": {
            "twitter": "https://twitter.com/yourhandle",
            "github": "https://github.com/your-org",
            "linkedin": "https://linkedin.com/company/your-company"
        }
    }
}
```

### Footer Link Sections

Organize footer links into sections:

```jsonc title="fumabase.jsonc"
{
    "footer": {
        "links": [
            {
                "header": "Product",
                "items": [
                    { "label": "Features", "href": "/features" },
                    { "label": "Pricing", "href": "/pricing" },
                    { "label": "API", "href": "/api" }
                ]
            },
            {
                "header": "Company",
                "items": [
                    { "label": "About", "href": "/about" },
                    { "label": "Blog", "href": "/blog" },
                    { "label": "Careers", "href": "/careers" }
                ]
            }
        ]
    }
}
```

## Theme and Styling

### Color Themes

Choose from predefined color themes:

```jsonc title="fumabase.jsonc"
{
    "theme": "ocean"
}
```

Available themes: `black`, `catppuccin`, `dusk`, `neutral`, `ocean`, `purple`, `vitepress`

### Custom CSS Variables

For advanced customization, define custom CSS variables:

```jsonc title="fumabase.jsonc"
{
    "cssVariables": {
        "light": {
            "--color-fd-primary": "hsl(220, 90%, 50%)",
            "--color-fd-background": "hsl(0, 0%, 98%)"
        },
        "dark": {
            "--color-fd-primary": "hsl(220, 90%, 70%)",
            "--color-fd-background": "hsl(220, 15%, 10%)"
        }
    }
}
```

## SEO and Metadata

### Custom Meta Tags

Add custom meta tags for SEO:

```jsonc title="fumabase.jsonc"
{
    "seo": {
        "metatags": {
            "keywords": "documentation, api, developer tools",
            "author": "Your Company Name"
        }
    }
}
```

### Indexing Settings

Control search engine indexing:

```jsonc title="fumabase.jsonc"
{
    "seo": {
        "indexing": "navigable"
    }
}
```

Options: `navigable` (only main pages) or `all` (all pages)

## Advanced Features

### Custom Domains

Connect custom domains to your documentation:

```jsonc title="fumabase.jsonc"
{
    "domains": [
        "docs.your-company.com",
        "help.your-product.com"
    ]
}
```

<Warning>
After adding domains, you'll need to configure DNS records to point to Fumabase's servers.
</Warning>

### Redirects

Set up URL redirects for moved content:

```jsonc title="fumabase.jsonc"
{
    "redirects": [
        {
            "source": "/old-path",
            "destination": "/new-path",
            "permanent": true
        }
    ]
}
```

### Site Banner

Add a site-wide announcement banner:

```jsonc title="fumabase.jsonc"
{
    "banner": {
        "content": "🚀 New feature released! Check out our latest updates.",
        "dismissible": true
    }
}
```

## Configuration Best Practices

### Version Control

- Keep your `fumabase.jsonc` file in version control
- Test configuration changes locally before deploying
- Use comments in the JSONC file for documentation

### Performance Considerations

- Optimize images before uploading
- Use external hosting for large media files
- Minimize custom CSS for faster loading

<Tip>
Start with the basic configuration and gradually add features as needed. Most sites work well with just the name, description, and logo configured.
</Tip>


==================================================
FILE: customization/meta.json
==================================================
{
    "title": "Customization",
    "icon": "sliders",
    "pages": ["configuration"]
}


==================================================
FILE: essentials/code.mdx
==================================================
---
title: 'Code Blocks'
description: 'Display inline code and code blocks with syntax highlighting'
icon: 'code'
---

## Basic Code Examples

### Inline Code

To denote a `word` or `phrase` as code, enclose it in backticks (`).

```
To denote a `word` or `phrase` as code, enclose it in backticks (`).
```

### Code Blocks

Use fenced code blocks by enclosing code in three backticks and specify the programming language for syntax highlighting.

```java HelloWorld.java
class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

````md
```java HelloWorld.java
class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```
````

## Advanced Features

### Code Groups

Show multiple language examples side by side:

<CodeGroup>
```javascript Node.js
const response = await fetch('/api/data');
const data = await response.json();
```

```python Python
import requests
response = requests.get('/api/data')
data = response.json()
```

```bash cURL
curl -X GET '/api/data'
```
</CodeGroup>

### Line Numbers

Add line numbers to your code examples:

```javascript title="config.js" lineNumbers=true
const config = {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 3
};
```

## Best Practices

- Always include the language for proper syntax highlighting
- Use descriptive titles for code blocks
- Keep examples focused and relevant
- Test your code examples before publishing


==================================================
FILE: essentials/frontmatter.mdx
==================================================
---
title: 'Frontmatter'
description: 'Configure page metadata and display properties using YAML frontmatter'
icon: 'file-text'
---

# Frontmatter Configuration

Frontmatter is YAML metadata placed at the beginning of your markdown files that controls how pages are displayed and indexed.

## Basic Frontmatter

### Required Properties

Every page should include at minimum:

```yaml
---
title: 'Page Title'
description: 'Brief description of page content'
---
```

### Complete Example

```yaml
---
title: 'API Reference'
description: 'Complete API documentation with examples and response schemas'
icon: 'code'
full: false
---
```

## Property Reference

### title

The page title that appears in the sidebar navigation and as the main H1 heading.

```yaml
title: 'Getting Started'
```

### description

Meta description used for SEO and displayed in search results.

```yaml
description: 'Learn how to set up and configure your project in minutes'
```

### icon

Icon name from [Lucide icons](https://lucide.dev) displayed next to the page title.

```yaml
icon: 'rocket'        # Shows rocket icon
icon: 'settings'      # Shows settings icon
icon: 'book-open'     # Shows book-open icon
```

### full

Boolean that determines if the page uses full width layout.

```yaml
full: true   # Full width layout
full: false  # Default centered layout
```

## Icon Reference

Commonly used icons for documentation:

<CardGroup cols={3}>
<Card title="Getting Started" icon="rocket">
`icon: 'rocket'`
</Card>

<Card title="API Reference" icon="code">
`icon: 'code'`
</Card>

<Card title="Configuration" icon="settings">
`icon: 'settings'`
</Card>

<Card title="Guides" icon="book-open">
`icon: 'book-open'`
</Card>

<Card title="Tutorials" icon="graduation-cap">
`icon: 'graduation-cap'`
</Card>

<Card title="Troubleshooting" icon="help-circle">
`icon: 'help-circle'`
</Card>
</CardGroup>

<Tip>
Browse the full icon library at [lucide.dev](https://lucide.dev) to find the perfect icon for your content.
</Tip>

## Advanced Usage

### Custom Properties

You can add custom properties for your own use:

```yaml
---
title: 'Advanced Configuration'
description: 'Custom settings and advanced options'
icon: 'settings'
version: '2.0'
author: 'Your Team'
reviewed: true
---
```

### Multi-line Descriptions

Use YAML multi-line syntax for longer descriptions:

```yaml
description: |
  This comprehensive guide covers everything you need to know
  about configuring advanced settings, including performance
  optimization, security considerations, and best practices
  for production deployments.
```

## Best Practices

### Consistent Naming

Use consistent naming patterns for similar content:

```yaml
# Good
icon: 'api'
icon: 'api-reference'

# Avoid
icon: 'api'
icon: 'reference-api'
icon: 'API'
```

### Descriptive Titles

Make titles clear and action-oriented:

```yaml
# Good
title: 'Setting Up Authentication'
title: 'Deploying to Production'

# Less clear
title: 'Authentication'
title: 'Production'
```

### SEO Optimization

Write descriptions that work well in search results:

```yaml
# Good
description: 'Step-by-step guide to set up OAuth 2.0 authentication with examples for Node.js, Python, and Ruby'

# Less effective
description: 'How to set up auth'
```

<Warning>
Always include both title and description. Missing these can hurt your SEO and make navigation difficult for users.
</Warning>

## Validation

Fumabase validates frontmatter and will show warnings for:
- Missing required fields
- Invalid icon names
- Malformed YAML syntax

<Check>
Proper frontmatter configuration ensures your documentation is well-organized, searchable, and provides a great user experience.
</Check>


==================================================
FILE: essentials/images.mdx
==================================================
---
title: 'Images and Media'
description: 'Add images, videos, and other media elements to your documentation'
icon: 'image'
---

## Adding Images

### Using Markdown Syntax

The standard markdown syntax lets you add images:

```md
![Alt text describing the image](/path/to/image.jpg)
```

### Using HTML img Tags

For more control over images, use HTML img tags:

```html
<img 
  src="/path/to/image.jpg" 
  alt="Descriptive alt text"
  style={{ width: '100%', borderRadius: '0.5rem' }}
/>
```

## Image Best Practices

### Alt Text

Always provide meaningful alt text for accessibility:

```md
<!-- Good -->
![Dashboard showing user analytics](/images/dashboard.png)

<!-- Poor -->
![Screenshot](/images/dashboard.png)
```

### Responsive Images

Make images responsive by setting appropriate styles:

```html
<img 
  src="/images/example.jpg" 
  alt="Example image"
  style={{ 
    maxWidth: '100%', 
    height: 'auto',
    borderRadius: '0.5rem'
  }}
/>
```

## Embedded Content

### Videos

Embed videos using iframe elements:

```html
<iframe
  width="560"
  height="315"
  src="https://www.youtube.com/embed/VIDEO_ID"
  title="YouTube video player"
  frameBorder="0"
  allowFullScreen
  style={{ width: '100%', borderRadius: '0.5rem' }}
></iframe>
```

### Frames for Images

Wrap images in frames for better presentation:

<Frame caption="Example dashboard showing key metrics">
<img 
  src="/images/dashboard-example.jpg" 
  alt="Dashboard with analytics charts and user statistics"
  style={{ borderRadius: '0.5rem' }}
/>
</Frame>

## File Size Considerations

- Keep images under 5MB for optimal performance
- Use modern formats like WebP when possible
- Compress images before uploading
- Consider using external hosting for large files

<Tip>
For large images or videos, consider using external hosting services like Cloudinary, S3, or YouTube and embedding them instead of uploading directly.
</Tip>


==================================================
FILE: essentials/meta.json
==================================================
{
    "title": "Essentials",
    "icon": "book",
    "pages": ["code", "images", "frontmatter", "markdown"]
}


==================================================
FILE: index.mdx
==================================================
---
title: 'Getting Started'
description: 'Quick start guide to get up and running with your new documentation website'
icon: 'rocket'
---

# Welcome to Your Documentation

This is your new documentation website built with Fumabase. Here's how to get started:

## 1. Explore the Documentation

Browse through the sections on the left to learn about:
- **Essentials**: Core documentation components and syntax
- **Writing**: Best practices for creating great documentation
- **Customization**: How to personalize your website

## 2. Customize Your Content

Edit any page by clicking the edit button in the top right corner. You can:
- Update text and examples
- Add your own content
- Customize the structure

## 3. Configure Your Site

Edit the `fumabase.jsonc` file to:
- Set your site name and description
- Add your logo and branding
- Configure navigation and footer

## 4. Preview and Publish

Use the Fumabase CLI to preview your site locally:

```bash
npm install -g fumabase
fumabase dev
```

Your changes will be automatically deployed when you push to your repository.

## Need Help?

Check out our comprehensive guides on documentation best practices and Fumabase features to create an outstanding documentation experience for your users.


==================================================
FILE: writing/best-practices.mdx
==================================================
---
title: 'Documentation Best Practices'
description: 'Learn how to create effective, user-focused documentation that helps users succeed'
icon: 'book-open'
---

# Documentation Best Practices

Great documentation is more than just accurate information—it's about helping users achieve their goals efficiently.

## User-Focused Writing

### Start with User Goals

Focus on what users want to accomplish, not just feature descriptions:

<CodeGroup>
```markdown ❌ Feature-Focused
# API Endpoints

- GET /users - Returns user list
- POST /users - Creates new user
- PUT /users/{id} - Updates user
- DELETE /users/{id} - Deletes user
```

```markdown ✅ User-Focused
# Managing Users

Learn how to manage user accounts in your application:

- **View all users**: List and search user accounts
- **Add new users**: Create user accounts with custom permissions
- **Update user information**: Modify user details and settings
- **Remove users**: Delete user accounts securely
```
</CodeGroup>

### Write for Different Experience Levels

Provide pathways for both beginners and experts:

<Steps>
<Step title="Quick Start">
Begin with the simplest approach that works for most users.

```javascript
// Simple example that just works
const result = await api.call('method');
```
</Step>

<Step title="Advanced Options">
Provide advanced configuration for power users.

<Accordion title="Advanced configuration">
```javascript
// Advanced options with error handling
const result = await api.call('method', {
    timeout: 30000,
    retries: 3,
    onRetry: (attempt) => console.log(`Retry ${attempt}`)
});
```
</Accordion>
</Step>
</Steps>

## Clear and Concise Content

### Use Plain Language

Avoid jargon and technical terms when simpler words work:

<CodeGroup>
```markdown ❌ Technical Jargon
The asynchronous invocation paradigm facilitates non-blocking I/O operations.
```

```markdown ✅ Plain Language
Async calls let your program do other work while waiting for responses.
```
</CodeGroup>

### Break Down Complex Concepts

Use progressive disclosure to reveal complexity gradually:

<Tabs>
<Tab title="Basic Example">
```javascript
// Start simple
const user = await getUser(userId);
```
</Tab>

<Tab title="With Error Handling">
```javascript
// Add error handling
try {
    const user = await getUser(userId);
} catch (error) {
    console.error('Failed to get user:', error);
}
```
</Tab>

<Tab title="Production Ready">
```javascript
// Full production implementation
async function getUserSafe(userId, options = {}) {
    const { timeout = 5000, retries = 3 } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const user = await getUser(userId, { signal: controller.signal });
            clearTimeout(timeoutId);
            return user;
        } catch (error) {
            if (attempt === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}
```
</Tab>
</Tabs>

## Effective Code Examples

### Complete, Runnable Examples

Always provide examples that users can copy and run:

```javascript
// Complete example with all required parts
import { API } from 'your-library';

// Initialize with realistic configuration
const api = new API({
    apiKey: process.env.API_KEY,
    baseURL: 'https://api.example.com',
    timeout: 30000
});

// Example usage with error handling
async function getUsers() {
    try {
        const users = await api.get('/users');
        console.log('Users:', users);
        return users;
    } catch (error) {
        console.error('Failed to fetch users:', error);
        throw error;
    }
}

// Call the function
getUsers();
```

### Show Expected Output

Always include what users should expect to see:

**Example Response:**
```json
{
    "users": [
        {
            "id": "user_123",
            "email": "user@example.com",
            "name": "Example User",
            "created": "2024-01-15T10:30:00Z"
        }
    ],
    "total": 1,
    "has_more": false
}
```

## Accessibility Considerations

### Descriptive Headings

Use headings that clearly describe the content:

```markdown
# ❌ Section 1
# ✅ User Authentication Setup

## ❌ Details
## ✅ Configuring OAuth 2.0
```

### Alt Text for Images

Provide meaningful descriptions for all images:

```markdown
<!-- Good -->
![Dashboard showing 5 active users and 3 pending requests](/images/dashboard.png)

<!-- Poor -->
![Image](/images/dashboard.png)
```

## Testing Your Documentation

### Verify Code Examples

Test every code example before publishing:

<Checklist>
- [ ] Code runs without errors
- [ ] All required imports are included
- [ ] Environment variables are documented
- [ ] Expected output matches actual output
- [ ] Error handling works as described
</Checklist>

### User Testing

Get feedback from real users:

<CardGroup cols={2}>
<Card title="New Users" icon="user-plus">
Can they complete basic tasks without help?
</Card>

<Card title="Experienced Users" icon="user-check">
Can they find advanced features easily?
</Card>
</CardGroup>

<Tip>
The best documentation anticipates user questions and provides clear, actionable answers before users even know they need them.
</Tip>


==================================================
FILE: writing/meta.json
==================================================
{
    "title": "Writing Guides",
    "icon": "edit-3",
    "pages": ["best-practices", "user-focused", "content-structure", "code-examples", "visual-design", "accessibility"]
}