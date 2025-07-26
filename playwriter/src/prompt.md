Executes code in the server to control playwright.

You have access to a `page` object where you can call playwright methods on it to accomplish actions on the page.

You can also use `console.log` to examine the results of your actions.

You only have access to `page`, `context` and node.js globals. Do not try to import anything or setup handlers.

Your code should be stateless and do not depend on any state.

If you really want to attach listeners you should also detach them using a try finally block, to prevent memory leaks.

You can also create a new page via `context.newPage()` if you need to start fresh. You can then find that page by iteration over `context.pages()`:

```javascript
const page = context.pages().find((p) => p.url().includes('/some/path'))
```

## important rules

- NEVER call `page.waitForTimeout`, instead use `page.waitForSelector` or use a while loop that waits for a condition to be true.
- always call `new_page` at the start of a conversation. later this page will be passed to the `execute` tool.
- In some rare cases you can also skip `new_page` tool, if the user asks you to instead use an existing page in the browser. You can set a page as default using `state.page = page`, `execute` calls will be passed this page in the scope later on.
- if running in localhost and some elements are difficult to target with locators you can update the source code to add `data-testid` attributes to elements you want to target. This will make running tests much easier later on. Also update the source markdown documents your are following if you do so.
- after every action call the tool `accessibility_snapshot` to get the page structure and understand what elements are available on the page
- after form submissions use `page.waitForLoadState('networkidle')` to ensure the page is fully loaded before proceeding
- sometimes when in localhost and using Vite you can encounter issues in the first page load, where a module is not found, because of updated optimization of the node_modules. In these cases you can try reloading the page 2 times and see if the issue resolves itself.
- for Google and GitHub login always use the Google account you have access to, already signed in
- if you are following a markdown document describing the steps to follow to test the website, update this document if you encounter unexpected behavior or if you can add information that would make the test faster, for example telling how to wait for actions that trigger loading states or to use a different timeout for specific actions.

## getting outputs of code execution

You can use `console.log` to print values you want to see in the tool call result

## using page.evaluate

you can execute client side JavaScript code using `page.evaluate()`

When executing code with `page.evaluate()`, return values directly from the evaluate function. Use `console.log()` outside of evaluate to display results:

```javascript
// Get data from the page by returning it
const title = await page.evaluate(() => document.title)
console.log('Page title:', title)

// Return multiple values as an object
const pageInfo = await page.evaluate(() => ({
    url: window.location.href,
    buttonCount: document.querySelectorAll('button').length,
    readyState: document.readyState,
}))
console.log('Page URL:', pageInfo.url)
console.log('Number of buttons:', pageInfo.buttonCount)
console.log('Page ready state:', pageInfo.readyState)
```

## Finding Elements on the Page

you can use the tool accessibility_snapshot to get the page accessibility snapshot tree, which provides a structured view of the page's elements, including their roles and names. This is useful for understanding the page structure and finding elements to interact with.

Example accessibility snapshot result:

```md
- generic [active] [ref=e1]:
    - generic [ref=e2]:
        - banner [ref=e3]:
            - generic [ref=e5]:
                - link "shadcn/ui" [ref=e6] [cursor=pointer]:
                    - /url: /
                    - img
                    - generic [ref=e11] [cursor=pointer]: shadcn/ui
                - navigation [ref=e12]:
                    - link "Docs" [ref=e13] [cursor=pointer]:
                        - /url: /docs/installation
                    - link "Components" [ref=e14] [cursor=pointer]:
                        - /url: /docs/components
                    - link "Blocks" [ref=e15] [cursor=pointer]:
                        - /url: /blocks
                    - link "Charts" [ref=e16] [cursor=pointer]:
                        - /url: /charts/area
                    - link "Themes" [ref=e17] [cursor=pointer]:
                        - /url: /themes
                    - link "Colors" [ref=e18] [cursor=pointer]:
                        - /url: /colors
```

Then you can use `page.locator(`aria-ref=${ref}`).describe(element);` to get an element with a specific `ref` and interact with it.

For example:

```javascript
const componentsLink = page
    // Exact target element reference from the page snapshot
    .locator('aria-ref=e14')
    // Human-readable element description used to obtain permission to interact with the element
    .describe('Components link')

componentsLink.click()
console.log('Clicked on Components link')
```

This approach is the preferred way to find elements on the page, as it allows you to use the structured information from the accessibility snapshot to interact with elements reliably.

### Using Snapshot Information to Interact with Elements

After analyzing the accessibility snapshot, use the role and name information to interact with elements:

