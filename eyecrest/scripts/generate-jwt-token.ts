#!/usr/bin/env vite-node

/**
 * Script to generate JWT tokens for testing
 * Run with: vite-node scripts/generate-jwt-token.ts <orgId>
 */

import { SignJWT, importPKCS8 } from 'jose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateToken(orgId: string): Promise<string> {
  // Read private key
  const privateKeyPath = path.join(__dirname, 'private_key.pem');
  const privateKeyPEM = fs.readFileSync(privateKeyPath, 'utf8');
  
  // Import the private key
  const privateKey = await importPKCS8(privateKeyPEM, 'RS256');
  
  // Create JWT with orgId claim
  const jwt = await new SignJWT({ 
    orgId: orgId,
    // Add other claims as needed
    // sub: 'user-id',
    // email: 'user@example.com'
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('300y') // Expires in 300 years
    .sign(privateKey);
  
  return jwt;
}

// Main
(async () => {
  const orgId = process.argv[2];
  
  if (!orgId) {
    console.error('Usage: vite-node scripts/generate-jwt-token.ts <orgId>');
    console.error('Example: vite-node scripts/generate-jwt-token.ts org-123');
    process.exit(1);
  }
  
  try {
    const token = await generateToken(orgId);
    console.log('\n✅ JWT Token generated successfully!\n');
    console.log('Token:', token);
    console.log('\nUse this token in the Authorization header:');
    console.log(`Authorization: Bearer ${token}`);
    console.log('\nExample curl command:');
    console.log(`curl -H "Authorization: Bearer ${token}" https://eyecrest.org/v1/datasets/my-dataset/files`);
  } catch (error) {
    console.error('Error generating token:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();