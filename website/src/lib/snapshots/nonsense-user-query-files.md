# File Tree

├── essentials
│   ├── code.mdx
│   ├── frontmatter.mdx
│   ├── images.mdx
│   └── markdown.mdx
├── README.md
└── writing
    ├── accessibility.mdx
    ├── code-examples.mdx
    └── content-structure.mdx


==================================================
FILE: essentials/code.mdx
==================================================
---
title: 'Code Blocks'
description: 'Display inline code and code blocks'
icon: 'code'
---

## Basic

### Inline Code

To denote a `word` or `phrase` as code, enclose it in backticks (`).

```
To denote a `word` or `phrase` as code, enclose it in backticks (`).
```

### Code Block

Use [fenced code blocks](https://www.markdownguide.org/extended-syntax/#fenced-code-blocks) by enclosing code in three backticks and follow the leading ticks with the programming language of your snippet to get syntax highlighting. Optionally, you can also write the name of your code after the programming language.

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



==================================================
FILE: essentials/frontmatter.mdx
==================================================
---
title: 'Frontmatter'
description: 'Configure page metadata and display properties'
icon: 'file-text'
---

## Overview

Frontmatter is YAML metadata placed at the beginning of your markdown files. It controls how your page is displayed and indexed.

```yaml
---
title: 'Page Title'
description: 'Brief description of the page content'
icon: 'icon-name'
---
```

## Required Properties

### title

The page title that appears in the sidebar navigation and as the main H1 heading on the page.

```yaml
title: 'Getting Started'
```

### description

Meta description used for SEO and displayed in search results. Also shown in the document overview.

```yaml
description: 'Learn how to set up and configure your project'
```

## Optional Properties

### icon

Icon name from [Lucide icons](https://lucide.dev) displayed next to the page title in the sidebar.

```yaml
icon: 'rocket'        # Shows rocket icon
icon: 'book-open'     # Shows book-open icon
icon: 'settings'      # Shows settings icon
```

<Tip>

Browse the full icon library at [lucide.dev](https://lucide.dev) to find the perfect icon for your page.

</Tip>

## Example

Here's a complete frontmatter example:

```yaml
---
title: 'API Reference'
description: 'Complete API documentation with examples and response schemas'
icon: 'code'
---
```

This creates a page with:
- "API Reference" in the sidebar and as the H1
- SEO description for search engines
- Code icon in the sidebar



==================================================
FILE: essentials/images.mdx
==================================================
---
title: 'Images and Embeds'
description: 'Add image, video, and other HTML elements'
icon: 'image'
---

<img
  style={{ borderRadius: '0.5rem' }}
  src="https://uploads.fumabase.com/Gui86K8XoAAZRb_.jpeg"
/>

## Image

### Using Markdown

The [markdown syntax](https://www.markdownguide.org/basic-syntax/#images) lets you add images using the following code

```md
![title](/path/image.jpg)
```

Note that the image file size must be less than 5MB. Otherwise, we recommend hosting on a service like [Cloudinary](https://cloudinary.com/) or [S3](https://aws.amazon.com/s3/). You can then use that URL and embed.

### Using Embeds

To get more customizability with images, you can also use [embeds](/writing-content/embed) to add images

```html
<img height="200" src="/path/image.jpg" />
```

## Embeds and HTML elements

<iframe
  width="560"
  height="315"
  src="https://www.youtube.com/embed/4KzFe50RQkQ"
  title="YouTube video player"
  frameBorder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
  style={{ width: '100%', borderRadius: '0.5rem' }}
></iframe>

<br />

<Tip>

Fumabase supports [HTML tags in Markdown](https://www.markdownguide.org/basic-syntax/#html). This is helpful if you prefer HTML tags to Markdown syntax, and lets you create documentation with infinite flexibility.

</Tip>

### iFrames

Loads another HTML page within the document. Most commonly used for embedding videos.

```html
<iframe src="https://www.youtube.com/watch?v=EpX1_YJPGAY"> </iframe>
```



==================================================
FILE: essentials/markdown.mdx
==================================================
---
title: 'Markdown Syntax'
description: 'Text, title, and styling in standard markdown'
icon: 'text'
---

## Titles

Best used for section headers.

```md
## Titles
```

### Subtitles

Best use to subsection headers.

```md
### Subtitles
```

<Tip>

Each **title** and **subtitle** creates an anchor and also shows up on the table of contents on the right.

</Tip>

## Text Formatting

We support most markdown formatting. Simply add `**`, `_`, or `~` around text to format it.

| Style         | How to write it   | Result          |
| ------------- | ----------------- | --------------- |
| Bold          | `**bold**`        | **bold**        |
| Italic        | `_italic_`        | _italic_        |
| Strikethrough | `~strikethrough~` | ~strikethrough~ |

You can combine these. For example, write `**_bold and italic_**` to get **_bold and italic_** text.

You need to use HTML to write superscript and subscript text. That is, add `<sup>` or `<sub>` around your text.

| Text Size   | How to write it          | Result                 |
| ----------- | ------------------------ | ---------------------- |
| Superscript | `<sup>superscript</sup>` | <sup>superscript</sup> |
| Subscript   | `<sub>subscript</sub>`   | <sub>subscript</sub>   |

## Linking to Pages

You can add a link by wrapping text in `[]()`. You would write `[link to google](https://google.com)` to [link to google](https://google.com).

Links to pages in your docs need to be root-relative. Basically, you should include the entire folder path. For example, `[link to text](/writing-content/text)` links to the page "Text" in our components section.

Relative links like `[link to text](../text)` will open slower because we cannot optimize them as easily.

## Blockquotes

### Singleline

To create a blockquote, add a `>` in front of a paragraph.

> Dorothy followed her through many of the beautiful rooms in her castle.

```md
> Dorothy followed her through many of the beautiful rooms in her castle.
```

### Multiline

> Dorothy followed her through many of the beautiful rooms in her castle.
>
> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.

```md
> Dorothy followed her through many of the beautiful rooms in her castle.
>
> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.
```

### LaTeX

Fumabase supports [LaTeX](https://www.latex-project.org) through the Latex component.

<Latex>8 x (vk x H1 - H2) = (0,1)</Latex>

```md
<Latex>8 x (vk x H1 - H2) = (0,1)</Latex>
```



==================================================
FILE: README.md
==================================================
# Fumabase Starter Kit

### Development

## 1. Install the Fumabase CLI

To preview your documentation changes locally, first install the [Fumabase CLI](https://www.npmjs.com/package/fumabase). Use the following command:

```
npm i -g fumabase
```

## 2. Start the Local Development Server

At the root of your documentation project (where `fumabase.jsonc` is located), start the development server with:

```
fumabase dev
```

### Publishing Changes

## 3. Set Up Automatic Deployments

Install our GitHub App to enable automated deployments from your repository. After pushing changes to your default branch, your documentation will be deployed to production automatically. You can find the installation link on your dashboard.



==================================================
FILE: writing/accessibility.mdx
==================================================
---
title: 'Writing Accessible Documentation'
description: 'Create documentation that works for everyone by following accessibility principles and inclusive design practices.'
---

# Writing Accessible Documentation

Accessible documentation isn't just about compliance—it creates better experiences for all users by prioritizing clarity, structure, and multiple ways to consume information.

## Clear Language and Structure

Accessible writing starts with clear, direct language that reduces cognitive load for all readers.

### Write for Clarity

Use simple, direct language that communicates efficiently:

<CodeGroup>
```markdown ❌ Complex Language
Subsequently, in order to implement the aforementioned functionality,
it is necessary to instantiate the configuration object with the
appropriate parameters as delineated in the following example.
```

```markdown ✅ Clear Language
Next, create a configuration object with these settings:
```

</CodeGroup>

### Meaningful Headings

Write headings that describe content accurately and help users navigate efficiently:

<Tabs>
<Tab title="Poor Headings">
```markdown
# Introduction
## Getting Started
## More Information
## Advanced Stuff
```
</Tab>

<Tab title="Descriptive Headings">
```markdown
# User Authentication Setup
## Installing the Authentication SDK
## Configuring Your First Login Flow
## Handling Authentication Errors
## Multi-Factor Authentication Options
```
</Tab>
</Tabs>

<Tip>
    **Screen Reader Test:** Read only your headings aloud. Can someone
    understand your document structure and find what they need?
</Tip>

## Alternative Text and Media

Provide meaningful descriptions for all visual content so information isn't lost for users who can't see images.

### Effective Alt Text

Write alt text that conveys the same information the image provides:

<Steps>
<Step title="Describe the purpose, not appearance">
    Focus on what information the image conveys, not how it looks.

    ```markdown
    ❌ "Screenshot of a dashboard"
    ✅ "Dashboard showing 3 active integrations, 1,247 API calls today,
        and 99.8% uptime status"
    ```

</Step>

<Step title="Include relevant text content">
    If the image contains important text, include it in the alt text.

    ```markdown
    ❌ "Error message dialog box"
    ✅ "Error dialog stating 'Invalid API key. Please check your
        configuration and try again.' with a retry button"
    ```

</Step>
</Steps>



==================================================
FILE: writing/code-examples.mdx
==================================================
---
title: 'Writing Effective Code Examples'
description: 'Create code examples that users can trust, understand, and successfully implement in their projects.'
---

# Writing Effective Code Examples

Code examples are often the first thing developers look for in documentation. Make them count by ensuring they're accurate, complete, and genuinely helpful.

## Complete and Runnable Examples

Never show partial code that won't work in isolation. Users should be able to copy your example and see it work immediately.

<CodeGroup>
```javascript ❌ Incomplete
// Don't do this - missing imports and setup
const user = await getUser(userId);
updateProfile(user.id, { name: 'John' });
```

```javascript ✅ Complete
// Do this - everything needed to run
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUserProfile(userId, updates) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }
        
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updates
        });
        
        return updatedUser;
    } catch (error) {
        console.error('Failed to update user:', error);
        throw error;
    }
}

// Usage
const result = await updateUserProfile('user_123', { name: 'John Doe' });
```
</CodeGroup>



==================================================
FILE: writing/content-structure.mdx
==================================================
---
title: 'Content Structure That Works'
description: 'Learn how to organize documentation that guides users to success with clear hierarchy and logical flow.'
---

# Content Structure That Works

Great documentation isn't just about having the right information—it's about organizing that information so users can find and understand it quickly.

## Start with User Intent

Before writing a single word, understand what your users are trying to accomplish. Are they trying to solve a problem, learn a concept, or complete a task?

<Tip>
Always lead with the outcome. Tell users what they'll achieve before explaining how to do it.
</Tip>

### The Inverted Pyramid Approach

Structure your content like a news article—most important information first, supporting details after.

<Steps>
<Step title="Lead with the outcome">
    Start each section by describing what the user will accomplish or learn.

    ```markdown
    # Setting Up Authentication

    By the end of this guide, you'll have secure API authentication
    working in your application with proper error handling.
    ```
</Step>

<Step title="Provide essential context">
    Give users the background they need to understand the instructions.

    <Note>
    Include prerequisites, assumptions, and any important warnings upfront.
    </Note>
</Step>

<Step title="Detail the implementation">
    Break down the actual steps, code examples, and configuration details.
</Step>
</Steps>