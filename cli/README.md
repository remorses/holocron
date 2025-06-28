# Fumabase CLI

The Fumabase CLI is a command-line tool for managing and previewing your documentation sites on Fumabase.

## Installation

```bash
npm install -g fumabase
```

## Commands

### `fumabase login`

Authenticate with your Fumabase account to access your projects.

```bash
fumabase login
```

**Options:**
- `--no-browser` - Skip automatic browser opening and manually open the login URL

The login command will:
1. Display a 6-digit verification code
2. Open your browser to the Fumabase login page
3. Save your authentication credentials locally after successful login

### `fumabase init`

Initialize a new Fumabase documentation project in the current directory.

```bash
fumabase init
```

**Options:**
- `--name <name>` - Specify the name for your documentation site
- `--from-template` - Download starter template files to help you get started
- `--org <orgId>` - Specify which organization to create the site under (if you have multiple)

The init command will:
- Scan your directory for markdown files (`.md` and `.mdx`)
- Create a new site on Fumabase
- Generate a `fumabase.json` configuration file
- If no markdown files are found, it will offer to download a starter template

**Requirements:**
- You must be logged in (`fumabase login`)
- Your project should contain at least 2 markdown files (or use `--from-template`)

### `fumabase dev`

Start a local development server to preview your documentation site with live reload.

```bash
fumabase dev
```

**Options:**
- `--dir <dir>` - Specify the directory containing your `fumabase.json` file (defaults to current directory)

The dev command will:
- Watch for changes to your markdown files, `meta.json`, `fumabase.json`, and `styles.css`
- Open a preview of your site in the browser
- Automatically reload when you make changes
- Display a preview URL with live updates

**Requirements:**
- A valid `fumabase.json` file in your project root (created by `fumabase init`)

### `fumabase sync`

Manually sync your current Git branch with Fumabase to trigger a deployment.

```bash
fumabase sync
```

The sync command will:
- Detect your current Git branch
- Sync with your GitHub repository
- Trigger a deployment on Fumabase

**Requirements:**
- You must be in a Git repository with a GitHub remote
- A valid `fumabase.json` file with a `siteId`
- You must be logged in

## Getting Started

1. **Login to Fumabase:**
   ```bash
   fumabase login
   ```

2. **Initialize your project:**
   ```bash
   fumabase init --name "My Documentation"
   ```

3. **Start the development server:**
   ```bash
   fumabase dev
   ```

4. **Make changes to your markdown files and see them live!**

## File Structure

Fumabase recognizes the following files:
- `**/*.md` - Markdown documentation files
- `**/*.mdx` - MDX documentation files (Markdown with JSX)
- `meta.json` - Navigation and metadata configuration
- `fumabase.json` - Site configuration (auto-generated)
- `styles.css` - Custom styles for your documentation

## Deployment

Your documentation is automatically deployed when you push changes to GitHub. You can also manually trigger a deployment using:

```bash
fumabase sync
```

## Help

For more help and documentation, visit [fumabase.com](https://fumabase.com)

To report issues or provide feedback, visit: https://github.com/anthropics/claude-code/issues