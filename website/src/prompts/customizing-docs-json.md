# Fumadocs Documentation App - Styling & Customization Guide

This guide outlines the best practices for styling and customizing a documentation app based on the Fumadocs framework architecture.

## Core Architecture

### CSS Structure
- **Main stylesheet**: `app/global.css` - Uses Tailwind CSS v4 with Fumadocs UI presets
- **Import order**:
  1. `fumadocs-ui/css/neutral.css` (theme)
  2. `fumadocs-ui/css/preset.css` (base styles)
  3. Framework-specific CSS (twoslash, openapi)
- **CSS Variables**: Use `fd-` prefixed variables for consistent theming

### Layout System
- **Root Layout**: `app/layout.tsx` - Font configuration, metadata, theme colors
- **Docs Layout**: `app/docs/layout.tsx` - Sidebar, search, AI features
- **Home Layout**: `app/(home)/layout.tsx` - Navigation menus, footer
- **Page Layout**: `app/docs/[...slug]/page.tsx` - TOC, breadcrumbs, content area

## Theming & Colors

### Custom Color Variables
```css
:root {
  --headless-color: hsl(250, 80%, 54%);
  --ui-color: hsl(220, 91%, 54%);
}

.dark {
  --headless-color: hsl(250 100% 80%);
  --ui-color: hsl(217 92% 76%);
}
```

### Theme Provider Setup
- Use `RootProvider` from `fumadocs-ui/provider`
- Enable theme switching with `next-themes`
- Set viewport theme colors for mobile browsers

### CSS Variable Naming
- Use `fd-` prefix for all Fumadocs theme variables
- Examples: `fd-primary`, `fd-secondary`, `fd-background`, `fd-muted-foreground`

## Component Styling

### Button Variants
Create standardized button component with CVA (Class Variance Authority):
- **Variants**: `default`, `outline`, `secondary`, `ghost`, `link`
- **Sizes**: `xs`, `sm`, `default`, `lg`
- Use gradient backgrounds and shadow effects for primary buttons

### Custom Animations
Define reusable animations in CSS:
```css
@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100% - var(--gap))); }
}
```

## Navigation Customization

### Navigation Links Configuration
- Define `linkItems` array with icons, text, URL, and active states
- Support different types: `icon`, `menu`, `custom`
- Use Lucide React icons for consistency

### Logo Implementation
- Support multiple logo variants (full image + icon fallback)
- Use responsive classes for different screen sizes
- Example: `hidden w-20 md:w-24 [.uwu_&]:block`

### Sidebar Customization
Transform sidebar tabs with custom styling:
```tsx
transform(option, node) {
  const color = `var(--${meta.file.dirname}-color, var(--color-fd-foreground))`;
  return {
    ...option,
    icon: (
      <div className="rounded-lg p-1.5 shadow-lg ring-2" style={{ color }}>
        {node.icon}
      </div>
    ),
  };
}
```

## Search & Interactive Features

### Search Integration
- Use `LargeSearchToggle` for desktop
- Add AI search trigger with custom styling
- Position search elements with responsive classes

### TOC (Table of Contents) Styling
- Use `PageTOCPopover` for mobile
- Style with `variant="clerk"` for desktop TOC
- Conditional rendering based on TOC length

## Page Layout Patterns

### Content Structure
```tsx
<PageRoot toc={{ toc, single: false }}>
  <PageArticle className="max-md:pb-16">
    <PageBreadcrumb />
    <h1>{title}</h1>
    <p className="text-lg text-fd-muted-foreground">{description}</p>
    <div className="flex flex-row gap-2 items-center mb-8 border-b pb-6">
      {/* Action buttons */}
    </div>
    <div className="prose flex-1 text-fd-foreground/80">
      {/* Content */}
    </div>
  </PageArticle>
</PageRoot>
```

## Open Graph Images

### OG Image Generation
- Use Next.js `ImageResponse` API
- Standard size: 1200x630px
- Dark theme with gradient backgrounds
- Include brand logo and title/description

### Metadata Configuration
- Centralize metadata creation with `createMetadata()` utility
- Set consistent OpenGraph and Twitter card properties
- Generate dynamic OG images per page: `/og/[...slug]/image.png`

## MDX Component Integration

### Component Registration
- Use `getMDXComponents()` to register components
- Import framework components: Twoslash, OpenAPI, TypeTable
- Add custom components: Mermaid, Callout, Preview

### Link Enhancement
- Wrap internal links with hover cards
- Show page title and description on hover
- Use `source.getPageByHref()` for link resolution

## Footer & Navigation Menus

### Footer Structure
```tsx
<footer className="mt-auto border-t bg-fd-card py-12 text-fd-secondary-foreground">
  <div className="container flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    {/* Footer content */}
  </div>
</footer>
```

### Navigation Menus
- Use `NavbarMenu` components for dropdown menus
- Include preview images and descriptions
- Grid layout for menu items with icons

## Typography & Fonts

### Font Configuration
- Use `Geist` and `Geist_Mono` from next/font/google
- Set CSS variables: `--font-sans`, `--font-mono`
- Apply to html element with `className={geist.variable} ${mono.variable}`

## Client-Side Enhancements

### Interactive Components
- Use 'use client' directive for interactive features
- Implement copy-to-clipboard functionality
- Add loading states and feedback

### GitHub Integration
- Add GitHub edit links to pages
- Style with consistent button variants
- Use SVG icons for GitHub branding

## Build Commands

- **Development**: `pnpm dev`
- **Build**: `pnpm build`
- **Lint**: Check package.json for ESLint configuration
- **Type Check**: Uses TypeScript with strict configuration

## Best Practices

1. **Consistency**: Use `fd-` prefixed CSS variables throughout
2. **Responsiveness**: Apply mobile-first responsive classes
3. **Accessibility**: Include proper ARIA labels and semantic HTML
4. **Performance**: Use dynamic imports for client-only components
5. **Theming**: Support both light and dark modes
6. **Component Composition**: Leverage Fumadocs UI components as base
7. **Custom Styling**: Extend base components rather than replacing them
