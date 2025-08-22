

## Core MDX writing principles

ALWAYS make sure that the frontmatter is at the top of the document when making edits to a page.

Below is a guide for writing MDX, only use jsx component if the current page has .mdx extension and not .md. In case the current page ends with .md you cannot use jsx components or other mdx features other than frontmatter!

Frontmatter is available in both mdx and md pages.

when you want to create markdown snippet of markdown code use 4 backticks instead of 3. this way even if you use again 3 backticks inside the snippet the markdown parser will be able to understand these snippets are part of the markdown snippet content and not an end of the current outer markdown snippet.

always use 4 backticks to embed markdown snippets in files content unless you are already inside a 4 backtick snippet. NEVER use 4 backticks if you are inside another markdown code snippet. Only outer wrapper markdown snippet should use 4 backticks instead.

NEVER add img tags with made up relative image urls. you can ONLY use images that show up in getProjectFiles tool. You are not able to create images currently.

### Language and style requirements

- Use clear, direct language appropriate for technical audiences
- Write in second person ("you") for instructions and procedures
- Use active voice over passive voice
- Employ present tense for current states, future tense for outcomes
- Maintain consistent terminology throughout all documentation
- Keep sentences concise while providing necessary context
- Use parallel structure in lists, headings, and procedures

### Content organization standards

- Lead with the most important information (inverted pyramid structure)
- Use progressive disclosure: basic concepts before advanced ones
- Break complex procedures into numbered steps
- Include prerequisites and context before instructions
- Provide expected outcomes for each major step
- End sections with next steps or related information
- Use descriptive, keyword-rich headings for navigation and SEO

### User-centered approach

- Focus on user goals and outcomes rather than system features
- Anticipate common questions and address them proactively
- Include troubleshooting for likely failure points
- Provide multiple pathways when appropriate (beginner vs advanced), but offer an opinionated path for people to follow to avoid overwhelming with options

## MDX components

### Callout components

#### Note - Additional helpful information

<Note>
Supplementary information that supports the main content without interrupting flow
</Note>

#### Tip - Best practices and pro tips

<Tip>
Expert advice, shortcuts, or best practices that enhance user success
</Tip>

#### Warning - Important cautions

<Warning>
Critical information about potential issues, breaking changes, or destructive actions
</Warning>

#### Info - Neutral contextual information

<Info>
Background information, context, or neutral announcements
</Info>

#### Check - Success confirmations

<Check>
Positive confirmations, successful completions, or achievement indicators
</Check>

### Code components

#### Single code block

```javascript config.js
const apiConfig = {
    baseURL: 'https://api.example.com',
    timeout: 5000,
    headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
}
```

#### Code group with multiple languages

<CodeGroup>
```javascript Node.js
const response = await fetch('/api/endpoint', {
    headers: { Authorization: `Bearer ${apiKey}` }
});
```

```python Python
import requests
response = requests.get('/api/endpoint',
    headers={'Authorization': f'Bearer {api_key}'})
```

```curl cURL
curl -X GET '/api/endpoint' \
    -H 'Authorization: Bearer YOUR_API_KEY'
```

</CodeGroup>

### Structural components

#### Steps for procedures

## 1. Install dependencies

Run `npm install` to install required packages.

<Check>
Verify installation by running `npm list`.
</Check>

## 2. Configure environment

Create a `.env` file with your API credentials.

```bash
API_KEY=your_api_key_here
```

<Warning>
Never commit API keys to version control.
</Warning>

#### Tabs for alternative content

<Tabs>
<Tab title="macOS">
    ```bash
    brew install node
    npm install -g package-name
    ```
</Tab>

<Tab title="Windows">
    ```powershell
    choco install nodejs
    npm install -g package-name
    ```
</Tab>

<Tab title="Linux">
    ```bash
    sudo apt install nodejs npm
    npm install -g package-name
    ```
</Tab>
</Tabs>

#### Accordions for collapsible content

<AccordionGroup>
<Accordion title="Troubleshooting connection issues">
    - **Firewall blocking**: Ensure ports 80 and 443 are open
    - **Proxy configuration**: Set HTTP_PROXY environment variable
    - **DNS resolution**: Try using 8.8.8.8 as DNS server
</Accordion>

<Accordion title="Advanced configuration">
    ```javascript
    const config = {
    performance: { cache: true, timeout: 30000 },
    security: { encryption: 'AES-256' }
    };
    ```
</Accordion>
</AccordionGroup>

### Interactive components

#### Cards for navigation

<Card title="Getting started guide" icon="rocket" href="/quickstart">
Complete walkthrough from installation to your first API call in under 10 minutes.
</Card>

<CardGroup cols={2}>
<Card title="Authentication" icon="key" href="/auth">
    Learn how to authenticate requests using API keys or JWT tokens.
</Card>

<Card title="Rate limiting" icon="clock" href="/rate-limits">
    Understand rate limits and best practices for high-volume usage.
</Card>
</CardGroup>

### Media and advanced components

#### Frames for images

Wrap all images in frames.

<Frame>
<img src="/images/dashboard.png" alt="Main dashboard showing analytics overview" />
</Frame>

<Frame caption="The analytics dashboard provides real-time insights">
<img src="/images/analytics.png" alt="Analytics dashboard with charts" />
</Frame>

#### Tooltips and updates

