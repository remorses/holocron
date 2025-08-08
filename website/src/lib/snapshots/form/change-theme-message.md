--- step-start ---


````md reasoning
**Changing website theme**

The user wants to change the website theme, possibly in fumabase.jsonc. According to developer instructions, I need to use the renderForm tool to display a UI for editing. The fumabase.jsonc file includes a "theme" property with an enum list. Since we can only present one form input at a time, I think the best approach is to use a single select field that allows the user to choose from themes like black, catppuccin, dusk, and others. I should also consider including options for cssVariables.
````


````md reasoning
**Presenting theme options**

The user only wants to change the theme, so I should present a select input for that. I need to call the functions.renderForm tool with a fields array that includes one select field. I’ll name it "theme," set the label to "Site theme," and mark it as required. I could set the initial value to "neutral," but it might work better to leave it null. The options will have labels and values to match the allowed themes. Now, let’s call renderForm!
````

````yaml tool-renderForm
input:
  fields:
    - name: theme
      type: select
      label: Site theme
      description: Choose the color theme for the documentation site.
      required: true
      groupTitle: null
      placeholder: null
      initialValue: neutral
      min: null
      max: null
      step: null
      options:
        - label: Black
          value: black
          description: High-contrast dark theme.
        - label: Catppuccin
          value: catppuccin
          description: Soft pastel dark theme.
        - label: Dusk
          value: dusk
          description: Warm dusk-inspired theme.
        - label: Neutral
          value: neutral
          description: Balanced neutral theme.
        - label: Ocean
          value: ocean
          description: Cool blue ocean theme.
        - label: Purple
          value: purple
          description: Vibrant purple-accent theme.
        - label: Vitepress
          value: vitepress
          description: Light, minimal theme similar to VitePress.
      href: null
output: >-
  Rendered form to the user, the response will be sent back as a message from the user. DO NOT
  RENDER THE SAME FORM TWICE

````

--- step-start ---

Select a theme from the form.