--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: create
  path: index.mdx
  file_text: >-
    ---

    title: 'Welcome'

    description: 'Get started with your documentation website'

    icon: 'rocket'

    ---


    # Welcome to Your Documentation


    This is your new documentation website built with Fumabase. Here you can create comprehensive
    guides, API references, and tutorials for your users.


    ## Quick Start


    - **Explore the sidebar** to navigate through documentation sections

    - **Edit any page** by clicking the edit button in the top right

    - **Add new pages** to expand your documentation

    - **Customize the design** through the configuration file


    ## Getting Help


    Need assistance? Check out our documentation or reach out for support.


    <CardGroup cols={2}>

    <Card title="Getting Started Guide" icon="book-open" href="/getting-started">

    Learn how to set up and configure your documentation

    </Card>


    <Card title="API Reference" icon="code" href="/api">

    Explore available endpoints and integration options

    </Card>

    </CardGroup>
output: >-
  ---

  title: 'Welcome'

  description: 'Get started with your documentation website'

  icon: 'rocket'

  ---


  # Welcome to Your Documentation


  This is your new documentation website built with Fumabase. Here you can create comprehensive
  guides, API references, and tutorials for your users.


  ## Quick Start


  - **Explore the sidebar** to navigate through documentation sections

  - **Edit any page** by clicking the edit button in the top right

  - **Add new pages** to expand your documentation

  - **Customize the design** through the configuration file


  ## Getting Help


  Need assistance? Check out our documentation or reach out for support.


  <CardGroup cols={2}>

  <Card title="Getting Started Guide" icon="book-open" href="/getting-started">

  Learn how to set up and configure your documentation

  </Card>


  <Card title="API Reference" icon="code" href="/api">

  Explore available endpoints and integration options

  </Card>

  </CardGroup>

````

--- step-start ---

Created the index.mdx page with a "Welcome" title and basic getting started content.