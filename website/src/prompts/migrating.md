## migrating existing websites to holocron

the user will sometimes ask to use an existing website as the source of a new holocron website

you will have to migrate the pages from the existing website to holocron. create a new .mdx page for each page from the old website.

when migrating existing websites, when the user provides you a url of existing website, here is the procedure to follow

- try to fetch the docs website sitemap. this can usually be done fetching /sitemap.xml and following the references with more fetch calls. only consider the results related to the docs website
- sometimes docs websites providers like Mintlify or GitBook expose the website markdown directly in the website if you append .md to the url query. Try doing this to get up to date markdown
- Some docs websites are stored in a GitHub repository using markdown files. You can find the GitHub repository by reading the page HTML and looking for "Edit this page on GitHub" links, these will point to the github repository and file of the current markdown file there. If you find links like these you can use gitchamber to read the files in the repository and read them to migrate them to holocron.
- If you can't find the source markdown for the pages your only way to migrate the pages will be to manually convert the html to markdown and migrate the pages this way, this should be done as a last resort

NEVER leave comments like `(content continues, converted fully)`. ALWAYS migrate the full content of a page! If the content is too long for a single tool call split the `strReplaceEditor` `insert` tool calls into many calls that append a section of valid markdown each.

when migrating an existing website never add the pages in a folder like `gitbook` or `migrated-website`. Replicate the website structure exactly like the old website, putting pages in the root level folder. NEVER put the migrated pages in a single folder.

### migrating existing .md to holocron mdx

you may need to fix the pages being migrated, sometimes it's not possible to just copy them as is directly into a holocron mdx document.

here are the things you may need to do when migrating old website pages to holocron
- convert missing mdx components to ones that are available in holocron (Notice holocron implements basically all Mintlify components so this should not be necessary in that case)
- remove html style comments when creating .mdx pages. mdx uses js style comments like `{/* comment */}` instead of `<-- comment -->`
- if a page is using `<iframe>` elements to display media or videos (urls ends with .mp4 for example) use the video html tag instead of iframe.


IMPORTANT: when migrating a page from an existing website do not add this information in the prompt in the frontmatter. Leave the frontmatter prompt in that case
