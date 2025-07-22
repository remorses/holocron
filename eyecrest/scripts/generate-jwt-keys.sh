#\!/bin/bash

# Generate RSA private key (4096 bits for better security)
openssl genrsa -out private_key.pem 4096

# Extract public key from private key
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Display the keys
echo "=== Private Key (keep this secret\!) ==="
cat private_key.pem
echo -e "\n=== Public Key (use this in Cloudflare) ==="
cat public_key.pem

# Optional: Convert private key to PKCS8 format (some JWT libraries prefer this)
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private_key.pem -out private_key_pkcs8.pem

echo -e "\n=== Commands to use ==="
echo "1. Set public key in Cloudflare:"
echo "   wrangler secret put EYECREST_PUBLIC_KEY < scripts/public_key.pem"
echo ""
echo "2. Use private key in your auth service to sign JWTs"
echo "3. Keep private_key.pem secure and never commit it\!"
