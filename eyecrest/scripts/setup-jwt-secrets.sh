#!/bin/bash

# Script to set up JWT secrets in Doppler and Cloudflare
# Run this after generating keys with ./generate-jwt-keys.sh

set -e

# Check if key files exist
if [ ! -f "scripts/private_key.pem" ] || [ ! -f "scripts/public_key.pem" ]; then
    echo "Error: Key files not found in scripts/ directory"
    echo "Please run ./scripts/generate-jwt-keys.sh first"
    exit 1
fi

# Read keys into variables
PRIVATE_KEY=$(cat scripts/private_key.pem)
PUBLIC_KEY=$(cat scripts/public_key.pem)

echo "Setting up JWT secrets..."

# Set up Doppler secrets for all environments
echo "Setting Doppler secrets for dev..."
doppler secrets set --config dev EYECREST_PUBLIC_KEY="$PUBLIC_KEY"
doppler secrets set --config dev EYECREST_SECRET_KEY="$PRIVATE_KEY"

echo "Setting Doppler secrets for preview..."
doppler secrets set --config preview EYECREST_PUBLIC_KEY="$PUBLIC_KEY"
doppler secrets set --config preview EYECREST_SECRET_KEY="$PRIVATE_KEY"

echo "Setting Doppler secrets for production..."
doppler secrets set --config production EYECREST_PUBLIC_KEY="$PUBLIC_KEY"
doppler secrets set --config production EYECREST_SECRET_KEY="$PRIVATE_KEY"

# Set up Cloudflare secret (public key only)
echo "Setting Cloudflare secret..."
wrangler secret put EYECREST_PUBLIC_KEY < scripts/public_key.pem

echo "✅ All secrets have been set up successfully!"
echo ""
echo "Summary:"
echo "- EYECREST_PUBLIC_KEY set in Doppler (dev, preview, production)"
echo "- EYECREST_SECRET_KEY set in Doppler (dev, preview, production)"
echo "- EYECREST_PUBLIC_KEY set in Cloudflare Workers"
echo ""
echo "The private key (EYECREST_SECRET_KEY) should be used by your auth service to sign JWTs."
echo "The public key (EYECREST_PUBLIC_KEY) is used by the worker to verify JWTs."
echo ""
echo "To set up a test JWT token, run:"
echo "  vite-node scripts/generate-jwt-token.ts test-org-123"
echo "Then add it to Doppler:"
echo "  doppler secrets set --config dev EYECREST_EXAMPLE_JWT=\"<token>\""