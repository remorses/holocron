--- step-start ---


````md reasoning
**Updating the website theme**

The user wants to change the theme of a new, empty website. My instructions tell me I need to create pages first, but since the user mentioned the theme right away, I see that I need to focus on updating it first. The theme is stored in fumabase.jsonc, and I always need to use a specific method for editing that file. So, I’ll create a form with a radio selection for the theme options like “black,” “catppuccin,” “dusk,” etc.
````


````md reasoning
**Generating theme selection form**

I need to create a form for the user to select a theme for the documentation site. The form should have a radio button format, labeled "Theme," and include a description encouraging users to choose a color. Since the file doesn’t exist or lacks a theme entry, I could start with “neutral” as the initial value. I'll avoid using any extra features for this task and just proceed with the standard setup for generating the form.
````

````yaml tool-renderForm
input:
  fields:
    - name: theme
      type: radio
      label: Theme
      description: Select a color theme for the documentation site
      required: true
      groupTitle: null
      placeholder: null
      initialValue: neutral
      min: null
      max: null
      step: null
      options:
        - label: black
          value: black
          description: null
        - label: catppuccin
          value: catppuccin
          description: null
        - label: dusk
          value: dusk
          description: null
        - label: neutral
          value: neutral
          description: null
        - label: ocean
          value: ocean
          description: null
        - label: purple
          value: purple
          description: null
        - label: vitepress
          value: vitepress
          description: null
      href: null
output: >-
  Rendered form to the user, the response will be sent back as a message from the user. DO NOT
  RENDER THE SAME FORM TWICE

````

--- step-start ---