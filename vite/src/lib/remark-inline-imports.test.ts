import { describe, expect, test } from 'vitest'
import { remarkInlineImports, type InlineImportEntry } from './remark-inline-imports.ts'
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root } from 'mdast'
import remarkMdx from 'remark-mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { remark } from 'remark'

function runInlineImports(
  content: string,
  resolvedImports: Map<string, InlineImportEntry>,
) {
  const plugin = remarkInlineImports
  const options = { resolvedImports }
  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(plugin, options)

  const parsed = processor.parse(content)
  const transformed = processor.runSync(parsed) as Root

  return {
    transformed,
    markdown: toMarkdown(transformed, {
      extensions: [gfmToMarkdown(), mdxToMarkdown(), frontmatterToMarkdown(['yaml'])],
    }),
  }
}

describe('remarkInlineImports', () => {
  test('inlines a simple .md default import, keeps import declaration', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/guide.md', {
        content: 'This is the guide content.\n\nSecond paragraph.',
        absPath: '/project/snippets/guide.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Guide from './snippets/guide.md'

# My Page

<Guide />

Some footer text.
`, imports)

    // Import declaration is kept as dead code (for HMR + line number preservation)
    expect(result.markdown).toContain("import Guide from './snippets/guide.md'")
    // Content is inlined in place of <Guide />
    expect(result.markdown).toContain('This is the guide content.')
    expect(result.markdown).toContain('Second paragraph.')
    expect(result.markdown).toContain('Some footer text.')
    // <Guide /> usage is gone
    expect(result.markdown).not.toContain('<Guide />')
  })

  test('rewrites relative image URLs in inlined content', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/guide.md', {
        content: '![diagram](./diagram.png)\n\nSome text with ![icon](../assets/icon.svg).',
        absPath: '/project/snippets/guide.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Guide from './snippets/guide.md'

<Guide />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Guide from './snippets/guide.md'

      ![diagram](./snippets/diagram.png)

      Some text with ![icon](./assets/icon.svg).
      "
    `)
  })

  test('rewrites relative link URLs in inlined content', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./docs/intro.md', {
        content: 'See [setup](./setup.md) and [API](../api/overview.md).',
        absPath: '/project/docs/intro.md',
        relativeDir: './docs/',
      }],
    ])

    const result = runInlineImports(`
import Intro from './docs/intro.md'

<Intro />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Intro from './docs/intro.md'

      See [setup](./docs/setup.md) and [API](./api/overview.md).
      "
    `)
  })

  test('leaves absolute and external URLs unchanged', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/links.md', {
        content: 'See [docs](/docs/intro) and [GitHub](https://github.com).\n\n![logo](/images/logo.png)',
        absPath: '/project/snippets/links.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Links from './snippets/links.md'

<Links />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Links from './snippets/links.md'

      See [docs](/docs/intro) and [GitHub](https://github.com).

      ![logo](/images/logo.png)
      "
    `)
  })

  test('handles multiple usages of the same import', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/note.md', {
        content: 'Important note here.',
        absPath: '/project/snippets/note.md',
        relativeDir: './',
      }],
    ])

    const result = runInlineImports(`
import Note from './snippets/note.md'

# Section 1

<Note />

# Section 2

<Note />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Note from './snippets/note.md'

      # Section 1

      Important note here.

      # Section 2

      Important note here.
      "
    `)
  })

  test('preserves non-.md imports (tsx, ts, jsx, js)', () => {
    // Only .md/.mdx imports should be in the resolvedImports map.
    // Non-md imports should pass through unchanged.
    const imports = new Map<string, InlineImportEntry>()

    const result = runInlineImports(`
import Button from './components/button.tsx'

# My Page

<Button />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Button from './components/button.tsx'

      # My Page

      <Button />
      "
    `)
  })

  test('strips frontmatter from inlined content', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/guide.md', {
        content: '---\ntitle: Guide\ndescription: Some description\n---\n\n# Guide Title\n\nGuide content.',
        absPath: '/project/snippets/guide.md',
        relativeDir: './',
      }],
    ])

    const result = runInlineImports(`
import Guide from './snippets/guide.md'

<Guide />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Guide from './snippets/guide.md'

      # Guide Title

      Guide content.
      "
    `)
  })

  test('only inlines default imports, leaves named imports alone', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/guide.md', {
        content: 'Guide content.',
        absPath: '/project/snippets/guide.md',
        relativeDir: './',
      }],
    ])

    // Named import should not be inlined
    const result = runInlineImports(`
import { something } from './snippets/guide.md'

# Page
`, imports)

    // The import should still be there since it's named, not default
    expect(result.markdown).toContain("import { something } from './snippets/guide.md'")
  })

  test('rewrites JSX src/href attributes in inlined content', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/images.md', {
        content: '<Image src="./photo.png" alt="A photo" />\n\n<a href="./details.md">Details</a>',
        absPath: '/project/snippets/images.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Images from './snippets/images.md'

<Images />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Images from './snippets/images.md'

      <Image src="./snippets/photo.png" alt="A photo" />

      <a href="./snippets/details.md">Details</a>
      "
    `)
  })

  test('same-directory import (relativeDir = ./) does not modify URLs', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./sibling.md', {
        content: '![img](./local.png)',
        absPath: '/project/pages/sibling.md',
        relativeDir: './',
      }],
    ])

    const result = runInlineImports(`
import Sibling from './sibling.md'

<Sibling />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Sibling from './sibling.md'

      ![img](./local.png)
      "
    `)
  })

  test('rewrites import sources precisely, not export constants with same string', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/section.mdx', {
        content: 'export const path = \'./badge\'\nimport Badge from \'./badge\'\n\n<Badge />',
        absPath: '/project/snippets/section.mdx',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Section from './snippets/section.mdx'

<Section />
`, imports)

    // The import source should be rewritten but the export constant should NOT.
    // The serializer may change quote style; check paths not quotes.
    expect(result.markdown).toMatch(/from\s+['"]\.\/snippets\/badge['"]/)
    // The export constant should keep the original ./badge path
    expect(result.markdown).toMatch(/export const path = ['"]\.\/badge['"]/)
  })

  test('rewrites relative import sources in inlined .mdx content', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/section.mdx', {
        content: 'import Badge from \'./badge\'\nimport { utils } from \'../lib/utils\'\n\n<Badge /> and some text.',
        absPath: '/project/snippets/section.mdx',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Section from './snippets/section.mdx'

<Section />
`, imports)

    // ./badge should become ./snippets/badge (relative to parent)
    // ../lib/utils should become ./lib/utils (resolved through snippets/../lib)
    // The serializer may use double quotes; check the path not the quote style.
    expect(result.markdown).toMatch(/from\s+['"]\.\/snippets\/badge['"]/)
    expect(result.markdown).toMatch(/from\s+['"]\.\/lib\/utils['"]/)
  })

  test('rewrites .md links with anchor fragments', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./docs/intro.md', {
        content: 'See [installation](./setup.md#installation) and [the config section](../config.md#advanced).',
        absPath: '/project/docs/intro.md',
        relativeDir: './docs/',
      }],
    ])

    const result = runInlineImports(`
import Intro from './docs/intro.md'

<Intro />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Intro from './docs/intro.md'

      See [installation](./docs/setup.md#installation) and [the config section](./config.md#advanced).
      "
    `)
  })

  test('leaves bare anchor links unchanged', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/nav.md', {
        content: 'Jump to [top](#top) or [overview](#overview).',
        absPath: '/project/snippets/nav.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Nav from './snippets/nav.md'

<Nav />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Nav from './snippets/nav.md'

      Jump to [top](#top) or [overview](#overview).
      "
    `)
  })

  test('rewrites deeply nested relative paths (../../)', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./guides/advanced/tuning.md', {
        content: 'See [intro](../../intro.md) and [basic setup](../basic/setup.md).\n\n![arch](../../images/arch.png)',
        absPath: '/project/guides/advanced/tuning.md',
        relativeDir: './guides/advanced/',
      }],
    ])

    const result = runInlineImports(`
import Tuning from './guides/advanced/tuning.md'

<Tuning />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Tuning from './guides/advanced/tuning.md'

      See [intro](./intro.md) and [basic setup](./guides/basic/setup.md).

      ![arch](./images/arch.png)
      "
    `)
  })

  test('rewrites links from deeply nested relativeDir', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./a/b/c/snippet.md', {
        content: 'Go to [sibling](./other.md) or [parent](../parent.md).',
        absPath: '/project/a/b/c/snippet.md',
        relativeDir: './a/b/c/',
      }],
    ])

    const result = runInlineImports(`
import Snippet from './a/b/c/snippet.md'

<Snippet />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Snippet from './a/b/c/snippet.md'

      Go to [sibling](./a/b/c/other.md) or [parent](./a/b/parent.md).
      "
    `)
  })

  test('rewrites links with query strings', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/links.md', {
        content: 'See [raw source](./example.md?raw) and [component](./widget.tsx?inline).',
        absPath: '/project/snippets/links.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Links from './snippets/links.md'

<Links />
`, imports)

    // query strings are part of the URL and get joined with relativeDir
    expect(result.markdown).toMatchInlineSnapshot(`
      "import Links from './snippets/links.md'

      See [raw source](./snippets/example.md?raw) and [component](./snippets/widget.tsx?inline).
      "
    `)
  })

  test('handles mix of .md links, external links, and absolute links', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./docs/overview.md', {
        content: 'Read [setup](./setup.md), visit [GitHub](https://github.com), check [API](/api/ref), and see [config](./config.md#options).',
        absPath: '/project/docs/overview.md',
        relativeDir: './docs/',
      }],
    ])

    const result = runInlineImports(`
import Overview from './docs/overview.md'

<Overview />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Overview from './docs/overview.md'

      Read [setup](./docs/setup.md), visit [GitHub](https://github.com), check [API](/api/ref), and see [config](./docs/config.md#options).
      "
    `)
  })

  test('rewrites JSX href linking to .md files', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/card.md', {
        content: '<Card href="./details.md">Details</Card>\n\n<a href="../other.md#section">Other page</a>',
        absPath: '/project/snippets/card.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import CardSnippet from './snippets/card.md'

<CardSnippet />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import CardSnippet from './snippets/card.md'

      <Card href="./snippets/details.md">Details</Card>

      <a href="./other.md#section">Other page</a>
      "
    `)
  })

  test('does not rewrite mailto: and tel: links', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/contact.md', {
        content: 'Email [us](mailto:hi@example.com) or call [support](tel:+1234567890).',
        absPath: '/project/snippets/contact.md',
        relativeDir: './snippets/',
      }],
    ])

    const result = runInlineImports(`
import Contact from './snippets/contact.md'

<Contact />
`, imports)

    expect(result.markdown).toMatchInlineSnapshot(`
      "import Contact from './snippets/contact.md'

      Email [us](mailto:hi@example.com) or call [support](tel:+1234567890).
      "
    `)
  })

  test('does not inline when no usages found (import kept as dead code)', () => {
    const imports = new Map<string, InlineImportEntry>([
      ['./snippets/unused.md', {
        content: 'Unused content.',
        absPath: '/project/snippets/unused.md',
        relativeDir: './',
      }],
    ])

    const result = runInlineImports(`
import Unused from './snippets/unused.md'

# Page without usage
`, imports)

    // Import should remain since the component was never used
    expect(result.markdown).toContain("import Unused from './snippets/unused.md'")
  })
})
