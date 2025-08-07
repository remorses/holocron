--- step-start ---


````md reasoning

````

````yaml tool-strReplaceEditor
input:
  command: create
  path: essentials/code.mdx
  file_text: |
    ---
    title: 'Code Blocks'
    description: 'Display inline code and code blocks'
    icon: 'code'
    ---

    ## Basic

    ### Inline Code

    Use backticks (`) to denote inline code: `example`.

    ```md
    Use backticks (`) to denote inline code: `example`.
    ```

    ### Code Block

    Enclose code in triple backticks with language specifier:

    ```javascript example.js
    console.log('Hello, world!');
    ```

    ```mdx
    ```javascript example.js
    console.log('Hello, world!');
    ```
    ```
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: |
  ---
  title: 'Code Blocks'
  description: 'Display inline code and code blocks'
  icon: 'code'
  ---

  ## Basic

  ### Inline Code

  Use backticks (`) to denote inline code: `example`.

  ```md
  Use backticks (`) to denote inline code: `example`.
  ```

  ### Code Block

  Enclose code in triple backticks with language specifier:

  ```javascript example.js
  console.log('Hello, world!');
  ```

  ```mdx
  ```javascript example.js
  console.log('Hello, world!');
  ```
  ```

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: essentials/frontmatter.mdx
  file_text: >
    ---

    title: 'Frontmatter'

    description: 'Configure page metadata and display properties'

    icon: 'file-text'

    ---


    ## Overview


    Frontmatter is YAML metadata at the top of your MDX files. It controls page title, description,
    and icon.


    ```yaml

    ---

    title: 'Page Title'

    description: 'Brief description'

    icon: 'icon-name'

    ---

    ```


    ### Required Fields


    - **title**: Page title shown in sidebar

    - **description**: SEO description


    <Tip>

    Find icon names at [lucide.dev](https://lucide.dev).

    </Tip>
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: >
  ---

  title: 'Frontmatter'

  description: 'Configure page metadata and display properties'

  icon: 'file-text'

  ---


  ## Overview


  Frontmatter is YAML metadata at the top of your MDX files. It controls page title, description,
  and icon.


  ```yaml

  ---

  title: 'Page Title'

  description: 'Brief description'

  icon: 'icon-name'

  ---

  ```


  ### Required Fields


  - **title**: Page title shown in sidebar

  - **description**: SEO description


  <Tip>

  Find icon names at [lucide.dev](https://lucide.dev).

  </Tip>

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: essentials/markdown.mdx
  file_text: |
    ---
    title: 'Markdown Syntax'
    description: 'Text formatting, links, and headings in Markdown'
    icon: 'text'
    ---

    ## Headings

    Use `#` for headings:

    ```md
    # H1
    ## H2
    ### H3
    ```

    ## Text Formatting

    - **Bold**: `**bold**`
    - _Italic_: `_italic_`
    - `Code`: `` `code` ``

    ## Links

    ```md
    [Link text](https://example.com)
    ```
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: |
  ---
  title: 'Markdown Syntax'
  description: 'Text formatting, links, and headings in Markdown'
  icon: 'text'
  ---

  ## Headings

  Use `#` for headings:

  ```md
  # H1
  ## H2
  ### H3
  ```

  ## Text Formatting

  - **Bold**: `**bold**`
  - _Italic_: `_italic_`
  - `Code`: `` `code` ``

  ## Links

  ```md
  [Link text](https://example.com)
  ```

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: essentials/images.mdx
  file_text: >
    ---

    title: 'Images and Embeds'

    description: 'Add images, videos, and HTML elements'

    icon: 'image'

    ---


    ## Images


    ![Fumabase Logo](/images/logo.png)


    ```md

    ![Alt text](/path/image.png)

    ```


    ## Embeds


    Use HTML for rich embeds:


    ```html

    <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameBorder="0"
    allowFullScreen></iframe>

    ```
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: |
  ---
  title: 'Images and Embeds'
  description: 'Add images, videos, and HTML elements'
  icon: 'image'
  ---

  ## Images

  ![Fumabase Logo](/images/logo.png)

  ```md
  ![Alt text](/path/image.png)
  ```

  ## Embeds

  Use HTML for rich embeds:

  ```html
  <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameBorder="0" allowFullScreen></iframe>
  ```

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: writing/accessibility.mdx
  file_text: |
    ---
    title: 'Accessibility'
    description: 'Ensure documentation is accessible to all users'
    icon: 'eye'
    ---

    ## Alt Text

    Provide descriptive alt text for images:

    ```md
    ![Dashboard showing metrics and charts](dashboard.png)
    ```

    ## Headings

    Use meaningful headings for structure and navigation.
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: |
  ---
  title: 'Accessibility'
  description: 'Ensure documentation is accessible to all users'
  icon: 'eye'
  ---

  ## Alt Text

  Provide descriptive alt text for images:

  ```md
  ![Dashboard showing metrics and charts](dashboard.png)
  ```

  ## Headings

  Use meaningful headings for structure and navigation.

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: writing/code-examples.mdx
  file_text: |
    ---
    title: 'Code Examples'
    description: 'Best practices for writing effective code snippets'
    icon: 'code'
    ---

    ## Complete Examples

    Provide runnable examples:

    ```javascript
    console.log('Hello, world!');
    ```

    ## Error Handling

    Show realistic failure scenarios:

    ```javascript
    try {
      await fetch('/api');
    } catch (e) {
      console.error('Request failed', e);
    }
    ```
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: |
  ---
  title: 'Code Examples'
  description: 'Best practices for writing effective code snippets'
  icon: 'code'
  ---

  ## Complete Examples

  Provide runnable examples:

  ```javascript
  console.log('Hello, world!');
  ```

  ## Error Handling

  Show realistic failure scenarios:

  ```javascript
  try {
    await fetch('/api');
  } catch (e) {
    console.error('Request failed', e);
  }
  ```

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: README.md
  file_text: >+
    # Documentation Starter Kit


    This project contains essential guides for writing and formatting documentation using MDX and
    Fumabase components.


    ## Development


    ```bash

    npm install -g fumabase

    fumabase dev

    ```

  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: >+
  # Documentation Starter Kit


  This project contains essential guides for writing and formatting documentation using MDX and
  Fumabase components.


  ## Development


  ```bash

  npm install -g fumabase

  fumabase dev

  ```


````

--- step-start ---

Completed website scaffolding.