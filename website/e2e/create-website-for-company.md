# E2E Test: Create a New Documentation Website for a Company

This guide explains how to test the creation of a new documentation website through the Holocron chat interface.

## Overview

This test covers the complete flow of creating a new documentation website for a company using the AI-powered chat interface.

## Prerequisites

- User must be authenticated (Google OAuth)
- Browser should be at the Holocron homepage

## Test Steps

### 1. Navigate to Dashboard

```javascript
// Click on Dashboard link
await page.getByRole('link', { name: 'Dashboard' }).first().click()

// Wait for OAuth redirect
await page.waitForURL(/accounts\.google\.com/)
```

### 2. Handle Google Authentication

```javascript
// Select existing Google account
await page.getByRole('link', { name: /.*@gmail\.com/ }).click()

// If permission screen appears, click Continue
await page.getByRole('button', { name: 'Continua' }).click()

// Wait for redirect back to Holocron
await page.waitForURL(/holocron\.com/, { timeout: 10000 })
```

### 3. Initiate Website Creation

```javascript
// Look for the chat interface options
// Click on "Create a docs website for my company"
await page.getByRole('button', { name: '⎿ [ ] Create a docs website for my company' }).click()

// Wait for form to render
await page.waitForSelector('input[name="companyName"]', { timeout: 5000 })
```

### 4. Fill Company Details Form

```javascript
// Fill company name
const companyNameInput = await page.getByRole('textbox', { name: 'Acme Corp' })
await companyNameInput.clear()
await companyNameInput.fill('YourCompanyName')

// Fill company website
// Use specific selector to avoid conflicts with other URL inputs
const websiteInput = await page.locator('input[name="companyWebsite"]')
await websiteInput.clear()
await websiteInput.fill('https://yourcompany.com')

// Radio button for existing docs is pre-selected to "No"
// No action needed unless you want to change it
```

### 5. Submit Form

```javascript
// Click Submit button
await page.getByRole('button', { name: 'Submit' }).click()

// Wait for AI processing
// The button will show "Loading..." while processing
await page.waitForSelector('button:has-text("Loading...")')
```

### 6. Monitor Creation Progress

```javascript
// The AI will show progress messages including:
// - "Planning MVP documentation site"
// - "Structuring documentation pages"
// - "Creating draft pages sequentially"

// Wait for completion - look for file creation indicators
await page.waitForSelector('text=/Create.*\.mdx/', { timeout: 30000 })
```

### 7. Verify Creation Success

```javascript
// Check for created pages - should see 6 files:
const expectedFiles = [
  'index.mdx',
  'getting-started.mdx',
  'installation.mdx',
  'usage.mdx',
  'api-reference.mdx',
  'faq.mdx'
]

// Verify each file appears in the output
for (const file of expectedFiles) {
  await expect(page.locator(`text=${file}`)).toBeVisible()
}

// Look for the generated site URL
const siteUrl = await page.locator('a[href*="holocron.com"]').textContent()
console.log('Created site URL:', siteUrl)

// Verify Save Changes button appears
await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible()
```

## Selectors Strategy

### Finding Elements

1. **Prefer Role-based selectors** for better accessibility testing:
   ```javascript
   page.getByRole('button', { name: 'Submit' })
   page.getByRole('textbox', { name: 'Company Name' })
   ```

2. **Use data attributes** when available:
   ```javascript
   page.locator('[data-testid="company-form"]')
   ```

3. **Fall back to specific attributes** for form inputs:
   ```javascript
   page.locator('input[name="companyName"]')
   ```

4. **Avoid generic selectors** like classes or IDs that might change

### Handling Multiple Matches

When multiple elements match, use:
- `.first()` or `.nth(0)` for the first match
- More specific selectors (combine role + name)
- Parent-child relationships

## Wait Strategies

1. **Wait for navigation**:
   ```javascript
   await page.waitForURL(/pattern/, { timeout: 10000 })
   ```

2. **Wait for elements**:
   ```javascript
   await page.waitForSelector('selector', { timeout: 5000 })
   ```

3. **Wait for network idle**:
   ```javascript
   await page.waitForLoadState('networkidle')
   ```

4. **Wait for text content**:
   ```javascript
   await page.waitForSelector('text=/pattern/i')
   ```

## Things to Remember

### Timeouts
- OAuth flow: 30 seconds
- Form rendering: 5 seconds
- AI processing: 30-60 seconds
- Use longer timeouts for AI operations

### State Management
- Forms may be disabled during processing
- Button text changes from "Submit" to "Loading..."
- AI shows progress through bullet points

### Verification Points
- Form submission disables inputs
- AI creates exactly 6 MDX files
- Site URL is generated and displayed
- Save Changes button appears after creation

### Common Issues

1. **OAuth Timeout**: Google auth can be slow, increase timeout
2. **Multiple Input Matches**: Use specific name attributes
3. **AI Processing Time**: Creation can take 30-60 seconds
4. **Dynamic Content**: Wait for specific text patterns

## Quick Test Checklist

- [ ] Dashboard navigation works
- [ ] OAuth flow completes
- [ ] Chat interface loads
- [ ] Form renders with all fields
- [ ] Form submission works
- [ ] AI creates 6 pages
- [ ] Site URL is generated
- [ ] Save Changes button appears

## Example Test Implementation

```javascript
test('Create new documentation site for company', async ({ page }) => {
  // Full test implementation
  await page.goto('https://holocron.com')
  
  // ... implement all steps above
  
  // Final assertion
  const siteUrl = await page.locator('a[href*="holocron.com"]').textContent()
  expect(siteUrl).toMatch(/[\w-]+\.holocron\.com/)
})
```