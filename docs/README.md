---
title: 'What is Fumadocs?'
description: 'Learn what Fumadocs is, its core features, and why it is the best choice for modern documentation.'
---

# What is Fumadocs?
Fumadocs is a modern, flexible documentation framework designed to help you create beautiful, user-friendly, and highly maintainable documentation sites with ease. Built for technical teams, open source projects, and product documentation, Fumadocs combines the power of Markdown/MDX with a rich set of UI components and best practices for content structure, accessibility, and developer experience.

<Frame caption="Fumadocs documentation site example">
<img src="/images/fumadocs.jpeg" alt="Screenshot of a Fumadocs-powered documentation site" />
</Frame>

## Who Uses Fumadocs?

Fumadocs is trusted by:

- **Open source projects** that need clear, collaborative, and easy-to-maintain documentation.
- **Product teams** who want to deliver seamless onboarding and support for their users.
- **Developer platforms** requiring interactive guides, API references, and code samples.
- **Internal teams** building knowledge bases, runbooks, and technical handbooks.

<Info>
Fumadocs is designed to scale from a single README to a full product suite documentation portal.
</Info>

## How Fumadocs Works

Fumadocs uses a content-first approach:

<Steps>
<Step title="Write in Markdown or MDX">
    Author your docs using Markdown for simplicity, or MDX for interactive and dynamic content.
</Step>
<Step title="Use Built-in Components">
    Enhance your docs with callouts, steps, tabs, code groups, cards, and more—just by adding simple tags.
</Step>
<Step title="Preview and Iterate">
    Use the Fumabase CLI to preview your site locally, with instant reloads as you write.
</Step>
<Step title="Deploy Instantly">
    Connect your GitHub repo for automatic deployments, or export static files for any hosting provider.
</Step>
</Steps>

## Fumadocs vs. Other Documentation Tools

<Tabs>
<Tab title="Fumadocs">
- MDX and Markdown support out of the box
- Rich, accessible UI components
- No vendor lock-in—export static files anytime
- Designed for both technical and non-technical writers
- Opinionated best practices, but fully extensible
</Tab>
<Tab title="Traditional Docs Generators">
- Limited interactivity and component support
- Often require complex configuration
- Less focus on accessibility and design
- May lock you into a specific ecosystem
</Tab>
<Tab title="Custom Solutions">
- High maintenance burden
- Inconsistent user experience
- Harder for new contributors to onboard
- Risk of technical debt over time
</Tab>
</Tabs>

<Note>
Fumadocs is open source and community-driven. You can contribute new components, report issues, or suggest features to help shape the future of documentation.
</Note>

## Frequently Asked Questions

<AccordionGroup>
<Accordion title="Can I migrate my existing docs to Fumadocs?">
Yes! You can import your Markdown files directly. For advanced features, simply add MDX or use Fumadocs components.
</Accordion>
<Accordion title="Does Fumadocs support custom domains and branding?">
Absolutely. You can set your own domain, logo, colors, and layout to match your brand.
</Accordion>
<Accordion title="Is Fumadocs suitable for API documentation?">
Yes. Fumadocs includes components for code samples, parameter tables, and request/response examples, making it ideal for API docs.
</Accordion>
<Accordion title="How do I get support or contribute?">
Join our community on GitHub or reach out via the support channels listed in your dashboard.
</Accordion>
</AccordionGroup>

<Info>
Ready to get started? Follow the quickstart steps below or explore the rest of the documentation to learn more.
</Info>

---



## Key Features

- **MDX-first**: Write documentation using Markdown and MDX, with support for React components and interactive content.
- **Component-rich**: Use built-in components for callouts, steps, tabs, code groups, cards, and more—no extra setup required.
- **Accessible by default**: Fumadocs enforces accessibility best practices, ensuring your docs are usable by everyone.
- **Customizable design**: Easily adjust colors, layout, and branding to match your product or company style.
- **SEO optimized**: Automatic meta tags, structured data, and fast-loading pages help your docs rank well in search engines.
- **Instant preview & deploy**: Preview changes locally with the Fumabase CLI and deploy instantly with GitHub integration.
- **Progressive disclosure**: Organize content for both beginners and experts, with collapsible sections, tabs, and navigation aids.

<Tip>
Fumadocs is ideal for teams who want to focus on content, not configuration. You get a best-practices setup out of the box, but can extend and customize as your needs grow.
</Tip>

## Why Choose Fumadocs?

- **Faster onboarding**: New contributors can start writing immediately—no complex build steps or custom syntax to learn.
- **Consistent user experience**: Built-in UI patterns ensure your docs are always clear, navigable, and visually appealing.
- **Scalable for any project**: From small libraries to large product suites, Fumadocs adapts to your documentation needs.
- **Open and extensible**: Add your own components, integrate with analytics, or automate workflows using the Fumabase platform.

<Check>
With Fumadocs, you can deliver world-class documentation that delights users and empowers your team.
</Check>

## Next Steps

- Explore the [Essentials](/essentials/frontmatter) to learn about frontmatter, images, code blocks, and Markdown syntax in Fumadocs.
- Read the [Writing Guides](/writing/content-structure) for tips on structure, accessibility, and user-focused documentation.
- Try editing this project locally using the steps below!

---


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
