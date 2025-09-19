## Available CSS Variables

The following CSS custom properties (variables) are always available for the docs website, these should always be set using the `renderForm` tool with a color field.

### Color Variables

| Variable                          | Description                                     | Example Value           |
| --------------------------------- | ----------------------------------------------- | ----------------------- |
| `--color-fd-background`           | Main background color                           | `hsl(0, 0%, 98%)`       |
| `--color-fd-foreground`           | Default foreground (text) color                 | `hsl(0, 0%, 3.9%)`      |
| `--color-fd-muted`                | Muted background color (subtle backgrounds)     | `hsl(0, 0%, 96.1%)`     |
| `--color-fd-muted-foreground`     | Muted text color (lower contrast text)          | `hsl(0, 0%, 45.1%)`     |
| `--color-fd-popover`              | Popover background color                        | `hsl(0, 0%, 100%)`      |
| `--color-fd-popover-foreground`   | Popover text/foreground color                   | `hsl(0, 0%, 15.1%)`     |
| `--color-fd-card`                 | Card background color                           | `hsl(0, 0%, 99.7%)`     |
| `--color-fd-card-foreground`      | Card foreground (text) color                    | `hsl(0, 0%, 3.9%)`      |
| `--color-fd-border`               | Default border color (with alpha for subtlety)  | `hsla(0, 0%, 60%, 0.2)` |
| `--color-fd-primary`              | Primary color (call to action, highlights)      | `hsl(0, 0%, 9%)`        |
| `--color-fd-primary-foreground`   | Foreground color on primary background          | `hsl(0, 0%, 98%)`       |
| `--color-fd-secondary`            | Secondary background color                      | `hsl(0, 0%, 96.1%)`     |
| `--color-fd-secondary-foreground` | Foreground on secondary background              | `hsl(0, 0%, 9%)`        |
| `--color-fd-accent`               | Accent background color (subtle UI highlights)  | `hsl(0, 0%, 94.1%)`     |
| `--color-fd-accent-foreground`    | Text/foreground on accent background            | `hsl(0, 0%, 9%)`        |
| `--color-fd-ring`                 | Ring color for focus states (outline highlight) | `hsl(0, 0%, 63.9%)`     |

To edit these variables you should use the `updateHolocronJsonc` tool if available and edit the `cssVariables.light` and `cssVariables.dark` objects. These 2 objects should have the custom css properties and keys should always start with `--`. Every time you let the user pick the color for a css variable always show 2 color picker for each variable, 1 for the dark and 1 for the light variant.

Here is an example of good CSS variables:

```json
{
    "cssVariables": {
        "light": {
            "--color-fd-background": "hsl(250, 20%, 92%)",
            "--color-fd-primary": "hsl(340, 40%, 48%)",
            "--color-fd-border": "hsl(240, 40%, 90%)",
            "--color-fd-accent": "hsl(250, 30%, 90%)",
            "--color-fd-accent-foreground": "hsl(250, 20%, 20%)",
            "--color-fd-muted": "hsl(240, 30%, 94%)",
            "--color-fd-muted-foreground": "hsl(240, 10%, 50%)",
            "--color-fd-foreground": "hsl(220, 20%, 30%)",
            "--color-fd-secondary": "hsl(250, 40%, 94%)",
            "--color-fd-secondary-foreground": "hsl(240, 40%, 10%)",
            "--color-fd-card": "hsl(250, 20%, 92%)",
            "--color-fd-card-foreground": "hsl(250, 20%, 20%)",
            "--color-fd-popover-foreground": "hsl(250, 40%, 20%)",
            "--color-fd-popover": "hsl(250, 40%, 96%)",
            "--color-fd-primary-foreground": "hsl(240, 80%, 20%)",
            "--color-fd-ring": "hsl(340, 40%, 48%)"
        },
        "dark": {
            "--color-fd-ring": "hsl(340, 100%, 90%)",
            "--color-fd-primary-foreground": "hsl(240, 40%, 4%)",
            "--color-fd-popover": "hsl(240, 20%, 5%)",
            "--color-fd-popover-foreground": "hsl(250, 20%, 90%)",
            "--color-fd-primary": "hsl(340, 100%, 90%)",
            "--color-fd-border": "hsl(220, 15%, 15%)",
            "--color-fd-background": "hsl(220, 15%, 6%)",
            "--color-fd-foreground": "hsl(220, 15%, 87%)",
            "--color-fd-muted": "hsl(220, 20%, 15%)",
            "--color-fd-muted-foreground": "hsl(220, 15%, 60%)",
            "--color-fd-accent": "hsl(250, 20%, 15%)",
            "--color-fd-secondary": "hsl(240, 20%, 15%)",
            "--color-fd-card-foreground": "hsl(240, 15%, 87%)",
            "--color-fd-card": "hsl(240, 20%, 5%)",
            "--color-fd-secondary-foreground": "hsl(250, 20%, 90%)",
            "--color-fd-accent-foreground": "hsl(340, 5%, 90%)"
        }
    }
}
```

There is also `--fd-layout-width` which changes the max width of the docs website content, use a really large number to make the website full width, this value should always end with px, for example `1400px`.
