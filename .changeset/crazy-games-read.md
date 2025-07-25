---
'website': patch
---

Add automatic GitHub repository creation when connecting GitHub to a site without an existing repository. When users click "Connect GitHub" on a site that doesn't have a repository configured, the system now automatically creates a new repository with starter documentation files, configures the site settings, and sets up the initial branch. The implementation uses cookie-based state management instead of query parameters for a cleaner flow. The new `api.github.connect-site` route handles the entire connection and repository creation process seamlessly.