```javascript
// First, get the snapshot to understand the page structure
const snapshot = await page.accessibility.snapshot()
console.log('Page structure:', JSON.stringify(snapshot, null, 2))

// Then use the information from the snapshot to click elements
// For example, if snapshot shows: { "role": "button", "name": "Sign In" }
await page.getByRole('button', { name: 'Sign In' }).click()

// For a link with { "role": "link", "name": "About" }
await page.getByRole('link', { name: 'About' }).click()

// For a textbox with { "role": "textbox", "name": "Email" }
await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com')

// For a heading with { "role": "heading", "name": "Welcome to Example.com" }
const headingText = await page
    .getByRole('heading', { name: 'Welcome to Example.com' })
    .textContent()
console.log('Heading text:', headingText)
```

### Complete Example: Find and Click Elements

```javascript
await page.getByRole('button', { name: 'Submit Form' }).click()
console.log('Clicked submit button')

await page.waitForLoadState('networkidle')
console.log('Form submitted successfully')
```

## Core Concepts

### Page and Context

In Playwright, automation happens through a `page` object (representing a browser tab) and `context` (representing a browser session with cookies, storage, etc.).

```javascript
// Assuming you have page and context already available
const page = await context.newPage()
```

### Element Selection

Playwright uses locators to find elements. The examples below show various selection methods:

```javascript
// By role (recommended)
await page.getByRole('button', { name: 'Submit' })

// By text
await page.getByText('Welcome')

// By placeholder
await page.getByPlaceholder('Enter email')

// By label
await page.getByLabel('Username')

// By test id
await page.getByTestId('submit-button')

// By CSS selector
await page.locator('.my-class')

// By XPath
await page.locator('//div[@class="content"]')
```

## Navigation

### Navigate to URL

```javascript
await page.goto('https://example.com')
// Wait for network idle (no requests for 500ms)
await page.goto('https://example.com', { waitUntil: 'networkidle' })
```

### Navigate Back/Forward

```javascript
// Go back to previous page
await page.goBack()

// Go forward to next page
await page.goForward()
```

## Screenshots

### Take Screenshot

```javascript
// Screenshot of viewport
await page.screenshot({ path: 'screenshot.png' })

// Full page screenshot
await page.screenshot({ path: 'fullpage.png', fullPage: true })

// Screenshot of specific element
const element = await page.getByRole('button', { name: 'Submit' })
await element.screenshot({ path: 'button.png' })

// Screenshot with custom dimensions
await page.setViewportSize({ width: 1280, height: 720 })
await page.screenshot({ path: 'custom-size.png' })
```

## Mouse Interactions

### Click Elements

```javascript
// Click by role
await page.getByRole('button', { name: 'Submit' }).click()

// Click at coordinates
await page.mouse.click(100, 200)

// Double click
await page.getByText('Double click me').dblclick()

// Right click
await page.getByText('Right click me').click({ button: 'right' })

// Click with modifiers
await page.getByText('Ctrl click me').click({ modifiers: ['Control'] })
```

### Hover

```javascript
// Hover over element
await page.getByText('Hover me').hover()

// Hover at coordinates
await page.mouse.move(100, 200)
```

## Keyboard Input

### Type Text

```javascript
// Type into input field
await page.getByLabel('Email').fill('user@example.com')

// Type character by character (simulates real typing)
await page.getByLabel('Email').type('user@example.com', { delay: 100 })

// Clear and type
await page.getByLabel('Email').clear()
await page.getByLabel('Email').fill('new@example.com')
```

### Press Keys

```javascript
// Press single key
await page.keyboard.press('Enter')

// Press key combination
await page.keyboard.press('Control+A')

// Press sequence of keys
await page.keyboard.press('Tab')
await page.keyboard.press('Tab')
await page.keyboard.press('Space')

// Common key shortcuts
await page.keyboard.press('Control+C') // Copy
await page.keyboard.press('Control+V') // Paste
await page.keyboard.press('Control+Z') // Undo
```

## Form Interactions

### Select Dropdown Options

```javascript
// Select by value
await page.selectOption('select#country', 'us')

// Select by label
await page.selectOption('select#country', { label: 'United States' })

// Select multiple options
await page.selectOption('select#colors', ['red', 'blue', 'green'])

// Get selected option
const selectedValue = await page.$eval('select#country', (el) => el.value)
```

### Checkboxes and Radio Buttons

```javascript
// Check checkbox
await page.getByLabel('I agree').check()

// Uncheck checkbox
await page.getByLabel('Subscribe').uncheck()

// Check if checked
const isChecked = await page.getByLabel('I agree').isChecked()

// Select radio button
await page.getByLabel('Option A').check()
```

## JavaScript Evaluation

### Execute JavaScript in Page Context

```javascript
// Evaluate simple expression
const result = await page.evaluate(() => 2 + 2)

// Access page variables
const pageTitle = await page.evaluate(() => document.title)

// Modify page
await page.evaluate(() => {
    document.body.style.backgroundColor = 'red'
})

// Pass arguments to page context
const sum = await page.evaluate(([a, b]) => a + b, [5, 3])

// Work with elements
const elementText = await page.evaluate(
    (el) => el.textContent,
    await page.getByRole('heading'),
)
```

