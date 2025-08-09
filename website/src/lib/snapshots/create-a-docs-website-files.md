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
    ├── content-structure.mdx
    ├── user-focused.mdx
    └── visual-design.mdx


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
icon: 'file'
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

### Video and Interactive Content

Provide text alternatives for multimedia content:

<AccordionGroup>
<Accordion title="Video transcripts">
Include complete transcripts for instructional videos:

```markdown
## Video: Setting Up Webhooks (3:42)

[Full transcript available]

**0:00 - 0:15** Introduction: "In this video, we'll configure webhooks
to receive real-time notifications when events occur in your application."

**0:16 - 0:45** Navigate to dashboard: "First, log into your dashboard
and click the 'Webhooks' tab in the sidebar. You'll see a list of
existing webhooks or an empty state if this is your first time."

**0:46 - 1:20** Creating a webhook: "Click 'Add Webhook' and enter your
endpoint URL. This should be a publicly accessible HTTPS URL that can
receive POST requests..."
```

</Accordion>

<Accordion title="Interactive demonstrations">
Provide step-by-step text instructions alongside interactive demos:

```markdown
## Interactive Demo: API Testing

Try our live API explorer below, or follow these equivalent steps:

1. **Set your API key:** Enter your test key in the authorization field
2. **Choose an endpoint:** Select 'GET /users' from the dropdown
3. **Add parameters:** Set limit=10 for the first 10 users
4. **Send request:** Click 'Execute' to see the live response
5. **Review response:** Examine the returned JSON structure

[Interactive API Explorer Component]
```

</Accordion>
</AccordionGroup>

<Check>
    Accessible documentation creates better experiences for everyone—users with
    disabilities, non-native speakers, people in low-bandwidth environments, and
    anyone trying to quickly find information.
</Check>



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

## Error Handling That Teaches

Show realistic error handling, not just the happy path. This teaches users about edge cases and builds more robust applications.

<Steps>
<Step title="Show common failure scenarios">
    Include examples of what happens when things go wrong.

    ```javascript
    async function fetchUserData(apiKey, userId) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        
        if (!userId) {
            throw new Error('User ID is required');
        }
        
        try {
            const response = await fetch(`/api/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Handle different HTTP status codes
            if (response.status === 401) {
                throw new Error('Invalid API key');
            }
            
            if (response.status === 404) {
                throw new Error('User not found');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError') {
                throw new Error('Network error - check your connection');
            }
            throw error; // Re-throw other errors
        }
    }
    ```
</Step>

<Step title="Demonstrate recovery strategies">
    Show users how to handle errors gracefully in their applications.

    <Tip>
    Include retry logic, fallback values, and user-friendly error messages.
    </Tip>
</Step>
</Steps>



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

## Progressive Information Disclosure

Reveal complexity gradually. Start with the simplest case that works, then build up to more sophisticated scenarios.

<Tabs>
<Tab title="Basic Example">
```javascript
// Start with the minimal working example
const response = await fetch('/api/users');
const users = await response.json();
```
</Tab>

<Tab title="With Error Handling">
```javascript
// Then show error handling
try {
    const response = await fetch('/api/users');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const users = await response.json();
} catch (error) {
    console.error('Failed to fetch users:', error);
}
```
</Tab>

<Tab title="Production Ready">
```javascript
// Finally, show production-ready implementation
const fetchUsers = async (options = {}) => {
    const { timeout = 5000, retries = 3 } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch('/api/users', {
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
};
```
</Tab>
</Tabs>

## Scannable Content Design

Most users scan before they read. Design your content to support this behavior.

### Effective Heading Hierarchy

Use headings to create a clear content outline:

```markdown
# Main Topic (H1)
## Primary Sections (H2)
### Subsections (H3)
#### Details (H4 - use sparingly)
```

<Warning>
Never skip heading levels. Going from H2 to H4 breaks screen readers and confuses users.
</Warning>



==================================================
FILE: writing/user-focused.mdx
==================================================
---
title: 'User-Focused Documentation'
description: 'Write documentation that solves real problems by understanding your users goals, context, and challenges.'
---

# User-Focused Documentation

The best documentation doesn't just explain features—it helps users accomplish their goals. Focus on outcomes, not just functionality.

## Understanding User Intent

Before documenting any feature, understand the jobs users are trying to do. Documentation should bridge the gap between what users want to achieve and how your product helps them get there.

## Write for Different Experience Levels

Lead with the simplest path that works, then provide advanced options for power users. Always include a short quick-start that gets users running in minutes.

### Quick Start Example

```javascript
import { EmailAPI } from '@company/sdk';
const client = new EmailAPI('your-api-key');
await client.send({
  to: 'user@example.com',
  subject: 'Hello World',
  html: '<h1>It works!</h1>'
});
```

## Anticipate Questions

Include troubleshooting, common errors, and success indicators so users can verify their setup quickly.



==================================================
FILE: writing/visual-design.mdx
==================================================
---
title: 'Visual Design for Documentation'
description: 'Use visual elements strategically to improve comprehension, reduce cognitive load, and guide users through complex information.'
---

# Visual Design for Documentation

Good visual design in documentation isn't about making things pretty—it's about making complex information easier to understand and act upon.

## Strategic Use of Visual Components

Every visual element should serve a purpose: reducing cognitive load, highlighting important information, or guiding user attention.

### Callouts That Guide Decision Making

Use callouts to break users out of autopilot reading and draw attention to critical information.

<Tabs>
<Tab title="Poor Usage">
<Note>
You can also use the advanced configuration options.
</Note>

<Warning>This might not work in all cases.</Warning>

<Tip>
There are several ways to do this.
</Tip>
</Tab>

<Tab title="Strategic Usage">
<Warning>
**Data Loss Risk:** This action permanently deletes all user data and cannot be undone. Only proceed if you have confirmed backups.
</Warning>

<Tip>
    **Performance Optimization:** Set `batchSize: 100` for datasets larger than
    10,000 records to avoid memory issues and improve processing speed.
</Tip>

<Check>
**Verification Complete:** Your SSL certificate is properly configured. Users will see the secure lock icon when accessing your application.
</Check>
</Tab>
</Tabs>

### Visual Hierarchy with Typography

Create clear information hierarchy using heading levels, text styling, and spacing.

<Steps>
<Step title="Establish clear heading levels">
    Use consistent heading hierarchy to create scannable content structure.

    ```markdown
    # Main Feature (H1)
    ## Setup Process (H2)
    ### Individual Steps (H3)
    #### Implementation Details (H4)
    ```

    <Info>
    **Heading Strategy:** Users scan headings first. Make them descriptive and outcome-focused rather than feature-focused.
    </Info>

</Step>

<Step title="Use emphasis purposefully">
    **Bold text** for critical terms and concepts users need to remember.

    *Italic text* for emphasis within sentences and technical terms.

    `Code formatting` for exact values, filenames, and commands.

    <Note>
    Avoid overusing emphasis—when everything is highlighted, nothing stands out.
    </Note>

</Step>
</Steps>