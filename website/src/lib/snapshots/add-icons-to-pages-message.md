--- step-start ---


````md reasoning
**Considering icon additions**

The user wants to add icons to all documentation pages, which means each page needs a frontmatter entry for an icon. I’ll start by identifying all the relevant `.md` and `.mdx` files in the content directories. For pages lacking icons, I’ll need to determine suitable ones. 

I could pull from the large list of available icons, but that might be overwhelming. A more efficient way might be to relate each page's title to an appropriate icon. Alternatively, I could ask the user for help mapping icons.
````


````md reasoning
**Updating icon frontmatter**

I need to insert icons into the frontmatter for each documentation page. Since the user might expect specific icons, I could consider a generic icon like 'file-text' if none are provided. I'll have to ask the user what icons to assign, but that might lead to tedious forms for each page.

The simpler approach might be to set 'file-text' as the default for all pages. However, the user likely wants a bulk update that incorporates meaningful icons. I’ll fetch the project files first to target the content folder and then systematically insert the chosen icon into each page's frontmatter.
````


````md reasoning
**Preparing to update frontmatter**

I’m thinking I can identify the frontmatter in each file by searching for the first and second `---` to insert the icon line before the closing separator. It seems like a good idea to use a method that allows for inserting the line efficiently. 

However, since the user hasn't specified icon mappings for individual pages, I can assume they’re fine with a generic approach. To save time, I’ll fetch the project files first to determine the best action. Let's get that sorted!
````

````yaml tool-getProjectFiles
input: {}
output: |-
  ├── index.mdx
  ├── getting-started.mdx
  ├── api
  │   └── overview.mdx
  ├── guides
  │   └── configuration.mdx
  └── fumabase.jsonc # Use the renderForm tool to update these values

````

--- step-start ---


````md reasoning

````