### Execute JavaScript on Element

```javascript
// Get element property
const href = await page.getByRole('link').evaluate((el) => el.href)

// Modify element
await page.getByRole('button').evaluate((el) => {
    el.style.backgroundColor = 'green'
    el.disabled = true
})

// Scroll element into view
await page.getByText('Section').evaluate((el) => el.scrollIntoView())
```

## File Handling

### File Upload

```javascript
// Upload single file
await page.getByLabel('Upload file').setInputFiles('/path/to/file.pdf')

// Upload multiple files
await page
    .getByLabel('Upload files')
    .setInputFiles(['/path/to/file1.pdf', '/path/to/file2.pdf'])

// Clear file input
await page.getByLabel('Upload file').setInputFiles([])

// For file inputs, use setInputFiles directly on the input element
// Find the file input element (often hidden)
await page.locator('input[type="file"]').setInputFiles('/path/to/file.pdf')
```

## Network Monitoring

### Check Network Activity

```javascript
// Wait for a specific request to complete and get its response
const response = await page.waitForResponse(
    (response) =>
        response.url().includes('/api/user') && response.status() === 200,
)

// Get response data
const responseBody = await response.json()
console.log('API response:', responseBody)

// Wait for specific request
const request = await page.waitForRequest('**/api/data')
console.log('Request URL:', request.url())
console.log('Request method:', request.method())

// Get all resources loaded by the page
const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => ({
        name: r.name,
        duration: r.duration,
        size: r.transferSize,
    })),
)
console.log('Page resources:', resources)
```

## Console Messages

### Capture Console Output

```javascript
// Console messages are automatically captured by the MCP implementation
// Use the console_logs tool to retrieve them

// To trigger console messages from the page:
await page.evaluate(() => {
    console.log('This message will be captured')
    console.error('This error will be captured')
    console.warn('This warning will be captured')
})

// Then use the console_logs MCP tool to retrieve all captured messages
// The tool provides filtering by type and pagination
```

## Waiting

### Wait for Conditions

```javascript
// Wait for element to appear
await page.waitForSelector('.success-message')

// Wait for element to disappear
await page.waitForSelector('.loading', { state: 'hidden' })

await page.waitForURL(/github\.com.*\/pull/)
await page.waitForURL(/\/new-org/)

// Wait for text to appear
await page.waitForFunction(
    (text) => document.body.textContent.includes(text),
    'Success!',
)

// Wait for navigation
await page.waitForURL('**/success')

// Wait for page load
await page.waitForLoadState('networkidle')

// Wait for specific condition
await page.waitForFunction(
    (text) => document.querySelector('.status')?.textContent === text,
    'Ready',
)
```

### Wait for Text to Appear or Disappear

```javascript
// Wait for specific text to appear on the page
await page.getByText('Loading complete').first().waitFor({ state: 'visible' })
console.log('Loading complete text is now visible')

// Wait for text to disappear from the page
await page.getByText('Loading...').first().waitFor({ state: 'hidden' })
console.log('Loading text has disappeared')

// Wait for multiple conditions sequentially
// First wait for loading to disappear, then wait for success message
await page.getByText('Processing...').first().waitFor({ state: 'hidden' })
await page.getByText('Success!').first().waitFor({ state: 'visible' })
console.log('Processing finished and success message appeared')

// Example: Wait for error message to disappear before proceeding
await page
    .getByText('Error: Please try again')
    .first()
    .waitFor({ state: 'hidden' })
await page.getByRole('button', { name: 'Submit' }).click()

// Example: Wait for confirmation text after form submission
await page.getByRole('button', { name: 'Save' }).click()
await page
    .getByText('Your changes have been saved')
    .first()
    .waitFor({ state: 'visible' })
console.log('Save confirmed')

// Example: Wait for dynamic content to load
await page.getByRole('button', { name: 'Load More' }).click()
await page
    .getByText('Loading more items...')
    .first()
    .waitFor({ state: 'visible' })
await page
    .getByText('Loading more items...')
    .first()
    .waitFor({ state: 'hidden' })
console.log('Additional items loaded')
```

### Work with Frames

```javascript
// Get frame by name
const frame = page.frame('frameName')

// Get frame by URL
const frame = page.frame({ url: /frame\.html/ })

// Interact with frame content
await frame.getByText('In Frame').click()

// Get all frames
const frames = page.frames()
```

## Best Practices

### Reliable Selectors

```javascript
// Prefer user-facing attributes
await page.getByRole('button', { name: 'Submit' })
await page.getByLabel('Email')
await page.getByPlaceholder('Search...')
await page.getByText('Welcome')

// Use test IDs for complex cases
await page.getByTestId('complex-component')

// Avoid brittle selectors
// Bad: await page.locator('.btn-3842');
// Good: await page.getByRole('button', { name: 'Submit' });
```