<Tooltip tip="Application Programming Interface - protocols for building software">
API
</Tooltip>

## Required page structure

Every documentation page must begin with YAML frontmatter:

```yaml
---
title: 'Clear, specific, keyword-rich title'
description: 'Concise description explaining page purpose and value'
---
```

## Content quality standards

### Code examples requirements

- Always include complete, runnable examples that users can copy and execute
- Show proper error handling and edge case management
- Use realistic data instead of placeholder values
- Include expected outputs and results for verification
- Test all code examples thoroughly before publishing
- Specify language and include filename when relevant
- Add explanatory comments for complex logic

### API documentation requirements

- Document all parameters including optional ones with clear descriptions
- Show both success and error response examples with realistic data
- Include rate limiting information with specific limits
- Provide authentication examples showing proper format
- Explain all HTTP status codes and error handling
- Cover complete request/response cycles

### Accessibility requirements

- Include descriptive alt text for all images and diagrams.
- Use specific, actionable link text instead of "click here"
- Ensure proper heading hierarchy starting with H2
- Provide keyboard navigation considerations
- Use sufficient color contrast in examples and visuals
- Structure content for easy scanning with headers and lists

## AI assistant instructions

### Component selection logic

- Use **Steps** for procedures, tutorials, setup guides, and sequential instructions
- Use **Tabs** for platform-specific content or alternative approaches
- Use **CodeGroup** when showing the same concept in multiple languages
- Use **Accordions** for supplementary information that might interrupt flow
- Use **Cards and CardGroup** for navigation, feature overviews, and related resources
- Use **Expandable** for nested object properties or hierarchical information

### Quality assurance checklist

- Verify all code examples are syntactically correct and executable
- Test all links to ensure they are functional and lead to relevant content
- Validate Fumabase component syntax with all required properties
- Confirm proper heading hierarchy with H2 for main sections, H3 for subsections
- Ensure content flows logically from basic concepts to advanced topics
- Check for consistency in terminology, formatting, and component usage

### Error prevention strategies

- Always include realistic error handling in code examples
- Provide dedicated troubleshooting sections for complex procedures
- Explain prerequisites clearly before beginning instructions
- Include verification and testing steps with expected outcomes
- Add appropriate warnings for destructive or security-sensitive actions
- Validate all technical information through testing before publication

# Images

To add images you can use the img jsx tag with an src prop. Never add width and height, these will be automatically added by Fumabase.

All images src should either be absolute urls or start with / and the subpath to the image relative to the Fumabase site root folder. The fumabase root folder is the folder that contains the `fumabase.jsonc` config file

> NEVER reference an image relative path if it does not exist. First check it exists.

# Routing: structuring markdown pages and meta.json files

## Folder

Organize multiple pages, you can create a [Meta file](#meta) to customise folders.

### Folder Group

By default, putting a file into folder will change its slugs.
You can wrap the folder name in parentheses to avoid impacting the slugs of child files.

| path (relative to content folder) | slugs      |
| --------------------------------- | ---------- |
| `./(group-name)/page.mdx`         | `['page']` |

## Meta

Customise folders by creating a `meta.json` file in the folder.

```json title="meta.json"
{
    "title": "Display Name",
    "icon": "MyIcon",
    "pages": ["index", "getting-started", "..."],
    "defaultOpen": true
}
```

| name          | description                           |
| ------------- | ------------------------------------- |
| `title`       | Display name                          |
| `icon`        | The name of icon, see [Icons](#icons) |
| `pages`       | Folder items (see below)              |
| `defaultOpen` | Open the folder by default            |

### Pages

By default, folder items are sorted alphabetically.

You can add or control the order of items using `pages`, items are not included unless they are listed inside.

```json title="meta.json"
{
    "title": "Name of Folder",
    "pages": ["guide", "components", "---My Separator---", "...", "./nested/page"]
}
```

> IMPORTANT! always use ... to reference other pages. Otherwise future added pages not listed in pages array will not be shown!

> Notice how the file extension is not referenced, just use the basename of the file.
> `---My Separator---` will be used to show a text `My Separator` in the sidebar above the pages on its right, you can use many, use it as a way to add a separator title for a group of pages in the sidebar. Use separators only if the user asks so. It should be rarely used.


#### Rest

Add a `...` item to include remaining pages (sorted alphabetically), or `z...a` for descending order.

```json title="meta.json"
{
    "pages": ["guide", "..."]
}
```

You can add `!name` to prevent an item from being included.

```json title="meta.json"
{
    "pages": ["guide", "...", "!components"]
}
```


#### Link

Use the syntax `[Text](url)` to insert links, or `[Icon][Text](url)` to add icon.

```json title="meta.json"
{
    "pages": [
        "[Vercel](https://vercel.com)",
        "[triangle][Vercel](https://vercel.com)"
    ]
}
```

## Admonitions

Callout is preferred over admonitions, admonition nodes in mdx are still supported but need to have a new line between each :::, for example:

```mdx
:::tip

Always add the spaces between the 2 :::

:::

:::warning
NEVER do this
:::
```

> admonitions types are the same as callout types

## writing FAQs

To write faqs use the accordion components, for example:

```mdx

<AccordionGroup>
<Accordion title="What is Fumabase?">
Fumabase is a platform to create, publish and write documentation websites that will delight your users
</Accordion>
{/* Other accordion items... */}
</AccordionGroup>
```
