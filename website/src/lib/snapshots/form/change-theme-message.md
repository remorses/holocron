--- step-start ---

I'll help you change the theme of the website. Let me first check the current configuration and then show you the available theme options.
````yaml tool-getProjectFiles
input: {}
output: '└── fumabase.jsonc # Use the updateFumabaseJsonc tool to update these values'

````

--- step-start ---

````yaml tool-strReplaceEditor
input:
  command: view
  path: fumabase.jsonc
output:
  success: false
  error: 'File not found: fumabase.jsonc'

````

--- step-start ---

Let me create the fumabase.jsonc file first and then update it with the theme options:
````yaml tool-strReplaceEditor
input:
  command: create
  path: fumabase.jsonc
  file_text: |-
    {
      "$schema": "https://fumabase.com/schema.json",
      "siteId": "",
      "name": "My Documentation",
      "description": "Documentation website"
    }
output: |-
  {
    "$schema": "https://fumabase.com/schema.json",
    "siteId": "",
    "name": "My Documentation",
    "description": "Documentation website"
  }

````

--- step-start ---

Now let me update the theme. Here are the available theme options:
````yaml tool-renderForm
input:
  fields:
    - name: theme
      type: select
      label: Choose a theme
      description: Select a color theme for your documentation website
      required: true
      initialValue: neutral
      options:
        - label: Black
          value: black
          description: Dark theme with black background
        - label: Catppuccin
          value: catppuccin
          description: Warm pastel color palette
        - label: Dusk
          value: dusk
          description: Soft blue and purple tones
        - label: Neutral
          value: neutral
          description: Clean, professional grayscale
        - label: Ocean
          value: ocean
          description: Blue and teal marine theme
        - label: Purple
          value: purple
          description: Rich purple accent theme
        - label: Vitepress
          value: vitepress
          description: VitePress-inspired green theme
output: >
  Rendered form to the user, the response will be sent back as a message from the user. DO NOT
  RENDER THE SAME FORM TWICE

````

--- step-start ---

I've created a form for you to choose a theme. Please select one of the available themes and I'll update your website configuration.