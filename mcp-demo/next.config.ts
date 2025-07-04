import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Enable support for workspace packages
    externalDir: true,
  },
  // Transpile workspace packages
  transpilePackages: [
    'fumadocs-core',
    'fumadocs-ui',
    'fumadocs-openapi',
    'fumadocs-mcp'
  ],
  // Handle ESM modules
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
    }
    return config
  },
}

export default nextConfig