/**
 * Mock blog provider for integration testing.
 *
 * Returns hardcoded articles without any external API dependency.
 * Configured as a runtime provider (static: false) so generate() runs
 * at request time and the result is cached.
 */

import type { CustomTabProvider } from '@holocron.so/vite'

let generateCallCount = 0

const articles = [
  {
    slug: 'hello-world',
    title: 'Hello World',
    description: 'First blog post',
    body: 'This is the **first** blog post from the runtime provider.',
    tag: 'Getting Started',
  },
  {
    slug: 'second-post',
    title: 'Second Post',
    description: 'Another article',
    body: 'This is the second article with some content.',
    tag: 'Getting Started',
  },
  {
    slug: 'advanced-topic',
    title: 'Advanced Topic',
    description: 'Deep dive',
    body: 'Advanced content about runtime providers.',
    tag: 'Advanced',
  },
]

const provider: CustomTabProvider = {
  name: 'mock-blog',
  static: false,
  ttlMs: 5_000, // 5 seconds for testing

  async generate({ tab }) {
    generateCallCount++
    const base = tab.base ?? 'blog'

    const mdxContent: Record<string, string> = {}
    const tagGroups = new Map<string, string[]>()

    for (const article of articles) {
      const slug = `${base}/${article.slug}`
      mdxContent[slug] = [
        '---',
        `title: "${article.title}"`,
        `description: "${article.description}"`,
        '---',
        '',
        `# ${article.title}`,
        '',
        article.body,
      ].join('\n')

      const existing = tagGroups.get(article.tag)
      if (existing) {
        existing.push(slug)
      } else {
        tagGroups.set(article.tag, [slug])
      }
    }

    const groups = Array.from(tagGroups.entries()).map(([tag, slugs]) => ({
      group: tag,
      pages: slugs,
    }))

    return { groups, mdxContent }
  },
}

export default provider

// Expose call count for testing cache behavior
export { generateCallCount }
