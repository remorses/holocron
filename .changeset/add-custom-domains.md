---
'@holocron.so/cli': minor
---

Add custom domain support for deployed websites.

Users can now point their own domains (e.g. `docs.mycompany.com`) at their Holocron-deployed docs site using Cloudflare SSL for SaaS. Custom domains require a Pro subscription.

**CLI commands:**

```bash
# Add a custom domain
holocron domain add --project <projectId> --hostname docs.mycompany.com

# List domains
holocron domain list --project <projectId>

# Check DNS/SSL status
holocron domain status --project <projectId>

# Remove a domain
holocron domain remove --project <projectId> --hostname docs.mycompany.com
```

**API routes:**

- `POST /api/v0/domains` — register a custom domain
- `GET /api/v0/domains/:projectId` — list domains
- `GET /api/v0/domains/:projectId/:domainId/status` — check status
- `DELETE /api/v0/domains/:projectId/:domainId` — remove domain

All custom domains CNAME to `acme.holocron.so`. SSL certificates are provisioned automatically by Cloudflare once DNS is configured. The KV mapping is only activated when both hostname and SSL validation are complete, preventing domain front-running.
