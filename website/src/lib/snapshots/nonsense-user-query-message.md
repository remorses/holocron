--- step-start ---


````md reasoning

````

````yaml tool-strReplaceEditor
input:
  command: create
  path: README.md
  file_text: >
    # Fumabase Starter Kit


    ### Development


    ## 1. Install the Fumabase CLI


    To preview your documentation changes locally, first install the [Fumabase
    CLI](https://www.npmjs.com/package/fumabase). Use the following command:


    ```

    npm i -g fumabase

    ```


    ## 2. Start the Local Development Server


    At the root of your documentation project (where `fumabase.jsonc` is located), start the
    development server with:


    ```

    fumabase dev

    ```


    ### Publishing Changes


    ## 3. Set Up Automatic Deployments


    Install our GitHub App to enable automated deployments from your repository. After pushing
    changes to your default branch, your documentation will be deployed to production automatically.
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: >
  # Fumabase Starter Kit


  ### Development


  ## 1. Install the Fumabase CLI


  To preview your documentation changes locally, first install the [Fumabase
  CLI](https://www.npmjs.com/package/fumabase). Use the following command:


  ```

  npm i -g fumabase

  ```


  ## 2. Start the Local Development Server


  At the root of your documentation project (where `fumabase.jsonc` is located), start the
  development server with:


  ```

  fumabase dev

  ```


  ### Publishing Changes


  ## 3. Set Up Automatic Deployments


  Install our GitHub App to enable automated deployments from your repository. After pushing changes
  to your default branch, your documentation will be deployed to production automatically.

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: essentials/code.mdx
  file_text: >
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


    Use [fenced code blocks](https://www.markdownguide.org/extended-syntax/#fenced-code-blocks) by
    enclosing code in three backticks and follow the leading ticks with the programming language of
    your snippet. Optionally, you can also write the filename after the language.


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
  insert_line: null
  new_str: null
  old_str: null
  view_range: null
output: >
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


  Use [fenced code blocks](https://www.markdownguide.org/extended-syntax/#fenced-code-blocks) by
  enclosing code in three backticks and follow the leading ticks with the programming language of
  your snippet. Optionally, you can also write the filename after the language.


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


    Frontmatter is YAML metadata placed at the beginning of your markdown files. It controls how
    your page is displayed and indexed.


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


    Meta description used for SEO and displayed in search results. Also shown in the document
    overview.


    ```yaml

    description: 'Learn how to set up and configure your project'

    ```


    ## Optional Properties


    ### icon


    Icon name from [Lucide icons](https://lucide.dev) displayed next to the page title in the
    sidebar.


    ```yaml

    icon: 'rocket'        # Shows rocket icon

    icon: 'book-open'     # Shows book-open icon

    icon: 'settings'      # Shows settings icon

    ```


    <Tip>

    Browse the full icon library at [lucide.dev](https://lucide.dev) to find the perfect icon for
    your page.

    </Tip>


    ## Example


    Here's a complete frontmatter example:


    ```yaml

    ---

    title: 'API Reference'

    description: 'Complete API documentation with examples and response schemas'

    icon: 'code'

    ---


    # Your markdown content starts here

    ```


    This creates a page with:

    - "API Reference" in the sidebar and as the H1

    - SEO description for search engines

    - Code icon in the sidebar
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


  Frontmatter is YAML metadata placed at the beginning of your markdown files. It controls how your
  page is displayed and indexed.


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


  Meta description used for SEO and displayed in search results. Also shown in the document
  overview.


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

  Browse the full icon library at [lucide.dev](https://lucide.dev) to find the perfect icon for your
  page.

  </Tip>


  ## Example


  Here's a complete frontmatter example:


  ```yaml

  ---

  title: 'API Reference'

  description: 'Complete API documentation with examples and response schemas'

  icon: 'code'

  ---


  # Your markdown content starts here

  ```


  This creates a page with:

  - "API Reference" in the sidebar and as the H1

  - SEO description for search engines

  - Code icon in the sidebar

````

--- step-start ---