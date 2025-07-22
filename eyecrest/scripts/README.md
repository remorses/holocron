# JWT Authentication Scripts

This directory contains scripts for setting up JWT-based authentication for the Eyecrest API.

## Setup Instructions

1. **Generate JWT key pair** (if you don't have existing keys):
   ```bash
   ./scripts/generate-jwt-keys.sh
   ```
   This creates:
   - `private_key.pem` - Keep this secret! Used to sign JWTs
   - `public_key.pem` - Used by the worker to verify JWTs
   - `private_key_pkcs8.pem` - Alternative format for some JWT libraries

2. **Deploy secrets to Doppler and Cloudflare**:
   ```bash
   ./scripts/setup-jwt-secrets.sh
   ```
   This sets:
   - `EYECREST_PUBLIC_KEY` in Doppler (dev, preview, production)
   - `EYECREST_SECRET_KEY` in Doppler (dev, preview, production)
   - `EYECREST_PUBLIC_KEY` in Cloudflare Workers

## Testing

Generate a test JWT token:
```bash
node scripts/generate-jwt-token.js org-123
```

Test the API with the generated token:
```bash
# Upload files
curl -X PUT https://eyecrest.org/v1/datasets/my-dataset/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [{
      "filename": "test.md",
      "content": "# Test\nThis is a test file."
    }]
  }'

# Search
curl https://eyecrest.org/v1/datasets/my-dataset/search?query=test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Security Notes

- **NEVER commit private keys** to git (already in .gitignore)
- The private key (`EYECREST_SECRET_KEY`) should only be used by your auth service
- The public key (`EYECREST_PUBLIC_KEY`) is safe to share and is used for verification
- JWT tokens contain the `orgId` claim which determines dataset access
- Each organization can only access datasets they created

## Reusing Existing Keys

If you have existing RSA keys:

1. Copy them to the scripts directory:
   ```bash
   cp /path/to/existing/private_key.pem scripts/
   cp /path/to/existing/public_key.pem scripts/
   ```

2. Run the setup script:
   ```bash
   ./scripts/setup-jwt-secrets.sh
   ```

## JWT Token Structure

Tokens must include:
- `orgId`: Organization identifier (required)
- `exp`: Expiration time (optional but recommended)
- `iat`: Issued at time (optional)

Example JWT payload:
```json
{
  "orgId": "org-123",
  "exp": 1735689600,
  "iat": 1704067200
}
```