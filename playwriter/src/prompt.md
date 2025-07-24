You have access to a `page` object where you can call playwright methods on it to accomplish actions on the page.

You can also use `console.log` to examine the results of your actions.

You only have access to `page`, `context` and node.js globals. Do not try to import anything or setup handlers.

Your code should be stateless and do not depend on any state.

If you really want to attach listeners you should also detach them using a try finally block, to prevent memory leaks.

You can also create a new page via `context.newPage()` if you need to start fresh. You can then find that page by iteration over `context.pages()`:

```javascript
const page = context
  .pages()
  .find(p => p.url().includes('/some/path'));
```

## Getting Results from Code Execution

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

### Using Accessibility Snapshot

The most reliable way to find elements is to first get an accessibility snapshot of the page. This provides a structured view of all interactive elements with their roles, names, and relationships.

```javascript
// Get accessibility snapshot
const snapshot = await page.accessibility.snapshot()
console.log(JSON.stringify(snapshot, null, 2))
```

Example accessibility snapshot result:

```json
{
    "role": "WebArea",
    "name": "Example Page",
    "children": [
        {
            "role": "heading",
            "name": "Welcome to Example.com",
            "level": 1
        },
        {
            "role": "navigation",
            "name": "Main navigation",
            "children": [
                {
                    "role": "link",
                    "name": "Home"
                },
                {
                    "role": "link",
                    "name": "About"
                },
                {
                    "role": "link",
                    "name": "Contact"
                }
            ]
        },
        {
            "role": "main",
            "children": [
                {
                    "role": "form",
                    "name": "Login Form",
                    "children": [
                        {
                            "role": "textbox",
                            "name": "Email",
                            "value": "",
                            "required": true
                        },
                        {
                            "role": "textbox",
                            "name": "Password",
                            "value": "",
                            "required": true,
                            "password": true
                        },
                        {
                            "role": "button",
                            "name": "Sign In",
                            "disabled": false
                        }
                    ]
                }
            ]
        }
    ]
}
```

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
// Step 1: Get snapshot to see what's on the page
const snapshot = await page.accessibility.snapshot()
console.log('Available elements:', JSON.stringify(snapshot, null, 2))

// Step 2: Find button in snapshot output
// Snapshot might show: { "role": "button", "name": "Submit Form" }

// Step 3: Click the button using the role and name
await page.getByRole('button', { name: 'Submit Form' }).click()
console.log('Clicked submit button')

// Step 4: Verify the action completed
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

## Page Snapshot

### Get Page Content and Structure

```javascript
// Get page title
const title = await page.title()

// Get page URL
const url = page.url()

// Get all text content
const textContent = await page.textContent('body')

// Get page HTML
const html = await page.content()

// Get accessibility tree (useful for understanding page structure)
const snapshot = await page.accessibility.snapshot()
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

### Drag and Drop

```javascript
// Drag from one element to another
await page.dragAndDrop('#source', '#target')

// Drag with mouse coordinates
await page.mouse.move(100, 100)
await page.mouse.down()
await page.mouse.move(200, 200)
await page.mouse.up()
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

## Dialogs

### Handle Alerts, Confirms, and Prompts

```javascript
// By default, Playwright auto-dismisses all dialogs (alerts, confirms, prompts)
// This means you can click buttons that trigger dialogs without any special handling

// Example: Click button that shows alert (auto-dismissed)
await page.getByRole('button', { name: 'Show Alert' }).click()

// If you need to accept a confirm dialog or provide input to a prompt,
// you must handle it in your MCP implementation with proper event listeners
// set up during the connect phase

// For stateless execution, if you need the dialog message:
// You would need to capture it through the console logs tool
// since browsers often log dialog messages to the console
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

### File Download

```javascript
// For downloads in MCP context, trigger the download and check if it started
// Note: Actually saving files would require the separate file handling tool

// Click download button
await page.getByText('Download').click()

// Check if download started by monitoring network
const downloadStarted = await page.evaluate(() => {
    // Check if any anchor has download attribute or if navigation occurred
    return document.querySelector('a[download]') !== null
})

console.log('Download triggered:', downloadStarted)
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

// Wait for text to appear
await page.waitForFunction(
    (text) => document.body.textContent.includes(text),
    'Success!',
)

// Wait for navigation
await page.waitForURL('**/success')

// Wait for specific time
await page.waitForTimeout(2000) // 2 seconds

// Wait for page load
await page.waitForLoadState('networkidle')
```

## Tab Management

## Browser Management

### Resize Browser Window

```javascript
// Set viewport size
await page.setViewportSize({ width: 1920, height: 1080 })

// Get viewport size
const viewport = page.viewportSize()
console.log(`Width: ${viewport.width}, Height: ${viewport.height}`)
```


## Advanced Patterns

### Handle Dynamic Content

```javascript

// Wait for specific text
await page.waitForFunction(
    (text) => document.querySelector('.status')?.textContent === text,
    'Ready',
)

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

### Wait Strategies

```javascript
// Wait for element before interacting
await page.getByRole('button', { name: 'Submit' }).waitFor()
await page.getByRole('button', { name: 'Submit' }).click()

// NEVER THIS
await page.waitForTimeout(500)

// Wait for network
await page.waitForLoadState('networkidle')
```
